import { NextResponse } from "next/server";
import { ApiError, apiRoute, readJson } from "@/lib/api";
import { EDITOR_ROLES } from "@/lib/permissions";
import { isResearchEnabled } from "@/lib/research";
import { researchNoteInput } from "@/lib/validation";

export const GET = apiRoute({}, async (_request, { workspace, db }) => {
  if (!isResearchEnabled()) throw new ApiError(503, "Research Beta is disabled.");
  const notes = await db((client) => client.query(
    `select id,matter_id as "matterId",query_id as "queryId",title,body,verification_state as "verificationState",created_at as "createdAt",updated_at as "updatedAt"
     from research_notes where organization_id=$1 order by updated_at desc limit 100`, [workspace.organizationId],
  ));
  return NextResponse.json({ data: notes.rows });
});

export const POST = apiRoute({ roles: EDITOR_ROLES }, async (request, { workspace, db, audit }) => {
  if (!isResearchEnabled()) throw new ApiError(503, "Research Beta is disabled.");
  const input = await readJson(request, researchNoteInput);
  const noteId = await db(async (client) => {
    if (input.matterId) {
      const matter = await client.query("select id from matters where id=$1 and organization_id=$2", [input.matterId, workspace.organizationId]);
      if (!matter.rows[0]) throw new ApiError(404, "Matter not found, or you do not have edit access.");
    }
    if (input.queryId) {
      const query = await client.query("select id from research_queries where id=$1 and organization_id=$2", [input.queryId, workspace.organizationId]);
      if (!query.rows[0]) throw new ApiError(404, "Research query not found in this organization.");
    }
    const note = await client.query<{ id: string }>(
      `insert into research_notes(organization_id,matter_id,query_id,title,body,created_by)
       values($1,$2,$3,$4,$5,$6) returning id`,
      [workspace.organizationId, input.matterId ?? null, input.queryId ?? null, input.title, input.body, workspace.userId],
    );
    for (const citation of input.citations) {
      await client.query("insert into research_note_citations(organization_id,note_id,passage_id,claim_text) values($1,$2,$3,$4)", [workspace.organizationId, note.rows[0].id, citation.passageId, citation.claimText]);
    }
    await audit(client, { action: "research.note.create", resourceType: "research_note", resourceId: note.rows[0].id, outcome: "success", metadata: { citations: input.citations.length, linkedMatter: Boolean(input.matterId) } });
    return note.rows[0].id;
  });
  return NextResponse.json({ data: { id: noteId } }, { status: 201 });
});
