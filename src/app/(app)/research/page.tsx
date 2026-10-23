import { AlertTriangle, BookOpen, Database, ExternalLink, GitBranch, Search, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { ResearchCitationGraph } from "@/components/research-citation-graph";
import { ResearchNoteComposer } from "@/components/research-note-composer";
import { StatusBadge } from "@/components/status-badge";
import { isNeo4jConfigured } from "@/lib/neo4j";
import { getResearchCitator, getResearchDocument, isResearchEnabled, searchResearch } from "@/lib/research";
import { isDemoMode } from "@/lib/runtime";
import { requireWorkspace } from "@/lib/workspace";

export const metadata = { title: "Precedent Research" };

type SearchParams = { q?: string; doc?: string; jurisdiction?: string; court?: string; documentType?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function queryLink(input: SearchParams) {
  const params = new URLSearchParams();
  for (const key of ["q", "doc", "jurisdiction", "court", "documentType"] as const) if (input[key]) params.set(key, input[key]!);
  return `/research${params.size ? `?${params}` : ""}`;
}

export default async function ResearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const workspace = await requireWorkspace();
  const params = await searchParams;
  const q = params.q?.trim().slice(0, 500) ?? "";
  const fixturesEnabled = process.env.RESEARCH_FIXTURES_ENABLED === "true";
  const enabled = isResearchEnabled() && !isDemoMode();
  // The local fixture corpus is intentionally discoverable without forcing a user to guess a query.
  const searchQuery = q || (fixturesEnabled ? "fixture" : "");
  const validQuery = searchQuery.length >= 2;
  const filters = { jurisdiction: params.jurisdiction?.trim().slice(0, 160) || undefined, court: params.court?.trim().slice(0, 200) || undefined, documentType: params.documentType?.trim().slice(0, 24) || undefined };
  const results = enabled && validQuery ? await searchResearch(workspace, searchQuery, filters) : [];
  const selectedId = params.doc && UUID.test(params.doc) ? params.doc : results[0]?.documentId;
  const selected = enabled && selectedId ? await getResearchDocument(workspace, selectedId) : null;
  const citator = selected ? await getResearchCitator(workspace, selected.id) : [];
  const graphProvider = citator[0]?.via ?? (isNeo4jConfigured() ? "syncing" : "postgres");

  return <div className="page">
    <header className="page-heading research-hero">
      <div>
        <p className="eyebrow"><BookOpen size={13} /> Research Beta · rights-gated authority corpus</p>
        <h1>Precedent Research & Judicial Citator</h1>
        <p className="lede">Search only enabled sources with recorded rights and provenance. Search results are research aids, not legal advice or a substitute for source review.</p>
      </div>
      <div className="actions"><span className={`policy-state ${enabled ? "" : "warning"}`}>{enabled ? "Research beta enabled" : "Research beta disabled"}</span></div>
    </header>

    {!enabled ? <section className="card empty-state"><Database size={24} /><strong>Research Beta is not enabled for this deployment.</strong><p>Set <code>RESEARCH_ENABLED=true</code> only after a source administrator has loaded rights-cleared authorities. The existing <Link href="/preview/research">synthetic preview</Link> remains available for product evaluation.</p></section> : <>
      {fixturesEnabled ? <div className="preview-banner" role="note"><AlertTriangle size={18} /><span><strong>Fictional development corpus.</strong> Every listed authority is a NyayaFlow fixture, not a real judgment or statute. Do not use it for legal work.</span></div> : null}
      <form action="/research" className="card research-command" method="get">
        <div className="research-query"><Search size={20} /><div><span>Search the enabled corpus</span><input aria-label="Research query" defaultValue={q} maxLength={500} minLength={2} name="q" placeholder="Search authority passages…" required /></div><button className="button primary" type="submit">Search</button></div>
        <div className="research-filters">
          <label className="field"><span>Jurisdiction</span><input defaultValue={filters.jurisdiction} maxLength={160} name="jurisdiction" placeholder="e.g. India" /></label>
          <label className="field"><span>Court</span><input defaultValue={filters.court} maxLength={200} name="court" placeholder="All courts" /></label>
          <label className="field"><span>Document type</span><select defaultValue={filters.documentType ?? ""} name="documentType"><option value="">All types</option><option value="judgment">Judgment</option><option value="statute">Statute</option><option value="rule">Rule</option><option value="order">Order</option><option value="commentary">Commentary</option></select></label>
          <div className="field"><span>Graph service</span><strong className="research-service-state"><GitBranch size={13} /> {isNeo4jConfigured() ? "Neo4j available" : "PostgreSQL fallback"}</strong></div>
        </div>
      </form>
      <p className="research-scope-line"><span><ShieldCheck size={13} /> Source rights and freshness are shown per record.</span><span>Firm notes and queries stay in PostgreSQL and are never projected to Neo4j.</span></p>

      {!validQuery ? <section className="card empty-state"><Search size={24} /><strong>Start with a passage or citation query.</strong><p>Use at least two characters. Results are limited to enabled sources, and every use still requires independent lawyer review.</p></section> : <div className="research-answer-layout">
        <aside className="card research-results"><div className="section-heading"><div><h2>Results</h2><p>{results.length} passage{results.length === 1 ? "" : "s"} returned</p></div></div><div className="research-result-list">
          {results.map((result, index) => <Link className={`research-result ${selected?.id === result.documentId ? "active" : ""}`} href={queryLink({ ...params, doc: result.documentId })} key={result.passageId}>
            <span className="research-result-rank">{index + 1}</span><span><h3>{result.title}</h3><p>{result.citation} · {result.court}</p><p>{result.snippet}</p><span className="research-meta">{result.locator} · {result.sourceName} · {result.rightsBasis}</span></span>
          </Link>)}
          {!results.length ? <div className="empty-state"><strong>No enabled passages matched.</strong><p>Broaden the words or check the selected source filters.</p></div> : null}
        </div></aside>
        <section>
          {selected ? <>
            <article className="card research-source-card"><div className="section-heading"><div><p className="eyebrow"><Database size={12} /> {selected.sourceName} · {selected.rightsBasis}</p><h2>{selected.title}</h2><p>{selected.citation} · {selected.court} · {selected.decisionDate ?? "date not recorded"}</p></div><StatusBadge value={selected.sourceState} /></div>
              <div className="research-answer-warning"><AlertTriangle size={15} /><span><strong>Verification boundary.</strong> {selected.isFixture ? "This is a fictional fixture and cannot support legal work." : "Review the original authoritative source, its version, and the treatment evidence before relying on this record."}</span></div>
              {selected.passages.map((passage) => <section className="research-claim" id={passage.id} key={passage.id}><span className="research-claim-number">{passage.ordinal}</span><div><strong>{passage.locator}{passage.heading ? ` · ${passage.heading}` : ""}</strong><p>{passage.body}</p></div></section>)}
              <p className="research-source-foot">Rights record: {selected.rightsReference}. Edition: {selected.sourceEdition}.{selected.sourceUrl ? <> <a href={selected.sourceUrl} rel="noreferrer" target="_blank">Open source record <ExternalLink size={11} /></a></> : null}</p>
            </article>
            <ResearchNoteComposer passages={selected.passages} />
            <ResearchCitationGraph anchor={{ id: selected.id, title: selected.title, citation: selected.citation }} baseQuery={q || undefined} edges={citator} provider={graphProvider} />
            <article className="card research-source-card"><div className="section-heading"><div><h2>Citation treatment</h2><p>{citator.length ? `Read from ${citator[0].via === "neo4j" ? "Neo4j graph projection" : "canonical PostgreSQL fallback"}.` : "No reviewed edges in the enabled corpus."}</p></div><GitBranch size={18} /></div>
              <div className="research-result-list">{citator.map((edge) => <div className="research-result" key={edge.id}><span className="research-result-rank">{edge.direction === "citing" ? "←" : "→"}</span><span><h3>{edge.title}</h3><p>{edge.citation} · {edge.court}</p><p><strong>{edge.treatment}</strong> at {edge.evidenceLocator} · <StatusBadge value={edge.sourceState} /></p><p>{edge.evidenceText}</p></span></div>)}{!citator.length ? <div className="empty-state"><strong>No citation edges yet.</strong><p>Absence of an edge is not evidence of no treatment.</p></div> : null}</div>
            </article>
          </> : <article className="card empty-state"><BookOpen size={24} /><strong>Select a result to inspect the source and citation treatment.</strong><p>Source provenance and review state appear before any research note can cite a passage.</p></article>}
        </section>
      </div>}
    </>}
  </div>;
}
