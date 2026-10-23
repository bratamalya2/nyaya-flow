import { NextResponse } from "next/server";
import { apiRoute, readJson, ApiError } from "@/lib/api";
import { RazorpayProvider } from "@/lib/payments";
import { requireAppPermission } from "@/lib/operations";
import { subscriptionStartInput } from "@/lib/validation";

export const POST = apiRoute({}, async (request, { workspace, db, audit }) => {
  const input = await readJson(request, subscriptionStartInput);
  const provider = new RazorpayProvider();
  const prepared = await db(async (client) => {
    await requireAppPermission(client, workspace.organizationId, "manage_subscription");
    const price = await client.query<{ plan_id: string; amount_paise: number; currency: string; code: string }>(`select pp.plan_id,pp.amount_paise,pp.currency,p.code from plan_prices pp join plan_catalog p on p.id=pp.plan_id where pp.id=$1 and pp.active_to is null and p.active_to is null`, [input.planPriceId]);
    if (!price.rows[0] || price.rows[0].code === "trial") throw new ApiError(400, "Choose an active paid plan.");
    const existing = await client.query<{ id: string }>(`select id from billing_attempts where organization_id=$1 and idempotency_key=$2`, [workspace.organizationId,input.idempotencyKey]);
    if (existing.rows[0]) throw new ApiError(409, "This checkout request was already started.");
    const subscription = await client.query<{ id: string }>(`insert into organization_subscriptions(organization_id,plan_price_id,status,provider,created_by) values($1,$2,'pending_payment','razorpay',$3) returning id`, [workspace.organizationId,input.planPriceId,workspace.userId]);
    const attempt = await client.query<{ id: string }>(`insert into billing_attempts(organization_id,plan_price_id,subscription_id,provider,amount_paise,currency,idempotency_key,initiated_by) values($1,$2,$3,'razorpay',$4,$5,$6,$7) returning id`, [workspace.organizationId,input.planPriceId,subscription.rows[0].id,price.rows[0].amount_paise,price.rows[0].currency,input.idempotencyKey,workspace.userId]);
    return { attemptId: attempt.rows[0].id, subscriptionId: subscription.rows[0].id, amountPaise: price.rows[0].amount_paise, currency: price.rows[0].currency };
  });
  let checkout;
  try {
    checkout = await provider.createCheckout({ receipt: prepared.attemptId, amountPaise: prepared.amountPaise, currency: prepared.currency, notes: { organizationId: workspace.organizationId, billingAttemptId: prepared.attemptId, subscriptionId: prepared.subscriptionId } });
  } catch (error) {
    throw new ApiError(503, error instanceof Error ? error.message : "Could not start Razorpay checkout.");
  }
  await db(async (client) => {
    await client.query(`update billing_attempts set provider_order_id=$2,status='pending' where id=$1`, [prepared.attemptId,checkout.providerOrderId]);
    await audit(client, { action: "subscription.checkout_started", resourceType: "billing_attempt", resourceId: prepared.attemptId, outcome: "success", metadata: { provider: "razorpay", amountPaise: prepared.amountPaise } });
  });
  return NextResponse.json({ data: { attemptId: prepared.attemptId, orderId: checkout.providerOrderId, amountPaise: checkout.amountPaise, currency: checkout.currency, keyId: checkout.keyId } }, { status: 201 });
});
