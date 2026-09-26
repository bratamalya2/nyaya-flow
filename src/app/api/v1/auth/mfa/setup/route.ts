import { authenticator } from "otplib";
import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { z } from "zod";
import { encryptMfaSecret, markSessionMfaVerified, requireSession, verifyTotp } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET() {
  const session = await requireSession({ allowUnverified: true });
  if (session.mfaVerified) return NextResponse.json({ alreadyEnabled: true });
  const secret = authenticator.generateSecret();
  await query("update app_users set mfa_pending_secret_encrypted = $1 where id = $2", [encryptMfaSecret(secret), session.userId]);
  const uri = authenticator.keyuri(session.email, "NyayaFlow", secret);
  return NextResponse.json({ qrCode: await QRCode.toDataURL(uri), manualKey: secret });
}

const schema = z.object({ code: z.string().regex(/^\d{6}$/) });
export async function POST(request: Request) {
  const session = await requireSession({ allowUnverified: true });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a six-digit code." }, { status: 400 });
  const result = await query<{ mfa_pending_secret_encrypted: string }>("select mfa_pending_secret_encrypted from app_users where id = $1", [session.userId]);
  const encrypted = result.rows[0]?.mfa_pending_secret_encrypted;
  if (!encrypted) return NextResponse.json({ error: "Start MFA setup again." }, { status: 409 });
  const { decryptMfaSecret } = await import("@/lib/auth");
  if (!verifyTotp(decryptMfaSecret(encrypted), parsed.data.code)) return NextResponse.json({ error: "Incorrect authenticator code." }, { status: 401 });
  await query("update app_users set mfa_secret_encrypted = mfa_pending_secret_encrypted, mfa_pending_secret_encrypted = null, mfa_enabled = true where id = $1", [session.userId]);
  await markSessionMfaVerified(session.id);
  return NextResponse.json({ enabled: true });
}
