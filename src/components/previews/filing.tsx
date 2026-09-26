import { BookMarked, CheckCircle2, FileSignature, FileWarning, GripVertical, ListTree, ScrollText, Send, ShieldAlert, Stamp } from "lucide-react";
import { Bar, Chip, DisabledAction, Kpi, Note, Panel, SegmentLinks, StaticField } from "@/components/previews/primitives";
import { inr, previewMatter, previewPeople } from "@/lib/preview-data";

type Finding = { title: string; result: "fail" | "warning" | "manual review"; rule: string; detail: string; fix?: string };
const TONE = { fail: "conflict", warning: "stale", "manual review": "manual" } as const;

const FINDINGS: Finding[] = [
  { title: "Caveat clearance statement not found", result: "fail", rule: "Synthetic rule pack DHC-SYN 2026.1 · rule 4(A)", detail: "No averment states whether a caveat has been lodged against the petitioner. The rule pack expects a declaration in the body of the petition.", fix: "Draft declaration available for lawyer review" },
  { title: "Court fee differs from the computed schedule", result: "fail", rule: "Court fee schedule · synthetic version 2026-04", detail: `Declared valuation ${inr(24500000)}; fee receipt attached ${inr(210000)}; computed fee ${inr(245000)}. Difference ${inr(35000)}.`, fix: "Recompute after confirming valuation with counsel" },
  { title: "Bookmark for Annexure P-4 points one page early", result: "warning", rule: "E-filing guideline · rule 12 (synthetic)", detail: "Bookmark targets page 86; the annexure heading appears on page 87. Running page numbers differ from the index on pages 112–124.", fix: "Regenerate bookmarks from the approved index" },
  { title: "Affidavit attestation", result: "manual review", rule: "Human check required", detail: "Signature, oath commissioner stamp, and date must be checked by a person against the signed original. Software cannot confirm attestation." },
];
const PASSED = ["Left margin 3.5 cm", "Font and line spacing", "Advocate welfare stamp affixed", "Urgent application format", "Searchable text layer", "Page size A4"];

const SECTIONS = [
  { title: "Sec I · Court fees & urgency", pages: "1–4", state: "Affixed" },
  { title: "Sec II · Notice of motion", pages: "5–8", state: "Indexed" },
  { title: "Sec III · Synopsis & list of dates", pages: "9–18", state: "Draft", current: true },
  { title: "Sec IV · Writ petition & affidavit", pages: "19–64", state: "Needs attestation check" },
  { title: "Sec V · Annexures P-1 to P-8", pages: "65–184", state: "Indexed" },
];
const INDEX = [
  ["1.", "Court fee & urgency application", "24.06.2026", "—", "1–4"],
  ["2.", "Notice of motion & memo of parties", "24.06.2026", "—", "5–8"],
  ["3.", "Synopsis and list of dates", "24.06.2026", "—", "9–18"],
  ["4.", "Writ petition under Article 226 with affidavit", "24.06.2026", "—", "19–64"],
  ["5.", "Impugned order", "14.06.2026", "P-1", "65–88"],
  ["6.", "Board resolution and authorisation", "02.05.2026", "P-2", "89–94"],
  ["7.", "Notifications relied upon", "15.01.2026", "P-3", "95–120"],
  ["8.", "Demand notice with proof of dispatch", "18.06.2026", "P-4", "121–140"],
];

function Auditor() {
  return <>
    <div className="pv-hero">
      <p className="eyebrow">Pre-filing check · synthetic rule pack</p>
      <h2>E-filing defect checker</h2>
      <p>Checks a bundle against a versioned forum rule pack. Every result shows its rule and effective version. A pass is not a guarantee that the registry will accept the filing.</p>
      <div className="pv-hero-strip">
        <div><span>Rule pack</span><strong>DHC-SYN 2026.1 (synthetic)</strong></div>
        <div><span>Target</span><strong>Commercial Division (Civil)</strong></div>
        <div><span>Bundle</span><strong>184 pages · PDF/A-1b</strong></div>
        <div><span>Findings</span><strong>2 fail · 1 warning · 1 manual</strong></div>
      </div>
      <div className="pv-hero-actions"><DisabledAction>Export checklist</DisabledAction><DisabledAction variant="teal">Re-run checks</DisabledAction></div>
    </div>
    <div className="pv-kpis">
      <Kpi label="Checks run" value="24" hint="Formatting and statutory" />
      <Kpi label="Pass" value="20" hint="Still subject to registry scrutiny" tone="verified" />
      <Kpi label="Fail" value="02" hint="Must be fixed before filing" tone="conflict" />
      <Kpi label="Warning / manual" value="01 / 01" hint="Needs a person to decide" tone="stale" />
    </div>
    <div className="pv-layout">
      <div className="pv-column">
        <Panel eyebrow="Findings" icon={FileWarning} title="Defects and directions">
          {FINDINGS.map((finding) => (
            <article className="pv-card-defect" key={finding.title}>
              <header><h3>{finding.title}</h3><Chip tone={TONE[finding.result]}>{finding.result}</Chip></header>
              <p className="pv-mono">{finding.rule}</p>
              <p>{finding.detail}</p>
              {finding.fix ? <div className="pv-fix"><span>{finding.fix}</span><DisabledAction>Prepare fix</DisabledAction></div> : null}
            </article>
          ))}
        </Panel>
        <Panel eyebrow={`${PASSED.length} checks passed`} icon={CheckCircle2} title="Passed formatting checks">
          <div className="pv-facts">{PASSED.map((item) => <div className="pv-fact" key={item}><span>Pass</span><strong>{item}</strong></div>)}</div>
        </Panel>
      </div>
      <div className="pv-column">
        <Panel eyebrow="Intake" icon={ScrollText} title="Bundle under check">
          <StaticField label="Forum" value={`${previewMatter.forum} — Original Civil`} />
          <StaticField label="Matter" value={`${previewMatter.reference} · ${previewMatter.shortTitle}`} />
          <StaticField label="File" value="Petition_Final_Draft.pdf · 184 pages" />
        </Panel>
        <Panel eyebrow="Signing" icon={FileSignature} title="DSC & eSign" aside={<Chip tone="stale">No partner</Chip>}>
          <p className="lede" style={{ marginTop: 0 }}>Signing sends the exact approved version to a licensed partner and locks it. No signing partner or token bridge is contracted yet.</p>
          <DisabledAction icon={FileSignature} variant="primary">Sign approved version</DisabledAction>
        </Panel>
        <Panel eyebrow="Submission" icon={Send} title="Court filing">
          <p className="lede" style={{ marginTop: 0 }}>No permitted court endpoint is configured. When enabled, submission still requires explicit human confirmation; until then, export the bundle for manual filing.</p>
          <DisabledAction>Export for manual filing</DisabledAction>
        </Panel>
      </div>
    </div>
  </>;
}

