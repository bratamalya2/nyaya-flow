import { NextResponse } from "next/server";
import { z } from "zod";
import { publicRoute, readJson } from "@/lib/api";
import { clientIp, createOpaqueToken, createSession, hashToken, verifyPassword } from "@/lib/auth";
import { query } from "@/lib/db";
import { isDemoMode } from "@/lib/runtime";
import { clearFailures, lockedUntil, recordFailure, signInRules } from "@/lib/throttle";

const schema = z.object({ email: z.email().max(254), password: z.string().min(8).max(256) });

export const POST = publicRoute(async (request) => {
  if (isDemoMode()) return NextResponse.json({ authenticated: true, mode: "demo" });
  const { email, password } = await readJson(request, schema);
  const rules = signInRules(email, await clientIp());
  const locked = await lockedUntil(rules);
  if (locked) return NextResponse.json({ error: "Too many sign-in attempts. Try again in 15 minutes." }, { status: 429 });

  const users = await query<{ id: string; password_hash: string; mfa_enabled: boolean }>("select id, password_hash, mfa_enabled from app_users where email = lower($1) and disabled_at is null and not is_portal_client", [email]);
  const user = users.rows[0];
  const valid = await verifyPassword(user?.password_hash, password);
  if (!user || !valid) {
    await recordFailure(rules);
    await query("insert into security_events (event_type, outcome, metadata) values ('auth.sign_in', 'denied', jsonb_build_object('email_hash', $1::text))", [hashToken(email.toLowerCase())]);
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }
  await clearFailures(rules);
  if (user.mfa_enabled) {
    const challenge = createOpaqueToken();
    await query("insert into auth_challenges (user_id, token_hash, expires_at) values ($1, $2, now() + interval '5 minutes')", [user.id, hashToken(challenge)]);
    return NextResponse.json({ mfaRequired: true, challenge });
  }
  await createSession(user.id, false);
  return NextResponse.json({ authenticated: true, mfaSetupRequired: true });
});
