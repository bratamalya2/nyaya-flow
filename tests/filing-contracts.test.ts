import { describe, expect, it } from "vitest";
import { canTransitionContract, canTransitionFiling, isReadyDocument } from "@/lib/filing-contracts";

describe("internal beta guards", () => {
  it("permits only reviewed filing lifecycle transitions", () => {
    expect(canTransitionFiling("draft", "review_required")).toBe(true);
    expect(canTransitionFiling("review_required", "approved")).toBe(true);
    expect(canTransitionFiling("approved", "draft")).toBe(false);
  });
  it("requires ready, paginated Vault versions", () => {
    expect(isReadyDocument({ status: "ready", pages: 1 })).toBe(true);
    expect(isReadyDocument({ status: "ocr_pending", pages: 1 })).toBe(false);
    expect(isReadyDocument({ status: "ready", pages: 0 })).toBe(false);
  });
  it("never permits a completed contract to return to review", () => {
    expect(canTransitionContract("approved", "executed")).toBe(true);
    expect(canTransitionContract("executed", "review_required")).toBe(false);
  });
});
