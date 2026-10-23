import { AlertTriangle, ArrowRight, BookOpen, FileCheck2, Files, Landmark } from "lucide-react";
import { notFound } from "next/navigation";
import type { ComponentType } from "react";
import { BnsPreview } from "@/components/previews/bns";
import { ContractsPreview } from "@/components/previews/contracts";
import { FilingPreview } from "@/components/previews/filing";
import { ResearchPreview } from "@/components/previews/research";

type Search = { view?: string; code?: string };
const modules: Record<string, { title: string; icon: ComponentType<{ size?: number }>; description: string; phase: string; render: (search: Search) => React.ReactNode }> = {
  research: { title: "Precedent Research & Judicial Citator", icon: BookOpen, phase: "Research beta", description: "Passage-linked research, transparent abstention, source provenance, and reviewed citation treatment.", render: (search) => <ResearchPreview view={search.view} /> },
  bns: { title: "BNS / BNSS Transition Matrix", icon: Landmark, phase: "Advanced", description: "Versioned old/new provision mapping, an applicability worksheet, and draft updates that need lawyer approval.", render: (search) => <BnsPreview code={search.code} /> },
  filing: { title: "E-Filing & Docket Assembly", icon: FileCheck2, phase: "Advanced", description: "Forum rule packs, defect checks with sources, annexure indexing, and a controlled export.", render: (search) => <FilingPreview view={search.view} /> },
  contracts: { title: "Contracts & Stamp Duty", icon: Files, phase: "Advanced", description: "Versioned templates, clause review signals, supported stamp-duty estimates, and digital signing.", render: () => <ContractsPreview /> },
};

export function generateStaticParams() { return Object.keys(modules).map((module) => ({ module })); }

export async function generateMetadata({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  return { title: modules[module] ? `${modules[module].title} (preview)` : "Preview" };
}

export default async function PreviewPage({ params, searchParams }: { params: Promise<{ module: string }>; searchParams: Promise<Search> }) {
  const { module } = await params;
  const item = modules[module];
  if (!item) notFound();
  return <div className="page">
    <header className="page-heading">
      <div><p className="eyebrow"><item.icon size={13} /> Roadmap preview · {item.phase}</p><h1>{item.title}</h1><p className="lede">{item.description}</p></div>
      <button className="button" disabled type="button">Production action unavailable <ArrowRight size={14} /></button>
    </header>
    <div className="preview-banner" role="note"><AlertTriangle size={18} /><span><strong>Synthetic preview—no live integration.</strong> Data on this page is fictional. Controls do not send, file, bill, message, or provide legal conclusions. Release requires legal, rights, and provider review.</span></div>
    <div data-preview-body="">{item.render(await searchParams)}</div>
  </div>;
}
