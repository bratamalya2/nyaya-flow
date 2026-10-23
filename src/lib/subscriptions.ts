import type { PoolClient } from "pg";
import { ApiError } from "@/lib/api";

export type EntitlementValue = boolean | number | string | Record<string, unknown>;

export async function entitlement(client: PoolClient, organizationId: string, key: string): Promise<EntitlementValue | undefined> {
  const result = await client.query<{ value: EntitlementValue }>(
    `select value from entitlements where organization_id=$1 and entitlement_key=$2 and effective_from<=now() and (effective_to is null or effective_to>now()) order by effective_from desc limit 1`,
    [organizationId, key],
  );
  return result.rows[0]?.value;
}

/** Existing records stay readable/exportable; only new billable/restricted actions call this guard. */
export async function requireEntitlement(client: PoolClient, organizationId: string, key: string, requested = 1) {
  const value = await entitlement(client, organizationId, key);
  const allowed = value === true || (typeof value === "number" && (value < 0 || value >= requested)) || (typeof value === "object" && value !== null && (value as { enabled?: boolean }).enabled === true);
  if (!allowed) throw new ApiError(402, "Your plan does not include this action. Existing records remain available to read and export.");
}

export async function createTrial(client: PoolClient, input: { organizationId: string; userId: string }) {
  const price = await client.query<{ id: string }>(`select pp.id from plan_prices pp join plan_catalog p on p.id=pp.plan_id where p.code='trial' and pp.interval='month' and pp.active_to is null limit 1`);
  if (!price.rows[0]) throw new ApiError(503, "The trial plan is not configured.");
  const subscription = await client.query<{ id: string }>(
    `insert into organization_subscriptions(organization_id,plan_price_id,status,trial_ends_at,current_period_end,created_by)
     values($1,$2,'trialing',now()+interval '14 days',now()+interval '14 days',$3) returning id`, [input.organizationId, price.rows[0].id, input.userId],
  );
  await client.query("select sync_subscription_entitlements($1)", [subscription.rows[0].id]);
  await client.query(`insert into subscription_events(organization_id,subscription_id,event_type,new_state,effective_at,actor_id) values($1,$2,'trial_started',jsonb_build_object('status','trialing'),now(),$3)`, [input.organizationId, subscription.rows[0].id, input.userId]);
  return subscription.rows[0].id;
}
