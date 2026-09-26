import { NextResponse } from "next/server";
import { ApiError, apiRoute, assertUuid } from "@/lib/api";
import { listOcrPages } from "@/lib/repositories/workspace";
import { ocrPages } from "@/lib/sample-data";

export const GET = apiRoute<{ id: string }>({ demo: async () => NextResponse.json({ data: ocrPages, mode: "demo" }) }, async (_request, { params, workspace, db, audit }) => {
  const versionId = assertUuid(params.id, "document");
  const pages = await listOcrPages(workspace, versionId);
  if (!pages) throw new ApiError(404, "Document not found or access denied.");
  await db((client) => audit(client, { action: "document.pages.view", resourceType: "document_version", resourceId: versionId, outcome: "success", metadata: { pages: pages.length } }));
  return NextResponse.json({ data: pages });
});