function Indexer() {
  return <>
    <div className="pv-hero">
      <p className="eyebrow">Docket indexer · FR-034</p>
      <h2>Master index & bundle assembly</h2>
      <p>{previewMatter.reference} · {previewMatter.title} · {previewMatter.forum}</p>
      <div className="pv-hero-actions"><DisabledAction>Preview merged bundle</DisabledAction><DisabledAction variant="teal">Export PDF/A</DisabledAction></div>
    </div>
    <div className="pv-layout-3">
      <Panel eyebrow="184 folios" icon={ListTree} title="Docket hierarchy">
        <div className="pv-list">{SECTIONS.map((section) => (
          <div className={`pv-row ${section.current ? "active" : ""}`} key={section.title}>
            <GripVertical size={14} className="muted" aria-hidden="true" />
            <div style={{ flex: 1 }}><strong>{section.title}</strong><p>Pages {section.pages} · {section.state}</p></div>
          </div>
        ))}</div>
        <div className="actions" style={{ marginTop: 10 }}><DisabledAction>Add annexure</DisabledAction><DisabledAction>Re-sequence folios</DisabledAction></div>
        <p className="nav-label" style={{ paddingLeft: 0, marginTop: 12 }}>Bundle size</p>
        <Bar value={48} tone="manual" /><p className="form-help">24.2 MB of a 50 MB limit (synthetic)</p>
      </Panel>
      <Panel eyebrow="Folio inspector" icon={BookMarked} title="Hyperlinked master index">
        <div className="pv-page">
          <p style={{ textAlign: "center", margin: "0 0 4px" }}>IN THE HIGH COURT OF DELHI AT NEW DELHI</p>
          <h4>WRIT PETITION (CIVIL) NO. 4417 OF 2026</h4>
          <p style={{ textAlign: "center", margin: 0 }}>{previewMatter.client.toUpperCase()} … PETITIONER<br /><em>versus</em><br />UNION OF INDIA &amp; ANR. … RESPONDENTS</p>
          <table><thead><tr><th>S.No.</th><th>Particulars</th><th>Date</th><th>Annex.</th><th>Folio</th></tr></thead><tbody>{INDEX.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody></table>
          <p className="pv-mono" style={{ textAlign: "right", marginTop: 8 }}>[PAGE 9 OF 184]</p>
        </div>
        <Note tone="manual">Synopsis, list of dates, and annexure labels are drafts until a reviewer approves them against the case file.</Note>
      </Panel>
      <div className="pv-column">
        <Panel eyebrow="Registry checklist" icon={ShieldAlert} title="Pre-scrutiny">
          {["Left margin and gutter", "Searchable text layer", "Bookmarks match index", "Annexure separator sheets", "Court fee e-challan linked"].map((item, index) => (
            <div className="policy-row" key={item}><div><strong>{item}</strong></div><Chip tone={index === 2 ? "stale" : "verified"}>{index === 2 ? "warning" : "pass"}</Chip></div>
          ))}
        </Panel>
        <Panel eyebrow="Stamping" icon={Stamp} title="Page numbering">
          <StaticField label="Folio format" value="Page {n} of {total}" />
          <StaticField label="True copy attestation" value="Annexures P-1 to P-8" />
        </Panel>
        <Panel eyebrow="Execution" icon={FileSignature} title="Signing sequence">
          <div className="pv-list">
            <div className="pv-row"><div><strong>{previewPeople.associate.name}</strong><p>Bundle assembled</p></div><Chip tone="verified">done</Chip></div>
            <div className="pv-row"><div><strong>Client signatory</strong><p>Awaiting eSign partner</p></div><Chip tone="stale">pending</Chip></div>
            <div className="pv-row"><div><strong>{previewPeople.lead.name}</strong><p>Advocate-on-record signature</p></div><Chip>not started</Chip></div>
          </div>
        </Panel>
      </div>
    </div>
  </>;
}

export function FilingPreview({ view }: { view?: string }) {
  const active = view === "indexer" ? "indexer" : "auditor";
  return <>
    <SegmentLinks active={active} items={[{ key: "auditor", label: "Defect checker", href: "/preview/filing" }, { key: "indexer", label: "Bundle indexer", href: "/preview/filing?view=indexer" }]} label="E-filing views" />
    {active === "auditor" ? <Auditor /> : <Indexer />}
  </>;
}
