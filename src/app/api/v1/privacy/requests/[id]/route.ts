import { NextResponse } from "next/server";
import { ApiError, apiRoute, assertUuid, readJson } from "@/lib/api";
import { ADMIN_ROLES } from "@/lib/permissions";
import { dataRequestUpdate } from "@/lib/validation";
import type { DataRequest } from "@/lib/types";

// FR-055: verify identity, review legal holds and retention, then fulfil or deny with a recorded decision.
export const DATA_REQUEST_TRANSITIONS: Record<DataRequest["status"], DataRequest["status"][]> = {
  received: ["identity_review", "denied"],
  identity_review: ["legal_hold_review", "denied"],
  legal_hold_review: ["processing", "denied"],
  processing: ["fulfilled", "denied"],
  fulfilled: [],
  denied: [],
};

export const PATCH = apiRoute<{ id: string }>({ roles: ADMIN_ROLES }, async (request, { params, workspace, db, audit }) => {
  const requestId = assertUuid(params.id, "data request");
  const input = await readJson(request, dataRequestUpdate);
  await db(async (client) => {
    const found = await client.query<{ status: DataRequest["status"]; request_type: DataRequest["requestType"]; matter_id: string | null }>(
      "select status, request_type, matter_id from data_requests where id = $1 and organization_id = $2 for update",
      [requestId, workspace.organizationId],
    );
    const current = found.rows[0];
    if (!current) throw new ApiError(404, "Data request not found.");
    if (!DATA_REQUEST_TRANSITIONS[current.status].includes(input.status)) throw new ApiError(409, `A ${current.status.replaceAll("_", " ")} request cannot move to ${input.status.replaceAll("_", " ")}.`);
    if (input.status === "denied" && !input.decisionReason) throw new ApiError(400, "Record the reason for denying the request.");
    if (current.status === "legal_hold_review" && input.status === "processing") {
      if (!input.holdReviewNote) throw new ApiError(400, "Record the legal-hold and retention review before processing.");
      if (current.request_type === "erasure" && current.matter_id) {
        const holds = await client.query("select 1 from legal_holds where matter_id = $1 and active", [current.matter_id]);
        if (holds.rowCount) throw new ApiError(409, "An active legal hold on the linked matter blocks erasure. Deny the request or release the hold first.");
      }
    }
    await client.query(
      `update data_requests set status = $2, decision_reason = coalesce($3, decision_reason),
         hold_review_note = case when $5 then $4 else hold_review_note end,
         hold_reviewed_by = case when $5 then $6::uuid else hold_reviewed_by end,
         hold_reviewed_at = case when $5 then now() else hold_reviewed_at end,
         assigned_to = coalesce(assigned_to, $6::uuid),
         completed_at = case when $2 in ('fulfilled','denied') then now() else completed_at end
       where id = $1`,
      [requestId, input.status, input.decisionReason ?? null, input.holdReviewNote ?? null, current.status === "legal_hold_review", workspace.userId],
    );
    await audit(client, { action: "privacy.request.transition", resourceType: "data_request", resourceId: requestId, outcome: "success", metadata: { from: current.status, to: input.status } });
  });
  return NextResponse.json({ updated: true });
});
