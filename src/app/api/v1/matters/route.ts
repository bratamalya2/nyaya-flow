import { NextResponse } from "next/server";
import { matters as demoMatters } from "@/lib/sample-data";
import { getSession } from "@/lib/auth";
import { withActor } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { matterInput } from "@/lib/validation";

export async function GET() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") return NextResponse.json({ data: demoMatters, mode: "demo" });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const result = await withActor(session.userId, (client) => client.query("select * from matters order by updated_at desc"));
  return NextResponse.json({ data: result.rows });
}

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") return NextResponse.json({ error: "Demo mode does not persist server mutations." }, { status: 409 });
  const parsed = matterInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid matter data.", issues: parsed.error.flatten() }, { status: 400 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try {
    const result = await withActor(session.userId, async (client) => {
      const inserted = await client.query(
      `insert into matters (organization_id, title, reference, cnr, forum, client_name, created_by, source_state)
       values ($1,$2,$3,$4,$5,$6,$7,'manual') returning *`,
      [parsed.data.organizationId, parsed.data.title, parsed.data.reference, parsed.data.cnr || null, parsed.data.forum, parsed.data.client, session.userId],
      );
      await recordAudit(client, { organizationId: parsed.data.organizationId, actorId: session.userId, action: "matter.create", resourceType: "matter", resourceId: inserted.rows[0].id, outcome: "success" });
      return inserted;
    });
    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create matter." }, { status: 400 });
  }
}
