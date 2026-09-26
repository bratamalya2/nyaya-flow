import { NextResponse } from "next/server";
import { ApiError, apiRoute, assertUuid } from "@/lib/api";

export const DELETE = apiRoute<{ id: string; grantId: string }>({}, async (_request, { params, workspace, db, audit }) => {
  const matterId = assertUuid(params.id, "matter");
  const grantId = assertUuid(params.grantId, "grant");
  await db(async (client) => {
    const removed = await client.query<{ user_id: string; permission: string }>(
      "delete from matter_grants where id = $1 and matter_id = $2 and organization_id = $3 returning user_id, permission",
      [grantId, matterId, workspace.organizationId],
    );
    if (!removed.rows[0]) throw new ApiError(404, "Grant not found or you cannot manage this matter.");
    await audit(client, { action: "matter.grant.revoke", resourceType: "matter", resourceId: matterId, outcome: "success", metadata: { userId: removed.rows[0].user_id, permission: removed.rows[0].permission } });
  });
  return NextResponse.json({ revoked: true });
});
