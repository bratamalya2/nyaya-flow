import { NextResponse } from "next/server";
import { revokeCurrentSession } from "@/lib/auth";

export async function POST(request: Request) {
  await revokeCurrentSession();
  return NextResponse.redirect(new URL("/sign-in", request.url), 303);
}
