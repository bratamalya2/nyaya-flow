import {
  AlertTriangle, BookMarked, BookOpen, CheckCircle2, CircleHelp, Copy, FileCheck2, FileSearch,
  Flag, GitBranch, Landmark, LibraryBig, Network, Pin, Quote, Scale, Search, ShieldCheck,
  ShieldQuestion, Sparkles,
} from "lucide-react";
import { Chip, DataTable, DisabledAction, Fact, Kpi, Note, Panel, SegmentLinks, StaticField } from "@/components/previews/primitives";
import { previewCriminalMatter, previewMatter } from "@/lib/preview-data";

type ResearchView = "answer" | "citator" | "review";
type Edge = { id: string; name: string; cite: string; x: number; y: number; label: string; tone: "followed" | "affirmed" | "distinguished" | "overruled" | "referred" };

const tabs = [
  { key: "answer", label: "Research answer", href: "/preview/research?view=answer" },
  { key: "citator", label: "Citator graph", href: "/preview/research?view=citator" },
  { key: "review", label: "Review & provenance", href: "/preview/research?view=review" },
];

const TONE = { followed: "#08745b", affirmed: "#006a78", distinguished: "#d8892a", overruled: "#b4232d", referred: "#e0a458" } as const;
const anchor = { x: 360, y: 260, name: "State v. Devika Arora", cite: "(2024) 6 SYN 412 · 3-Judge Bench" };
const edges: Edge[] = [
  { id: "a", name: "Harbans Lal v. State", cite: "(1992) 1 SYN 335 · 2-Judge", x: 150, y: 90, label: "FOLLOWED", tone: "followed" },
  { id: "b", name: "Nirmal Kaur v. CBI", cite: "(2022) 10 SYN 51", x: 580, y: 80, label: "AFFIRMED", tone: "affirmed" },
  { id: "c", name: "Ravi Chandra v. CBI", cite: "(2012) 1 SYN 40", x: 110, y: 400, label: "DISTINGUISHED", tone: "distinguished" },
  { id: "d", name: "State v. Ram Prakash", cite: "(1976) SYN Cri 123", x: 330, y: 480, label: "OVERRULED? (UNREVIEWED)", tone: "overruled" },
  { id: "e", name: "Suresh Batra v. State", cite: "(2025) SYN 102", x: 610, y: 420, label: "REFERRED TO LARGER BENCH", tone: "referred" },
];

const results = [
  { title: anchor.name, cite: "(2024) 6 SYN 412", forum: "Supreme Court · synthetic", bench: "3 judges · fixture checked", locator: "Paras 31–36", treatment: "Anchor authority", tone: "verified" as const },
  { title: "Nirmal Kaur v. CBI", cite: "(2022) 10 SYN 51", forum: "Supreme Court · synthetic", bench: "Bench strength unknown", locator: "Paras 18–21", treatment: "Later considered", tone: "manual" as const },
  { title: "Harbans Lal v. State", cite: "(1992) 1 SYN 335", forum: "Supreme Court · synthetic", bench: "2 judges · fixture checked", locator: "Paras 42–44", treatment: "Followed in fixture", tone: "verified" as const },
];

function ResearchScope() {
  return <>
    <section className="card research-command" aria-label="Synthetic research query">
      <div className="research-query">
        <Search size={18} />
        <div><span>Natural-language query</span><strong>When may staged custodial remand be considered under a fictional amended procedure?</strong></div>
        <DisabledAction variant="primary" icon={Sparkles}>Research</DisabledAction>
      </div>
      <div className="research-filters">
        <StaticField label="Jurisdiction" value="India · Supreme Court" />
        <StaticField label="Date range" value="1990–2026" />
        <StaticField label="Document type" value="Judgments" />
        <StaticField label="Source rights" value="Approved fixtures only" />
      </div>
    </section>
    <div className="research-scope-line">
      <span><LibraryBig size={13} /> Corpus: disconnected</span>
      <span><ShieldCheck size={13} /> Rights: preview fixtures</span>
      <span><FileSearch size={13} /> 3 illustrative results</span>
      <span><CircleHelp size={13} /> Hinglish evaluation pending</span>
    </div>
  </>;
}

