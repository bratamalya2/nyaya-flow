import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { calculateDeadline } from "@/lib/deadlines";
import { confidenceBucket, normalizeConflictName } from "@/lib/operations";
import { RazorpayProvider } from "@/lib/payments";

describe("operational workflow primitives", () => {
  it("calculates calendar and business-day deadlines with recorded exclusions", () => {
    expect(calculateDeadline("2026-10-02", { daysAfter: 3, businessDays: false })).toBe("2026-10-05");
    expect(calculateDeadline("2026-10-02", { daysAfter: 1, businessDays: true })).toBe("2026-10-05");
    expect(calculateDeadline("2026-10-02", { daysAfter: 1, businessDays: true, excludedWeekdays: [1] })).toBe("2026-10-06");
  });
  it("normalizes conflicts without treating a confidence score as a legal decision", () => {
    expect(normalizeConflictName("Asha-Textiles (Pvt.) Ltd.")).toBe("asha textiles pvt ltd");
    expect(confidenceBucket(49)).toBe("low"); expect(confidenceBucket(50)).toBe("medium"); expect(confidenceBucket(80)).toBe("high");
  });
  it("accepts only an exact Razorpay webhook HMAC", () => {
    const body = '{"event":"payment.captured"}'; const secret = "webhook-secret";
    const signature = createHmac("sha256", secret).update(body).digest("hex");
    const provider = new RazorpayProvider("id", "secret", secret);
    expect(provider.verifyWebhook(body, signature)).toBe(true);
    expect(provider.verifyWebhook(body, "bad")).toBe(false);
  });
});
