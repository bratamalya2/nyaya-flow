import type { PoolClient } from "pg";
import { withActor } from "@/lib/db";
import { isDemoMode } from "@/lib/runtime";
import * as demo from "@/lib/sample-data";
import type {
  AppRole, AuditEvent, AuditVerification, ConsentRecord, DataRequest, Hearing, Invitation, LegalHold, Matter, MatterDetail,
  MatterGrant, Member, OcrPage, OrganizationPolicies, Party, Person, RetentionClass, Revision, SearchHit, Task, VaultDocument,
} from "@/lib/types";
import type { Workspace } from "@/lib/workspace";

type Timestamp = Date | string;
const iso = (value: Timestamp) => new Date(value).toISOString();
const isoOrUndefined = (value: Timestamp | null) => (value ? iso(value) : undefined);
export const initialsOf = (name: string) => name.replace(/^Adv\.\s*/i, "").split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
const person = (id: string, name: string, role: AppRole = "advocate"): Person => ({ id, name, initials: initialsOf(name), role });

const run = <T>(workspace: Workspace, operation: (client: PoolClient) => Promise<T>) => withActor(workspace.userId, operation);

// ---------------------------------------------------------------------------------------------
// Matters
// ---------------------------------------------------------------------------------------------
type MatterRow = {
  id: string; title: string; reference: string; cnr: string | null; forum: string; court_room: string | null; stage: string;
  status: Matter["status"]; source_state: Matter["sourceState"]; client_name: string; restricted: boolean; updated_at: Timestamp;
  lead_id: string | null; lead_name: string; lead_role: AppRole; next_listing_at: Timestamp | null;
};
const MATTER_SELECT = `
  select m.id, m.title, m.reference, m.cnr, m.forum, m.court_room, m.stage, m.status, m.source_state, m.client_name, m.restricted, m.updated_at,
         m.lead_id, coalesce(u.display_name, 'Unassigned') lead_name, coalesce(ms.role, 'advocate') lead_role,
         (select min(h.starts_at) from hearings h where h.matter_id = m.id and h.starts_at >= now() and h.status in ('proposed','confirmed')) next_listing_at
  from matters m
  left join app_users u on u.id = m.lead_id
  left join memberships ms on ms.user_id = m.lead_id and ms.organization_id = m.organization_id`;
const toMatter = (row: MatterRow): Matter => ({
  id: row.id, title: row.title, reference: row.reference, cnr: row.cnr || undefined, forum: row.forum, courtRoom: row.court_room || undefined,
  stage: row.stage, status: row.status, sourceState: row.source_state, updatedAt: iso(row.updated_at), client: row.client_name,
  restricted: row.restricted, lead: person(row.lead_id ?? "", row.lead_name, row.lead_role), nextListingAt: isoOrUndefined(row.next_listing_at), tags: [],
});

export async function listMatters(workspace: Workspace): Promise<Matter[]> {
  if (isDemoMode()) return demo.matters;
  const result = await run(workspace, (client) => client.query<MatterRow>(`${MATTER_SELECT} where m.organization_id = $1 order by m.updated_at desc`, [workspace.organizationId]));
  return result.rows.map(toMatter);
}

export async function findDuplicateMatters(workspace: Workspace, input: { reference?: string; cnr?: string; forum?: string }): Promise<Matter[]> {
  if (isDemoMode()) return demo.matters.filter((matter) => (input.cnr && matter.cnr === input.cnr) || (input.reference && matter.reference.toLowerCase() === input.reference.toLowerCase()));
  const result = await run(workspace, (client) => client.query<MatterRow>(
    `${MATTER_SELECT} where m.organization_id = $1 and ((($2::text is not null) and m.cnr = $2) or (($3::text is not null) and lower(m.reference) = lower($3) and ($4::text is null or m.forum = $4)))
     order by m.updated_at desc limit 5`,
    [workspace.organizationId, input.cnr ?? null, input.reference ?? null, input.forum ?? null],
  ));
  return result.rows.map(toMatter);
}

