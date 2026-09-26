import { describe, expect, it } from "vitest";
import { uploadIntentInput } from "@/lib/validation";

const valid = { organizationId: "00000000-0000-4000-8000-000000000001", matterId: "00000000-0000-4000-8000-000000000002", fileName: "petition.pdf", mimeType: "application/pdf", sizeBytes: 1024, expectedPages: 10, sha256: "a".repeat(64) };
describe("upload intent validation", () => {
  it("accepts supported documents within limits", () => expect(uploadIntentInput.safeParse(valid).success).toBe(true));
  it("rejects files over 100 MB and page declarations over 500", () => {
    expect(uploadIntentInput.safeParse({ ...valid, sizeBytes: 101 * 1024 * 1024 }).success).toBe(false);
    expect(uploadIntentInput.safeParse({ ...valid, expectedPages: 501 }).success).toBe(false);
  });
  it("rejects unapproved content types", () => expect(uploadIntentInput.safeParse({ ...valid, mimeType: "application/msword" }).success).toBe(false));
});
