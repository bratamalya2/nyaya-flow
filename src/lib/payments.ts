import { createHmac, timingSafeEqual } from "node:crypto";

export type CheckoutRequest = { receipt: string; amountPaise: number; currency: string; notes: Record<string, string> };
export type Checkout = { providerOrderId: string; amountPaise: number; currency: string; keyId: string };
export interface PaymentProvider {
  createCheckout(input: CheckoutRequest): Promise<Checkout>;
  verifyWebhook(rawBody: string, signature: string | null): boolean;
}

export class RazorpayProvider implements PaymentProvider {
  constructor(private readonly keyId = process.env.RAZORPAY_KEY_ID, private readonly keySecret = process.env.RAZORPAY_KEY_SECRET, private readonly webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET) {}
  private configured() { return Boolean(this.keyId && this.keySecret); }
  async createCheckout(input: CheckoutRequest): Promise<Checkout> {
    if (!this.configured()) throw new Error("Razorpay is not configured. Set server-only Razorpay credentials before enabling checkout.");
    const token = Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");
    const response = await fetch("https://api.razorpay.com/v1/orders", { method: "POST", headers: { Authorization: `Basic ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ amount: input.amountPaise, currency: input.currency, receipt: input.receipt, notes: input.notes }) });
    if (!response.ok) throw new Error(`Razorpay order creation failed (${response.status}).`);
    const payload = await response.json() as { id: string; amount: number; currency: string };
    return { providerOrderId: payload.id, amountPaise: payload.amount, currency: payload.currency, keyId: this.keyId! };
  }
  verifyWebhook(rawBody: string, signature: string | null) {
    if (!this.webhookSecret || !signature) return false;
    const expected = createHmac("sha256", this.webhookSecret).update(rawBody).digest("hex");
    return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }
}
