import { NextResponse } from "next/server";
import { apiRoute, readJson } from "@/lib/api";
import { ADMIN_ROLES } from "@/lib/permissions";
import { consentInput } from "@/lib/validation";

export const POST = apiRoute({ roles: ADMIN_ROLES }, async (request, { workspace, db, audit }) => {
  const input = await readJson(request, consentInput);
  const id = await db(async (client) => {
    const inserted = await client.query<{ id: string }>(
      "insert into consent_records (organization_id, subject_reference, purpose, legal_basis, notice_version, status, recorded_by) values ($1,$2,$3,$4,$5,$6,$7) returning id",
      [workspace.organizationId, input.subjectReference, input.purpose, input.legalBasis, input.noticeVersion, input.status, workspace.userId],
    );
    await audit(client, { action: "privacy.consent.record", resourceType: "consent", resourceId: inserted.rows[0].id, outcome: "success", metadata: { legalBasis: input.legalBasis, noticeVersion: input.noticeVersion } });
    return inserted.rows[0].id;
  });
  return NextResponse.json({ data: { id } }, { status: 201 });
});
