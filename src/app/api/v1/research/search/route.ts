import { NextResponse } from "next/server";
import { ApiError, apiRoute } from "@/lib/api";
import { hashToken } from "@/lib/auth";
import { isResearchEnabled, searchResearch } from "@/lib/research";

function inputOf(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim();
  if (!query || query.length < 2 || query.length > 500) throw new ApiError(400, "Research query must contain 2–500 characters.");
  const filter = (name: string, max: number) => {
    const value = params.get(name)?.trim();
    return value && value.length <= max ? value : undefined;
  };
  return { query, jurisdiction: filter("jurisdiction", 160), court: filter("court", 200), documentType: filter("documentType", 24) };
}

export const GET = apiRoute({ demo: async () => NextResponse.json({ error: "Research Beta is unavailable in demo mode; use the synthetic preview instead." }, { status: 409 }) }, async (request, { workspace, db, audit }) => {
  if (!isResearchEnabled()) throw new ApiError(503, "Research Beta is disabled. An administrator must enable an approved corpus first.");
  const input = inputOf(request);
  const results = await searchResearch(workspace, input.query, input);
  // Research terms can be confidential. The audit log retains only an irreversible digest.
  await db(async (client) => {
    await client.query(
      `insert into research_queries(organization_id,created_by,query_text,filters,result_count,corpus_snapshot)
       values($1,$2,$3,$4::jsonb,$5,jsonb_build_object('at',now(),'fixturesEnabled',$6::boolean))`,
      [workspace.organizationId, workspace.userId, input.query, JSON.stringify({ jurisdiction: input.jurisdiction, court: input.court, documentType: input.documentType }), results.length, process.env.RESEARCH_FIXTURES_ENABLED === "true"],
    );
    await audit(client, { action: "research.search", resourceType: "research_query", outcome: "success", metadata: { queryHash: hashToken(input.query.toLowerCase()), results: results.length } });
  });
  return NextResponse.json({ data: results, corpus: { enabled: true, fixturesEnabled: process.env.RESEARCH_FIXTURES_ENABLED === "true" } });
});