function AnswerView() {
  return <>
    <ResearchScope />
    <div className="research-answer-layout">
      <section className="card research-results" aria-labelledby="research-results-title">
        <div className="section-heading"><div><p className="eyebrow"><FileSearch size={13} /> Ranked retrieval</p><h2 id="research-results-title">Authorities</h2></div><Chip tone="manual">Synthetic</Chip></div>
        <div className="research-result-list">
          {results.map((result, index) => <article className={`research-result ${index === 0 ? "active" : ""}`} id={index === 1 ? "source-nirmal" : undefined} key={result.cite}>
            <div className="research-result-rank">{index + 1}</div>
            <div>
              <h3>{result.title}</h3>
              <p className="pv-mono">{result.cite} · {result.locator}</p>
              <p>{result.forum}</p>
              <div className="actions"><Chip tone={result.tone}>{result.treatment}</Chip><span className="research-meta">{result.bench}</span></div>
            </div>
          </article>)}
        </div>
        <Note tone="manual">Ranking is illustrative. A Research beta release requires a licensed or permitted corpus, recorded publication dates, and passage-locator evaluation.</Note>
      </section>

      <div className="pv-column">
        <Panel eyebrow="Evidence-linked synthesis" icon={Sparkles} title="Illustrative research answer" aside={<Chip tone="stale">Lawyer review required</Chip>}>
          <div className="research-answer-warning"><AlertTriangle size={15} /><span>This is a fictional workflow example, not Indian law or legal advice. The production corpus is not connected.</span></div>
          <div className="research-claims">
            <article className="research-claim">
              <span className="research-claim-number">1</span>
              <div><p>Within this fictional fixture, staged custody is treated as an exceptional, reasoned decision rather than an automatic continuation.</p><a href="#passage-34">State v. Devika Arora, para 34</a></div>
            </article>
            <article className="research-claim">
              <span className="research-claim-number">2</span>
              <div><p>The illustrative court records the remaining statutory window and tests necessity independently at each request.</p><a href="#passage-35">State v. Devika Arora, para 35</a></div>
            </article>
            <article className="research-claim">
              <span className="research-claim-number">3</span>
              <div><p>A second fictional authority is displayed for comparison, but its bench strength is unknown and therefore excluded from hierarchy conclusions.</p><a href="#source-nirmal">Nirmal Kaur v. CBI, paras 18–21</a></div>
            </article>
          </div>
          <div className="research-withheld"><ShieldQuestion size={17} /><div><strong>Unsupported proposition withheld</strong><p>The fixtures do not support a universal numerical rule. The answer stops instead of filling the gap.</p></div></div>
          <div className="actions" style={{ marginTop: 12 }}><DisabledAction icon={BookMarked} variant="primary">Save research note</DisabledAction><DisabledAction icon={Copy}>Copy with status</DisabledAction><DisabledAction icon={Flag}>Report citation issue</DisabledAction></div>
        </Panel>

        <section className="research-evidence-grid" aria-label="Passage evidence">
          <article className="card research-source-card" id="passage-34">
            <div className="section-heading"><div><p className="eyebrow"><Quote size={13} /> Passage 1</p><h2>State v. Devika Arora</h2></div><Chip tone="verified">Fixture checked</Chip></div>
            <p className="pv-mono">SYN-2024-412-P34 · para 34 · source edition 1.2</p>
            <blockquote className="pv-quote">“A later request requires its own recorded reasons, the remaining period, and a fresh necessity assessment.”</blockquote>
            <p className="research-source-foot">Fictional passage · publication date 12 Jun 2024 · redistribution status: preview fixture</p>
          </article>
          <article className="card research-source-card" id="passage-35">
            <div className="section-heading"><div><p className="eyebrow"><Quote size={13} /> Passage 2</p><h2>Statutory context</h2></div><Chip tone="manual">Synthetic text</Chip></div>
            <p className="pv-mono">SYN-ACT-2023-S187-3 · section 187(3) · fixture version 0.4</p>
            <blockquote className="pv-quote">The fictional provision supplies an outer window but does not dispense with recorded judicial scrutiny.</blockquote>
            <p className="research-source-foot">Illustrative paraphrase · not enacted text · verification unavailable</p>
          </article>
        </section>
      </div>
    </div>
  </>;
}

