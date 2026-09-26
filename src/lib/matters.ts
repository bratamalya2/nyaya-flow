import type { PoolClient } from "pg";
import { ApiError } from "@/lib/api";
import type { Workspace } from "@/lib/workspace";

export interface MatterRef {
  id: string;
  organization_id: string;
  title: string;
  forum: string;
  court_room: string | null;
  restricted: boolean;
}

/** Loads a matter visible to the user (RLS) in the active organization, or fails with 404. */
export async function requireMatter(client: PoolClient, workspace: Workspace, matterId: string, options: { forUpdate?: boolean } = {}) {
  const result = await client.query<MatterRef>(
    `select id, organization_id, title, forum, court_room, restricted from matters where id = $1 and organization_id = $2${options.forUpdate ? " for update" : ""}`,
    [matterId, workspace.organizationId],
  );
  if (!result.rows[0]) throw new ApiError(404, "Matter not found or access denied.");
  return result.rows[0];
}

export async function hasMatterPermission(client: PoolClient, matterId: string, permission: "view" | "edit" | "manage" | "export") {
  const result = await client.query<{ allowed: boolean }>("select can_access_matter($1, $2) allowed", [matterId, permission]);
  return result.rows[0]?.allowed === true;
}

export async function recordRevision(client: PoolClient, input: {
  organizationId: string; matterId: string; resourceType: "matter" | "hearing" | "task"; resourceId: string;
  previous: Record<string, unknown>; changes: Record<string, unknown>; reason: string; changedBy: string;
}) {
  await client.query(
    `insert into record_revisions(organization_id, matter_id, resource_type, resource_id, previous, changes, reason, changed_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [input.organizationId, input.matterId, input.resourceType, input.resourceId, input.previous, input.changes, input.reason, input.changedBy],
  );
}

/** Returns only the fields whose values actually change, as {previous, changes} snapshots. */
export function diffFields(current: Record<string, unknown>, requested: Record<string, unknown>) {
  const previous: Record<string, unknown> = {};
  const changes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(requested)) {
    if (value === undefined) continue;
    const before = current[key] instanceof Date ? (current[key] as Date).toISOString() : current[key] ?? null;
    const after = value instanceof Date ? value.toISOString() : value;
    const same = typeof after === "string" && typeof before === "string" && !Number.isNaN(Date.parse(after)) && !Number.isNaN(Date.parse(before)) && /T/.test(after)
      ? Date.parse(after) === Date.parse(before)
      : before === after;
    if (!same) {
      previous[key] = before;
      changes[key] = after;
    }
  }
  return { previous, changes };
}
