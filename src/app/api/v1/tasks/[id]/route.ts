import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth";
import { withActor } from "@/lib/db";

const schema = z.object({ state: z.enum(["open","in_progress","done","cancelled"]) });
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") return NextResponse.json({ updated: true, mode: "demo" });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(()=>null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid task state." }, { status: 400 });
  const { id } = await params;
  try {
    const task = await withActor(session.userId, async (client) => {
      const result = await client.query<{ id:string;organization_id:string }>("update tasks set state=$2,completed_at=case when $2='done' then now() else null end where id=$1 returning id,organization_id", [id,parsed.data.state]);
      if (!result.rows[0]) throw new Error("Task not found or access denied.");
      await recordAudit(client,{organizationId:result.rows[0].organization_id,actorId:session.userId,action:"task.state.update",resourceType:"task",resourceId:id,outcome:"success",metadata:{state:parsed.data.state}});
      return result.rows[0];
    });
    return NextResponse.json({ data:task });
  } catch(error) { return NextResponse.json({error:error instanceof Error ? error.message : "Task update failed."},{status:400}); }
}
