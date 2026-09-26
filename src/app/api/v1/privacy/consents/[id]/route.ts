import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, apiRoute, assertUuid, readJson } from "@/lib/api";
import { ADMIN_ROLES } from "@/lib/permissions";

const schema = z.object({ status: z.literal("withdrawn") });

export const PATCH = apiRoute<{ id: string }>({ roles: ADMIN_ROLES }, async (request, { params, workspace, db, audit }) => {
  const consentId = assertUuid(params.id, "consent record");
  await readJson(request, schema);
  await db(async (client) => {
    const updated = await client.query("update consent_records set status = 'withdrawn', withdrawn_at = now(), withdrawn_by = $3 where id = $1 and organization_id = $2 and status = 'recorded'", [consentId, workspace.organizationId, workspace.userId]);
    if (!updated.rowCount) throw new ApiError(404, "Active consent record not found.");
    await audit(client, { action: "privacy.consent.withdraw", resourceType: "consent", resourceId: consentId, outcome: "success" });
  });
  return NextResponse.json({ withdrawn: true });
});
