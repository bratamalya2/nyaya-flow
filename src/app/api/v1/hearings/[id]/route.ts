import { NextResponse } from "next/server";
import { ApiError, apiRoute, assertUuid, readJson } from "@/lib/api";
import { diffFields, recordRevision } from "@/lib/matters";
import { hearingUpdate } from "@/lib/validation";

type HearingRow = { organization_id: string; matter_id: string; advocate_id: string; starts_at: Date; ends_at: Date; court_room: string | null; item_number: number | null; status: string; notes: string | null };

export const PATCH = apiRoute<{ id: string }>({}, async (request, { params, workspace, db, audit }) => {
  const hearingId = assertUuid(params.id, "hearing");
  const input = await readJson(request, hearingUpdate);
  const changes = await db(async (client) => {
    const found = await client.query<HearingRow>(
      "select organization_id, matter_id, advocate_id, starts_at, ends_at, court_room, item_number, status, notes from hearings where id = $1 and organization_id = $2 for update",
      [hearingId, workspace.organizationId],
    );
    const current = found.rows[0];
    if (!current) throw new ApiError(404, "Hearing not found or access denied.");
    const requested = { advocate_id: input.advocateId, starts_at: input.startsAt, ends_at: input.endsAt, court_room: input.courtRoom, item_number: input.itemNumber, status: input.status, notes: input.notes };
    const diff = diffFields(current, requested);
    if (!Object.keys(diff.changes).length) throw new ApiError(400, "No changes were submitted.");
    const startsAt = new Date(input.startsAt ?? current.starts_at);
    const endsAt = new Date(input.endsAt ?? current.ends_at);
    if (endsAt <= startsAt) throw new ApiError(400, "End time must be after start time.");
    const updated = await client.query(
      `update hearings set advocate_id = coalesce($2, advocate_id), starts_at = $3, ends_at = $4, court_room = coalesce($5, court_room),
         item_number = case when $6::boolean then $7 else item_number end, status = coalesce($8::hearing_status, status), notes = coalesce($9, notes),
         dismissal_reason = case when $8 in ('adjourned','cancelled') then $10 else dismissal_reason end
       where id = $1`,
      [hearingId, input.advocateId ?? null, startsAt, endsAt, input.courtRoom ?? null, input.itemNumber !== undefined, input.itemNumber ?? null, input.status ?? null, input.notes ?? null, input.reason],
    );
    if (!updated.rowCount) throw new ApiError(403, "You do not have permission to edit this hearing.");
    await recordRevision(client, { organizationId: current.organization_id, matterId: current.matter_id, resourceType: "hearing", resourceId: hearingId, ...diff, reason: input.reason, changedBy: workspace.userId });
    await audit(client, { action: "hearing.update", resourceType: "hearing", resourceId: hearingId, outcome: "success", metadata: { fields: Object.keys(diff.changes) } });
    return diff.changes;
  });
  return NextResponse.json({ data: { id: hearingId, changes } });
});
