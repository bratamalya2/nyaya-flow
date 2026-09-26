import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth";
import { withActor } from "@/lib/db";

const schema = z.object({ organizationId: z.uuid(), requesterReference: z.string().min(2).max(200), requestType: z.enum(["access","correction","erasure","export"]) });
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid privacy request." }, { status: 400 });
  const result = await withActor(session.userId, async (client) => {
    const inserted = await client.query<{ id: string }>(`insert into data_requests(organization_id,requester_reference,request_type,created_by) values($1,$2,$3,$4) returning id`, [parsed.data.organizationId, parsed.data.requesterReference, parsed.data.requestType, session.userId]);
    await recordAudit(client, { organizationId: parsed.data.organizationId, actorId: session.userId, action: "privacy.request.create", resourceType: "data_request", resourceId: inserted.rows[0].id, outcome: "success" });
    return inserted.rows[0];
  });
  return NextResponse.json({ data: result }, { status: 201 });
}
