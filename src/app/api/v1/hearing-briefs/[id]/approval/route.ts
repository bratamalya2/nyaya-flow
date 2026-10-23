import { NextResponse } from "next/server";
import { apiRoute, assertUuid, readJson, ApiError } from "@/lib/api";
import { requireAppPermission } from "@/lib/operations";
import { hearingBriefApprovalInput } from "@/lib/validation";

export const POST = apiRoute<{ id: string }>({}, async (request, { params, workspace, db, audit }) => {
  const briefId = assertUuid(params.id, "hearing brief");
  const input = await readJson(request, hearingBriefApprovalInput);
  await db(async (client) => {
    const brief = await client.query<{ organization_id: string; status: string }>(`select b.organization_id,b.status from hearing_briefs b join hearings h on h.id=b.hearing_id where b.id=$1 and h.organization_id=$2 for update`, [briefId,workspace.organizationId]);
    if (!brief.rows[0]) throw new ApiError(404, "Hearing brief not found or access denied.");
    if (brief.rows[0].status === "confirmed") throw new ApiError(409, "Approved hearing briefs are immutable; create a new version.");
    await requireAppPermission(client, brief.rows[0].organization_id, "approve_hearing_brief");
    const status = input.decision === "approved" ? "confirmed" : "rejected";
    await client.query(`insert into hearing_brief_approvals(organization_id,hearing_brief_id,decision,note,decided_by) values($1,$2,$3,$4,$5)`, [brief.rows[0].organization_id,briefId,input.decision,input.note ?? null,workspace.userId]);
    await client.query(`update hearing_briefs set status=$2,approved_by=case when $2='confirmed' then $3 else null end,approved_at=case when $2='confirmed' then now() else null end where id=$1`, [briefId,status,workspace.userId]);
    await audit(client, { action: `hearing_brief.${input.decision}`, resourceType: "hearing_brief", resourceId: briefId, outcome: "success", metadata: {} });
  });
  return NextResponse.json({ data: { id: briefId } });
});