// ---------------------------------------------------------------------------------------------
// Hearings, tasks, conflicts
// ---------------------------------------------------------------------------------------------
type HearingRow = {
  id: string; matter_id: string; title: string; reference: string; forum: string; court_room: string | null; starts_at: Timestamp; ends_at: Timestamp;
  item_number: number | null; advocate_id: string; advocate_name: string; status: Hearing["status"]; source_state: Hearing["sourceState"]; notes: string | null; updated_at: Timestamp;
};
const HEARING_SELECT = `
  select h.id, h.matter_id, m.title, m.reference, h.forum, h.court_room, h.starts_at, h.ends_at, h.item_number, h.advocate_id,
         u.display_name advocate_name, h.status, h.source_state, h.notes, h.updated_at
  from hearings h join matters m on m.id = h.matter_id join app_users u on u.id = h.advocate_id`;
const toHearing = (row: HearingRow): Hearing => ({
  id: row.id, matterId: row.matter_id, matterTitle: row.title, reference: row.reference, forum: row.forum, courtRoom: row.court_room || "Court not assigned",
  startsAt: iso(row.starts_at), endsAt: iso(row.ends_at), itemNumber: row.item_number ?? undefined, advocate: person(row.advocate_id, row.advocate_name),
  status: row.status, sourceState: row.source_state, updatedAt: iso(row.updated_at), note: row.notes || undefined,
});

/** Hearings on one IST calendar day (default today), optionally only one advocate's. */
export async function listDayHearings(workspace: Workspace, options: { date?: string; advocateId?: string } = {}): Promise<Hearing[]> {
  if (isDemoMode()) return demo.hearings.filter((hearing) => !options.advocateId || hearing.advocate.id === options.advocateId);
  const result = await run(workspace, (client) => client.query<HearingRow>(
    `${HEARING_SELECT}
     where h.organization_id = $1 and (h.starts_at at time zone 'Asia/Kolkata')::date = coalesce($2::date, (now() at time zone 'Asia/Kolkata')::date)
       and ($3::uuid is null or h.advocate_id = $3)
     order by h.starts_at`,
    [workspace.organizationId, options.date ?? null, options.advocateId ?? null],
  ));
  return result.rows.map(toHearing);
}

export async function listDismissedConflicts(workspace: Workspace, hearingIds: string[]): Promise<Set<string>> {
  if (isDemoMode() || !hearingIds.length) return new Set();
  const result = await run(workspace, (client) => client.query<{ first_hearing_id: string; second_hearing_id: string }>(
    "select first_hearing_id, second_hearing_id from conflict_dismissals where organization_id = $1 and (first_hearing_id = any($2) or second_hearing_id = any($2))",
    [workspace.organizationId, hearingIds],
  ));
  return new Set(result.rows.map((row) => conflictKey(row.first_hearing_id, row.second_hearing_id)));
}
export const conflictKey = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);

type TaskRow = { id: string; matter_id: string; matter_title: string; title: string; due_at: Timestamp; assignee_id: string | null; assignee_name: string | null; state: Task["state"]; priority: Task["priority"] };
const TASK_SELECT = `
  select t.id, t.matter_id, m.title matter_title, t.title, t.due_at, t.assignee_id, u.display_name assignee_name, t.state, t.priority
  from tasks t join matters m on m.id = t.matter_id left join app_users u on u.id = t.assignee_id`;
const toTask = (row: TaskRow): Task => ({
  id: row.id, matterId: row.matter_id, matterTitle: row.matter_title, title: row.title, dueAt: iso(row.due_at),
  assignee: row.assignee_id && row.assignee_name ? person(row.assignee_id, row.assignee_name) : undefined, state: row.state, priority: row.priority,
});

/** Open work that is overdue or due by the end of tomorrow (IST). */
export async function listDueTasks(workspace: Workspace, options: { assigneeId?: string } = {}): Promise<Task[]> {
  if (isDemoMode()) return demo.tasks.filter((task) => !options.assigneeId || task.assignee?.id === options.assigneeId);
  const result = await run(workspace, (client) => client.query<TaskRow>(
    `${TASK_SELECT}
     where t.organization_id = $1 and t.state in ('open','in_progress') and t.due_at is not null
       and (t.due_at at time zone 'Asia/Kolkata')::date <= (now() at time zone 'Asia/Kolkata')::date + 1
       and ($2::uuid is null or t.assignee_id = $2)
     order by t.due_at`,
    [workspace.organizationId, options.assigneeId ?? null],
  ));
  return result.rows.map(toTask);
}

