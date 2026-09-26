import { NextResponse } from "next/server";
import { apiRoute, readJson } from "@/lib/api";
import { conflictDismissalInput } from "@/lib/validation";

export const POST = apiRoute({}, async (request, { workspace, db, audit }) => {
  const input = await readJson(request, conflictDismissalInput);
  const [first, second] = [input.firstHearingId, input.secondHearingId].sort();
  const id = await db(async (client) => {
    const inserted = await client.query<{ id: string }>(
      "insert into conflict_dismissals (organization_id, first_hearing_id, second_hearing_id, reason, dismissed_by) values ($1,$2,$3,$4,$5) returning id",
      [workspace.organizationId, first, second, input.reason, workspace.userId],
    );
    await audit(client, { action: "hearing.conflict.dismiss", resourceType: "conflict", resourceId: inserted.rows[0].id, outcome: "success", metadata: { hearings: [first, second] } });
    return inserted.rows[0].id;
  });
  return NextResponse.json({ data: { id } }, { status: 201 });
});
