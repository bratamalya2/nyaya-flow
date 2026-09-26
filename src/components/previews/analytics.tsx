import { Activity, AlarmClock, Building2, CalendarClock, ShieldCheck, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { Bar, Chip, DataTable, DisabledAction, Kpi, Note, Panel, StackedBar, StaticField, type Tone } from "@/components/previews/primitives";
import { previewCriminalMatter, previewMatter, previewPeople } from "@/lib/preview-data";

const FORUMS = [
  { name: "Delhi High Court", dockets: 54, parts: [30, 18, 6] },
  { name: "Supreme Court of India", dockets: 22, parts: [9, 11, 2] },
  { name: "NCLT & NCLAT", dockets: 31, parts: [12, 15, 4] },
  { name: "Other High Courts & tribunals", dockets: 35, parts: [16, 14, 5] },
];
const WORKLOAD: { name: string; role: string; dockets: string; focus: string; load: number; status: [string, Tone] }[] = [
  { name: previewPeople.lead.name, role: previewPeople.lead.role, dockets: "18 lead matters", focus: "Constitutional writs", load: 82, status: ["Balanced", "verified"] },
  { name: previewPeople.advocate.name, role: previewPeople.advocate.role, dockets: "11 matters", focus: "Criminal appeals", load: 64, status: ["Available", "manual"] },
  { name: previewPeople.associate.name, role: previewPeople.associate.role, dockets: "24 drafts", focus: "Insolvency, commercial", load: 96, status: ["Over-allocated", "conflict"] },
  { name: previewPeople.paralegal.name, role: previewPeople.paralegal.role, dockets: "40 filings", focus: "Registry, indexing", load: 71, status: ["Balanced", "verified"] },
];

export function AnalyticsPreview() {
  return <>
    <div className="filters">
      <StaticField label="Persona" value="Managing partner view" />
      <StaticField label="Period" value="FY 2026–27 to date" />
      <DisabledAction>Export board pack</DisabledAction>
    </div>
    <Note tone="manual">Every figure on this page is synthetic. Aggregates in the Expansion release only count matters the viewer is authorized to see, so restricted matters never leak into totals.</Note>
    <div className="pv-kpis" style={{ marginTop: 14 }}>
      <Kpi label="Active portfolio" value="142" hint="Matters across 18 forums" bar={71} />
      <Kpi label="Exposure (synthetic)" value="₹482 Cr" hint="Client-declared values, not an estimate of outcomes" bar={58} tone="stale" />
      <Kpi label="Next 7 days" value="19" hint="High-priority listings" bar={38} tone="conflict" />
      <Kpi label="Fee realization" value="94.2%" hint="Collected vs invoiced" bar={94} tone="verified" />
    </div>
    <div className="pv-layout">
      <div className="pv-column">
        <Panel eyebrow="By forum" icon={Building2} title="Distribution and status" aside={<span className="pv-legend" style={{ marginTop: 0 }}><span style={{ color: "var(--green)" }}>Favourable</span><span style={{ color: "var(--amber)" }}>Pending</span><span style={{ color: "var(--red)" }}>Adverse</span></span>}>
          <div className="pv-layout-halves">
            {FORUMS.map((forum) => (
              <div className="pv-row" key={forum.name} style={{ display: "block" }}>
                <div className="section-heading" style={{ marginBottom: 8 }}><strong>{forum.name}</strong><Chip>{forum.dockets} dockets</Chip></div>
                <StackedBar parts={[{ label: "Favourable", value: forum.parts[0], tone: "verified" }, { label: "Pending", value: forum.parts[1], tone: "stale" }, { label: "Adverse", value: forum.parts[2], tone: "conflict" }]} />
                <p>Outcome labels are entered by the lead advocate.</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel eyebrow="Team capacity" icon={Users} title="Workload matrix" aside={<DisabledAction>Rebalance assignments</DisabledAction>}>
          <DataTable columns={["Advocate", "Active work", "Focus", "Load", "Status"]} rows={WORKLOAD.map((row) => [
            <span key="n"><strong>{row.name}</strong><div className="muted">{row.role}</div></span>,
            row.dockets, row.focus,
            <span key="l" style={{ display: "grid", gap: 4, minWidth: 110 }}><Bar tone={row.status[1]} value={row.load} /><span className="muted tabular">{row.load}%</span></span>,
            <Chip key="s" tone={row.status[1]}>{row.status[0]}</Chip>,
          ])} />
        </Panel>
        <Panel eyebrow="Client accounts" icon={Wallet} title="Client exposure">
          <DataTable align={["left", "right", "left", "right", "left", "left"]} columns={["Client", "Matters", "Main forum", "Declared value", "Next listing", "Advance"]} rows={[
            [previewMatter.client, "14", "Delhi HC (writ)", "₹142.8 Cr", "28 Oct · Court 12", <Chip key="a" tone="verified">Sufficient</Chip>],
            ["Meridian Credit Ltd.", "22", "NCLT Principal Bench", "₹189.4 Cr", "30 Oct · Court 2", <Chip key="b" tone="verified">Sufficient</Chip>],
            ["Kabir Malhotra", "1", "Supreme Court", "—", "02 Nov · Court 1", <Chip key="c" tone="stale">Top-up due</Chip>],
            ["Northwind Logistics", "11", "Delhi HC (commercial)", "₹81.8 Cr", "05 Nov · Registrar", <Chip key="d" tone="verified">Sufficient</Chip>],
          ]} />
        </Panel>
      </div>
      <div className="pv-column">
        <Panel eyebrow="Next 72 hours" icon={AlarmClock} title="Priority radar" aside={<Chip tone="conflict">3 critical</Chip>}>
          <div className="pv-list">
            <div className="pv-row"><div><strong>{previewCriminalMatter.title}</strong><p>{previewCriminalMatter.forum} · bail · today 10:45 AM</p></div><Chip tone="conflict">today</Chip></div>
            <div className="pv-row"><div><strong>Meridian Credit v. Suryodaya Power</strong><p>NCLT Court 2 · admission · tomorrow</p></div><Chip tone="stale">tomorrow</Chip></div>
            <div className="pv-row"><div><strong>{previewMatter.shortTitle}</strong><p>{previewMatter.forum} {previewMatter.court} · rejoinder due</p></div><Chip tone="stale">Thursday</Chip></div>
          </div>
        </Panel>
        <Panel eyebrow="Controls in the working app" icon={ShieldCheck} title="Privilege safeguards">
          <div className="policy-row"><div><strong>Row-level security</strong><p>Enforced by PostgreSQL for every query</p></div><Chip tone="verified">on</Chip></div>
          <div className="policy-row"><div><strong>Restricted matters</strong><p>Leadership and explicit grants only</p></div><Chip tone="verified">on</Chip></div>
          <div className="policy-row"><div><strong>Audit chain</strong><p>Verified daily by the worker</p></div><Link className="button small" href="/admin">View</Link></div>
        </Panel>
        <Panel eyebrow="Cash flow" icon={Activity} title="Realization">
          <p className="nav-label" style={{ paddingLeft: 0 }}>Billed vs collected</p><Bar value={94} tone="verified" />
          <p className="nav-label" style={{ paddingLeft: 0, marginTop: 10 }}>Unbilled work in progress</p><Bar value={32} tone="stale" />
          <p className="form-help"><CalendarClock size={11} style={{ verticalAlign: "-2px" }} /> Synthetic quarter-to-date figures.</p>
        </Panel>
      </div>
    </div>
  </>;
}
