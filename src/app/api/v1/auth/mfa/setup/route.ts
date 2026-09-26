import { NextResponse } from "next/server";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { z } from "zod";
import { ApiError, publicRoute, readJson } from "@/lib/api";
import { consumeTotp, decryptMfaSecret, encryptMfaSecret, getSession, markSessionMfaVerified } from "@/lib/auth";
import { auditAuthEvent } from "@/lib/auth-events";
import { query } from "@/lib/db";
import { isDemoMode } from "@/lib/runtime";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("confirm"), code: z.string().regex(/^\d{6}$/) }),
]);

export const POST = publicRoute(async (request) => {
  if (isDemoMode()) return NextResponse.json({ alreadyEnabled: true, mode: "demo" });
  const session = await getSession({ allowUnverified: true });
  if (!session) throw new ApiError(401, "Sign in again to set up MFA.");
  if (session.mfaVerified) return NextResponse.json({ alreadyEnabled: true });
  const user = await query<{ mfa_enabled: boolean; mfa_pending_secret_encrypted: string | null }>("select mfa_enabled, mfa_pending_secret_encrypted from app_users where id = $1", [session.userId]);
  // An unverified session must never replace an enrolled authenticator.
  if (user.rows[0]?.mfa_enabled) throw new ApiError(409, "MFA is already enrolled. Sign in again with your authenticator code.");

  const body = await readJson(request, schema);
  if (body.action === "start") {
    const secret = authenticator.generateSecret();
    await query("update app_users set mfa_pending_secret_encrypted = $1 where id = $2", [encryptMfaSecret(secret), session.userId]);
    const uri = authenticator.keyuri(session.email, "NyayaFlow", secret);
    return NextResponse.json({ qrCode: await QRCode.toDataURL(uri), manualKey: secret });
  }

  const pending = user.rows[0]?.mfa_pending_secret_encrypted;
  if (!pending) throw new ApiError(409, "Start MFA setup again.");
  if (!(await consumeTotp(session.userId, decryptMfaSecret(pending), body.code))) throw new ApiError(401, "Incorrect authenticator code.");
  await query("update app_users set mfa_secret_encrypted = mfa_pending_secret_encrypted, mfa_pending_secret_encrypted = null, mfa_enabled = true where id = $1", [session.userId]);
  await markSessionMfaVerified(session.id);
  await auditAuthEvent(session.userId, "auth.mfa_enrolled");
  await auditAuthEvent(session.userId, "auth.sign_in", { method: "password+totp-enrollment" });
  return NextResponse.json({ enabled: true });
});
