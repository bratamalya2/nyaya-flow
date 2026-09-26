import { NextResponse } from "next/server";
import { ApiError, apiRoute, assertUuid, readJson } from "@/lib/api";
import { hasMatterPermission, requireMatter } from "@/lib/matters";
import { legalHoldInput } from "@/lib/validation";

export const POST = apiRoute<{ id: string }>({}, async (request, { params, workspace, db, audit }) => {
  const matterId = assertUuid(params.id, "matter");
  const { reason } = await readJson(request, legalHoldInput);
  const holdId = await db(async (client) => {
    const matter = await requireMatter(client, workspace, matterId);
    if (!(await hasMatterPermission(client, matterId, "manage"))) throw new ApiError(403, "Placing a legal hold requires manage permission on this matter.");
    const inserted = await client.query<{ id: string }>("insert into legal_holds (organization_id, matter_id, reason, created_by) values ($1,$2,$3,$4) returning id", [matter.organization_id, matterId, reason, workspace.userId]);
    await audit(client, { action: "legal_hold.place", resourceType: "matter", resourceId: matterId, outcome: "success", metadata: { holdId: inserted.rows[0].id } });
    return inserted.rows[0].id;
  });
  return NextResponse.json({ data: { id: holdId } }, { status: 201 });
});
