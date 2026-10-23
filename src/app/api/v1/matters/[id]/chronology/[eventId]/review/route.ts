import { NextResponse } from "next/server";
import { apiRoute, assertUuid, readJson, ApiError } from "@/lib/api";
import { requireAppPermission } from "@/lib/operations";
import { chronologyReviewInput } from "@/lib/validation";

export const POST = apiRoute<{ id: string; eventId: string }>({}, async (request, { params, workspace, db, audit }) => {
  const matterId = assertUuid(params.id, "matter"); const eventId = assertUuid(params.eventId, "chronology event"); const input = await readJson(request, chronologyReviewInput);
  await db(async (client) => {
    const event = await client.query<{ organization_id: string; review_state: string; version: number }>(`select organization_id,review_state,version from chronology_events where id=$1 and matter_id=$2 and organization_id=$3 for update`, [eventId,matterId,workspace.organizationId]);
    if (!event.rows[0]) throw new ApiError(404, "Chronology event not found."); await requireAppPermission(client,event.rows[0].organization_id,"review_chronology");
    if (["confirmed","merged"].includes(event.rows[0].review_state)) throw new ApiError(409,"Reviewed events are immutable; create a new version.");
    if (input.action === "merge" && !input.targetEventId) throw new ApiError(400,"Choose the event to merge into.");
    const state = input.action === "confirm" ? "confirmed" : input.action === "reject" ? "rejected" : input.action === "merge" ? "merged" : "in_review";
    await client.query(`update chronology_events set review_state=$2,reviewed_by=$3,reviewed_at=now() where id=$1`,[eventId,state,workspace.userId]);
    await client.query(`insert into chronology_review_actions(organization_id,chronology_event_id,action,reason,target_event_id,acted_by) values($1,$2,$3,$4,$5,$6)`,[event.rows[0].organization_id,eventId,input.action,input.reason ?? null,input.targetEventId ?? null,workspace.userId]);
    await audit(client,{action:`chronology.${input.action}`,resourceType:"chronology_event",resourceId:eventId,outcome:"success",metadata:{matterId,targetEventId:input.targetEventId ?? null}});
  }); return NextResponse.json({data:{id:eventId}});
});
