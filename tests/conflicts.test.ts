import { describe, expect, it } from "vitest";
import { findHearingConflicts } from "@/lib/conflicts";
import type { Hearing, Person } from "@/lib/types";

const advocate: Person = { id: "advocate", name: "Advocate", initials: "AD", role: "advocate" };
function hearing(id: string, start: string, end: string, forum = "Delhi High Court"): Hearing {
  return { id, matterId: id, matterTitle: id, reference: id, forum, courtRoom: id, startsAt: start, endsAt: end, advocate, status: "confirmed", sourceState: "manual" };
}

describe("findHearingConflicts", () => {
  it("detects overlapping assignments for the same advocate", () => {
    const result = findHearingConflicts([
      hearing("one", "2026-09-27T05:30:00.000Z", "2026-09-27T06:30:00.000Z"),
      hearing("two", "2026-09-27T06:00:00.000Z", "2026-09-27T07:00:00.000Z", "NCLT"),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].overlapMinutes).toBe(30);
  });

  it("uses a travel buffer across forums", () => {
    const result = findHearingConflicts([
      hearing("one", "2026-09-27T05:30:00.000Z", "2026-09-27T06:00:00.000Z"),
      hearing("two", "2026-09-27T06:20:00.000Z", "2026-09-27T07:00:00.000Z", "NCLT"),
    ], 35);
    expect(result).toHaveLength(1);
    expect(result[0].overlapMinutes).toBe(0);
  });
});
