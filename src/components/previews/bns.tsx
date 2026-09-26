import { ArrowLeftRight, CalendarClock, FileDiff, Info, Scale, Search, Sparkles } from "lucide-react";
import { Chip, DataTable, DisabledAction, Note, Panel, SegmentLinks, StaticField } from "@/components/previews/primitives";
import { previewCriminalMatter } from "@/lib/preview-data";

type Provision = { section: string; heading: string; text?: string; attributes: [string, string][]; era: string };
type CodePair = { key: string; label: string; legacy: Provision; current: Provision; delta: string };

// Section 420 IPC and Section 318(4) BNS share the same operative wording; other pairs show headings
// only until the versioned Gazette corpus is licensed for the Research beta.
const CHEATING_TEXT = "Whoever cheats and thereby dishonestly induces the person deceived to deliver any property to any person, or to make, alter or destroy the whole or any part of a valuable security, or anything which is signed or sealed, and which is capable of being converted into a valuable security, shall be punished with imprisonment of either description for a term which may extend to seven years, and shall also be liable to fine.";

const PAIRS: CodePair[] = [
  {
    key: "ipc", label: "IPC 1860 ↔ BNS 2023",
    legacy: { section: "Section 420, IPC 1860", heading: "Cheating and dishonestly inducing delivery of property", text: CHEATING_TEXT, era: "In force until 30 June 2024", attributes: [["Cognizability", "Cognizable"], ["Bail", "Non-bailable"], ["Compounding", "With permission of court"], ["Trial", "Magistrate of the first class"]] },
    current: { section: "Section 318(4), BNS 2023", heading: "Cheating", text: CHEATING_TEXT, era: "In force from 1 July 2024", attributes: [["Cognizability", "Cognizable"], ["Bail", "Non-bailable"], ["Compounding", "Check BNSS Section 359"], ["Trial", "Magistrate of the first class"]] },
    delta: "Sections 415–420 IPC are consolidated in Section 318 BNS; sub-section (4) carries the Section 420 offence with the same seven-year maximum.",
  },
  {
    key: "crpc", label: "CrPC 1973 ↔ BNSS 2023",
    legacy: { section: "Section 438, CrPC 1973", heading: "Direction for grant of bail to person apprehending arrest", era: "In force until 30 June 2024", attributes: [["Relief", "Anticipatory bail"], ["Forum", "High Court / Court of Session"]] },
    current: { section: "Section 482, BNSS 2023", heading: "Direction for grant of bail to person apprehending arrest", era: "In force from 1 July 2024", attributes: [["Relief", "Anticipatory bail"], ["Forum", "High Court / Court of Session"]] },
    delta: "Renumbered; compare conditions and excluded offences against the official text before relying on equivalence.",
  },
  {
    key: "iea", label: "IEA 1872 ↔ BSA 2023",
    legacy: { section: "Section 65B, Indian Evidence Act 1872", heading: "Admissibility of electronic records", era: "In force until 30 June 2024", attributes: [["Subject", "Electronic records"], ["Certificate", "Required"]] },
    current: { section: "Section 63, BSA 2023", heading: "Admissibility of electronic records", era: "In force from 1 July 2024", attributes: [["Subject", "Electronic records"], ["Certificate", "Required; check prescribed format"]] },
    delta: "Renumbered with changes to the certificate requirement; review the Schedule before filing.",
  },
];

