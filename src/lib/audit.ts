import type { PoolClient } from "pg";

export async function recordAudit(client: PoolClient, event: {
  organizationId: string;
  actorId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  outcome: "success" | "denied" | "error";
  correlationId?: string;
  metadata?: Record<string, unknown>;
}) {
  await client.query(
    `insert into audit_events(organization_id,actor_id,action,resource_type,resource_id,outcome,correlation_id,metadata,chain_hash)
     values($1,$2,$3,$4,$5,$6,$7,$8,'pending-trigger-value')`,
    [event.organizationId, event.actorId || null, event.action, event.resourceType, event.resourceId || null, event.outcome, event.correlationId || crypto.randomUUID(), event.metadata || {}],
  );
}
