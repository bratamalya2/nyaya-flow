import { NextResponse } from "next/server";
import { getSession, hashToken } from "@/lib/auth";
import { withActor } from "@/lib/db";
import { storeRequestBody } from "@/lib/storage";

export const runtime = "nodejs";

export async function PUT(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { token } = await params;
  try {
    const intent = await withActor(session.userId, async (client) => {
      const result = await client.query<{ id: string; document_version_id: string; storage_path: string; expected_bytes: string; expected_sha256: string }>(
        `select i.id, i.document_version_id, v.storage_path, i.expected_bytes::text, i.expected_sha256
         from upload_intents i join document_versions v on v.id = i.document_version_id
         where i.token_hash = $1 and i.user_id = $2 and i.used_at is null and i.claimed_at is null and i.expires_at > now() for update`,
        [hashToken(token), session.userId],
      );
      if (!result.rows[0]) throw new Error("Upload intent is invalid or expired.");
      await client.query("update upload_intents set claimed_at=now() where id=$1", [result.rows[0].id]);
      return result.rows[0];
    });
    await storeRequestBody(request, intent.storage_path, Number(intent.expected_bytes), intent.expected_sha256);
    await withActor(session.userId, async (client) => {
      await client.query("update upload_intents set used_at = now() where id = $1", [intent.id]);
      await client.query("update document_versions set status = 'quarantined' where id = $1", [intent.document_version_id]);
      await client.query(`insert into background_jobs (organization_id, job_type, payload) select organization_id, 'malware_scan', jsonb_build_object('documentVersionId', id) from document_versions where id = $1`, [intent.document_version_id]);
    });
    return NextResponse.json({ uploaded: true, status: "quarantined" });
  } catch (error) {
    await withActor(session.userId, (client) => client.query("update upload_intents set claimed_at=null where token_hash=$1 and used_at is null", [hashToken(token)])).catch(() => undefined);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 400 });
  }
}
