import { NextResponse } from "next/server";
import { apiRoute, readJson } from "@/lib/api";
import { ADMIN_ROLES } from "@/lib/permissions";
import { retentionClassInput } from "@/lib/validation";

// Automatic deletion stays off until a reviewed retention policy exists; classes are recorded for review only.
export const POST = apiRoute({ roles: ADMIN_ROLES }, async (request, { workspace, db, audit }) => {
  const input = await readJson(request, retentionClassInput);
  const id = await db(async (client) => {
    const inserted = await client.query<{ id: string }>(
      "insert into retention_classes (organization_id, name, retention_days, automatic_deletion) values ($1,$2,$3,false) returning id",
      [workspace.organizationId, input.name, input.retentionDays ?? null],
    );
    await audit(client, { action: "privacy.retention_class.create", resourceType: "retention_class", resourceId: inserted.rows[0].id, outcome: "success", metadata: { retentionDays: input.retentionDays ?? null } });
    return inserted.rows[0].id;
  });
  return NextResponse.json({ data: { id } }, { status: 201 });
});
