import argon2 from "argon2";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createOpaqueToken, createSession, hashToken } from "@/lib/auth";
import { query } from "@/lib/db";

const schema = z.object({ email: z.email().max(254), password: z.string().min(8).max(256) });

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") return NextResponse.json({ authenticated: true });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid credentials." }, { status: 400 });
  const users = await query<{ id: string; password_hash: string; mfa_enabled: boolean }>("select id, password_hash, mfa_enabled from app_users where email = lower($1) and disabled_at is null", [parsed.data.email]);
  const user = users.rows[0];
  const valid = user ? await argon2.verify(user.password_hash, parsed.data.password).catch(() => false) : false;
  if (!user || !valid) {
    await query("insert into security_events (event_type, outcome, metadata) values ('auth.sign_in', 'denied', jsonb_build_object('email_hash', encode(digest(lower($1), 'sha256'), 'hex')))", [parsed.data.email]);
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }
  if (user.mfa_enabled) {
    const challenge = createOpaqueToken();
    await query("insert into auth_challenges (user_id, token_hash, expires_at) values ($1, $2, now() + interval '5 minutes')", [user.id, hashToken(challenge)]);
    return NextResponse.json({ mfaRequired: true, challenge });
  }
  await createSession(user.id, false);
  return NextResponse.json({ authenticated: true, mfaSetupRequired: true });
}
