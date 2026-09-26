import { AlertTriangle, BookOpen, Copy, Flag, Network, Pin, Quote, ShieldQuestion } from "lucide-react";
import { Chip, DisabledAction, Kpi, Note, Panel, StaticField } from "@/components/previews/primitives";
import { previewCriminalMatter, previewMatter } from "@/lib/preview-data";

type Edge = { id: string; name: string; cite: string; x: number; y: number; label: string; tone: "followed" | "affirmed" | "distinguished" | "overruled" | "referred" };
const TONE = { followed: "#08745b", affirmed: "#006a78", distinguished: "#d8892a", overruled: "#b4232d", referred: "#e0a458" } as const;
const anchor = { x: 360, y: 260, name: "State v. Devika Arora", cite: "(2024) 6 SYN 412 · 3-Judge Bench" };
const edges: Edge[] = [
  { id: "a", name: "Harbans Lal v. State", cite: "(1992) 1 SYN 335 · 2-Judge", x: 150, y: 90, label: "FOLLOWED", tone: "followed" },
  { id: "b", name: "Nirmal Kaur v. CBI", cite: "(2022) 10 SYN 51", x: 580, y: 80, label: "AFFIRMED", tone: "affirmed" },
  { id: "c", name: "Ravi Chandra v. CBI", cite: "(2012) 1 SYN 40", x: 110, y: 400, label: "DISTINGUISHED", tone: "distinguished" },
  { id: "d", name: "State v. Ram Prakash", cite: "(1976) SYN Cri 123", x: 330, y: 480, label: "OVERRULED? (UNREVIEWED)", tone: "overruled" },
  { id: "e", name: "Suresh Batra v. State", cite: "(2025) SYN 102", x: 610, y: 420, label: "REFERRED TO LARGER BENCH", tone: "referred" },
];

