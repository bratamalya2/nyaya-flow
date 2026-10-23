export type CitationGraphEdge = { id: string; documentId: string; title: string; citation: string; treatment: string; direction: "citing" | "cited"; sourceState: string };
export type CitationGraphNode = { id: string; title: string; citation: string; x: number; y: number; anchor?: boolean };

export function citationGraphLayout(anchor: { id: string; title: string; citation: string }, edges: CitationGraphEdge[]) {
  const unique = [...new Map(edges.map((edge) => [edge.documentId, edge])).values()];
  const radius = unique.length < 3 ? 160 : 205;
  const nodes: CitationGraphNode[] = [{ ...anchor, x: 360, y: 250, anchor: true }];
  unique.forEach((edge, index) => {
    const angle = -Math.PI / 2 + (index / Math.max(unique.length, 1)) * Math.PI * 2;
    nodes.push({ id: edge.documentId, title: edge.title, citation: edge.citation, x: Math.round(360 + Math.cos(angle) * radius), y: Math.round(250 + Math.sin(angle) * radius) });
  });
  return { width: 720, height: 500, nodes, edges: unique };
}

export const treatmentColor = (treatment: string) => ({ followed: "#16817b", affirmed: "#16817b", cited: "#4f6f8f", distinguished: "#b36b13", overruled: "#b42318", doubted: "#b42318", referred_to_larger_bench: "#7654b7" }[treatment] ?? "#4f6f8f");