// ---------------------------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------------------------
type DocumentRow = {
  id: string; document_id: string; matter_id: string; title: string; version_number: number; page_count: number | null; size_bytes: string;
  status: VaultDocument["status"]; classification: string; language: string | null; confidence: number | null; uploaded_at: Timestamp; uploader: string; sha256: string;
};
const languageLabel = (value: string | null): VaultDocument["language"] => (value === "hin" ? "Hindi" : value === "eng" ? "English" : value === "eng+hin" ? "Mixed" : "Unknown");

export async function listDocuments(workspace: Workspace, options: { matterId?: string } = {}): Promise<VaultDocument[]> {
  if (isDemoMode()) return demo.documents.filter((document) => !options.matterId || document.matterId === options.matterId);
  const result = await run(workspace, (client) => client.query<DocumentRow>(
    `select v.id, d.id document_id, d.matter_id, d.title, v.version_number, v.page_count, v.size_bytes::text, v.status, d.classification,
            (select language from ocr_pages p where p.document_version_id = v.id order by page_number limit 1) language,
            (select round(avg(confidence), 1)::float from ocr_pages p where p.document_version_id = v.id) confidence,
            v.uploaded_at, u.display_name uploader, v.sha256
     from document_versions v join documents d on d.id = v.document_id join app_users u on u.id = v.uploaded_by
     where d.organization_id = $1 and ($2::uuid is null or d.matter_id = $2)
       and v.version_number = (select max(v2.version_number) from document_versions v2 where v2.document_id = d.id)
     order by v.uploaded_at desc`,
    [workspace.organizationId, options.matterId ?? null],
  ));
  return result.rows.map((row) => ({
    id: row.id, documentId: row.document_id, matterId: row.matter_id, title: row.title, version: `v${row.version_number}.0`, versionNumber: row.version_number,
    pages: row.page_count || 0, size: `${(Number(row.size_bytes) / 1024 / 1024).toFixed(1)} MB`, status: row.status, classification: row.classification,
    language: languageLabel(row.language), ocrConfidence: row.confidence ?? undefined, uploadedAt: iso(row.uploaded_at), uploadedBy: row.uploader,
    hash: `${row.sha256.slice(0, 4)}…${row.sha256.slice(-4)}`,
  }));
}

export async function listOcrPages(workspace: Workspace, versionId: string): Promise<OcrPage[] | null> {
  if (isDemoMode()) return demo.ocrPages;
  return run(workspace, async (client) => {
    const version = await client.query("select 1 from document_versions where id = $1 and organization_id = $2", [versionId, workspace.organizationId]);
    if (!version.rowCount) return null;
    const pages = await client.query<{ id: string; page_number: number; language: string; confidence: string | null; extracted_text: string; corrected_text: string | null }>(
      "select id, page_number, language, confidence, extracted_text, corrected_text from ocr_pages where document_version_id = $1 order by page_number",
      [versionId],
    );
    return pages.rows.map((row) => ({ id: row.id, pageNumber: row.page_number, language: row.language, confidence: row.confidence === null ? undefined : Number(row.confidence), extractedText: row.extracted_text, correctedText: row.corrected_text ?? undefined }));
  });
}

export async function searchDocuments(workspace: Workspace, search: string): Promise<SearchHit[]> {
  if (isDemoMode()) {
    const needle = search.toLowerCase();
    return demo.ocrPages.filter((page) => (page.correctedText ?? page.extractedText).toLowerCase().includes(needle)).map((page) => ({
      documentId: demo.documents[0].documentId, versionId: demo.documents[0].id, matterId: demo.documents[0].matterId, pageNumber: page.pageNumber, title: demo.documents[0].title,
      snippet: (page.correctedText ?? page.extractedText).slice(0, 160),
    }));
  }
  const result = await run(workspace, (client) => client.query<{ document_id: string; version_id: string; matter_id: string; page_number: number; title: string; snippet: string }>(
    "select document_id, version_id, matter_id, page_number, title, snippet from document_search($1, $2)",
    [search, workspace.organizationId],
  ));
  return result.rows.map((row) => ({ documentId: row.document_id, versionId: row.version_id, matterId: row.matter_id, pageNumber: row.page_number, title: row.title, snippet: row.snippet }));
}

