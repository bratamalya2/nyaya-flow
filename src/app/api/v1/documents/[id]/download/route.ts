import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { withActor } from "@/lib/db";
import { resolveStoragePath } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await params;
  const result = await withActor(session.userId, (client) => client.query<{ storage_path: string; mime_type: string; title: string }>(
    `select v.storage_path,v.mime_type,d.title from document_versions v join documents d on d.id=v.document_id where v.id=$1 and v.status='ready'`, [id],
  ));
  const version = result.rows[0];
  if (!version) return NextResponse.json({ error: "Document not found or access revoked." }, { status: 404 });
  const file = resolveStoragePath(version.storage_path);
  const info = await stat(file).catch(() => null);
  if (!info) return NextResponse.json({ error: "Stored file is unavailable." }, { status: 404 });
  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
  const filename = version.title.replace(/["\\\r\n]/g, "_");
  return new Response(stream, { headers: { "content-type": version.mime_type, "content-length": String(info.size), "content-disposition": `attachment; filename="${filename}"`, "cache-control": "private, no-store" } });
}
