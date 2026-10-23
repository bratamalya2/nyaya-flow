import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { ApiError, apiRoute, assertUuid } from "@/lib/api";
import { isFilingEnabled } from "@/lib/filing-contracts";
import { hasMatterPermission } from "@/lib/matters";

export const GET = apiRoute<{ id: string }>({}, async (_request, { params, workspace, db, audit }) => {
  if (!isFilingEnabled()) return NextResponse.json({ error: "E-Filing Beta is disabled." }, { status: 503 });
  const id = assertUuid(params.id, "filing bundle");
  const manifest = await db(async (client) => {
    const bundle = await client.query<{ title: string; matter_id: string; review_state: string; pack: string; version: string }>(`select b.title,b.matter_id,b.review_state,p.name pack,p.version from filing_bundles b join filing_rule_packs p on p.id=b.rule_pack_id where b.id=$1 and b.organization_id=$2`, [id, workspace.organizationId]);
    if (!bundle.rows[0]) throw new ApiError(404, "Filing bundle not found.");
    if (!(await hasMatterPermission(client, bundle.rows[0].matter_id, "export"))) throw new ApiError(403, "Matter export permission is required.");
    if (bundle.rows[0].review_state !== "approved" && bundle.rows[0].review_state !== "exported") throw new ApiError(409, "Approve the internal bundle before exporting its local manifest.");
    const entries = await client.query<{ label: string; document_sha256: string; folio_start: number | null; folio_end: number | null }>("select label,document_sha256,folio_start,folio_end from filing_bundle_entries where bundle_id=$1 order by sort_order", [id]);
    const value = { kind: "NyayaFlow local filing manifest", warning: "Internal preparation only. No court submission, DSC, eSign, or provider action has occurred.", bundleId: id, title: bundle.rows[0].title, rulePack: { name: bundle.rows[0].pack, version: bundle.rows[0].version }, entries: entries.rows };
    const encoded = JSON.stringify(value, null, 2); const digest = createHash("sha256").update(encoded).digest("hex");
    await client.query("insert into filing_exports(organization_id,bundle_id,manifest_sha256,created_by) values($1,$2,$3,$4)", [workspace.organizationId, id, digest, workspace.userId]);
    await client.query("update filing_bundles set review_state='exported' where id=$1 and review_state='approved'", [id]);
    await audit(client, { action: "filing.bundle.local_export", resourceType: "filing_bundle", resourceId: id, outcome: "success", metadata: { manifestSha256: digest, externalSubmission: false } });
    return encoded;
  });
  return new NextResponse(manifest, { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="filing-manifest-${id}.json"` } });
});
