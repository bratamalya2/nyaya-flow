import { NextResponse } from "next/server";
import { ApiError, apiRoute, assertUuid, readJson } from "@/lib/api";
import { hasMatterPermission, requireMatter } from "@/lib/matters";
import { grantInput } from "@/lib/validation";

export const POST = apiRoute<{ id: string }>({}, async (request, { params, workspace, db, audit }) => {
  const matterId = assertUuid(params.id, "matter");
  const input = await readJson(request, grantInput);
  if (input.expiresAt && new Date(input.expiresAt) <= new Date()) throw new ApiError(400, "Expiry must be in the future.");
  const grantId = await db(async (client) => {
    const matter = await requireMatter(client, workspace, matterId);
    if (!(await hasMatterPermission(client, matterId, "manage"))) throw new ApiError(403, "Managing access requires manage permission on this matter.");
    const inserted = await client.query<{ id: string }>(
      `insert into matter_grants (organization_id, matter_id, user_id, permission, expires_at, granted_by) values ($1,$2,$3,$4,$5,$6)
       on conflict (matter_id, user_id, permission) do update set expires_at = excluded.expires_at, granted_by = excluded.granted_by returning id`,
      [matter.organization_id, matterId, input.userId, input.permission, input.expiresAt ?? null, workspace.userId],
    );
    await audit(client, { action: "matter.grant.create", resourceType: "matter", resourceId: matterId, outcome: "success", metadata: { userId: input.userId, permission: input.permission, expiresAt: input.expiresAt ?? null } });
    return inserted.rows[0].id;
  });
  return NextResponse.json({ data: { id: grantId } }, { status: 201 });
});
