import { NextResponse } from "next/server";
import { ApiError, apiRoute, readJson } from "@/lib/api";
import { canManageMatters } from "@/lib/permissions";
import { listMatters } from "@/lib/repositories/workspace";
import { matters as demoMatters } from "@/lib/sample-data";
import { matterInput } from "@/lib/validation";

export const GET = apiRoute({ demo: async () => NextResponse.json({ data: demoMatters, mode: "demo" }) }, async (_request, { workspace }) => {
  return NextResponse.json({ data: await listMatters(workspace) });
});

export const POST = apiRoute({}, async (request, { workspace, db, audit }) => {
  const input = await readJson(request, matterInput);
  // A restricted matter is invisible to non-leadership creators until someone grants them access,
  // so only leadership may create one directly.
  if (input.restricted && !canManageMatters(workspace.role)) throw new ApiError(403, "Only owners, managing partners, and admins can create restricted matters.");
  const leadId = input.leadId ?? workspace.userId;
  const created = await db(async (client) => {
    const inserted = await client.query<{ id: string }>(
      `insert into matters (organization_id, title, reference, cnr, forum, court_room, client_name, restricted, lead_id, created_by, source_state)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'manual') returning id`,
      [workspace.organizationId, input.title, input.reference, input.cnr ?? null, input.forum, input.courtRoom ?? null, input.client, input.restricted, leadId, workspace.userId],
    );
    const matterId = inserted.rows[0].id;
    for (const party of input.parties) {
      await client.query("insert into parties (organization_id, matter_id, name, party_type) values ($1,$2,$3,$4)", [workspace.organizationId, matterId, party.name, party.partyType]);
    }
    if (input.restricted && leadId !== workspace.userId) {
      await client.query(
        `insert into matter_grants (organization_id, matter_id, user_id, permission, granted_by) values ($1,$2,$3,'manage',$4) on conflict do nothing`,
        [workspace.organizationId, matterId, leadId, workspace.userId],
      );
    }
    await audit(client, { action: "matter.create", resourceType: "matter", resourceId: matterId, outcome: "success", metadata: { restricted: input.restricted, parties: input.parties.length } });
    return matterId;
  });
  return NextResponse.json({ data: { id: created } }, { status: 201 });
});
