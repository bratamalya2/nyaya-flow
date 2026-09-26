import { NextResponse } from "next/server";
import { ApiError, apiRoute, assertUuid, readJson } from "@/lib/api";
import { diffFields, recordRevision, requireMatter } from "@/lib/matters";
import { matterUpdate } from "@/lib/validation";

type MatterRow = { title: string; stage: string; status: string; restricted: boolean; lead_id: string | null; court_room: string | null };

export const PATCH = apiRoute<{ id: string }>({}, async (request, { params, workspace, db, audit }) => {
  const matterId = assertUuid(params.id, "matter");
  const input = await readJson(request, matterUpdate);
  const result = await db(async (client) => {
    const matter = await requireMatter(client, workspace, matterId, { forUpdate: true });
    const current = (await client.query<MatterRow>("select title, stage, status, restricted, lead_id, court_room from matters where id = $1", [matterId])).rows[0];
    const requested = { title: input.title, stage: input.stage, status: input.status, restricted: input.restricted, lead_id: input.leadId, court_room: input.courtRoom };
    const { previous, changes } = diffFields(current, requested);
    if (!Object.keys(changes).length) throw new ApiError(400, "No changes were submitted.");
    const updated = await client.query(
      `update matters set title = coalesce($2, title), stage = coalesce($3, stage), status = coalesce($4::matter_status, status),
         restricted = coalesce($5, restricted), lead_id = coalesce($6, lead_id), court_room = coalesce($7, court_room),
         closed_reason = case when $4 = 'closed' then $8 else closed_reason end
       where id = $1`,
      [matterId, input.title ?? null, input.stage ?? null, input.status ?? null, input.restricted ?? null, input.leadId ?? null, input.courtRoom ?? null, input.reason],
    );
    if (!updated.rowCount) throw new ApiError(403, "You do not have permission to edit this matter.");
    await recordRevision(client, { organizationId: matter.organization_id, matterId, resourceType: "matter", resourceId: matterId, previous, changes, reason: input.reason, changedBy: workspace.userId });
    await audit(client, { action: "matter.update", resourceType: "matter", resourceId: matterId, outcome: "success", metadata: { fields: Object.keys(changes) } });
    return changes;
  });
  return NextResponse.json({ data: { id: matterId, changes: result } });
});