// ---------------------------------------------------------------------------------------------
// Matter detail
// ---------------------------------------------------------------------------------------------
export async function getMatterDetail(workspace: Workspace, matterId: string): Promise<MatterDetail | null> {
  if (isDemoMode()) {
    const matter = demo.matters.find((item) => item.id === matterId);
    if (!matter) return null;
    return {
      matter,
      parties: matter.id === demo.matters[0].id ? demo.parties : [],
      hearings: demo.hearings.filter((item) => item.matterId === matterId),
      tasks: demo.tasks.filter((item) => item.matterId === matterId),
      documents: demo.documents.filter((item) => item.matterId === matterId),
      grants: matter.restricted ? demo.grants : [],
      revisions: demo.revisions.filter((revision) => demo.hearings.some((hearing) => hearing.id === revision.resourceId && hearing.matterId === matterId)),
      legalHolds: demo.legalHolds.filter((hold) => hold.matterId === matterId),
      permissions: { edit: true, manage: true },
    };
  }
  const detail = await run(workspace, async (client) => {
    const matter = await client.query<MatterRow>(`${MATTER_SELECT} where m.organization_id = $1 and m.id = $2`, [workspace.organizationId, matterId]);
    if (!matter.rows[0]) return null;
    const [permissions, parties, hearings, tasks, grants, revisions, holds] = await Promise.all([
      client.query<{ edit: boolean; manage: boolean }>("select can_access_matter($1, 'edit') edit, can_access_matter($1, 'manage') manage", [matterId]),
      client.query<{ id: string; name: string; party_type: Party["partyType"] }>("select id, name, party_type from parties where matter_id = $1 order by created_at", [matterId]),
      client.query<HearingRow>(`${HEARING_SELECT} where h.matter_id = $1 order by h.starts_at desc`, [matterId]),
      client.query<TaskRow>(`${TASK_SELECT} where t.matter_id = $1 order by t.state in ('done','cancelled'), t.due_at nulls last`, [matterId]),
      client.query<{ id: string; user_id: string; user_name: string; permission: MatterGrant["permission"]; expires_at: Timestamp | null; granted_by: string }>(
        `select g.id, g.user_id, u.display_name user_name, g.permission, g.expires_at, gb.display_name granted_by
         from matter_grants g join app_users u on u.id = g.user_id join app_users gb on gb.id = g.granted_by where g.matter_id = $1 order by u.display_name`, [matterId]),
      client.query<{ id: string; resource_type: Revision["resourceType"]; resource_id: string; previous: Record<string, unknown>; changes: Record<string, unknown>; reason: string; changed_by: string; changed_at: Timestamp }>(
        `select r.id, r.resource_type, r.resource_id, r.previous, r.changes, r.reason, u.display_name changed_by, r.changed_at
         from record_revisions r join app_users u on u.id = r.changed_by where r.matter_id = $1 order by r.changed_at desc limit 100`, [matterId]),
      client.query<{ id: string; reason: string; active: boolean; created_by: string; created_at: Timestamp; released_at: Timestamp | null }>(
        `select l.id, l.reason, l.active, u.display_name created_by, l.created_at, l.released_at
         from legal_holds l join app_users u on u.id = l.created_by where l.matter_id = $1 order by l.created_at desc`, [matterId]),
    ]);
    return { matter: matter.rows[0], permissions: permissions.rows[0], parties, hearings, tasks, grants, revisions, holds };
  });
  if (!detail) return null;
  const matter = toMatter(detail.matter);
  return {
    matter,
    parties: detail.parties.rows.map((row) => ({ id: row.id, name: row.name, partyType: row.party_type })),
    hearings: detail.hearings.rows.map(toHearing),
    tasks: detail.tasks.rows.map(toTask),
    documents: await listDocuments(workspace, { matterId }),
    grants: detail.grants.rows.map((row) => ({ id: row.id, userId: row.user_id, userName: row.user_name, permission: row.permission, expiresAt: isoOrUndefined(row.expires_at), grantedBy: row.granted_by })),
    revisions: detail.revisions.rows.map((row) => ({ id: row.id, resourceType: row.resource_type, resourceId: row.resource_id, previous: row.previous, changes: row.changes, reason: row.reason, changedBy: row.changed_by, changedAt: iso(row.changed_at) })),
    legalHolds: detail.holds.rows.map((row) => ({ id: row.id, matterId, matterTitle: matter.title, reason: row.reason, active: row.active, createdBy: row.created_by, createdAt: iso(row.created_at), releasedAt: isoOrUndefined(row.released_at) })),
    permissions: { edit: detail.permissions.edit, manage: detail.permissions.manage },
  };
}

