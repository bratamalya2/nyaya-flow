import { NextResponse } from "next/server";
import { apiRoute, assertUuid, readJson } from "@/lib/api";
import { requireMatter } from "@/lib/matters";
import { taskInput } from "@/lib/validation";

export const POST = apiRoute<{ id: string }>({}, async (request, { params, workspace, db, audit }) => {
  const matterId = assertUuid(params.id, "matter");
  const input = await readJson(request, taskInput);
  const taskId = await db(async (client) => {
    const matter = await requireMatter(client, workspace, matterId);
    const inserted = await client.query<{ id: string }>(
      "insert into tasks (organization_id, matter_id, title, assignee_id, due_at, priority, created_by) values ($1,$2,$3,$4,$5,$6,$7) returning id",
      [matter.organization_id, matterId, input.title, input.assigneeId ?? null, input.dueAt, input.priority, workspace.userId],
    );
    await audit(client, { action: "task.create", resourceType: "task", resourceId: inserted.rows[0].id, outcome: "success", metadata: { matterId } });
    return inserted.rows[0].id;
  });
  return NextResponse.json({ data: { id: taskId } }, { status: 201 });
});
