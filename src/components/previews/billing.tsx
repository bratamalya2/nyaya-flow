import { Banknote, FileText, HandCoins, QrCode, ReceiptIndianRupee, Scale, Wallet } from "lucide-react";
import { Chip, DataTable, DisabledAction, Kpi, Note, Panel, StaticField } from "@/components/previews/primitives";
import { inr, previewMatter } from "@/lib/preview-data";

const INVOICES = [
  { number: "INV-2026-031", date: "24 Sep 2026", client: "Asha Textiles Pvt. Ltd.", matter: previewMatter.reference, type: "Appearance fee", amount: 250000, sac: "9982", status: ["Allocated from advance", "manual"] },
  { number: "INV-2026-032", date: "23 Sep 2026", client: "Meridian Credit Ltd.", matter: "CP(IB)/58/2026", type: "Stage fee · admission", amount: 175000, sac: "9982", status: ["Unpaid", "stale"] },
  { number: "INV-2026-033", date: "21 Sep 2026", client: "Kabir Malhotra", matter: "SLP(Crl.) 5120/2026", type: "Compendium & registry", amount: 85000, sac: "9982", status: ["Paid · reconciled", "verified"] },
  { number: "INV-2026-034", date: "20 Sep 2026", client: "Northwind Logistics", matter: "CS(COMM) 301/2025", type: "Out-of-pocket expenses", amount: 42500, sac: "Reimbursement", status: ["Credit note issued", "conflict"] },
] as const;

// Deterministic placeholder pattern with corner markers: deliberately not a scannable payment code.
const corner = (x: number, y: number) => [[0, 0], [8, 0], [0, 8]].some(([cx, cy]) => x >= cx && x < cx + 3 && y >= cy && y < cy + 3);
const QR_CELLS = Array.from({ length: 121 }, (_, index) => corner(index % 11, Math.floor(index / 11)) || ((index * 2654435761) >>> 0) % 7 < 3);

export function BillingPreview() {
  return <>
    <div className="pv-kpis">
      <Kpi label="Billed · FY 2026–27" value={inr(1840000)} hint="Synthetic figure" />
      <Kpi label="Client advances held" value={inr(625000)} hint="Tracked separately from firm income" tone="verified" />
      <Kpi label="Outstanding invoices" value={inr(280000)} hint="3 invoices" tone="stale" />
      <Kpi label="Out-of-pocket expenses" value={inr(42300)} hint="Court fees, stamps, process" />
    </div>
    <section className="card pv-panel" style={{ marginBottom: 14 }}>
      <div className="section-heading"><div><p className="eyebrow"><Scale size={13} /> Fee model</p><h2>Flat subscription; no share of legal fees</h2></div><Chip tone="manual">Needs accountant & counsel review</Chip></div>
      <p className="lede" style={{ marginTop: 0 }}>Engagements record fixed, hearing, hourly, or expense-based fees. The platform takes no commission, referral fee, or success percentage. Issued invoices are never edited; corrections use credit notes.</p>
    </section>
    <div className="pv-layout">
      <div className="pv-column">
        <Panel eyebrow="Ledger" icon={ReceiptIndianRupee} title="Invoices" aside={<span className="actions"><Chip tone="manual">Invoices</Chip><Chip>Advances</Chip><Chip>Hearing fees</Chip><Chip>Disbursements</Chip></span>}>
          <DataTable
            align={["left", "left", "left", "right", "left", "left"]}
            columns={["Invoice", "Client & matter", "Fee type", "Taxable (INR)", "SAC", "Status"]}
            rows={INVOICES.map((invoice) => [
              <span key="n"><strong className="tabular">{invoice.number}</strong><div className="muted">{invoice.date}</div></span>,
              <span key="c"><strong>{invoice.client}</strong><div className="muted">{invoice.matter}</div></span>,
              invoice.type,
              inr(invoice.amount),
              invoice.sac,
              <Chip key="s" tone={invoice.status[1]}>{invoice.status[0]}</Chip>,
            ])}
          />
          <div className="actions" style={{ marginTop: 12 }}><DisabledAction icon={FileText} variant="primary">Issue invoice from approved charges</DisabledAction><DisabledAction>Record credit note</DisabledAction></div>
        </Panel>
        <Panel eyebrow="Client advances" icon={Wallet} title="Retainer ledger">
          <p className="lede" style={{ marginTop: 0 }}>Advances are liabilities until applied. Each allocation to an earned fee is an explicit, audited entry and can never exceed the available balance.</p>
          <DataTable align={["left", "left", "right", "right"]} columns={["Client", "Last movement", "Received", "Available"]} rows={[
            ["Asha Textiles Pvt. Ltd.", "Allocated to INV-2026-031", inr(500000), inr(250000)],
            ["Meridian Credit Ltd.", "Advance received 02 Sep", inr(375000), inr(375000)],
          ]} />
        </Panel>
      </div>
      <div className="pv-column">
        <Panel eyebrow="Collection" icon={QrCode} title="Payment request" aside={<Chip tone="stale">No gateway</Chip>}>
          <svg className="pv-qr" viewBox="0 0 11 11" role="img" aria-label="Placeholder pattern, not a payment code">
            <rect width="11" height="11" fill="#fff" />
            {QR_CELLS.map((filled, index) => filled ? <rect fill="#0b2240" height="1" key={index} width="1" x={index % 11} y={Math.floor(index / 11)} /> : null)}
          </svg>
          <Note tone="manual">Placeholder pattern, not a payable code. UPI and bank collection arrive only through a contracted payment partner, with reconciliation from verified webhooks.</Note>
          <div className="actions" style={{ marginTop: 10 }}><DisabledAction icon={Banknote} variant="teal">Send payment link</DisabledAction></div>
        </Panel>
        <Panel eyebrow="Quick log" icon={HandCoins} title="Today's appearance">
          <StaticField label="Matter" value={`${previewMatter.reference} — ${previewMatter.shortTitle}`} />
          <StaticField label="Court / item" value={`${previewMatter.court}, item ${previewMatter.item}`} />
          <StaticField label="Fee amount (INR)" value="1,50,000" />
          <DisabledAction variant="primary">Submit for approval</DisabledAction>
        </Panel>
        <Panel eyebrow="Vouchers" icon={Banknote} title="Recent disbursements">
          <div className="pv-list">
            <div className="pv-row"><div><strong>Advocate welfare stamp</strong><p>{previewMatter.reference}</p></div><span className="tabular">{inr(500)}</span></div>
            <div className="pv-row"><div><strong>E-filing court fee</strong><p>CP(IB)/58/2026</p></div><span className="tabular">{inr(38000)}</span></div>
            <div className="pv-row"><div><strong>Process service</strong><p>4 respondents</p></div><span className="tabular">{inr(4000)}</span></div>
          </div>
        </Panel>
      </div>
    </div>
  </>;
}
