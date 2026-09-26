import { describe, expect, it } from "vitest";
import { hearingInput, matterInput, taskUpdate, uploadIntentInput } from "@/lib/validation";

const valid = { matterId: "00000000-0000-4000-8000-000000000002", fileName: "petition.pdf", mimeType: "application/pdf", sizeBytes: 1024, expectedPages: 10, sha256: "a".repeat(64) };
describe("upload intent validation", () => {
  it("accepts supported documents within limits", () => expect(uploadIntentInput.safeParse(valid).success).toBe(true));
  it("rejects files over 100 MB and page declarations over 500", () => {
    expect(uploadIntentInput.safeParse({ ...valid, sizeBytes: 101 * 1024 * 1024 }).success).toBe(false);
    expect(uploadIntentInput.safeParse({ ...valid, expectedPages: 501 }).success).toBe(false);
  });
  it("rejects unapproved content types", () => expect(uploadIntentInput.safeParse({ ...valid, mimeType: "application/msword" }).success).toBe(false));
});

describe("matter validation", () => {
  const base = { title: "Asha Textiles v. State", reference: "W.P.(C) 10/2026", forum: "Delhi High Court", client: "Asha Textiles" };
  it("normalizes a valid CNR and treats blanks as absent", () => {
    expect(matterInput.parse({ ...base, cnr: "dlhc010012342026" }).cnr).toBe("DLHC010012342026");
    const parsed = matterInput.parse({ ...base, cnr: "  ", courtRoom: "" });
    expect(parsed.cnr).toBeUndefined();
    expect(parsed.courtRoom).toBeUndefined();
  });
  it("rejects malformed CNRs", () => {
    for (const cnr of ["DLHC0100123", "1234567890123456", "DLHC-01-0012-2026"]) expect(matterInput.safeParse({ ...base, cnr }).success).toBe(false);
  });
});

describe("hearing and task validation", () => {
  const advocateId = "00000000-0000-4000-8000-000000000101";
  it("requires the hearing to end after it starts", () => {
    expect(hearingInput.safeParse({ advocateId, startsAt: "2026-10-01T10:00:00+05:30", endsAt: "2026-10-01T09:00:00+05:30" }).success).toBe(false);
    expect(hearingInput.safeParse({ advocateId, startsAt: "2026-10-01T10:00:00+05:30", endsAt: "2026-10-01T11:00:00+05:30" }).success).toBe(true);
  });
  it("requires a reason for deadline or assignee changes but not for state toggles", () => {
    expect(taskUpdate.safeParse({ dueAt: "2026-10-01T10:00:00+05:30" }).success).toBe(false);
    expect(taskUpdate.safeParse({ dueAt: "2026-10-01T10:00:00+05:30", reason: "Client asked for time" }).success).toBe(true);
    expect(taskUpdate.safeParse({ state: "done" }).success).toBe(true);
  });
});
