import { NextResponse } from "next/server";
import { ApiError, errorResponse } from "@/lib/api";
import { getPlatformSession, isPlatformEnabled, type PlatformSession } from "@/lib/platform";

/** Route wrapper for the platform console: 404 when not configured, 401 without a platform session. */
export function platformRoute<P = Record<string, never>>(handler: (request: Request, context: { params: P; session: PlatformSession; correlationId: string }) => Promise<Response>) {
  return async (request: Request, segment: { params: Promise<P> }) => {
    const correlationId = crypto.randomUUID();
    try {
      if (!isPlatformEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404 });
      const session = await getPlatformSession();
      if (!session) throw new ApiError(401, "Platform sign-in required.");
      const params = segment?.params ? await segment.params : ({} as P);
      return await handler(request, { params, session, correlationId });
    } catch (error) {
      return errorResponse(error, correlationId);
    }
  };
}

export function invitationLink(request: Request, token: string) {
  const base = (process.env.APP_BASE_URL || new URL(request.url).origin).replace(/\/$/, "");
  return `${base}/invite/${token}`;
}
