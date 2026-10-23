import { NextResponse } from "next/server";
import { apiRoute, assertUuid, readJson, ApiError } from "@/lib/api";
import { hearingBriefInput } from "@/lib/validation";

export const GET = apiRoute<{ id: string }>({}, async (_request, { params, workspace, db }) => {
  const hearingId = assertUuid(params.id, "hearing");
  const data = await db(async (client) => (await client.query(
    `select b.id,b.title,b.status,b.version,b.approved_at,b.created_at,coalesce(json_agg(json_build_object('id',s.id,'key',s.section_key,'heading',s.heading,'body',s.body,'position',s.position) order by s.position) filter(where s.id is not null),'[]') as sections
     from hearing_briefs b join hearings h on h.id=b.hearing_id left join hearing_brief_sections s on s.hearing_brief_id=b.id where b.hearing_id=$1 and h.organization_id=$2 group by b.id order by b.version desc`, [hearingId,workspace.organizationId],
  )).rows);
  return NextResponse.json({ data });
});

export const POST = apiRoute<{ id: string }>({}, async (request, { params, workspace, db, audit }) => {
  const hearingId = assertUuid(params.id, "hearing");
  const input = await readJson(request, hearingBriefInput);
  if (input.hearingId !== hearingId) throw new ApiError(400, "Hearing identifier does not match the route.");
  const id = await db(async (client) => {
    const hearing = await client.query<{ organization_id: string; matter_id: string }>(`select organization_id,matter_id from hearings where id=$1 and organization_id=$2`, [hearingId,workspace.organizationId]);
    if (!hearing.rows[0]) throw new ApiError(404, "Hearing not found or access denied.");
    const version = await client.query<{ version: number }>(`select coalesce(max(version),0)+1 as version from hearing_briefs where hearing_id=$1`, [hearingId]);
    const brief = await client.query<{ id: string }>(`insert into hearing_briefs(organization_id,hearing_id,title,version,created_by) values($1,$2,$3,$4,$5) returning id`, [hearing.rows[0].organization_id,hearingId,input.title,version.rows[0].version,workspace.userId]);
    for (const [position, section] of input.sections.entries()) await client.query(`insert into hearing_brief_sections(organization_id,hearing_brief_id,section_key,heading,body,position) values($1,$2,$3,$4,$5,$6)`, [hearing.rows[0].organization_id,brief.rows[0].id,section.sectionKey,section.heading,section.body,position]);
    await audit(client, { action: "hearing_brief.create", resourceType: "hearing_brief", resourceId: brief.rows[0].id, outcome: "success", metadata: { hearingId, version: version.rows[0].version } });
    return brief.rows[0].id;
  });
  return NextResponse.json({ data: { id } }, { status: 201 });
});
