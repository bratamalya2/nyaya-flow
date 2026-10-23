import { withActor } from "@/lib/db";
import type { Workspace } from "@/lib/workspace";

type DateValue = Date | string | null;
const iso = (value: DateValue) => value ? new Date(value).toISOString() : null;

export const filingStates = ["draft", "review_required", "approved", "exported", "blocked"] as const;
export const contractStates = ["draft", "review_required", "approved", "executed", "blocked"] as const;
export type FilingState = typeof filingStates[number];
export type ContractState = typeof contractStates[number];
export const isFilingEnabled = () => process.env.FILING_BETA_ENABLED === "true";
export const isContractsEnabled = () => process.env.CONTRACTS_BETA_ENABLED === "true";

export function canTransitionFiling(from: FilingState, to: FilingState) {
  return ({ draft: ["review_required", "blocked"], review_required: ["approved", "blocked", "draft"], approved: ["exported", "blocked"], exported: [], blocked: ["draft"] } as Record<FilingState, FilingState[]>)[from].includes(to);
}
export function canTransitionContract(from: ContractState, to: ContractState) {
  return ({ draft: ["review_required", "blocked"], review_required: ["approved", "blocked", "draft"], approved: ["executed", "blocked"], executed: [], blocked: ["draft"] } as Record<ContractState, ContractState[]>)[from].includes(to);
}
export function isReadyDocument(version: { status: string; pages?: number }) { return version.status === "ready" && (version.pages ?? 1) > 0; }

export type FilingRulePack = { id: string; forum: string; name: string; version: string; sourceReference: string; sourceState: string; effectiveFrom: string | null; effectiveUntil: string | null; enabled: boolean; isFixture: boolean };
export type FilingFinding = { id: string; ruleKey: string; ruleVersion: string; outcome: "pass" | "warning" | "fail" | "manual_review"; evidence: string; sourceReference: string; reviewState: string };
export type FilingBundle = { id: string; matterId: string; matterTitle: string; title: string; reviewState: FilingState; rulePack: Pick<FilingRulePack, "name" | "version" | "sourceReference" | "isFixture">; entries: { id: string; label: string; hash: string; folioStart: number | null; folioEnd: number | null }[]; findings: FilingFinding[]; approvedAt: string | null };
export type ContractTemplate = { id: string; title: string; version: string; sourceReference: string; sourceState: string; status: string; isFixture: boolean };
export type ClauseReview = { id: string; clauseLabel: string; sourceLocator: string; finding: "no_issue" | "review_required" | "high_risk"; note: string; reviewState: string; assignedTo: string | null };
export type ContractRecord = { id: string; matterId: string | null; matterTitle: string | null; title: string; counterparty: string; status: ContractState; templateTitle: string | null; isFixture: boolean; clauses: ClauseReview[]; execution: { status: string; method: string; referenceNote: string | null } | null };

export async function listFilingRulePacks(workspace: Workspace): Promise<FilingRulePack[]> {
  const result = await withActor(workspace.userId, (client) => client.query<{
    id: string; forum: string; name: string; version: string; source_reference: string; source_state: string; effective_from: DateValue; effective_until: DateValue; enabled: boolean; is_fixture: boolean;
  }>("select id,forum,name,version,source_reference,source_state,effective_from,effective_until,enabled,is_fixture from filing_rule_packs where organization_id=$1 and enabled order by forum,name,version", [workspace.organizationId]));
  return result.rows.map((row) => ({ id: row.id, forum: row.forum, name: row.name, version: row.version, sourceReference: row.source_reference, sourceState: row.source_state, effectiveFrom: iso(row.effective_from), effectiveUntil: iso(row.effective_until), enabled: row.enabled, isFixture: row.is_fixture }));
}

