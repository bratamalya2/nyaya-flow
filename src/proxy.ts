import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginMutation } from "@/lib/origin";

export function proxy(request: NextRequest) {
  const allowed = isSameOriginMutation(request.method, request.headers.get("origin"), request.headers.get("host"), process.env.APP_BASE_URL);
  if (!allowed) return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
