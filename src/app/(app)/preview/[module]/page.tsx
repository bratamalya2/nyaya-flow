import { AlertTriangle, ArrowRight, Beaker, BookOpen, ChartNoAxesCombined, FileCheck2, Files, Landmark, ReceiptIndianRupee, Users } from "lucide-react";
import { notFound } from "next/navigation";

const modules = {
  research: { title: "Precedent Knowledge Graph", icon: BookOpen, description: "Evidence-linked citator relationships, reviewed treatment, and paragraph-level authority." },
  bns: { title: "BNS / BNSS Transition Matrix", icon: Landmark, description: "Versioned old/new provision mapping with applicability worksheets and lawyer review." },
  filing: { title: "E-Filing & Docket Assembly", icon: FileCheck2, description: "Forum-specific rule packs, annexure indexing, defect checks, and controlled export." },
  client: { title: "Controlled Client Portal", icon: Users, description: "Approved milestones, selected documents, evidence intake, and revocable access." },
  billing: { title: "Financials & BCI Billing", icon: ReceiptIndianRupee, description: "Approved charges, invoices, retainers, allocations, and reconciliation history." },
  contracts: { title: "Contracts & CLM", icon: Files, description: "Versioned templates, clause review, digital signing, and supported stamp-duty workflows." },
  analytics: { title: "Litigation Portfolio Analytics", icon: ChartNoAxesCombined, description: "Permission-safe workload, forum, risk, and firm performance summaries." },
} as const;

export function generateStaticParams() { return Object.keys(modules).map((module) => ({ module })); }

export default async function PreviewPage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  if (!(module in modules)) notFound();
  const item = modules[module as keyof typeof modules];
  const Icon = item.icon;
  return <div className="page">
    <header className="page-heading"><div><p className="eyebrow"><Beaker size={13} /> Roadmap preview</p><h1>{item.title}</h1><p className="lede">{item.description}</p></div><button className="button" disabled type="button">Production action unavailable <ArrowRight size={14} /></button></header>
    <div className="preview-banner"><AlertTriangle size={18} /><span><strong>Synthetic preview—no live integration.</strong> Data on this page is fictional. Controls do not send, file, bill, message, or provide legal conclusions.</span></div>
    <div className="preview-grid">
      <section className="card preview-canvas"><div><div className="preview-node"><Icon size={31} /><span>{module.toUpperCase()}</span></div><h2 style={{ marginTop: 20 }}>Capability preview</h2><p className="lede" style={{ marginInline: "auto" }}>This composition preserves the supplied Stitch visual direction while keeping the unreleased workflow isolated from production matter data.</p></div></section>
      <aside className="card"><div className="preview-stat"><span>Release phase</span><strong>{module === "research" ? "Research beta" : "Expansion / advanced"}</strong></div><div className="preview-stat"><span>Data source</span><strong>Synthetic fixtures</strong></div><div className="preview-stat"><span>External actions</span><strong className="danger">Disabled</strong></div><div className="preview-stat"><span>Required gate</span><strong>Legal, rights & provider review</strong></div></aside>
    </div>
  </div>;
}
