"use client";

import { Minus, Move, Plus, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { citationGraphLayout, treatmentColor, type CitationGraphEdge } from "@/lib/research-graph";

type Props = { anchor: { id: string; title: string; citation: string }; edges: CitationGraphEdge[]; provider: "neo4j" | "postgres" | "syncing"; baseQuery?: string };
export function ResearchCitationGraph({ anchor, edges, provider, baseQuery }: Props) {
  const [selected, setSelected] = useState(() => new Set(edges.map((edge) => edge.treatment)));
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | undefined>(undefined);
  const graph = useMemo(() => citationGraphLayout(anchor, edges.filter((edge) => selected.has(edge.treatment))), [anchor, edges, selected]);
  const toggle = (treatment: string) => setSelected((current) => { const next = new Set(current); if (next.has(treatment)) next.delete(treatment); else next.add(treatment); return next; });
  const href = (id: string) => `/research?doc=${encodeURIComponent(id)}${baseQuery ? `&q=${encodeURIComponent(baseQuery)}` : ""}`;
  const node = (id: string) => graph.nodes.find((item) => item.id === id)!;
  const treatments = [...new Set(edges.map((edge) => edge.treatment))];
  return <section className="card research-graph" aria-labelledby="citation-graph-title">
    <div className="section-heading"><div><p className="eyebrow"><Move size={12} /> One-hop citation network</p><h2 id="citation-graph-title">Knowledge graph</h2><p>{provider === "neo4j" ? "Neo4j projection" : provider === "postgres" ? "Canonical PostgreSQL fallback" : "Graph projection is syncing; canonical citation data remains available."}</p></div><div className="graph-controls"><button aria-label="Zoom out" className="icon-button" onClick={() => setScale((value) => Math.max(.65, value - .15))} type="button"><Minus size={14} /></button><button aria-label="Reset graph view" className="icon-button" onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }} type="button"><RotateCcw size={14} /></button><button aria-label="Zoom in" className="icon-button" onClick={() => setScale((value) => Math.min(1.7, value + .15))} type="button"><Plus size={14} /></button></div></div>
    {edges.length ? <><div className="graph-filters" aria-label="Citation treatment filters">{treatments.map((treatment) => <label key={treatment}><input checked={selected.has(treatment)} onChange={() => toggle(treatment)} type="checkbox" /><span style={{ background: treatmentColor(treatment) }} />{treatment.replaceAll("_", " ")}</label>)}</div>
      <div className="graph-canvas"><svg aria-label={`Citation graph centred on ${anchor.title}`} onPointerDown={(event) => { drag.current = { x: event.clientX - pan.x, y: event.clientY - pan.y }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (drag.current) setPan({ x: event.clientX - drag.current.x, y: event.clientY - drag.current.y }); }} onPointerUp={() => { drag.current = undefined; }} role="img" viewBox={`0 0 ${graph.width} ${graph.height}`}><defs>{treatments.map((treatment) => <marker id={`arrow-${treatment}`} key={treatment} markerHeight="7" markerWidth="7" orient="auto" refX="6" refY="3.5"><path d="M0,0 L7,3.5 L0,7 z" fill={treatmentColor(treatment)} /></marker>)}</defs><g transform={`translate(${pan.x} ${pan.y}) scale(${scale})`}>
        {graph.edges.map((edge) => { const other = node(edge.documentId); const from = edge.direction === "citing" ? other : graph.nodes[0]; const to = edge.direction === "citing" ? graph.nodes[0] : other; return <g key={edge.id}><line markerEnd={`url(#arrow-${edge.treatment})`} stroke={treatmentColor(edge.treatment)} strokeDasharray={edge.treatment === "distinguished" ? "6 4" : undefined} strokeWidth="2.5" x1={from.x} x2={to.x} y1={from.y} y2={to.y} /><text className="graph-edge-label" fill={treatmentColor(edge.treatment)} textAnchor="middle" x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 7}>{edge.treatment.replaceAll("_", " ")}</text></g>; })}
        {graph.nodes.map((item) => <Link aria-label={item.anchor ? `Anchor authority: ${item.title}` : `Re-anchor graph on ${item.title}`} href={href(item.id)} key={item.id}><circle className={item.anchor ? "graph-node anchor" : "graph-node"} cx={item.x} cy={item.y} r={item.anchor ? 35 : 25} /><text className={`graph-node-title ${item.anchor ? "anchor-label" : ""}`} textAnchor="middle" x={item.x} y={item.y + 4}>{item.anchor ? "ANCHOR" : item.citation.slice(0, 14)}</text><text className="graph-node-caption" textAnchor="middle" x={item.x} y={item.y + (item.anchor ? 55 : 45)}>{item.title.slice(0, 28)}</text></Link>)}
      </g></svg></div><p className="graph-help">Drag to pan. Use controls to zoom. Select an authority node to re-anchor. The evidence list below remains the accessible detailed record.</p></> : <div className="empty-state"><strong>No citation edges are available for this authority.</strong><p>Absence of graph edges is not evidence of no treatment.</p></div>}
  </section>;
}
