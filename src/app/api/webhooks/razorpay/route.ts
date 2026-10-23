import { NextResponse } from "next/server";
import { publicRoute, ApiError } from "@/lib/api";
import { query } from "@/lib/db";
import { RazorpayProvider } from "@/lib/payments";

/** Raw-body handler: no browser callback can activate a subscription. */
export const POST = publicRoute(async (request) => {
  const rawBody = await request.text();
  const provider = new RazorpayProvider();
  if (!provider.verifyWebhook(rawBody, request.headers.get("x-razorpay-signature"))) throw new ApiError(401, "Invalid webhook signature.");
  const payload = JSON.parse(rawBody) as { event?: string; id?: string };
  const eventId = request.headers.get("x-razorpay-event-id") ?? payload.id;
  if (!eventId || !payload.event) throw new ApiError(400, "Webhook is missing its event identifier.");
  await query("select apply_razorpay_payment_event($1,$2,$3::jsonb)", [eventId,payload.event,JSON.stringify(payload)]);
  return NextResponse.json({ received: true });
});
