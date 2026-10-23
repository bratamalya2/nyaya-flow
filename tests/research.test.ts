import { describe, expect, it } from "vitest";
import { sourceMayBeEnabled } from "@/lib/research";
import { citationGraphLayout } from "@/lib/research-graph";
import { researchNoteInput } from "@/lib/validation";

describe("Research corpus rights boundary", () => {
  it("accepts a fixture only when it is explicitly marked as a fixture", () => {
    expect(sourceMayBeEnabled({ rightsBasis: "fixture", isFixture: true })).toBe(true);
    expect(sourceMayBeEnabled({ rightsBasis: "fixture", isFixture: false, rightsVerifiedAt: "2026-01-01" })).toBe(false);
  });

  it("requires a recorded verification for non-fixture sources", () => {
    expect(sourceMayBeEnabled({ rightsBasis: "licensed", isFixture: false })).toBe(false);
    expect(sourceMayBeEnabled({ rightsBasis: "licensed", isFixture: false, rightsVerifiedAt: "2026-01-01" })).toBe(true);
    expect(sourceMayBeEnabled({ rightsBasis: "permission", isFixture: false, rightsVerifiedAt: "2026-01-01" })).toBe(true);
  });
});

describe("Citation graph layout", () => {
  it("places a stable anchor and one node for each cited authority", () => {
    const graph = citationGraphLayout({ id: "anchor", title: "Anchor", citation: "[SYN] 1" }, [
      { id: "edge-a", documentId: "a", title: "A", citation: "[SYN] A", treatment: "followed", direction: "cited", sourceState: "verified" },
      { id: "edge-b", documentId: "b", title: "B", citation: "[SYN] B", treatment: "distinguished", direction: "citing", sourceState: "verified" },
    ]);
    expect(graph.nodes).toHaveLength(3);
    expect(graph.nodes[0]).toMatchObject({ id: "anchor", x: 360, y: 250, anchor: true });
    expect(graph.nodes.map((node) => `${node.x}:${node.y}`)).toEqual(["360:250", "360:90", "360:410"]);
  });
});

describe("Research note validation", () => {
  it("does not accept an empty research note or citation claim", () => {
    expect(researchNoteInput.safeParse({ title: "A research note", body: "", citations: [] }).success).toBe(false);
    expect(researchNoteInput.safeParse({ title: "A research note", body: "Review needed", citations: [{ passageId: "00000000-0000-4000-8000-000000000001", claimText: "" }] }).success).toBe(false);
  });
});
