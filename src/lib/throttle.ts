import { hashToken } from "@/lib/auth";
import { query } from "@/lib/db";

export interface ThrottleRule {
  bucket: string;
  limit: number;
  windowMinutes: number;
  lockMinutes: number;
}

export const signInRules = (email: string, ip: string): ThrottleRule[] => [
  { bucket: `email:${hashToken(email.trim().toLowerCase())}`, limit: 5, windowMinutes: 15, lockMinutes: 15 },
  { bucket: `ip:${hashToken(ip)}`, limit: 30, windowMinutes: 15, lockMinutes: 15 },
];

export const mfaRules = (userId: string, ip: string): ThrottleRule[] => [
  { bucket: `mfa:${userId}`, limit: 5, windowMinutes: 15, lockMinutes: 15 },
  { bucket: `ip:${hashToken(ip)}`, limit: 30, windowMinutes: 15, lockMinutes: 15 },
];

/** Returns the latest lock expiry among the buckets, or null when none is locked. */
export async function lockedUntil(rules: ThrottleRule[]) {
  const result = await query<{ locked_until: Date }>(
    "select max(locked_until) locked_until from auth_throttle where bucket = any($1) and locked_until > now()",
    [rules.map((rule) => rule.bucket)],
  );
  return result.rows[0]?.locked_until ?? null;
}

export async function recordFailure(rules: ThrottleRule[]) {
  for (const rule of rules) {
    await query(
      `insert into auth_throttle(bucket, failures, window_started_at) values ($1, 1, now())
       on conflict (bucket) do update set
         failures = case when auth_throttle.window_started_at < now() - make_interval(mins => $2) then 1 else auth_throttle.failures + 1 end,
         window_started_at = case when auth_throttle.window_started_at < now() - make_interval(mins => $2) then now() else auth_throttle.window_started_at end,
         locked_until = case
           when (case when auth_throttle.window_started_at < now() - make_interval(mins => $2) then 1 else auth_throttle.failures + 1 end) >= $3
           then now() + make_interval(mins => $4) else auth_throttle.locked_until end`,
      [rule.bucket, rule.windowMinutes, rule.limit, rule.lockMinutes],
    );
  }
}

export async function clearFailures(rules: ThrottleRule[]) {
  await query("delete from auth_throttle where bucket = any($1)", [rules.filter((rule) => !rule.bucket.startsWith("ip:")).map((rule) => rule.bucket)]);
}