// ---------------------------------------------------------------------------------------------
// Members and administration
// ---------------------------------------------------------------------------------------------
export async function listMembers(workspace: Workspace): Promise<Member[]> {
  if (isDemoMode()) return demo.members;
  const result = await run(workspace, (client) => client.query<{ id: string; display_name: string; email: string; role: AppRole; active: boolean; mfa_enabled: boolean }>(
    `select u.id, u.display_name, u.email, m.role, m.active, u.mfa_enabled from memberships m join app_users u on u.id = m.user_id
     where m.organization_id = $1 order by m.active desc, u.display_name`,
    [workspace.organizationId],
  ));
  return result.rows.map((row) => ({ ...person(row.id, row.display_name, row.role), email: row.email, active: row.active, mfaEnabled: row.mfa_enabled }));
}

export async function listInvitations(workspace: Workspace): Promise<Invitation[]> {
  if (isDemoMode()) return demo.invitations;
  const result = await run(workspace, (client) => client.query<{ id: string; email: string; role: AppRole; expires_at: Timestamp; invited_by: string }>(
    `select i.id, i.email, i.role, i.expires_at, u.display_name invited_by from invitations i join app_users u on u.id = i.invited_by
     where i.organization_id = $1 and i.accepted_at is null and i.revoked_at is null and i.expires_at > now() order by i.created_at desc`,
    [workspace.organizationId],
  ));
  return result.rows.map((row) => ({ id: row.id, email: row.email, role: row.role, expiresAt: iso(row.expires_at), invitedBy: row.invited_by }));
}

export async function listAuditEvents(workspace: Workspace, options: { resourceId?: string; limit?: number } = {}): Promise<AuditEvent[]> {
  if (isDemoMode()) return demo.auditEvents;
  const result = await run(workspace, (client) => client.query<{ id: string; actor: string | null; action: string; resource_type: string; resource_id: string | null; outcome: AuditEvent["outcome"]; created_at: Timestamp; correlation_id: string; chain_index: string }>(
    `select a.id, u.display_name actor, a.action, a.resource_type, a.resource_id, a.outcome, a.created_at, a.correlation_id, a.chain_index
     from audit_events a left join app_users u on u.id = a.actor_id
     where a.organization_id = $1 and ($2::text is null or a.resource_id = $2) order by a.chain_index desc limit $3`,
    [workspace.organizationId, options.resourceId ?? null, options.limit ?? 100],
  ));
  return result.rows.map((row) => ({
    id: row.id, actor: row.actor || "System", action: row.action, resource: `${row.resource_type}${row.resource_id ? ` · ${row.resource_id}` : ""}`,
    outcome: row.outcome, createdAt: iso(row.created_at), correlationId: row.correlation_id, chainIndex: Number(row.chain_index),
  }));
}

export async function latestAuditVerification(workspace: Workspace): Promise<AuditVerification | null> {
  if (isDemoMode()) return demo.auditVerification;
  const result = await run(workspace, (client) => client.query<{ verified_at: Timestamp; ok: boolean; checked_count: string; first_bad_index: string | null }>(
    "select verified_at, ok, checked_count, first_bad_index from audit_verifications where organization_id = $1 order by verified_at desc limit 1",
    [workspace.organizationId],
  ));
  const row = result.rows[0];
  return row ? { verifiedAt: iso(row.verified_at), ok: row.ok, checkedCount: Number(row.checked_count), firstBadIndex: row.first_bad_index === null ? undefined : Number(row.first_bad_index) } : null;
}

