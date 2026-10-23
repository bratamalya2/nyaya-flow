import { NextResponse } from "next/server";
import { apiRoute, assertUuid, readJson } from "@/lib/api";
import { requireMatter } from "@/lib/matters";
import { requireAppPermission } from "@/lib/operations";
import { chronologyEventInput } from "@/lib/validation";

export const GET = apiRoute<{ id: string }>({}, async (_request, { params, workspace, db }) => {
  const matterId = assertUuid(params.id, "matter");
  const data = await db(async (client) => {
    await requireMatter(client, workspace, matterId);
    return (await client.query(`select id,event_type,title,description,occurred_on,occurred_end_on,date_precision,source_state,confidence,review_state,version,reviewed_at,created_at from chronology_events where matter_id=$1 order by occurred_on,id`, [matterId])).rows;
  });
  return NextResponse.json({ data });
});

export const POST = apiRoute<{ id: string }>({}, async (request, { params, workspace, db, audit }) => {
  const matterId = assertUuid(params.id, "matter");
  const input = await readJson(request, chronologyEventInput);
  const id = await db(async (client) => {
    const matter = await requireMatter(client, workspace, matterId);
    await requireAppPermission(client, matter.organization_id, "review_chronology");
    const event = await client.query<{ id: string }>(
      `insert into chronology_events(organization_id,matter_id,event_type,title,description,occurred_on,occurred_end_on,date_precision,source_state,confidence,created_by)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
      [matter.organization_id,matterId,input.eventType,input.title,input.description ?? null,input.occurredOn,input.occurredEndOn ?? null,input.datePrecision,input.sourceState,input.confidence ?? null,workspace.userId],
    );
    await client.query(`insert into chronology_event_revisions(organization_id,chronology_event_id,version,snapshot,reason,created_by) values($1,$2,1,$3,'created',$4)`, [matter.organization_id,event.rows[0].id,JSON.stringify(input),workspace.userId]);
    await audit(client, { action: "chronology.create", resourceType: "chronology_event", resourceId: event.rows[0].id, outcome: "success", metadata: { matterId, sourceState: input.sourceState } });
    return event.rows[0].id;
  });
  return NextResponse.json({ data: { id } }, { status: 201 });
});