function CitationGraph() {
  return <svg className="pv-graph" viewBox="0 0 720 540" role="img" aria-label="Synthetic citation graph centred on State v. Devika Arora">
    <defs>{Object.entries(TONE).map(([key, color]) => <marker id={`arrow-${key}`} key={key} markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4"><path d="M0,0 L8,4 L0,8 z" fill={color} /></marker>)}</defs>
    {edges.map((edge) => {
      const midX = (edge.x + anchor.x) / 2;
      const midY = (edge.y + anchor.y) / 2;
      return <g key={edge.id}>
        <line markerEnd={`url(#arrow-${edge.tone})`} stroke={TONE[edge.tone]} strokeDasharray={edge.tone === "distinguished" || edge.tone === "referred" ? "5 4" : undefined} strokeWidth="2" x1={anchor.x} x2={edge.x} y1={anchor.y} y2={edge.y} />
        <text className="pv-edge-label" fill={TONE[edge.tone]} textAnchor="middle" x={midX} y={midY - 6}>{edge.label}</text>
        <circle cx={edge.x} cy={edge.y} fill="var(--card)" r="16" stroke={TONE[edge.tone]} strokeWidth="3" />
        <circle cx={edge.x} cy={edge.y} fill={TONE[edge.tone]} r="6" />
        <text fontSize="11" fontWeight="700" textAnchor="middle" x={edge.x} y={edge.y + 32}>{edge.name}</text>
        <text fontSize="9" opacity=".7" textAnchor="middle" x={edge.x} y={edge.y + 45}>{edge.cite}</text>
      </g>;
    })}
    <circle cx={anchor.x} cy={anchor.y} fill="#0b2240" r="30" stroke="#d8892a" strokeWidth="4" />
    <text fill="#fff" fontSize="11" fontWeight="700" textAnchor="middle" x={anchor.x} y={anchor.y + 4} style={{ fill: "#fff", stroke: "none" }}>ANCHOR</text>
    <text fontSize="12" fontWeight="700" textAnchor="middle" x={anchor.x} y={anchor.y + 50}>{anchor.name}</text>
    <text fontSize="9" opacity=".7" textAnchor="middle" x={anchor.x} y={anchor.y + 63}>{anchor.cite}</text>
  </svg>;
}

function CitatorView() {
  return <>
    <div className="filters" aria-label="Graph filters">
      <StaticField label="Anchor authority" value={`${anchor.name} — ${anchor.cite}`} />
      <StaticField label="Bench strength" value="3 judges · fixture checked" />
      <StaticField label="Forum" value="Supreme Court (synthetic corpus)" />
      <Chip tone="verified">Followed (42)</Chip><Chip tone="stale">Distinguished (18)</Chip><Chip tone="conflict">Negative (3 · unreviewed)</Chip>
    </div>
    <div className="pv-layout">
      <div className="pv-column">
        <Panel eyebrow="Citation graph · depth 2 · 6 nodes" icon={Network} title="Precedent network" aside={<span className="actions"><DisabledAction>Zoom</DisabledAction><DisabledAction>Re-anchor</DisabledAction></span>}>
          <CitationGraph />
          <div className="pv-legend">
            <span style={{ color: TONE.followed }}>Followed</span><span style={{ color: TONE.affirmed }}>Affirmed</span><span style={{ color: TONE.distinguished }}>Distinguished</span><span style={{ color: TONE.overruled }}>Negative (needs review)</span><span style={{ color: TONE.referred }}>Referred to larger bench</span>
          </div>
          <Note tone="manual">Edges are synthetic. Every production edge must carry a direction, supporting passage, extraction version, source-rights record, and reviewer state; a citation alone never implies treatment.</Note>
        </Panel>
        <div className="pv-kpis" style={{ marginBottom: 0 }}>
          <Kpi label="Citing authorities" value="84" hint="Synthetic count" />
          <Kpi label="Treatment edges reviewed" value="0 / 6" hint="Awaiting analyst review" tone="stale" />
          <Kpi label="Corpus freshness" value="Not connected" hint="Approved corpus pending procurement" />
        </div>
        <section className="card pv-panel" style={{ background: "var(--st-conflict-bg)", borderColor: "var(--st-conflict-border)" }}>
          <div className="section-heading"><div><p className="eyebrow" style={{ color: "var(--st-conflict)" }}><AlertTriangle size={13} /> Possible negative treatment</p><h2>Opposing reliance may be affected</h2></div><Chip tone="conflict">Unreviewed</Chip></div>
          <p className="lede" style={{ marginTop: 0 }}>A fictional rejoinder relies on <strong>State v. Ram Prakash (1976) SYN Cri 123</strong>. The graph links it to the anchor with a possible overruling edge at paragraph 24. A reviewer must confirm both passages before the label can be treated as current.</p>
          <div className="actions"><DisabledAction icon={Copy}>Copy passage for review</DisabledAction></div>
        </section>
      </div>
      <div className="pv-column">
        <Panel eyebrow="Citator status" icon={ShieldQuestion} title="Treatment review" aside={<Chip tone="stale">Unreviewed</Chip>}>
          <p className="lede" style={{ marginTop: 0 }}>No negative flags have been reviewed. Status becomes verified only after an analyst confirms the relationship against both source passages.</p>
          <p className="nav-label" style={{ paddingLeft: 0 }}>Precedent hierarchy (Art. 141)</p>
          <div className="pv-ladder">
            <div><span>Constitution Bench (5+ judges)</span><span className="muted">Superior authority</span></div>
            <div className="current"><span>3-Judge Bench (anchor fixture)</span><span>Binds smaller benches</span></div>
            <div><span>Division Bench (2 judges)</span><span className="muted">Bound</span></div>
            <div><span>High Courts & subordinate courts</span><span className="muted">Hierarchy review required</span></div>
          </div>
          <p className="nav-label" style={{ paddingLeft: 0, marginTop: 10 }}>Bench (fictional)</p>
          <div className="actions"><Chip>Justice A. Verma</Chip><Chip>Justice N. Pillai</Chip><Chip>Justice S. Khurana</Chip></div>
        </Panel>
        <Panel eyebrow="Paragraph locator" icon={Quote} title="Ratio snippet · Para 34">
          <p className="pv-mono">(2024) 6 SYN 412 @ page 438, para 34 · locator SYN-2024-412-P34</p>
          <blockquote className="pv-quote">“A later request requires its own recorded reasons, the remaining period, and a fresh necessity assessment.”</blockquote>
          <Note tone="manual">Fictional passage for layout only. Real research must open the exact licensed or permitted source and expose its edition.</Note>
          <div className="actions" style={{ marginTop: 10 }}><DisabledAction icon={Copy} variant="primary">Copy formatted citation</DisabledAction><DisabledAction icon={Pin}>Pin to matter</DisabledAction><DisabledAction icon={Flag}>Report discrepancy</DisabledAction></div>
        </Panel>
        <Panel eyebrow="Linked matters" icon={BookOpen} title="Briefs citing this ratio">
          <div className="pv-list">
            <div className="pv-row"><div><strong>{previewCriminalMatter.title}</strong><p>{previewCriminalMatter.reference} · bail application</p></div><Chip tone="stale">Draft</Chip></div>
            <div className="pv-row"><div><strong>{previewMatter.shortTitle}</strong><p>{previewMatter.reference} · research note</p></div><Chip tone="manual">Synthetic</Chip></div>
          </div>
        </Panel>
      </div>
    </div>
  </>;
}

function ReviewView() {
  return <div className="pv-column">
    <div className="research-review-grid">
      <Panel eyebrow="Release gate" icon={ShieldCheck} title="Verification status" aside={<Chip tone="stale">Not export-ready</Chip>}>
        <div className="research-checklist">
          <div><CheckCircle2 size={16} /><span><strong>Passage locators present</strong><small>3 of 3 illustrative claims link to fixtures.</small></span></div>
          <div><CheckCircle2 size={16} /><span><strong>Source rights labelled</strong><small>Preview fixtures only; production procurement pending.</small></span></div>
          <div className="pending"><CircleHelp size={16} /><span><strong>Bench metadata incomplete</strong><small>One authority remains visibly unknown.</small></span></div>
          <div className="blocked"><AlertTriangle size={16} /><span><strong>Negative treatment unreviewed</strong><small>Export must retain the warning state.</small></span></div>
        </div>
        <div className="actions" style={{ marginTop: 12 }}><DisabledAction icon={FileCheck2} variant="primary">Export verified note</DisabledAction><DisabledAction icon={BookMarked}>Save to matter</DisabledAction></div>
      </Panel>
      <Panel eyebrow="Coverage declaration" icon={Landmark} title="Corpus & freshness">
        <div className="pv-facts">
          <Fact label="Corpus" value="Disconnected" sub="No production judgments indexed" />
          <Fact label="Fixture jurisdiction" value="Supreme Court" sub="Synthetic examples only" />
          <Fact label="Publication dates" value="Recorded" sub="Fixture metadata" />
          <Fact label="Last ingestion" value="Never" sub="Research worker not deployed" />
        </div>
        <Note tone="manual">No coverage, currency, or completeness claim is made until approved sources are ingested and evaluated.</Note>
      </Panel>
    </div>

    <Panel eyebrow="Human review queue" icon={GitBranch} title="Treatment evidence">
      <DataTable columns={["Relationship", "Supporting locator", "Metadata", "Review state"]} rows={[
        [<span key="a"><strong>Harbans Lal → Devika Arora</strong><br /><small>Followed</small></span>, "SYN-2024-412-P31", "2 → 3 judges", <Chip tone="stale" key="s">Pending</Chip>],
        [<span key="b"><strong>Nirmal Kaur → Devika Arora</strong><br /><small>Affirmed</small></span>, "SYN-2024-412-P32", "Unknown → 3 judges", <Chip tone="manual" key="s">Metadata gap</Chip>],
        [<span key="c"><strong>Ram Prakash → Devika Arora</strong><br /><small>Possible overruling</small></span>, "SYN-2024-412-P24", "2 → 3 judges", <Chip tone="conflict" key="s">Needs two-source review</Chip>],
        [<span key="d"><strong>Devika Arora → Suresh Batra</strong><br /><small>Larger-bench reference</small></span>, "SYN-2025-102-P17", "3 → 5 judges", <Chip tone="stale" key="s">Pending</Chip>],
      ]} />
      <Note tone="conflict">Negative treatment cannot be inferred from citation direction, language fragments, or bench strength alone. Review must record the source passage and reviewer decision.</Note>
    </Panel>

    <div className="research-review-grid">
      <Panel eyebrow="Draft note" icon={BookMarked} title="Matter-ready research record" aside={<Chip tone="manual">Unsaved preview</Chip>}>
        <div className="pv-facts">
          <Fact label="Linked matter" value={previewCriminalMatter.reference} />
          <Fact label="Author" value="Current reviewer" />
          <Fact label="Claims" value="3 cited · 1 withheld" />
          <Fact label="Treatment" value="Warnings preserved" />
        </div>
        <p className="lede">A saved note would preserve the query, retrieved source versions, claim-to-passage map, reviewer status, and later treatment notifications.</p>
        <div className="actions"><DisabledAction icon={BookMarked} variant="primary">Save note</DisabledAction><DisabledAction icon={Flag}>Send correction</DisabledAction></div>
      </Panel>
      <Panel eyebrow="Evaluation evidence" icon={Scale} title="Beta acceptance gates">
        <div className="research-gates">
          <p><span>Citation precision</span><strong>Threshold not approved</strong></p>
          <p><span>Passage-locator validity</span><strong>Test set pending</strong></p>
          <p><span>False-treatment rate</span><strong>Expert review pending</strong></p>
          <p><span>Abstention quality</span><strong>Test set pending</strong></p>
          <p><span>Multilingual retrieval</span><strong>Evaluation pending</strong></p>
        </div>
      </Panel>
    </div>
  </div>;
}

export function ResearchPreview({ view }: { view?: string }) {
  const active: ResearchView = view === "citator" || view === "review" ? view : "answer";
  return <>
    <section className="pv-hero research-hero">
      <p className="eyebrow"><LibraryBig size={13} /> Evidence before synthesis</p>
      <h2>Trace every proposition to a passage.</h2>
      <p>Search scope, source rights, passage locators, bench metadata, treatment evidence, and uncertainty remain visible from retrieval through export.</p>
      <div className="pv-hero-strip">
        <div><span>Release phase</span><strong>Research beta · not enabled</strong></div>
        <div><span>Corpus</span><strong>Approved source required</strong></div>
        <div><span>Graph projection</span><strong>Not deployed</strong></div>
        <div><span>Answer policy</span><strong>Cite or abstain</strong></div>
      </div>
    </section>
    <SegmentLinks active={active} items={tabs} label="Precedent research preview sections" />
    {active === "answer" ? <AnswerView /> : active === "citator" ? <CitatorView /> : <ReviewView />}
  </>;
}