export async function listConsents(workspace: Workspace): Promise<ConsentRecord[]> {
  if (isDemoMode()) return demo.consents;
  const result = await run(workspace, (client) => client.query<{ id: string; subject_reference: string; purpose: string; legal_basis: string; notice_version: string; status: ConsentRecord["status"]; recorded_at: Timestamp; withdrawn_at: Timestamp | null }>(
    "select id, subject_reference, purpose, legal_basis, notice_version, status, recorded_at, withdrawn_at from consent_records where organization_id = $1 order by recorded_at desc limit 200",
    [workspace.organizationId],
  ));
  return result.rows.map((row) => ({ id: row.id, subjectReference: row.subject_reference, purpose: row.purpose, legalBasis: row.legal_basis, noticeVersion: row.notice_version, status: row.status, recordedAt: iso(row.recorded_at), withdrawnAt: isoOrUndefined(row.withdrawn_at) }));
}

export async function listDataRequests(workspace: Workspace): Promise<DataRequest[]> {
  if (isDemoMode()) return demo.dataRequests;
  const result = await run(workspace, (client) => client.query<{ id: string; requester_reference: string; request_type: DataRequest["requestType"]; status: DataRequest["status"]; matter_id: string | null; matter_title: string | null; decision_reason: string | null; hold_review_note: string | null; created_at: Timestamp; completed_at: Timestamp | null }>(
    `select r.id, r.requester_reference, r.request_type, r.status, r.matter_id, m.title matter_title, r.decision_reason, r.hold_review_note, r.created_at, r.completed_at
     from data_requests r left join matters m on m.id = r.matter_id where r.organization_id = $1 order by r.created_at desc limit 200`,
    [workspace.organizationId],
  ));
  return result.rows.map((row) => ({
    id: row.id, requesterReference: row.requester_reference, requestType: row.request_type, status: row.status, matterId: row.matter_id ?? undefined,
    matterTitle: row.matter_title ?? undefined, decisionReason: row.decision_reason ?? undefined, holdReviewNote: row.hold_review_note ?? undefined,
    createdAt: iso(row.created_at), completedAt: isoOrUndefined(row.completed_at),
  }));
}

export async function listLegalHolds(workspace: Workspace): Promise<LegalHold[]> {
  if (isDemoMode()) return demo.legalHolds;
  const result = await run(workspace, (client) => client.query<{ id: string; matter_id: string; matter_title: string; reason: string; active: boolean; created_by: string; created_at: Timestamp; released_at: Timestamp | null }>(
    `select l.id, l.matter_id, m.title matter_title, l.reason, l.active, u.display_name created_by, l.created_at, l.released_at
     from legal_holds l join matters m on m.id = l.matter_id join app_users u on u.id = l.created_by
     where l.organization_id = $1 order by l.active desc, l.created_at desc limit 200`,
    [workspace.organizationId],
  ));
  return result.rows.map((row) => ({ id: row.id, matterId: row.matter_id, matterTitle: row.matter_title, reason: row.reason, active: row.active, createdBy: row.created_by, createdAt: iso(row.created_at), releasedAt: isoOrUndefined(row.released_at) }));
}

export async function listRetentionClasses(workspace: Workspace): Promise<RetentionClass[]> {
  if (isDemoMode()) return demo.retentionClasses;
  const result = await run(workspace, (client) => client.query<{ id: string; name: string; retention_days: number | null; automatic_deletion: boolean }>(
    "select id, name, retention_days, automatic_deletion from retention_classes where organization_id = $1 order by name",
    [workspace.organizationId],
  ));
  return result.rows.map((row) => ({ id: row.id, name: row.name, retentionDays: row.retention_days ?? undefined, automaticDeletion: row.automatic_deletion }));
}

export async function getOrganizationPolicies(workspace: Workspace): Promise<OrganizationPolicies> {
  if (isDemoMode()) return demo.policies;
  const result = await run(workspace, (client) => client.query<{ external_ai_enabled: boolean; automatic_deletion_enabled: boolean; timezone: string }>(
    "select external_ai_enabled, automatic_deletion_enabled, timezone from organizations where id = $1",
    [workspace.organizationId],
  ));
  const row = result.rows[0];
  return { externalAiEnabled: row?.external_ai_enabled ?? false, automaticDeletionEnabled: row?.automatic_deletion_enabled ?? false, timezone: row?.timezone ?? "Asia/Kolkata" };
}
