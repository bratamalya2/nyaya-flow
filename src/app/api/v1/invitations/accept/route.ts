import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, publicRoute, readJson } from "@/lib/api";
import { createSession, getSession, hashPassword, hashToken } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { query, withActor } from "@/lib/db";
import { isDemoMode } from "@/lib/runtime";
import { passwordInput } from "@/lib/validation";

const schema = z.object({
  token: z.string().min(20).max(100),
  displayName: z.string().trim().min(2).max(120).optional(),
  password: passwordInput.optional(),
});

export const POST = publicRoute(async (request) => {
  if (isDemoMode()) throw new ApiError(409, "Invitations are disabled in demo mode.");
  const input = await readJson(request, schema);
  const tokenHash = hashToken(input.token);
  const invitation = (await query<{ email: string; organization_name: string }>("select email, organization_name from invitation_lookup($1)", [tokenHash])).rows[0];
  if (!invitation) throw new ApiError(400, "This invitation is invalid, expired, or already used.");

  const existing = (await query<{ id: string }>("select id from app_users where email = $1", [invitation.email])).rows[0];
  let userId: string;
  let newAccount = false;
  if (existing) {
    const session = await getSession();
    if (!session || session.userId !== existing.id) throw new ApiError(409, `An account for ${invitation.email} already exists. Sign in with it, then open this invitation link again.`);
    userId = existing.id;
  } else {
    if (!input.displayName || !input.password) throw new ApiError(400, "Enter your name and a password of at least 14 characters.");
    const created = await query<{ id: string }>("insert into app_users (email, display_name, password_hash) values ($1,$2,$3) returning id", [invitation.email, input.displayName, await hashPassword(input.password)]);
    userId = created.rows[0].id;
    newAccount = true;
  }

  const organizationId = (await query<{ accept_invitation: string }>("select accept_invitation($1, $2)", [tokenHash, userId])).rows[0].accept_invitation;
  await withActor(userId, (client) => recordAudit(client, { organizationId, actorId: userId, action: "membership.invitation.accept", resourceType: "membership", resourceId: userId, outcome: "success", metadata: { newAccount } }));
  if (newAccount) await createSession(userId, false);
  return NextResponse.json({ accepted: true, organizationName: invitation.organization_name, mfaSetupRequired: newAccount });
});
