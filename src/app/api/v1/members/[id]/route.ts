import { NextResponse } from "next/server";
import { ApiError, apiRoute, assertUuid, readJson } from "@/lib/api";
import { ADMIN_ROLES } from "@/lib/permissions";
import { memberUpdate } from "@/lib/validation";

export const PATCH = apiRoute<{ id: string }>({ roles: ADMIN_ROLES }, async (request, { params, workspace, db, audit }) => {
  const userId = assertUuid(params.id, "member");
  const input = await readJson(request, memberUpdate);
  if (input.role === undefined && input.active === undefined) throw new ApiError(400, "No changes were submitted.");
  if (userId === workspace.userId && (input.active === false || (input.role && input.role !== workspace.role))) throw new ApiError(400, "You cannot change your own role or deactivate yourself. Ask another owner or admin.");
  await db(async (client) => {
    const current = await client.query<{ role: string; active: boolean }>("select role, active from memberships where organization_id = $1 and user_id = $2", [workspace.organizationId, userId]);
    if (!current.rows[0]) throw new ApiError(404, "Member not found.");
    const losesOwner = current.rows[0].role === "owner" && current.rows[0].active && (input.active === false || (input.role !== undefined && input.role !== "owner"));
    if (losesOwner) {
      const owners = await client.query<{ count: string }>("select count(*) from memberships where organization_id = $1 and role = 'owner' and active and user_id <> $2", [workspace.organizationId, userId]);
      if (Number(owners.rows[0].count) === 0) throw new ApiError(409, "An organization must keep at least one active owner.");
    }
    const updated = await client.query(
      "update memberships set role = coalesce($3::app_role, role), active = coalesce($4, active) where organization_id = $1 and user_id = $2",
      [workspace.organizationId, userId, input.role ?? null, input.active ?? null],
    );
    if (!updated.rowCount) throw new ApiError(403, "Only owners can change owner memberships.");
    await audit(client, { action: "membership.update", resourceType: "membership", resourceId: userId, outcome: "success", metadata: { from: current.rows[0], to: input } });
  });
  return NextResponse.json({ updated: true });
});
