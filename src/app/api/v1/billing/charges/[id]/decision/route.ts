import { NextResponse } from "next/server";
import { apiRoute, ApiError, assertUuid, readJson } from "@/lib/api";
import { canApproveCharges } from "@/lib/finance";
import { billingChargeDecisionInput } from "@/lib/validation";

export const POST = apiRoute<{ id: string }>({}, async (request, { params, workspace, db, audit }) => {
  if (!canApproveCharges(workspace.role)) throw new ApiError(403, "Finance or leadership authority is required.");
  const id = assertUuid(params.id, "charge"); const input = await readJson(request, billingChargeDecisionInput);
  await db(async (client) => {
    const charge = await client.query<{ id: string; matter_id: string; status: string }>("select id,matter_id,status from billing_charges where id=$1 and organization_id=$2 for update", [id, workspace.organizationId]);
    if (!charge.rows[0]) throw new ApiError(404, "Charge not found or access denied.");
    if (charge.rows[0].status !== "submitted") throw new ApiError(409, "Only submitted charges can be approved or rejected.");
    const status = input.decision === "approved" ? "approved" : "rejected";
    await client.query("update billing_charges set status=$1,approved_at=case when $1='approved' then now() else null end,approved_by=case when $1='approved' then $2 else null end,rejection_reason=case when $1='rejected' then $3 else null end where id=$4", [status, workspace.userId, input.reason, id]);
    await client.query("insert into billing_charge_approvals(organization_id,charge_id,decision,reason,decided_by) values($1,$2,$3,$4,$5)", [workspace.organizationId, id, input.decision, input.reason, workspace.userId]);
    await audit(client, { action: `billing.charge.${input.decision}`, resourceType: "billing_charge", resourceId: id, outcome: "success", metadata: { matterId: charge.rows[0].matter_id, reason: input.reason } });
  });
  return NextResponse.json({ data: { id, decision: input.decision } });
});
