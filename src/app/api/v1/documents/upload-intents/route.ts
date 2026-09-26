import { NextResponse } from "next/server";
import { createOpaqueToken, getSession, hashToken } from "@/lib/auth";
import { withActor } from "@/lib/db";
import { uploadIntentInput } from "@/lib/validation";

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") return NextResponse.json({ error: "Demo uploads stay in browser memory." }, { status: 409 });
  const parsed = uploadIntentInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid upload metadata.", issues: parsed.error.flatten() }, { status: 400 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const versionId = crypto.randomUUID();
  const objectPath = `${parsed.data.organizationId}/${parsed.data.matterId}/${versionId}/original`;
  const uploadToken = createOpaqueToken();
  try {
    const ids = await withActor(session.userId, async (client) => {
      const document = await client.query<{ id: string }>(`insert into documents (organization_id, matter_id, title, status, created_by) values ($1,$2,$3,'uploaded',$4) returning id`, [parsed.data.organizationId, parsed.data.matterId, parsed.data.fileName, session.userId]);
      await client.query(`insert into document_versions (id, organization_id, document_id, storage_path, mime_type, size_bytes, sha256, status, uploaded_by) values ($1,$2,$3,$4,$5,$6,$7,'uploaded',$8)`, [versionId, parsed.data.organizationId, document.rows[0].id, objectPath, parsed.data.mimeType, parsed.data.sizeBytes, parsed.data.sha256, session.userId]);
      await client.query(`insert into upload_intents (organization_id, matter_id, document_version_id, user_id, token_hash, expected_bytes, expected_sha256, expires_at) values ($1,$2,$3,$4,$5,$6,$7,now() + interval '15 minutes')`, [parsed.data.organizationId, parsed.data.matterId, versionId, session.userId, hashToken(uploadToken), parsed.data.sizeBytes, parsed.data.sha256]);
      return { documentId: document.rows[0].id };
    });
    return NextResponse.json({ ...ids, versionId, path: objectPath, uploadUrl: `/api/v1/documents/uploads/${encodeURIComponent(uploadToken)}` }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create upload intent." }, { status: 400 });
  }
}
