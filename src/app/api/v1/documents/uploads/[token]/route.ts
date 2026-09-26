import { NextResponse } from "next/server";
import { ApiError, apiRoute } from "@/lib/api";
import { hashToken } from "@/lib/auth";
import { storeRequestBody } from "@/lib/storage";

export const runtime = "nodejs";

type Intent = { id: string; organization_id: string; document_version_id: string; storage_path: string; expected_bytes: string; expected_sha256: string };

export const PUT = apiRoute<{ token: string }>({}, async (request, { params, workspace, db, audit }) => {
  const tokenHash = hashToken(params.token);
  const intent = await db(async (client) => {
    const result = await client.query<Intent>(
      `select i.id, i.organization_id, i.document_version_id, v.storage_path, i.expected_bytes::text, i.expected_sha256
       from upload_intents i join document_versions v on v.id = i.document_version_id
       where i.token_hash = $1 and i.user_id = $2 and i.used_at is null and i.claimed_at is null and i.expires_at > now() for update of i`,
      [tokenHash, workspace.userId],
    );
    if (!result.rows[0]) throw new ApiError(400, "Upload link is invalid or expired.");
    await client.query("update upload_intents set claimed_at = now() where id = $1", [result.rows[0].id]);
    return result.rows[0];
  });
  try {
    await storeRequestBody(request, intent.storage_path, Number(intent.expected_bytes), intent.expected_sha256);
  } catch (error) {
    await db((client) => client.query("update upload_intents set claimed_at = null where id = $1 and used_at is null", [intent.id])).catch(() => undefined);
    throw new ApiError(400, error instanceof Error && /integrity|exceeded|empty/i.test(error.message) ? error.message : "Upload failed. Try again.");
  }
  await db(async (client) => {
    await client.query("update upload_intents set used_at = now() where id = $1", [intent.id]);
    await client.query("update document_versions set status = 'quarantined' where id = $1", [intent.document_version_id]);
    await client.query("update documents set status = 'quarantined' where id = (select document_id from document_versions where id = $1)", [intent.document_version_id]);
    await client.query("insert into background_jobs (organization_id, job_type, payload) values ($1, 'malware_scan', jsonb_build_object('documentVersionId', $2::text))", [intent.organization_id, intent.document_version_id]);
    await audit(client, { organizationId: intent.organization_id, action: "document.upload", resourceType: "document_version", resourceId: intent.document_version_id, outcome: "success", metadata: { bytes: Number(intent.expected_bytes) } });
  });
  return NextResponse.json({ uploaded: true, status: "quarantined" });
});
