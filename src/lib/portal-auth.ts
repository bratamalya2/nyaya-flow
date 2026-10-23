import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { query, withPortalClient } from "@/lib/db";
import { hashToken } from "@/lib/auth";

const COOKIE = "nf_portal";
const HOURS = 12;
export type PortalSession = { id: string; clientId: string; organizationId: string; userId: string; email: string; displayName: string };
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export async function createPortalSession(clientId: string) {
  const token = randomBytes(32).toString("base64url"); const headerStore = await headers(); const expires = new Date(Date.now() + HOURS * 3_600_000);
  await withPortalClient(clientId, (client) => client.query("insert into portal_sessions(client_id,token_hash,expires_at,ip_hash,user_agent_hash) values($1,$2,$3,$4,$5)", [clientId, hashToken(token), expires, hash((headerStore.get("x-forwarded-for") || "unknown").split(",")[0]), hash(headerStore.get("user-agent") || "unknown")]));
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires });
}
export const getPortalSession = cache(async (): Promise<PortalSession | null> => {
  const token = (await cookies()).get(COOKIE)?.value; if (!token) return null;
  const result = await query<{ session_id: string; client_id: string; organization_id: string; user_id: string; email: string; display_name: string }>("select * from portal_session_lookup($1)", [hashToken(token)]);
  const row = result.rows[0]; if (!row) return null;
  return { id: row.session_id, clientId: row.client_id, organizationId: row.organization_id, userId: row.user_id, email: row.email, displayName: row.display_name };
});
export async function revokePortalSession() { const session = await getPortalSession(); if (session) await withPortalClient(session.clientId, (client) => client.query("update portal_sessions set revoked_at=now() where id=$1", [session.id])); (await cookies()).delete(COOKIE); }
