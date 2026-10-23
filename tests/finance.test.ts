import { describe, expect, it } from "vitest";
import { canTransitionCharge, isFinanceRole } from "@/lib/finance";
import { availableAdvance, formatInr, inrToPaise, invoiceBalance } from "@/lib/finance-format";

describe("finance workflow guards", () => {
  it("permits the charge review lifecycle but never reopens an invoiced charge", () => {
    expect(canTransitionCharge("draft", "submitted")).toBe(true);
    expect(canTransitionCharge("submitted", "approved")).toBe(true);
    expect(canTransitionCharge("submitted", "rejected")).toBe(true);
    expect(canTransitionCharge("approved", "invoiced")).toBe(true);
    expect(canTransitionCharge("invoiced", "draft")).toBe(false);
  });
  it("calculates paise and never produces a negative available balance", () => {
    expect(inrToPaise(1250.75)).toBe(125075);
    expect(availableAdvance(10_000, 4_000)).toBe(6_000);
    expect(availableAdvance(10_000, 12_000)).toBe(0);
    expect(invoiceBalance(10_000, 3_000, 2_000)).toBe(5_000);
    expect(formatInr(125075)).toContain("1,250.75");
  });
  it("limits finance management to leadership and the dedicated finance role", () => {
    expect(isFinanceRole("owner")).toBe(true);
    expect(isFinanceRole("finance")).toBe(true);
    expect(isFinanceRole("advocate")).toBe(false);
  });
});
