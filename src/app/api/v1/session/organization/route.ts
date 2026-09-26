import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, apiRoute, readJson } from "@/lib/api";
import { ORG_COOKIE } from "@/lib/workspace";

const schema = z.object({ organizationId: z.uuid() });

export const POST = apiRoute({}, async (request, { workspace }) => {
  const { organizationId } = await readJson(request, schema);
  if (!workspace.memberships.some((membership) => membership.organizationId === organizationId)) throw new ApiError(403, "You are not a member of that organization.");
  (await cookies()).set(ORG_COOKIE, organizationId, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return NextResponse.json({ organizationId });
});
