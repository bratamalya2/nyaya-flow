import { NextResponse } from "next/server";
import { apiRoute, readJson } from "@/lib/api";
import { ADMIN_ROLES } from "@/lib/permissions";
import { dataRequestInput } from "@/lib/validation";

export const POST = apiRoute({ roles: ADMIN_ROLES }, async (request, { workspace, db, audit }) => {
  const input = await readJson(request, dataRequestInput);
  const id = await db(async (client) => {
    const inserted = await client.query<{ id: string }>(
      "insert into data_requests (organization_id, requester_reference, request_type, matter_id, created_by) values ($1,$2,$3,$4,$5) returning id",
      [workspace.organizationId, input.requesterReference, input.requestType, input.matterId ?? null, workspace.userId],
    );
    await audit(client, { action: "privacy.request.create", resourceType: "data_request", resourceId: inserted.rows[0].id, outcome: "success", metadata: { requestType: input.requestType } });
    return inserted.rows[0].id;
  });
  return NextResponse.json({ data: { id } }, { status: 201 });
});
