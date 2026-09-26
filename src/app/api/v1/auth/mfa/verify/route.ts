import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, decryptMfaSecret, hashToken, verifyTotp } from "@/lib/auth";
import { query } from "@/lib/db";

const schema = z.object({ challenge: z.string().min(20).max(100), code: z.string().regex(/^\d{6}$/) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid MFA challenge." }, { status: 400 });
  const result = await query<{ id: string; user_id: string; mfa_secret_encrypted: string; attempts: number }>(
    `select c.id, c.user_id, u.mfa_secret_encrypted, c.attempts from auth_challenges c join app_users u on u.id = c.user_id
     where c.token_hash = $1 and c.used_at is null and c.expires_at > now() for update`,
    [hashToken(parsed.data.challenge)],
  );
  const challenge = result.rows[0];
  if (!challenge || challenge.attempts >= 5) return NextResponse.json({ error: "MFA challenge expired." }, { status: 401 });
  const valid = verifyTotp(decryptMfaSecret(challenge.mfa_secret_encrypted), parsed.data.code);
  if (!valid) {
    await query("update auth_challenges set attempts = attempts + 1 where id = $1", [challenge.id]);
    return NextResponse.json({ error: "Incorrect authenticator code." }, { status: 401 });
  }
  await query("update auth_challenges set used_at = now() where id = $1", [challenge.id]);
  await createSession(challenge.user_id, true);
  return NextResponse.json({ authenticated: true });
}
