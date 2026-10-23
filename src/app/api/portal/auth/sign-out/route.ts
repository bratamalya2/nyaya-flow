import { NextResponse } from "next/server";
import { publicRoute } from "@/lib/api";
import { revokePortalSession } from "@/lib/portal-auth";
export const POST = publicRoute(async () => { await revokePortalSession(); return NextResponse.json({ data: { ok: true } }); });
