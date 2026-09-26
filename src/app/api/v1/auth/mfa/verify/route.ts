import { NextResponse } from "next/server";
import { z } from "zod";
import { publicRoute, readJson } from "@/lib/api";
import { clientIp, consumeTotp, createSession, decryptMfaSecret, hashToken } from "@/lib/auth";
import { auditAuthEvent } from "@/lib/auth-events";
import { query } from "@/lib/db";
import { clearFailures, lockedUntil, mfaRules, recordFailure } from "@/lib/throttle";

const schema = z.object({ challenge: z.string().min(20).max(100), code: z.string().regex(/^\d{6}$/) });
const expired = () => NextResponse.json({ error: "MFA challenge expired. Sign in again." }, { status: 401 });

export const POST = publicRoute(async (request) => {
  const { challenge, code } = await readJson(request, schema);
  const result = await query<{ id: string; user_id: string; mfa_secret_encrypted: string }>(
    `select c.id, c.user_id, u.mfa_secret_encrypted from auth_challenges c join app_users u on u.id = c.user_id
     where c.token_hash = $1 and c.used_at is null and c.expires_at > now() and u.disabled_at is null`,
    [hashToken(challenge)],
  );
  const row = result.rows[0];
  if (!row) return expired();
  const rules = mfaRules(row.user_id, await clientIp());
  if (await lockedUntil(rules)) return NextResponse.json({ error: "Too many verification attempts. Try again in 15 minutes." }, { status: 429 });

  // Count the attempt atomically before checking the code so parallel guesses cannot exceed the limit.
  const attempt = await query("update auth_challenges set attempts = attempts + 1 where id = $1 and attempts < 5 and used_at is null returning attempts", [row.id]);
  if (!attempt.rowCount) return expired();
  if (!(await consumeTotp(row.user_id, decryptMfaSecret(row.mfa_secret_encrypted), code))) {
    await recordFailure(rules);
    return NextResponse.json({ error: "Incorrect or already used authenticator code." }, { status: 401 });
  }
  const used = await query("update auth_challenges set used_at = now() where id = $1 and used_at is null returning id", [row.id]);
  if (!used.rowCount) return expired();
  await clearFailures(rules);
  await createSession(row.user_id, true);
  await auditAuthEvent(row.user_id, "auth.sign_in", { method: "password+totp" });
  return NextResponse.json({ authenticated: true });
});
