import { NextResponse } from "next/server";
import { ApiError, publicRoute, readJson } from "@/lib/api";
import { hashPassword, hashToken } from "@/lib/auth";
import { createPortalSession } from "@/lib/portal-auth";
import { portalActivateInput } from "@/lib/validation";
import { query } from "@/lib/db";
export const POST = publicRoute(async (request) => { const input = await readJson(request, portalActivateInput); const invite = await query<{ client_id: string; user_id: string }>("select * from consume_portal_invitation($1,$2)", [hashToken(input.token), await hashPassword(input.password)]); if (!invite.rows[0]) throw new ApiError(400, "Activation link is invalid, used, or expired."); await createPortalSession(invite.rows[0].client_id); return NextResponse.json({ data: { ok: true } }); });
