import { NextResponse } from "next/server";
import { apiRoute, assertUuid, readJson } from "@/lib/api";
import { requireMatter } from "@/lib/matters";
import { hearingInput } from "@/lib/validation";

export const POST = apiRoute<{ id: string }>({}, async (request, { params, workspace, db, audit }) => {
  const matterId = assertUuid(params.id, "matter");
  const input = await readJson(request, hearingInput);
  const hearingId = await db(async (client) => {
    const matter = await requireMatter(client, workspace, matterId);
    const inserted = await client.query<{ id: string }>(
      `insert into hearings (organization_id, matter_id, advocate_id, forum, court_room, item_number, starts_at, ends_at, status, source_state, notes, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'manual',$10,$11) returning id`,
      [matter.organization_id, matterId, input.advocateId, input.forum ?? matter.forum, input.courtRoom ?? matter.court_room, input.itemNumber ?? null, input.startsAt, input.endsAt, input.status, input.notes ?? null, workspace.userId],
    );
    await audit(client, { action: "hearing.create", resourceType: "hearing", resourceId: inserted.rows[0].id, outcome: "success", metadata: { matterId, status: input.status } });
    return inserted.rows[0].id;
  });
  return NextResponse.json({ data: { id: hearingId } }, { status: 201 });
});
