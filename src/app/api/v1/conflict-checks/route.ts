import { NextResponse } from "next/server";
import { apiRoute, readJson } from "@/lib/api";
import { confidenceBucket, normalizeConflictName, requireAppPermission } from "@/lib/operations";
import { conflictCheckInput } from "@/lib/validation";

export const GET = apiRoute({}, async (_request, { db }) => {
  const data = await db(async (client) => (await client.query(`select id,status,query_summary,completed_at,created_at from conflict_checks order by created_at desc limit 100`)).rows);
  return NextResponse.json({ data });
});

export const POST = apiRoute({}, async (request, { workspace, db, audit }) => {
  const input = await readJson(request, conflictCheckInput);
  const id = await db(async (client) => {
    await requireAppPermission(client, workspace.organizationId, "run_conflict_check");
    const check = await client.query<{ id: string }>(`insert into conflict_checks(organization_id,status,query_summary,requested_by) values($1,'running',$2,$3) returning id`, [workspace.organizationId,input.subjects.map((s) => s.displayName).join(", "),workspace.userId]);
    for (const subject of input.subjects) {
      const normalized = normalizeConflictName(subject.displayName);
      const inserted = await client.query<{ id: string }>(`insert into conflict_check_subjects(organization_id,conflict_check_id,subject_type,display_name,normalized_name) values($1,$2,$3,$4,$5) returning id`, [workspace.organizationId,check.rows[0].id,subject.subjectType,subject.displayName,normalized]);
      for (const alias of subject.aliases) await client.query(`insert into conflict_subject_aliases(organization_id,conflict_check_subject_id,alias,normalized_alias) values($1,$2,$3,$4)`, [workspace.organizationId,inserted.rows[0].id,alias,normalizeConflictName(alias)]);
      const candidates = await client.query<{ matter_id: string; name: string }>(`select p.matter_id,p.name from parties p join matters m on m.id=p.matter_id where m.organization_id=$1 and lower(regexp_replace(p.name,'[^[:alnum:]]+',' ','g')) like '%' || $2 || '%'`, [workspace.organizationId,normalized]);
      for (const candidate of candidates.rows) {
        const confidence = normalizeConflictName(candidate.name) === normalized ? 100 : 65;
        await client.query(`insert into conflict_matches(organization_id,conflict_check_id,conflict_check_subject_id,matter_id,confidence,bucket,explanation) values($1,$2,$3,$4,$5,$6,$7)`, [workspace.organizationId,check.rows[0].id,inserted.rows[0].id,candidate.matter_id,confidence,confidenceBucket(confidence),"Name normalization match; human conflict review required."]);
      }
    }
    await client.query(`update conflict_checks set status='completed',completed_at=now() where id=$1`, [check.rows[0].id]);
    await audit(client, { action: "conflict_check.run", resourceType: "conflict_check", resourceId: check.rows[0].id, outcome: "success", metadata: { subjectCount: input.subjects.length } });
    return check.rows[0].id;
  });
  return NextResponse.json({ data: { id } }, { status: 201 });
});
