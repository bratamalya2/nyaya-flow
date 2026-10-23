import { NextResponse } from "next/server";
import { ApiError, apiRoute, assertUuid } from "@/lib/api";
import { getResearchDocument, isResearchEnabled } from "@/lib/research";

export const GET = apiRoute<{ id: string }>({ demo: async () => NextResponse.json({ error: "Research Beta is unavailable in demo mode." }, { status: 409 }) }, async (_request, { params, workspace }) => {
  if (!isResearchEnabled()) throw new ApiError(503, "Research Beta is disabled.");
  const document = await getResearchDocument(workspace, assertUuid(params.id, "research document"));
  if (!document) throw new ApiError(404, "Research document not found in the enabled corpus.");
  return NextResponse.json({ data: document });
});
