import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute, readJson } from "@/lib/api";
import { EDITOR_ROLES } from "@/lib/permissions";
import { isTransitionEnabled } from "@/lib/transitions";

const date = z.union([z.literal(""), z.iso.date()]).transform((value) => value || null);
const input = z.object({ mappingId: z.uuid().nullable().optional(), offenceDate: date, firDate: date, proceedingDate: date, notes: z.string().trim().max(10_000).optional() });

export const POST = apiRoute({ roles: EDITOR_ROLES }, async (request, { workspace, db, audit }) => {
  if (!isTransitionEnabled()) return NextResponse.json({ error: "Transition Beta is disabled." }, { status: 503 });
  const value = await readJson(request, input);
  const id = await db(async (client) => {
    if (value.mappingId) {
      const mapping = await client.query("select id from transition_mappings where id=$1", [value.mappingId]);
      if (!mapping.rows[0]) throw new Error("Unknown transition mapping.");
    }
    const row = await client.query<{ id: string }>(
      `insert into transition_worksheets(organization_id,mapping_id,offence_date,fir_date,proceeding_date,review_state,notes,created_by)
       values($1,$2,$3,$4,$5,'review_required',$6,$7) returning id`,
      [workspace.organizationId, value.mappingId ?? null, value.offenceDate, value.firDate, value.proceedingDate, value.notes ?? null, workspace.userId],
    );
    await audit(client, { action: "transition.worksheet.create", resourceType: "transition_worksheet", resourceId: row.rows[0].id, outcome: "success", metadata: { mappingLinked: Boolean(value.mappingId) } });
    return row.rows[0].id;
  });
  return NextResponse.json({ data: { id, reviewState: "review_required" } }, { status: 201 });
});