function ProvisionPane({ provision, tone, tag }: { provision: Provision; tone: "conflict" | "verified"; tag: string }) {
  return (
    <section className="card pv-panel">
      <div className="section-heading"><div><p className="eyebrow">{tone === "conflict" ? "Legacy law" : "Current Sanhita"}</p><h2 style={{ fontSize: 15 }}>{provision.section}</h2></div><Chip tone={tone}>{tag}</Chip></div>
      <p className="nav-label" style={{ paddingLeft: 0 }}>Marginal heading</p>
      <h3 className="legal-title" style={{ fontSize: 18, marginBottom: 10 }}>{provision.heading}</h3>
      {provision.text ? <div className="pv-statute reading">{provision.text}</div> : <Note tone="manual">Statutory text loads from the licensed, versioned corpus in the Research beta.</Note>}
      <div className="pv-facts">{provision.attributes.map(([label, value]) => <div className="pv-fact" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      <p className="pv-mono" style={{ marginTop: 10 }}>{provision.era}</p>
    </section>
  );
}

export function BnsPreview({ code }: { code?: string }) {
  const pair = PAIRS.find((item) => item.key === code) ?? PAIRS[0];
  return <>
    <div className="pv-hero">
      <p className="eyebrow">Statutory transition engine · effective 1 July 2024</p>
      <h2>Criminal law transition matrix</h2>
      <p>Side-by-side provisions, an applicability worksheet, and citation updates that always require a lawyer&apos;s approval.</p>
      <div className="pv-hero-actions"><SegmentLinks active={pair.key} items={PAIRS.map((item) => ({ key: item.key, label: item.label, href: `/preview/bns?code=${item.key}` }))} label="Code pair" /></div>
    </div>
    <div className="pv-layout-3">
      <ProvisionPane provision={pair.legacy} tag="Repealed" tone="conflict" />
      <div className="pv-column">
        <Panel eyebrow="Art. 20(1) worksheet" icon={CalendarClock} title="Applicability worksheet">
          <StaticField label="1. Date of offence" value="14 May 2024" />
          <StaticField label="2. FIR registered" value="20 Jul 2024" />
          <StaticField label="3. Police report / charge-sheet" value="15 Sep 2024" />
          <div className="pv-note pv-note-verified">
            <strong>Illustrative reasoning — not a determination</strong>
            <p style={{ margin: "4px 0 0" }}>Offence before 1 July 2024: Article 20(1) points to the substantive law in force then (IPC). FIR after that date: procedure generally follows BNSS. Check the savings in Section 531 BNSS for anything pending on 1 July 2024, then confirm the facts.</p>
          </div>
          <div className="actions" style={{ marginTop: 10 }}><DisabledAction>Attach worksheet to matter</DisabledAction></div>
        </Panel>
        <section className="card pv-panel" style={{ background: "var(--navy-strong)", color: "#fff" }}>
          <p className="eyebrow" style={{ color: "#84d2e2" }}><FileDiff size={13} /> Draft converter</p>
          <h2 style={{ color: "#fff", fontSize: 15 }}>Update citations in a draft</h2>
          <p style={{ color: "#cbd5e1", fontSize: 11 }}>Produces tracked changes and a citation report. The document stays unchanged until an authorized lawyer approves.</p>
          <DisabledAction icon={ArrowLeftRight} variant="teal">Propose tracked changes</DisabledAction>
        </section>
      </div>
      <ProvisionPane provision={pair.current} tag="Current" tone="verified" />
    </div>
    <Note tone="manual">{pair.delta} Mappings in this preview are unverified fixtures.</Note>

    <div className="pv-layout" style={{ marginTop: 14 }}>
      <Panel eyebrow="Paragraph-linked research" icon={Sparkles} title="Precedent answers with citations" aside={<Chip tone="stale">Corpus not connected</Chip>}>
        <StaticField label="Question" value="Default bail timelines under Section 187 BNSS compared with Section 167(2) CrPC" />
        <div className="actions" style={{ marginBottom: 10 }}><Chip tone="manual">Scope: Supreme Court & High Courts</Chip><Chip tone="manual">Treatment: reviewed only</Chip><DisabledAction icon={Search} variant="teal">Search corpus</DisabledAction></div>
        <p className="reading" style={{ fontSize: 12, lineHeight: 1.7 }}>In the synthetic authority <strong>State v. Devika Arora (2024) 6 SYN 412</strong>, paragraphs 18–22 discuss custody under Section 187 BNSS. Each sentence of a real answer links to a quoted paragraph; any sentence without a verifiable passage is withheld or marked uncertain.</p>
        <blockquote className="pv-quote">“Para 21 (synthetic): the change in wording is directed at the manner of custody within the outer limit, not at extending that limit.”</blockquote>
        <div className="actions"><DisabledAction>Copy with pins</DisabledAction><DisabledAction>Flag ambiguity</DisabledAction><DisabledAction variant="primary">Save research note</DisabledAction></div>
      </Panel>
      <Panel eyebrow="Quick reference" icon={Scale} title="Common renumberings">
        <DataTable columns={["Old", "New", "Subject"]} rows={[
          ["CrPC 154", "BNSS 173", "Information in cognizable cases"],
          ["CrPC 167", "BNSS 187", "Procedure when investigation cannot be completed in 24 hours"],
          ["CrPC 438", "BNSS 482", "Anticipatory bail"],
          ["IEA 65B", "BSA 63", "Electronic records"],
        ]} />
        <p className="form-help">Linked matter: {previewCriminalMatter.title} · {previewCriminalMatter.reference}</p>
      </Panel>
    </div>
    <p className="pv-note pv-note-stale" style={{ marginTop: 14 }}><Info size={12} style={{ verticalAlign: "-2px" }} /> Section 531 BNSS (repeal and savings): proceedings pending on 1 July 2024 generally continue under the CrPC. Confirm the position for each matter before relying on this summary.</p>
  </>;
}
