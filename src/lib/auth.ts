import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { authenticator } from "otplib";
import { query } from "@/lib/db";

const SESSION_DAYS = 7;
const cookieName = () => process.env.SESSION_COOKIE_NAME || "nf_session";

export interface AppSession {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  mfaVerified: boolean;
}

export function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createOpaqueToken() {
  return randomBytes(32).toString("base64url");
}

function encryptionKey() {
  const configured = process.env.MFA_ENCRYPTION_KEY;
  if (!configured) throw new Error("MFA_ENCRYPTION_KEY is required.");
  const key = Buffer.from(configured, "base64");
  if (key.length !== 32) throw new Error("MFA_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  return key;
}

export function encryptMfaSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptMfaSecret(value: string) {
  const [iv, tag, encrypted] = value.split(".").map((part) => Buffer.from(part, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function verifyTotp(secret: string, code: string) {
  return authenticator.verify({ token: code.replace(/\s/g, ""), secret });
}

export async function createSession(userId: string, mfaVerified: boolean) {
  const token = createOpaqueToken();
  const headerStore = await headers();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await query(
    `insert into sessions (user_id, token_hash, mfa_verified, expires_at, ip_hash, user_agent_hash)
     values ($1, $2, $3, $4, $5, $6)`,
    [userId, hashToken(token), mfaVerified, expiresAt, hashToken(headerStore.get("x-forwarded-for") || "unknown"), hashToken(headerStore.get("user-agent") || "unknown")],
  );
  const cookieStore = await cookies();
  cookieStore.set(cookieName(), token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: expiresAt });
  return token;
}

export async function getSession(options: { allowUnverified?: boolean } = {}): Promise<AppSession | null> {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") return { id: "demo-session", userId: "00000000-0000-4000-8000-000000000101", email: "vikram@demo.nyayaflow.in", displayName: "Adv. Vikram Sen", mfaVerified: true };
  const token = (await cookies()).get(cookieName())?.value;
  if (!token) return null;
  const result = await query<{ id: string; user_id: string; email: string; display_name: string; mfa_verified: boolean }>(
    `select s.id, s.user_id, u.email, u.display_name, s.mfa_verified
     from sessions s join app_users u on u.id = s.user_id
     where s.token_hash = $1 and s.revoked_at is null and s.expires_at > now() and u.disabled_at is null`,
    [hashToken(token)],
  );
  const row = result.rows[0];
  if (!row || (!row.mfa_verified && !options.allowUnverified)) return null;
  return { id: row.id, userId: row.user_id, email: row.email, displayName: row.display_name, mfaVerified: row.mfa_verified };
}

export async function requireSession(options: { allowUnverified?: boolean } = {}) {
  const session = await getSession(options);
  if (!session) redirect("/sign-in");
  return session;
}

export async function markSessionMfaVerified(sessionId: string) {
  await query("update sessions set mfa_verified = true, last_seen_at = now() where id = $1", [sessionId]);
}

export async function revokeCurrentSession() {
  const token = (await cookies()).get(cookieName())?.value;
  if (token) await query("update sessions set revoked_at = now() where token_hash = $1", [hashToken(token)]);
  (await cookies()).delete(cookieName());
}

export function constantTimeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
