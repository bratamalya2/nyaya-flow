import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { ApiError, apiRoute, assertUuid } from "@/lib/api";
import { contentDisposition } from "@/lib/http";
import { resolveStoragePath } from "@/lib/storage";

export const runtime = "nodejs";

// [id] is a document version id. Authorization is re-checked on every request, so revoked access
// takes effect immediately; no bearer download links are issued.
export const GET = apiRoute<{ id: string }>({ demo: async () => NextResponse.json({ error: "Demo documents have no stored file.", mode: "demo" }, { status: 409 }) }, async (_request, { params, workspace, db, audit }) => {
  const versionId = assertUuid(params.id, "document");
  const version = await db(async (client) => {
    const result = await client.query<{ storage_path: string; mime_type: string; title: string; version_number: number }>(
      `select v.storage_path, v.mime_type, d.title, v.version_number from document_versions v join documents d on d.id = v.document_id
       where v.id = $1 and v.organization_id = $2 and v.status = 'ready'`,
      [versionId, workspace.organizationId],
    );
    if (!result.rows[0]) throw new ApiError(404, "Document not found, not yet cleared, or access revoked.");
    await audit(client, { action: "document.download", resourceType: "document_version", resourceId: versionId, outcome: "success" });
    return result.rows[0];
  });
  const file = resolveStoragePath(version.storage_path);
  const info = await stat(file).catch(() => null);
  if (!info) throw new ApiError(404, "Stored file is unavailable.");
  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new Response(stream, {
    headers: {
      "content-type": version.mime_type,
      "content-length": String(info.size),
      "content-disposition": contentDisposition(version.title),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
});
