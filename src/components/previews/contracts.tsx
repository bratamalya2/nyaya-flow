import { Calculator, FilePlus2, FileSearch, FileSignature, Landmark, Library, Upload } from "lucide-react";
import { Chip, DisabledAction, Fact, Kpi, Note, Panel, StaticField, type Tone } from "@/components/previews/primitives";
import { inr } from "@/lib/preview-data";

type Clause = { number: string; title: string; risk: string; tone: Tone; page: string; quote: string; note: string; fix?: string };
const CLAUSES: Clause[] = [
  { number: "14.2", title: "Limitation of liability and indemnity carve-out", risk: "High · uncapped", tone: "conflict", page: "Page 28, para 3", quote: "…neither party's liability shall be limited with respect to indirect or consequential loss arising from the Supplier's negligence…", note: "No aggregate cap on consequential loss. Consider Sections 73–74 of the Indian Contract Act, 1872 and the commercial position with the reviewer.", fix: "Suggest bilateral cap for review" },
  { number: "22.4", title: "Post-termination restraint on personnel", risk: "Reviewer attention", tone: "stale", page: "Page 39, para 6", quote: "…for 24 months after termination, the Customer shall not engage any competing provider in the listed regions…", note: "Restraints of trade are scrutinised under Section 27 of the Indian Contract Act, 1872. Flagged for a lawyer to assess enforceability.", fix: "Suggest non-solicitation alternative" },
  { number: "26.1", title: "Dispute resolution and arbitrator appointment", risk: "Reviewer attention", tone: "stale", page: "Page 44, para 1", quote: "…disputes shall be referred to a sole arbitrator appointed by the Supplier's Managing Director…", note: "Unilateral appointment clauses have been challenged in Indian courts. Reviewer to confirm current authority before advising.", fix: "Suggest institutional appointment" },
  { number: "11.3", title: "Liquidated damages for service levels", risk: "No issue found", tone: "verified", page: "Page 22, para 4", quote: "…service credits of 0.5% of the monthly fee per week of shortfall, capped at 5%…", note: "Pre-estimate with a cap. Draft signal only; a lawyer must confirm." },
];

export function ContractsPreview() {
  return <>
    <div className="pv-kpis">
      <Kpi label="Active drafts" value="18" hint="In negotiation (synthetic)" />
      <Kpi label="Clauses flagged" value="3" hint="1 high, 2 for review" tone="conflict" />
      <Kpi label="Stamp duty rule packs" value="0 validated" hint="Every estimate needs manual confirmation" tone="stale" />
      <Kpi label="Templates" value="3" hint="Synthetic, not yet legally reviewed" />
    </div>
    <div className="pv-layout">
      <div className="pv-column">
        <section className="card pv-panel">
          <div className="actions"><Chip>Draft v3.4 (redlined)</Chip><Chip tone="stale">Under partner review</Chip><Chip tone="manual">Arbitration clause</Chip></div>
          <h2 className="legal-title" style={{ fontSize: 24, marginTop: 10 }}>Master Services Agreement — warehousing and cloud logistics</h2>
          <p className="lede">Northwind Logistics Pvt. Ltd. and Vistara Cloud Systems Pvt. Ltd. (fictional parties)</p>
          <div className="pv-facts">
            <Fact label="Consideration" value={inr(42000000)} sub="GST exclusive" />
            <Fact label="Governing law" value="Laws of India" />
            <Fact label="Seat" value="New Delhi" />
            <Fact label="Confidentiality" value="5 years post-expiry" />
          </div>
          <div className="actions" style={{ marginTop: 12 }}><DisabledAction icon={Upload}>Import third-party contract</DisabledAction><DisabledAction icon={FilePlus2} variant="primary">New from template</DisabledAction></div>
        </section>
        <Panel eyebrow="Clause review · draft signals" icon={FileSearch} title="Clause-by-clause review" aside={<DisabledAction>Re-scan</DisabledAction>}>
          {CLAUSES.map((clause) => (
            <article className="pv-card-defect" key={clause.number}>
              <header><h3>Clause {clause.number}: {clause.title}</h3><Chip tone={clause.tone}>{clause.risk}</Chip></header>
              <p className="pv-mono">{clause.page} · confidence: medium (synthetic)</p>
              <blockquote className="pv-quote" style={{ fontSize: 12 }}>{clause.quote}</blockquote>
              <p>{clause.note}</p>
              {clause.fix ? <div className="pv-fix"><span>Reviewer comments and score edits are audited.</span><DisabledAction>{clause.fix}</DisabledAction></div> : null}
            </article>
          ))}
        </Panel>
      </div>
      <div className="pv-column">
        <Panel eyebrow="Stamp duty" icon={Calculator} title="Estimator" aside={<Chip tone="stale">Unvalidated</Chip>}>
          <StaticField label="State / schedule" value="National Capital Territory of Delhi" />
          <StaticField label="Instrument" value="Agreement or memorandum of agreement" />
          <StaticField label="Declared value (INR)" value="4,20,00,000" />
          <div className="pv-note pv-note-stale"><strong>Manual confirmation required.</strong><p style={{ margin: "4px 0 0" }}>This state and instrument combination is not in a validated rule pack, so no duty figure is shown. Estimates appear only with their state, instrument, inputs, rule version, source, and assumptions.</p></div>
          <div className="actions" style={{ marginTop: 10 }}><DisabledAction icon={Landmark} variant="teal">Procure e-stamp</DisabledAction></div>
          <p className="form-help">E-stamp procurement appears only for a contracted provider, and its status follows the provider&apos;s acknowledgment.</p>
        </Panel>
        <Panel eyebrow="Execution" icon={FileSignature} title="Signing pipeline">
          <div className="pv-list">
            <div className="pv-row"><div><strong>Authorised signatory, Northwind</strong><p>DSC via partner bridge</p></div><Chip tone="stale">no partner</Chip></div>
            <div className="pv-row"><div><strong>Authorised signatory, Vistara</strong><p>Aadhaar eSign via licensed provider</p></div><Chip tone="stale">no partner</Chip></div>
          </div>
          <Note tone="manual">Signing uses the exact document hash; any change after signing restarts the process.</Note>
          <div className="actions" style={{ marginTop: 10 }}><DisabledAction variant="primary">Send for signature</DisabledAction></div>
        </Panel>
        <Panel eyebrow="Templates" icon={Library} title="Template library">
          <div className="pv-list">
            {[["NDA", "v5.0"], ["Commercial lease", "v3.1"], ["Shareholders' agreement", "v4.2"]].map(([name, version]) => <div className="pv-row" key={name}><div><strong>{name}</strong><p>{version} · snapshot on use · awaiting legal approval</p></div><Chip>synthetic</Chip></div>)}
          </div>
        </Panel>
      </div>
    </div>
  </>;
}
