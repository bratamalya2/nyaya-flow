import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute, readJson } from "@/lib/api";
import { listSessions, revokeCurrentSession, revokeSessions } from "@/lib/auth";
import { auditAuthEvent } from "@/lib/auth-events";

export const GET = apiRoute({ demo: async () => NextResponse.json({ data: [], mode: "demo" }) }, async (_request, { workspace }) => {
  return NextResponse.json({ data: await listSessions(workspace.session) });
});

const schema = z.union([z.object({ sessionId: z.uuid() }), z.object({ others: z.literal(true) })]);

export const DELETE = apiRoute({}, async (request, { workspace }) => {
  const body = await readJson(request, schema);
  const current = workspace.session.id;
  const revoked = "others" in body
    ? await revokeSessions(workspace.userId, { exceptSessionId: current })
    : await revokeSessions(workspace.userId, { sessionId: body.sessionId });
  await auditAuthEvent(workspace.userId, "auth.sessions_revoked", { count: revoked, scope: "others" in body ? "others" : "one" });
  if ("sessionId" in body && body.sessionId === current) await revokeCurrentSession();
  return NextResponse.json({ revoked, signedOut: "sessionId" in body && body.sessionId === current });
});
