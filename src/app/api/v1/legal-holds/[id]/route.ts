import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, apiRoute, assertUuid, readJson } from "@/lib/api";

const schema = z.object({ active: z.literal(false), reason: z.string().trim().min(3).max(500) });

export const PATCH = apiRoute<{ id: string }>({}, async (request, { params, workspace, db, audit }) => {
  const holdId = assertUuid(params.id, "legal hold");
  const { reason } = await readJson(request, schema);
  await db(async (client) => {
    const released = await client.query<{ matter_id: string }>(
      "update legal_holds set active = false, released_by = $2, released_at = now() where id = $1 and organization_id = $3 and active returning matter_id",
      [holdId, workspace.userId, workspace.organizationId],
    );
    if (!released.rows[0]) throw new ApiError(404, "Active hold not found or you cannot manage this matter.");
    await audit(client, { action: "legal_hold.release", resourceType: "matter", resourceId: released.rows[0].matter_id, outcome: "success", metadata: { holdId, reason } });
  });
  return NextResponse.json({ released: true });
});
