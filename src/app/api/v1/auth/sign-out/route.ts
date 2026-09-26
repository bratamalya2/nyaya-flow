import { NextResponse } from "next/server";
import { getSession, revokeCurrentSession } from "@/lib/auth";
import { auditAuthEvent } from "@/lib/auth-events";
import { isDemoMode } from "@/lib/runtime";

export async function POST(request: Request) {
  if (!isDemoMode()) {
    const session = await getSession({ allowUnverified: true });
    if (session?.mfaVerified) await auditAuthEvent(session.userId, "auth.sign_out").catch(() => undefined);
    await revokeCurrentSession();
  }
  return NextResponse.redirect(new URL("/sign-in", request.url), 303);
}