export async function listFilingBundles(workspace: Workspace): Promise<FilingBundle[]> {
  const result = await withActor(workspace.userId, (client) => client.query<{
    id: string; matter_id: string; matter_title: string; title: string; review_state: FilingState; approved_at: DateValue; pack_name: string; pack_version: string; source_reference: string; is_fixture: boolean;
  }>(`select b.id,b.matter_id,m.title matter_title,b.title,b.review_state,b.approved_at,p.name pack_name,p.version pack_version,p.source_reference,p.is_fixture
      from filing_bundles b join matters m on m.id=b.matter_id join filing_rule_packs p on p.id=b.rule_pack_id where b.organization_id=$1 order by b.updated_at desc`, [workspace.organizationId]));
  return Promise.all(result.rows.map(async (row) => {
    const details = await withActor(workspace.userId, async (client) => Promise.all([
      client.query<{ id: string; label: string; document_sha256: string; folio_start: number | null; folio_end: number | null }>("select id,label,document_sha256,folio_start,folio_end from filing_bundle_entries where bundle_id=$1 order by sort_order", [row.id]),
      client.query<{ id: string; rule_key: string; rule_version: string; outcome: FilingFinding["outcome"]; evidence: string; source_reference: string; review_state: string }>("select id,rule_key,rule_version,outcome,evidence,source_reference,review_state from filing_findings where bundle_id=$1 order by created_at", [row.id]),
    ]));
    return { id: row.id, matterId: row.matter_id, matterTitle: row.matter_title, title: row.title, reviewState: row.review_state, approvedAt: iso(row.approved_at), rulePack: { name: row.pack_name, version: row.pack_version, sourceReference: row.source_reference, isFixture: row.is_fixture }, entries: details[0].rows.map((entry) => ({ id: entry.id, label: entry.label, hash: entry.document_sha256, folioStart: entry.folio_start, folioEnd: entry.folio_end })), findings: details[1].rows.map((finding) => ({ id: finding.id, ruleKey: finding.rule_key, ruleVersion: finding.rule_version, outcome: finding.outcome, evidence: finding.evidence, sourceReference: finding.source_reference, reviewState: finding.review_state })) };
  }));
}

export async function listContractTemplates(workspace: Workspace): Promise<ContractTemplate[]> {
  const result = await withActor(workspace.userId, (client) => client.query<{ id: string; title: string; version: string; source_reference: string; source_state: string; status: string; is_fixture: boolean }>("select id,title,version,source_reference,source_state,status,is_fixture from contract_templates where organization_id=$1 and status='approved' order by title", [workspace.organizationId]));
  return result.rows.map((row) => ({ id: row.id, title: row.title, version: row.version, sourceReference: row.source_reference, sourceState: row.source_state, status: row.status, isFixture: row.is_fixture }));
}

export async function listContracts(workspace: Workspace): Promise<ContractRecord[]> {
  const result = await withActor(workspace.userId, (client) => client.query<{ id: string; matter_id: string | null; matter_title: string | null; title: string; counterparty: string; status: ContractState; template_snapshot: { title?: string; isFixture?: boolean } }>(`select c.id,c.matter_id,m.title matter_title,c.title,c.counterparty,c.status,c.template_snapshot from contracts c left join matters m on m.id=c.matter_id where c.organization_id=$1 order by c.updated_at desc`, [workspace.organizationId]));
  return Promise.all(result.rows.map(async (row) => {
    const details = await withActor(workspace.userId, async (client) => Promise.all([
      client.query<{ id: string; clause_label: string; source_locator: string; finding: ClauseReview["finding"]; note: string; review_state: string; assigned_to: string | null }>("select id,clause_label,source_locator,finding,note,review_state,assigned_to from contract_clause_reviews where contract_id=$1 order by created_at", [row.id]),
      client.query<{ status: string; method: string; reference_note: string | null }>("select status,method,reference_note from contract_executions where contract_id=$1", [row.id]),
    ]));
    return { id: row.id, matterId: row.matter_id, matterTitle: row.matter_title, title: row.title, counterparty: row.counterparty, status: row.status, templateTitle: row.template_snapshot.title ?? null, isFixture: row.template_snapshot.isFixture === true, clauses: details[0].rows.map((clause) => ({ id: clause.id, clauseLabel: clause.clause_label, sourceLocator: clause.source_locator, finding: clause.finding, note: clause.note, reviewState: clause.review_state, assignedTo: clause.assigned_to })), execution: details[1].rows[0] ? { status: details[1].rows[0].status, method: details[1].rows[0].method, referenceNote: details[1].rows[0].reference_note } : null };
  }));
}
