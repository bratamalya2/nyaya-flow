import { NextResponse } from "next/server";
import { ApiError, apiRoute, assertUuid } from "@/lib/api";
import { ADMIN_ROLES } from "@/lib/permissions";

export const DELETE = apiRoute<{ id: string }>({ roles: ADMIN_ROLES }, async (_request, { params, workspace, db, audit }) => {
  const invitationId = assertUuid(params.id, "invitation");
  await db(async (client) => {
    const revoked = await client.query("update invitations set revoked_at = now() where id = $1 and organization_id = $2 and accepted_at is null and revoked_at is null", [invitationId, workspace.organizationId]);
    if (!revoked.rowCount) throw new ApiError(404, "Pending invitation not found.");
    await audit(client, { action: "membership.invite.revoke", resourceType: "invitation", resourceId: invitationId, outcome: "success" });
  });
  return NextResponse.json({ revoked: true });
});
