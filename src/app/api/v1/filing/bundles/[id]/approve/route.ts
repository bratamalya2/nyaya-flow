import { NextResponse } from "next/server";
import { ApiError, apiRoute, assertUuid, readJson } from "@/lib/api";
import { isFilingEnabled } from "@/lib/filing-contracts";
import { hasMatterPermission } from "@/lib/matters";
import { filingApprovalInput } from "@/lib/validation";

export const POST = apiRoute<{ id: string }>({}, async (request, { params, workspace, db, audit }) => {
  if (!isFilingEnabled()) return NextResponse.json({ error: "E-Filing Beta is disabled." }, { status: 503 });
  const id = assertUuid(params.id, "filing bundle"); const input = await readJson(request, filingApprovalInput);
  await db(async (client) => {
    const bundle = await client.query<{ matter_id: string; review_state: string }>("select matter_id,review_state from filing_bundles where id=$1 and organization_id=$2 for update", [id, workspace.organizationId]);
    if (!bundle.rows[0]) throw new ApiError(404, "Filing bundle not found.");
    if (!(await hasMatterPermission(client, bundle.rows[0].matter_id, "manage"))) throw new ApiError(403, "Matter manage permission is required to approve a bundle.");
    const blocked = await client.query("select 1 from filing_findings where bundle_id=$1 and outcome='fail'", [id]);
    if (blocked.rowCount) throw new ApiError(409, "Resolve failing internal checks before approval.");
    await client.query("update filing_bundles set review_state='approved',approved_by=$1,approved_at=now() where id=$2", [workspace.userId, id]);
    await client.query("update filing_findings set review_state='reviewed',reviewed_by=$1,reviewed_at=now() where bundle_id=$2 and review_state='review_required'", [workspace.userId, id]);
    await audit(client, { action: "filing.bundle.approve", resourceType: "filing_bundle", resourceId: id, outcome: "success", metadata: { reason: input.reason, externalSubmission: false } });
  });
  return NextResponse.json({ data: { reviewState: "approved", externalSubmission: false } });
});
