import { AlertTriangle, ArrowLeftRight, Landmark, Scale } from "lucide-react";
import Link from "next/link";
import { TransitionWorkspace } from "@/components/transition-workspace";
import { StatusBadge } from "@/components/status-badge";
import { isDemoMode } from "@/lib/runtime";
import { isTransitionEnabled, listTransitionMappings } from "@/lib/transitions";
import { requireWorkspace } from "@/lib/workspace";

export const metadata = { title: "BNS / BNSS Transition Matrix" };

export default async function BnsPage() {
  const workspace = await requireWorkspace();
  const enabled = isTransitionEnabled() && !isDemoMode();
  const mappings = enabled ? await listTransitionMappings(workspace) : [];
  const fixtures = mappings.some((mapping) => mapping.source.isFixture);
  return <div className="page">
    <header className="page-heading"><div><p className="eyebrow"><Landmark size={13} /> Criminal-code transition workspace</p><h1>BNS / BNSS / BSA Matrix</h1><p className="lede">Versioned provision comparisons, review worksheets, and local citation flags. Every transition needs primary-source and lawyer verification.</p></div><span className={`policy-state ${enabled ? "" : "warning"}`}>{enabled ? "Transition beta enabled" : "Transition beta disabled"}</span></header>
    {!enabled ? <section className="card empty-state"><Landmark size={24} /><strong>The transition workspace is disabled.</strong><p>Set <code>BNS_TRANSITION_ENABLED=true</code> after loading reviewed source material. The <Link href="/preview/bns">synthetic preview</Link> remains available for evaluation.</p></section> : <>
      {fixtures ? <div className="preview-banner" role="note"><AlertTriangle size={18} /><span><strong>Fictional development mappings.</strong> These records are fixtures, not statutory text or legal advice. They cannot be used in court work.</span></div> : null}
      <div className="transition-matrix" aria-label="Provision mapping matrix">
        {mappings.map((mapping) => <article className="card transition-map" key={mapping.id}>
          <div className="section-heading"><div><p className="eyebrow">{mapping.relation.replaceAll("_", " ")} · {mapping.source.name}</p><h2>{mapping.legacy.code} {mapping.legacy.section} <ArrowLeftRight size={15} /> {mapping.current ? `${mapping.current.code} ${mapping.current.section}` : "No mapped provision"}</h2></div><StatusBadge value={mapping.sourceState} /></div>
          <div className="transition-provisions"><section><span>Legacy</span><strong>{mapping.legacy.heading}</strong><p>{mapping.legacy.text ?? "No provision text loaded."}</p><small>Edition {mapping.legacy.sourceEdition} · {mapping.legacy.effectiveUntil ? `through ${mapping.legacy.effectiveUntil}` : "date not recorded"}</small></section><section><span>Current</span>{mapping.current ? <><strong>{mapping.current.heading}</strong><p>{mapping.current.text ?? "No provision text loaded."}</p><small>Edition {mapping.current.sourceEdition} · {mapping.current.effectiveFrom ? `from ${mapping.current.effectiveFrom}` : "date not recorded"}</small></> : <p>No current mapping recorded.</p>}</section></div>
          <div className="research-answer-warning"><AlertTriangle size={14} /><span>{mapping.mappingNote} Rights record: {mapping.source.rightsReference}</span></div>
        </article>)}
      </div>
      {!mappings.length ? <section className="card empty-state"><Scale size={24} /><strong>No enabled mappings are available.</strong><p>Load only versioned statutory material with documented source rights and a reviewed mapping note.</p></section> : <TransitionWorkspace mappings={mappings.map((mapping) => ({ id: mapping.id, legacy: { code: mapping.legacy.code, section: mapping.legacy.section }, current: mapping.current ? { code: mapping.current.code, section: mapping.current.section } : null }))} />}
    </>}
  </div>;
}
