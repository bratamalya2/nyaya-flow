import { NextResponse } from "next/server";
import { ApiError, apiRoute, readJson } from "@/lib/api";
import { ADMIN_ROLES } from "@/lib/permissions";
import { organizationPolicyUpdate } from "@/lib/validation";

export const PATCH = apiRoute({ roles: ADMIN_ROLES }, async (request, { workspace, db, audit }) => {
  const input = await readJson(request, organizationPolicyUpdate);
  await db(async (client) => {
    const updated = await client.query("update organizations set external_ai_enabled = $2 where id = $1", [workspace.organizationId, input.externalAiEnabled]);
    if (!updated.rowCount) throw new ApiError(403, "You do not have permission to change organization policies.");
    await audit(client, { action: "organization.policy.update", resourceType: "organization", resourceId: workspace.organizationId, outcome: "success", metadata: input });
  });
  return NextResponse.json({ updated: true });
});
