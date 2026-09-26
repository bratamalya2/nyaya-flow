import type { PoolClient } from "pg";

export interface AuditInput {
  organizationId: string;
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string;
  outcome: "success" | "denied" | "error";
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

// Chain position and hashes are assigned by the seal_audit_event trigger under a per-organization lock.
export async function recordAudit(client: PoolClient, event: AuditInput) {
  await client.query(
    `insert into audit_events(organization_id,actor_id,action,resource_type,resource_id,outcome,correlation_id,metadata)
     values($1,$2,$3,$4,$5,$6,$7,$8)`,
    [event.organizationId, event.actorId || null, event.action, event.resourceType, event.resourceId || null, event.outcome, event.correlationId || crypto.randomUUID(), event.metadata || {}],
  );
}
