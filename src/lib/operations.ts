import type { PoolClient } from "pg";
import { ApiError } from "@/lib/api";

export type AppPermission = "view_command_centre" | "manage_deadlines" | "review_chronology" | "run_conflict_check" | "approve_hearing_brief" | "manage_billing" | "manage_subscription";

export async function requireAppPermission(client: PoolClient, organizationId: string, permission: AppPermission) {
  const result = await client.query<{ allowed: boolean }>("select has_app_permission($1,$2::app_permission) as allowed", [organizationId, permission]);
  if (!result.rows[0]?.allowed) throw new ApiError(403, "Your role does not permit this action.");
}

export function normalizeConflictName(value: string) {
  return value.normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim().toLowerCase().replace(/\s+/g, " ");
}

export function confidenceBucket(confidence: number): "low" | "medium" | "high" {
  return confidence >= 80 ? "high" : confidence >= 50 ? "medium" : "low";
}