export function ResearchPreview() {
  return <>
    <div className="filters" aria-label="Graph filters">
      <StaticField label="Anchor authority" value={`${anchor.name} — ${anchor.cite}`} />
      <StaticField label="Bench strength" value="3-Judge Bench" />
      <StaticField label="Forum" value="Supreme Court (synthetic corpus)" />
      <Chip tone="verified">Followed (42)</Chip><Chip tone="stale">Distinguished (18)</Chip><Chip tone="conflict">Negative (3 · unreviewed)</Chip>
    </div>
    <div className="pv-layout">
      <div className="pv-column">
        <Panel eyebrow="Citation graph · depth 2 · 6 nodes" icon={Network} title="Precedent network" aside={<span className="actions"><DisabledAction>Zoom</DisabledAction><DisabledAction>Re-anchor</DisabledAction></span>}>
          <svg className="pv-graph" viewBox="0 0 720 540" role="img" aria-label="Synthetic citation graph centred on State v. Devika Arora">
            <defs>{Object.entries(TONE).map(([key, color]) => <marker id={`arrow-${key}`} key={key} markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4"><path d="M0,0 L8,4 L0,8 z" fill={color} /></marker>)}</defs>
            {edges.map((edge) => {
              const midX = (edge.x + anchor.x) / 2;
              const midY = (edge.y + anchor.y) / 2;
              return <g key={edge.id}>
                <line markerEnd={`url(#arrow-${edge.tone})`} stroke={TONE[edge.tone]} strokeDasharray={edge.tone === "distinguished" || edge.tone === "referred" ? "5 4" : undefined} strokeWidth="2" x1={anchor.x} x2={edge.x} y1={anchor.y} y2={edge.y} />
                <text className="pv-edge-label" fill={TONE[edge.tone]} textAnchor="middle" x={midX} y={midY - 6}>{edge.label}</text>
                <circle cx={edge.x} cy={edge.y} fill="#fff" r="16" stroke={TONE[edge.tone]} strokeWidth="3" />
                <circle cx={edge.x} cy={edge.y} fill={TONE[edge.tone]} r="6" />
                <text fontSize="11" fontWeight="700" textAnchor="middle" x={edge.x} y={edge.y + 32}>{edge.name}</text>
                <text fontSize="9" opacity=".7" textAnchor="middle" x={edge.x} y={edge.y + 45}>{edge.cite}</text>
              </g>;
            })}
            <circle cx={anchor.x} cy={anchor.y} fill="#0b2240" r="30" stroke="#d8892a" strokeWidth="4" />
            <text fill="#fff" fontSize="11" fontWeight="700" textAnchor="middle" x={anchor.x} y={anchor.y + 4} style={{ fill: "#fff", stroke: "none" }}>ANCHOR</text>
            <text fontSize="12" fontWeight="700" textAnchor="middle" x={anchor.x} y={anchor.y + 50}>{anchor.name}</text>
            <text fontSize="9" opacity=".7" textAnchor="middle" x={anchor.x} y={anchor.y + 63}>{anchor.cite}</text>
          </svg>
          <div className="pv-legend">
            <span style={{ color: TONE.followed }}>Followed</span><span style={{ color: TONE.affirmed }}>Affirmed</span><span style={{ color: TONE.distinguished }}>Distinguished</span><span style={{ color: TONE.overruled }}>Negative (needs review)</span><span style={{ color: TONE.referred }}>Referred to larger bench</span>
          </div>
          <Note tone="manual">Edges are synthetic. In the Research beta every edge carries a source passage, extraction version, and reviewer state; a citation alone never implies negative treatment.</Note>
        </Panel>
        <div className="pv-kpis" style={{ marginBottom: 0 }}>
          <Kpi label="Citing authorities" value="84" hint="Synthetic count" />
          <Kpi label="Treatment edges reviewed" value="0 / 6" hint="Awaiting analyst review" tone="stale" />
          <Kpi label="Corpus freshness" value="Not connected" hint="Licensed corpus pending procurement" />
        </div>
        <section className="card pv-panel" style={{ background: "var(--st-conflict-bg)", borderColor: "var(--st-conflict-border)" }}>
          <div className="section-heading"><div><p className="eyebrow" style={{ color: "var(--st-conflict)" }}><AlertTriangle size={13} /> Possible negative treatment</p><h2>Opposing reliance may be affected</h2></div><Chip tone="conflict">Unreviewed</Chip></div>
          <p className="lede" style={{ marginTop: 0 }}>The opposing rejoinder relies on <strong>State v. Ram Prakash (1976) SYN Cri 123</strong>. The synthetic graph links it to the anchor with a possible overruling edge at paragraph 24. A reviewer must confirm the passage before this flag can be shown as current law.</p>
          <div className="actions"><DisabledAction icon={Copy}>Copy passage for review</DisabledAction></div>
        </section>
      </div>
      <div className="pv-column">
        <Panel eyebrow="Citator status" icon={ShieldQuestion} title="Treatment review" aside={<Chip tone="stale">Unreviewed</Chip>}>
          <p className="lede" style={{ marginTop: 0 }}>0 reviewed negative flags. Status becomes “verified” only after an analyst confirms each edge against its source passage.</p>
          <p className="nav-label" style={{ paddingLeft: 0 }}>Precedent hierarchy (Art. 141)</p>
          <div className="pv-ladder">
            <div><span>Constitution Bench (5+ judges)</span><span className="muted">Binds smaller benches</span></div>
            <div className="current"><span>3-Judge Bench (this authority)</span><span>Binds lower benches</span></div>
            <div><span>Division Bench (2 judges)</span><span className="muted">Bound</span></div>
            <div><span>High Courts & subordinate courts</span><span className="muted">Bound</span></div>
          </div>
          <p className="nav-label" style={{ paddingLeft: 0, marginTop: 10 }}>Bench (fictional)</p>
          <div className="actions"><Chip>Justice A. Verma</Chip><Chip>Justice N. Pillai</Chip><Chip>Justice S. Khurana</Chip></div>
        </Panel>
        <Panel eyebrow="Paragraph locator" icon={Quote} title="Ratio snippet · Para 34">
          <p className="pv-mono">(2024) 6 SYN 412 @ page 438, para 34 · locator SYN-2024-412-P34</p>
          <blockquote className="pv-quote">“Police custody within the permitted period need not be continuous and may be sought in parts, subject to the statutory outer limit and judicial scrutiny of each request.”</blockquote>
          <Note tone="manual">Synthetic paraphrase for layout only. Real answers quote the licensed source verbatim with an exact locator.</Note>
          <div className="actions" style={{ marginTop: 10 }}><DisabledAction icon={Copy} variant="primary">Copy formatted citation</DisabledAction><DisabledAction icon={Pin}>Pin to hall pack</DisabledAction><DisabledAction icon={Flag}>Report discrepancy</DisabledAction></div>
        </Panel>
        <Panel eyebrow="Linked matters" icon={BookOpen} title="Briefs citing this ratio">
          <div className="pv-list">
            <div className="pv-row"><div><strong>{previewCriminalMatter.title}</strong><p>{previewCriminalMatter.reference} · bail application</p></div></div>
            <div className="pv-row"><div><strong>{previewMatter.shortTitle}</strong><p>{previewMatter.reference} · research note (draft)</p></div></div>
          </div>
        </Panel>
      </div>
    </div>
  </>;
}
