import { NextResponse } from "next/server";
import { ApiError, apiRoute } from "@/lib/api";
import { hashToken } from "@/lib/auth";
import { searchDocuments } from "@/lib/repositories/workspace";

const queryOf = (request: Request) => {
  const search = new URL(request.url).searchParams.get("q")?.trim();
  if (!search || search.length < 2 || search.length > 200) throw new ApiError(400, "Search query must contain 2–200 characters.");
  return search;
};

export const GET = apiRoute({
  demo: async (request) => NextResponse.json({ data: await searchDocuments({} as never, queryOf(request)), mode: "demo" }),
}, async (request, { workspace, db, audit }) => {
  const search = queryOf(request);
  const hits = await searchDocuments(workspace, search);
  // Search terms can themselves be privileged; the audit trail keeps only a hash.
  await db((client) => audit(client, { action: "document.search", resourceType: "search", outcome: "success", metadata: { queryHash: hashToken(search.toLowerCase()), results: hits.length } }));
  return NextResponse.json({ data: hits });
});
