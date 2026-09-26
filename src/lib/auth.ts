import argon2 from "argon2";
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { authenticator } from "otplib";
import { cache } from "react";
import { query } from "@/lib/db";
import { DEMO_USER_ID, isDemoMode } from "@/lib/runtime";

export const SESSION_ABSOLUTE_HOURS = 12;
export const SESSION_IDLE_MINUTES = 60;
const TOUCH_AFTER_MINUTES = 5;
const cookieName = () => process.env.SESSION_COOKIE_NAME || "nf_session";

// Accept the previous/next 30-second step for clock skew; replay is blocked by mfa_last_step.
authenticator.options = { window: 1 };

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

/** Returns the absolute TOTP time step the code belongs to, or null when the code is invalid. */
export function totpStep(secret: string, code: string, now = Date.now()) {
  const delta = authenticator.checkDelta(code.replace(/\s/g, ""), secret);
  if (delta === null) return null;
  return Math.floor(now / 1000 / authenticator.allOptions().step) + delta;
}

/** Verifies a TOTP code and records its step so the same code cannot be used twice. */
export async function consumeTotp(userId: string, secret: string, code: string) {
  const step = totpStep(secret, code);
  if (step === null) return false;
  const result = await query("update app_users set mfa_last_step=$2 where id=$1 and (mfa_last_step is null or mfa_last_step<$2) returning id", [userId, step]);
  return result.rowCount === 1;
}

let dummyHash: Promise<string> | undefined;
/** Runs Argon2 even for unknown accounts so response time does not reveal which emails exist. */
export async function verifyPassword(passwordHash: string | undefined, password: string) {
  if (!passwordHash) {
    dummyHash ??= argon2.hash("nyayaflow-timing-equalizer", { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
    await argon2.verify(await dummyHash, password).catch(() => false);
    return false;
  }
  return argon2.verify(passwordHash, password).catch(() => false);
}

export function hashPassword(password: string) {
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
}

export async function clientIp() {
  const headerStore = await headers();
  return headerStore.get("x-real-ip") || headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function createSession(userId: string, mfaVerified: boolean) {
  const token = createOpaqueToken();
  const headerStore = await headers();
  const expiresAt = new Date(Date.now() + SESSION_ABSOLUTE_HOURS * 3_600_000);
  await query(
    `insert into sessions (user_id, token_hash, mfa_verified, expires_at, ip_hash, user_agent_hash)
     values ($1, $2, $3, $4, $5, $6)`,
    [userId, hashToken(token), mfaVerified, expiresAt, hashToken(await clientIp()), hashToken(headerStore.get("user-agent") || "unknown")],
  );
  const cookieStore = await cookies();
  cookieStore.set(cookieName(), token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: expiresAt });
  return token;
}

const loadSession = cache(async (): Promise<AppSession | null> => {
  if (isDemoMode()) return { id: "demo-session", userId: DEMO_USER_ID, email: "advocate@demo.nyayaflow.test", displayName: "Adv. Meera Iyer", mfaVerified: true };
  const token = (await cookies()).get(cookieName())?.value;
  if (!token) return null;
  const result = await query<{ id: string; user_id: string; email: string; display_name: string; mfa_verified: boolean; stale: boolean }>(
    `select s.id, s.user_id, u.email, u.display_name, s.mfa_verified,
            s.last_seen_at < now() - make_interval(mins => $3) as stale
     from sessions s join app_users u on u.id = s.user_id
     where s.token_hash = $1 and s.revoked_at is null and s.expires_at > now()
       and s.last_seen_at > now() - make_interval(mins => $2) and u.disabled_at is null`,
    [hashToken(token), SESSION_IDLE_MINUTES, TOUCH_AFTER_MINUTES],
  );
  const row = result.rows[0];
  if (!row) return null;
  if (row.stale) await query("update sessions set last_seen_at = now() where id = $1", [row.id]);
  return { id: row.id, userId: row.user_id, email: row.email, displayName: row.display_name, mfaVerified: row.mfa_verified };
});

export async function getSession(options: { allowUnverified?: boolean } = {}): Promise<AppSession | null> {
  const session = await loadSession();
  if (!session || (!session.mfaVerified && !options.allowUnverified)) return null;
  return session;
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
  if (token) await query("update sessions set revoked_at = now() where token_hash = $1 and revoked_at is null", [hashToken(token)]);
  (await cookies()).delete(cookieName());
}

export interface SessionSummary {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  current: boolean;
}

export async function listSessions(session: AppSession): Promise<SessionSummary[]> {
  if (isDemoMode()) return [{ id: session.id, createdAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(), expiresAt: new Date(Date.now() + SESSION_ABSOLUTE_HOURS * 3_600_000).toISOString(), current: true }];
  const result = await query<{ id: string; created_at: Date; last_seen_at: Date; expires_at: Date }>(
    `select id, created_at, last_seen_at, expires_at from sessions
     where user_id = $1 and revoked_at is null and expires_at > now() and last_seen_at > now() - make_interval(mins => $2)
     order by last_seen_at desc`,
    [session.userId, SESSION_IDLE_MINUTES],
  );
  return result.rows.map((row) => ({ id: row.id, createdAt: row.created_at.toISOString(), lastSeenAt: row.last_seen_at.toISOString(), expiresAt: row.expires_at.toISOString(), current: row.id === session.id }));
}

export async function revokeSessions(userId: string, options: { sessionId?: string; exceptSessionId?: string }) {
  const result = await query(
    `update sessions set revoked_at = now()
     where user_id = $1 and revoked_at is null and ($2::uuid is null or id = $2) and ($3::uuid is null or id <> $3)`,
    [userId, options.sessionId ?? null, options.exceptSessionId ?? null],
  );
  return result.rowCount ?? 0;
}

export function constantTimeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
