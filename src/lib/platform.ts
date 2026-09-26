import argon2 from "argon2";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { clientIp, constantTimeEqual, createOpaqueToken, hashToken, totpStep } from "@/lib/auth";
import { query } from "@/lib/db";

// The platform superadmin lives in the server environment, not in the database:
//   SUPERADMIN_EMAIL          sign-in email
//   SUPERADMIN_PASSWORD_HASH  base64url of an Argon2id hash (no `$`, so .env expansion cannot corrupt it)
//   SUPERADMIN_TOTP_SECRET    base32 TOTP secret; MFA is mandatory
// Generate the last two with `npm run superadmin:setup`. The console is disabled unless all three are set.

export const PLATFORM_COOKIE = "nf_platform";
export const PLATFORM_ABSOLUTE_HOURS = 8;
export const PLATFORM_IDLE_MINUTES = 30;

export interface PlatformConfig {
  email: string;
  passwordHash: string;
  totpSecret: string;
}

export function encodePasswordHash(hash: string) {
  return Buffer.from(hash, "utf8").toString("base64url");
}

export function platformConfig(env: Record<string, string | undefined> = process.env): PlatformConfig | null {
  const email = env.SUPERADMIN_EMAIL?.trim().toLowerCase();
  const encoded = env.SUPERADMIN_PASSWORD_HASH?.trim();
  const totpSecret = env.SUPERADMIN_TOTP_SECRET?.trim().replace(/\s/g, "").toUpperCase();
  if (!email || !encoded || !totpSecret) return null;
  const passwordHash = Buffer.from(encoded, "base64url").toString("utf8");
  if (!passwordHash.startsWith("$argon2id$")) return null;
  if (!/^[A-Z2-7]{16,}=*$/.test(totpSecret)) return null;
  return { email, passwordHash, totpSecret };
}

export const isPlatformEnabled = () => platformConfig() !== null;
const emailHash = (email: string) => hashToken(`platform:${email.toLowerCase()}`);

export async function recordPlatformAudit(event: { action: string; resourceType: string; resourceId?: string; outcome: "success" | "denied" | "error"; actorEmail?: string; metadata?: Record<string, unknown> }) {
  await query(
    "insert into platform_audit_events (actor_email_hash, action, resource_type, resource_id, outcome, ip_hash, metadata) values ($1,$2,$3,$4,$5,$6,$7)",
    [event.actorEmail ? emailHash(event.actorEmail) : null, event.action, event.resourceType, event.resourceId ?? null, event.outcome, hashToken(await clientIp()), event.metadata ?? {}],
  );
}

/** Checks email, password, and a fresh TOTP code. Always runs Argon2 so timing does not reveal which part failed. */
export async function verifyPlatformCredentials(config: PlatformConfig, input: { email: string; password: string; code: string }) {
  const emailOk = constantTimeEqual(input.email.trim().toLowerCase(), config.email);
  const passwordOk = await argon2.verify(config.passwordHash, input.password).catch(() => false);
  if (!emailOk || !passwordOk) return false;
  const step = totpStep(config.totpSecret, input.code);
  if (step === null) return false;
  const stored = await query(
    `insert into platform_totp_steps (admin_email_hash, last_step) values ($1, $2)
     on conflict (admin_email_hash) do update set last_step = excluded.last_step where platform_totp_steps.last_step < excluded.last_step
     returning last_step`,
    [emailHash(config.email), step],
  );
  return stored.rowCount === 1;
}

export async function createPlatformSession(config: PlatformConfig) {
  const token = createOpaqueToken();
  const expiresAt = new Date(Date.now() + PLATFORM_ABSOLUTE_HOURS * 3_600_000);
  await query("insert into platform_sessions (token_hash, admin_email_hash, ip_hash, expires_at) values ($1,$2,$3,$4)", [hashToken(token), emailHash(config.email), hashToken(await clientIp()), expiresAt]);
  (await cookies()).set(PLATFORM_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", expires: expiresAt });
}

export interface PlatformSession { id: string; email: string }

/** The current platform session, valid only while it matches the configured superadmin email. */
export const getPlatformSession = cache(async (): Promise<PlatformSession | null> => {
  const config = platformConfig();
  if (!config) return null;
  const token = (await cookies()).get(PLATFORM_COOKIE)?.value;
  if (!token) return null;
  const result = await query<{ id: string }>(
    `update platform_sessions set last_seen_at = now()
     where token_hash = $1 and admin_email_hash = $2 and revoked_at is null and expires_at > now()
       and last_seen_at > now() - make_interval(mins => $3)
     returning id`,
    [hashToken(token), emailHash(config.email), PLATFORM_IDLE_MINUTES],
  );
  return result.rows[0] ? { id: result.rows[0].id, email: config.email } : null;
});

export async function revokePlatformSession() {
  const token = (await cookies()).get(PLATFORM_COOKIE)?.value;
  if (token) await query("update platform_sessions set revoked_at = now() where token_hash = $1 and revoked_at is null", [hashToken(token)]);
  (await cookies()).delete(PLATFORM_COOKIE);
}

/** For pages: 404 when the console is not configured, sign-in redirect when there is no session. */
export async function requirePlatformSession() {
  if (!isPlatformEnabled()) notFound();
  const session = await getPlatformSession();
  if (!session) redirect("/platform/sign-in");
  return session;
}
