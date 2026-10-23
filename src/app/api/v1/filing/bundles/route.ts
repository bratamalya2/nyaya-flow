import { NextResponse } from "next/server";
import { ApiError, apiRoute, readJson } from "@/lib/api";
import { isFilingEnabled } from "@/lib/filing-contracts";
import { requireMatter } from "@/lib/matters";
import { EDITOR_ROLES } from "@/lib/permissions";
import { filingBundleInput } from "@/lib/validation";

export const POST = apiRoute({ roles: EDITOR_ROLES }, async (request, { workspace, db, audit }) => {
  if (!isFilingEnabled()) return NextResponse.json({ error: "E-Filing Beta is disabled." }, { status: 503 });
  const input = await readJson(request, filingBundleInput);
  const id = await db(async (client) => {
    await requireMatter(client, workspace, input.matterId);
    const pack = await client.query<{ id: string; version: string; source_reference: string }>("select id,version,source_reference from filing_rule_packs where id=$1 and organization_id=$2 and enabled", [input.rulePackId, workspace.organizationId]);
    if (!pack.rows[0]) throw new ApiError(400, "Choose an enabled, source-recorded rule pack.");
    const versions = await client.query<{ id: string; title: string; sha256: string; page_count: number | null }>(
      `select v.id,d.title,v.sha256,v.page_count from document_versions v join documents d on d.id=v.document_id
       where v.organization_id=$1 and d.matter_id=$2 and v.id=any($3::uuid[]) and v.status='ready' and v.approved_at is not null`,
      [workspace.organizationId, input.matterId, input.documentVersionIds],
    );
    if (versions.rows.length !== new Set(input.documentVersionIds).size) throw new ApiError(400, "Every bundle entry must be an approved, ready Vault version from this matter.");
    const bundle = await client.query<{ id: string }>("insert into filing_bundles(organization_id,matter_id,rule_pack_id,title,review_state,created_by) values($1,$2,$3,$4,'review_required',$5) returning id", [workspace.organizationId, input.matterId, input.rulePackId, input.title, workspace.userId]);
    for (const [index, version] of versions.rows.entries()) {
      await client.query("insert into filing_bundle_entries(organization_id,bundle_id,document_version_id,label,sort_order,folio_start,folio_end,document_sha256) values($1,$2,$3,$4,$5,$6,$7,$8)", [workspace.organizationId, bundle.rows[0].id, version.id, version.title, index, versions.rows.slice(0, index).reduce((total, item) => total + (item.page_count ?? 0), 0) + 1, versions.rows.slice(0, index + 1).reduce((total, item) => total + (item.page_count ?? 0), 0), version.sha256]);
    }
    const rules = [
      ["ready_vault_versions", "pass", `${versions.rows.length} approved, ready Vault version(s) are hash-pinned in this internal bundle.`],
      ["index_and_folio_review", "manual_review", "Review the generated index and folio sequence before local export."],
      ["human_filing_review", "manual_review", "A lawyer must verify forum requirements, source currency, and the finished bundle. No court submission is available."],
    ] as const;
    for (const [rule, outcome, evidence] of rules) await client.query("insert into filing_findings(organization_id,bundle_id,rule_key,rule_version,outcome,evidence,source_reference) values($1,$2,$3,$4,$5,$6,$7)", [workspace.organizationId, bundle.rows[0].id, rule, pack.rows[0].version, outcome, evidence, pack.rows[0].source_reference]);
    await audit(client, { action: "filing.bundle.create", resourceType: "filing_bundle", resourceId: bundle.rows[0].id, outcome: "success", metadata: { matterId: input.matterId, documentCount: versions.rows.length, rulePackId: input.rulePackId } });
    return bundle.rows[0].id;
  });
  return NextResponse.json({ data: { id, reviewState: "review_required" } }, { status: 201 });
});
