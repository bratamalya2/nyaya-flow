import { NextResponse } from "next/server";
import { ApiError, publicRoute, readJson } from "@/lib/api";
import { verifyPassword } from "@/lib/auth";
import { createPortalSession } from "@/lib/portal-auth";
import { portalSignInInput } from "@/lib/validation";
import { query } from "@/lib/db";
export const POST = publicRoute(async (request) => { const input = await readJson(request, portalSignInInput); const result = await query<{ client_id: string; password_hash: string }>("select * from portal_client_credentials($1)", [input.email]); const row = result.rows[0]; if (!await verifyPassword(row?.password_hash, input.password)) throw new ApiError(401, "Email or password is incorrect."); await createPortalSession(row.client_id); return NextResponse.json({ data: { ok: true } }); });
