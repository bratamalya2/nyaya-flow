import { NextResponse } from "next/server";
import { ApiError, apiRoute, readJson } from "@/lib/api";
import { createOpaqueToken, hashToken } from "@/lib/auth";
import { requireMatter } from "@/lib/matters";
import { uploadIntentInput } from "@/lib/validation";

export const POST = apiRoute({ demo: async () => NextResponse.json({ error: "Demo uploads stay in browser memory.", mode: "demo" }, { status: 409 }) }, async (request, { workspace, db }) => {
  const input = await readJson(request, uploadIntentInput);
  const versionId = crypto.randomUUID();
  const uploadToken = createOpaqueToken();
  const created = await db(async (client) => {
    const matter = await requireMatter(client, workspace, input.matterId);
    let documentId = input.documentId;
    let versionNumber = 1;
    if (documentId) {
      const existing = await client.query<{ next_version: number }>(
        `select coalesce(max(v.version_number), 0) + 1 next_version from documents d left join document_versions v on v.document_id = d.id
         where d.id = $1 and d.matter_id = $2 group by d.id`,
        [documentId, matter.id],
      );
      if (!existing.rows[0]) throw new ApiError(404, "Document not found on this matter.");
      versionNumber = existing.rows[0].next_version;
      await client.query("update documents set status = 'uploaded' where id = $1", [documentId]);
    } else {
      const document = await client.query<{ id: string }>("insert into documents (organization_id, matter_id, title, status, created_by) values ($1,$2,$3,'uploaded',$4) returning id", [matter.organization_id, matter.id, input.fileName, workspace.userId]);
      documentId = document.rows[0].id;
    }
    const objectPath = `${matter.organization_id}/${matter.id}/${versionId}/original`;
    await client.query(
      `insert into document_versions (id, organization_id, document_id, version_number, storage_path, mime_type, size_bytes, sha256, status, uploaded_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,'uploaded',$9)`,
      [versionId, matter.organization_id, documentId, versionNumber, objectPath, input.mimeType, input.sizeBytes, input.sha256.toLowerCase(), workspace.userId],
    );
    await client.query(
      `insert into upload_intents (organization_id, matter_id, document_version_id, user_id, token_hash, expected_bytes, expected_sha256, expires_at)
       values ($1,$2,$3,$4,$5,$6,$7, now() + interval '15 minutes')`,
      [matter.organization_id, matter.id, versionId, workspace.userId, hashToken(uploadToken), input.sizeBytes, input.sha256.toLowerCase()],
    );
    return { documentId, versionNumber };
  });
  return NextResponse.json({ ...created, versionId, uploadUrl: `/api/v1/documents/uploads/${encodeURIComponent(uploadToken)}` }, { status: 201 });
});
