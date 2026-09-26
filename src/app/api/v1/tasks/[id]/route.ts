import { NextResponse } from "next/server";
import { ApiError, apiRoute, assertUuid, readJson } from "@/lib/api";
import { diffFields, recordRevision } from "@/lib/matters";
import { taskUpdate } from "@/lib/validation";

type TaskRow = { organization_id: string; matter_id: string; title: string; due_at: Date | null; assignee_id: string | null; priority: string; state: string };

export const PATCH = apiRoute<{ id: string }>({ demo: async () => NextResponse.json({ updated: true, mode: "demo" }) }, async (request, { params, workspace, db, audit }) => {
  const taskId = assertUuid(params.id, "task");
  const input = await readJson(request, taskUpdate);
  const changes = await db(async (client) => {
    const found = await client.query<TaskRow>("select organization_id, matter_id, title, due_at, assignee_id, priority, state from tasks where id = $1 and organization_id = $2 for update", [taskId, workspace.organizationId]);
    const current = found.rows[0];
    if (!current) throw new ApiError(404, "Task not found or access denied.");
    const diff = diffFields(current, { state: input.state, title: input.title, due_at: input.dueAt, assignee_id: input.assigneeId, priority: input.priority });
    if (!Object.keys(diff.changes).length) return diff.changes;
    const updated = await client.query(
      `update tasks set state = coalesce($2, state), title = coalesce($3, title), due_at = coalesce($4, due_at),
         assignee_id = case when $5::boolean then $6 else assignee_id end, priority = coalesce($7, priority),
         completed_at = case when coalesce($2, state) = 'done' then coalesce(completed_at, now()) else null end
       where id = $1`,
      [taskId, input.state ?? null, input.title ?? null, input.dueAt ?? null, input.assigneeId !== undefined, input.assigneeId ?? null, input.priority ?? null],
    );
    if (!updated.rowCount) throw new ApiError(403, "You do not have permission to edit this task.");
    if (input.reason) await recordRevision(client, { organizationId: current.organization_id, matterId: current.matter_id, resourceType: "task", resourceId: taskId, ...diff, reason: input.reason, changedBy: workspace.userId });
    await audit(client, { action: input.state && Object.keys(diff.changes).length === 1 ? "task.state.update" : "task.update", resourceType: "task", resourceId: taskId, outcome: "success", metadata: { fields: Object.keys(diff.changes) } });
    return diff.changes;
  });
  return NextResponse.json({ data: { id: taskId, changes } });
});
