import { NextResponse } from "next/server";
import { ApiError, apiRoute, assertUuid } from "@/lib/api";
import { isNeo4jConfigured } from "@/lib/neo4j";
import { getResearchDocument, getResearchCitator, isResearchEnabled } from "@/lib/research";

export const GET = apiRoute<{ id: string }>({ demo: async () => NextResponse.json({ error: "Research Beta is unavailable in demo mode." }, { status: 409 }) }, async (_request, { params, workspace }) => {
  if (!isResearchEnabled()) throw new ApiError(503, "Research Beta is disabled.");
  const documentId = assertUuid(params.id, "research document");
  if (!await getResearchDocument(workspace, documentId)) throw new ApiError(404, "Research document not found in the enabled corpus.");
  const edges = await getResearchCitator(workspace, documentId);
  return NextResponse.json({ data: edges, graphConfigured: isNeo4jConfigured() });
});
