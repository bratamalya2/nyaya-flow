import { NextResponse } from "next/server";
import { apiRoute, readJson } from "@/lib/api";
import { createOpaqueToken, hashToken } from "@/lib/auth";
import { ADMIN_ROLES } from "@/lib/permissions";
import { invitationInput } from "@/lib/validation";

export const POST = apiRoute({ roles: ADMIN_ROLES }, async (request, { workspace, db, audit }) => {
  const input = await readJson(request, invitationInput);
  const token = createOpaqueToken();
  const invitation = await db(async (client) => {
    const inserted = await client.query<{ id: string; expires_at: Date }>(
      `insert into invitations (organization_id, email, role, token_hash, invited_by, expires_at) values ($1,$2,$3,$4,$5, now() + make_interval(days => $6))
       returning id, expires_at`,
      [workspace.organizationId, input.email, input.role, hashToken(token), workspace.userId, input.expiresInDays],
    );
    await audit(client, { action: "membership.invite", resourceType: "invitation", resourceId: inserted.rows[0].id, outcome: "success", metadata: { role: input.role } });
    return inserted.rows[0];
  });
  const base = process.env.APP_BASE_URL || new URL(request.url).origin;
  // The link is shown once to the inviting admin; only its hash is stored.
  return NextResponse.json({ data: { id: invitation.id, expiresAt: invitation.expires_at.toISOString(), link: `${base.replace(/\/$/, "")}/invite/${token}` } }, { status: 201 });
});
