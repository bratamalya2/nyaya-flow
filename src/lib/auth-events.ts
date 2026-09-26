import { recordAudit } from "@/lib/audit";
import { withActor } from "@/lib/db";

/** Authentication events are firm-scoped: record one audit event in each organization the user belongs to. */
export async function auditAuthEvent(userId: string, action: string, metadata: Record<string, unknown> = {}) {
  await withActor(userId, async (client) => {
    const memberships = await client.query<{ organization_id: string }>("select organization_id from memberships where user_id = $1 and active", [userId]);
    const correlationId = crypto.randomUUID();
    for (const row of memberships.rows) {
      await recordAudit(client, { organizationId: row.organization_id, actorId: userId, action, resourceType: "session", outcome: "success", correlationId, metadata });
    }
  });
}
