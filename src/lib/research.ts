import type { PoolClient } from "pg";
import { withActor } from "@/lib/db";
import { isNeo4jConfigured, Neo4jUnavailableError, withNeo4jSession } from "@/lib/neo4j";
import type { Workspace } from "@/lib/workspace";

export const researchRightsBases = ["licensed", "permission", "public_domain", "fixture"] as const;
export type ResearchRightsBasis = (typeof researchRightsBases)[number];

export function sourceMayBeEnabled(source: { rightsBasis: ResearchRightsBasis; isFixture: boolean; rightsVerifiedAt?: string | null }) {
  return (source.isFixture && source.rightsBasis === "fixture") || (!source.isFixture && source.rightsBasis !== "fixture" && Boolean(source.rightsVerifiedAt));
}

export function isResearchEnabled() {
  return process.env.RESEARCH_ENABLED === "true";
}

/** pg returns SQL `date` values as JavaScript Date objects; React/API callers only receive ISO dates. */
function isoDate(value: string | Date | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

export interface ResearchSearchResult {
  documentId: string;
  passageId: string;
  title: string;
  citation: string;
  jurisdiction: string;
  court: string;
  documentType: string;
  decisionDate: string | null;
  benchStrength: number | null;
  benchMetadataState: string;
  locator: string;
  snippet: string;
  sourceName: string;
  rightsBasis: ResearchRightsBasis;
  sourceState: string;
  isFixture: boolean;
  rank: number;
}

type SearchRow = {
  document_id: string; passage_id: string; title: string; citation: string; jurisdiction: string; court: string; document_type: string;
  decision_date: string | Date | null; bench_strength: number | null; bench_metadata_state: string; locator: string; snippet: string;
  source_name: string; rights_basis: ResearchRightsBasis; source_state: string; is_fixture: boolean; rank: number | string;
};

export async function searchResearch(workspace: Workspace, query: string, filters: { jurisdiction?: string; court?: string; documentType?: string; limit?: number } = {}) {
  const result = await withActor(workspace.userId, (client) => client.query<SearchRow>(
    "select * from research_search($1,$2,$3,$4,$5)",
    [query, filters.jurisdiction ?? null, filters.court ?? null, filters.documentType ?? null, Math.min(filters.limit ?? 20, 50)],
  ));
  return result.rows.map((row): ResearchSearchResult => ({
    documentId: row.document_id, passageId: row.passage_id, title: row.title, citation: row.citation, jurisdiction: row.jurisdiction, court: row.court,
    documentType: row.document_type, decisionDate: isoDate(row.decision_date), benchStrength: row.bench_strength, benchMetadataState: row.bench_metadata_state,
    locator: row.locator, snippet: row.snippet, sourceName: row.source_name, rightsBasis: row.rights_basis, sourceState: row.source_state,
    isFixture: row.is_fixture, rank: Number(row.rank),
  }));
}

export interface ResearchDocument {
  id: string; title: string; citation: string; jurisdiction: string; court: string; documentType: string; decisionDate: string | null;
  benchStrength: number | null; benchMetadataState: string; sourceUrl: string | null; sourceEdition: string; sourceState: string;
  sourceName: string; rightsBasis: ResearchRightsBasis; rightsReference: string; attribution: string | null; isFixture: boolean;
  passages: { id: string; ordinal: number; locator: string; heading: string | null; body: string }[];
}

type DocumentRow = Omit<ResearchDocument, "passages" | "decisionDate"> & { decisionDate: string | Date | null };
type PassageRow = { id: string; ordinal: number; locator: string; heading: string | null; body: string };

export async function getResearchDocument(workspace: Workspace, documentId: string): Promise<ResearchDocument | null> {
  return withActor(workspace.userId, async (client) => {
    const document = await client.query<DocumentRow>(
      `select d.id,d.title,d.citation,d.jurisdiction,d.court,d.document_type as "documentType",d.decision_date as "decisionDate",
        d.bench_strength as "benchStrength",d.bench_metadata_state as "benchMetadataState",d.source_url as "sourceUrl",d.source_edition as "sourceEdition",d.source_state as "sourceState",
        s.name as "sourceName",s.rights_basis as "rightsBasis",s.rights_reference as "rightsReference",s.attribution,s.is_fixture as "isFixture"
       from research_documents d join research_sources s on s.id=d.source_id where d.id=$1 and s.enabled and d.source_state in ('verified','stale','manual')`, [documentId],
    );
    if (!document.rows[0]) return null;
    const passages = await client.query<PassageRow>("select id,ordinal,locator,heading,body from research_passages where document_id=$1 order by ordinal", [documentId]);
    return { ...document.rows[0], decisionDate: isoDate(document.rows[0].decisionDate), passages: passages.rows };
  });
}

export interface CitatorEdge {
  id: string; direction: "citing" | "cited"; documentId: string; title: string; citation: string; court: string; decisionDate: string | null;
  treatment: string; evidenceLocator: string; evidenceText: string; sourceState: string; reviewedAt: string | null; via: "postgres" | "neo4j";
}

type CitatorRow = Omit<CitatorEdge, "direction" | "via" | "decisionDate"> & { direction: "citing" | "cited"; decisionDate: string | Date | null };

async function postgresCitator(client: PoolClient, documentId: string) {
  const result = await client.query<CitatorRow>(
    `select e.id,case when e.citing_document_id=$1 then 'citing' else 'cited' end as direction,
       other.id as "documentId",other.title,other.citation,other.court,other.decision_date as "decisionDate",
       e.treatment as treatment,e.evidence_locator as "evidenceLocator",e.evidence_text as "evidenceText",e.source_state as "sourceState",e.reviewed_at as "reviewedAt"
     from research_citation_edges e
     join research_documents other on other.id=case when e.citing_document_id=$1 then e.cited_document_id else e.citing_document_id end
     join research_sources s on s.id=other.source_id
     where $1 in (e.citing_document_id,e.cited_document_id) and s.enabled and other.source_state in ('verified','stale','manual')
     order by other.decision_date desc nulls last, other.title`, [documentId],
  );
  return result.rows.map((row) => ({ ...row, decisionDate: isoDate(row.decisionDate), via: "postgres" as const }));
}

/** Prefer Neo4j for graph traversal, but always retain PostgreSQL's canonical, reviewed edge data as a safe fallback. */
export async function getResearchCitator(workspace: Workspace, documentId: string): Promise<CitatorEdge[]> {
  const fallback = await withActor(workspace.userId, (client) => postgresCitator(client, documentId));
  if (!isNeo4jConfigured()) return fallback;
  try {
    const records = await withNeo4jSession("READ", (session) => session.executeRead((tx) => tx.run(
      `match (anchor:Authority {id:$id})
       optional match (other:Authority)-[edge:CITES]->(anchor)
       return 'citing' as direction, other, edge
       union
       match (anchor:Authority {id:$id})-[edge:CITES]->(other:Authority)
       return 'cited' as direction, other, edge`, { id: documentId },
    )));
    if (!records.records.length) return fallback;
    return records.records.map((record) => {
      const other = record.get("other").properties as Record<string, unknown>;
      const edge = record.get("edge").properties as Record<string, unknown>;
      return {
        id: String(edge.id), direction: record.get("direction") as "citing" | "cited", documentId: String(other.id), title: String(other.title), citation: String(other.citation),
        court: String(other.court), decisionDate: other.decisionDate ? String(other.decisionDate) : null, treatment: String(edge.treatment),
        evidenceLocator: String(edge.evidenceLocator), evidenceText: String(edge.evidenceText), sourceState: String(edge.sourceState),
        reviewedAt: edge.reviewedAt ? String(edge.reviewedAt) : null, via: "neo4j" as const,
      };
    });
  } catch (error) {
    if (error instanceof Neo4jUnavailableError) return fallback;
    console.error("Research graph read failed; using canonical PostgreSQL citator.", error);
    return fallback;
  }
}

export async function recordResearchQuery(client: PoolClient, workspace: Workspace, input: { query: string; filters: Record<string, string>; resultCount: number }) {
  const result = await client.query<{ id: string }>(
    `insert into research_queries(organization_id,created_by,query_text,filters,result_count,corpus_snapshot)
     values($1,$2,$3,$4::jsonb,$5,jsonb_build_object('at',now(),'fixturesEnabled',$6::boolean)) returning id`,
    [workspace.organizationId, workspace.userId, input.query, JSON.stringify(input.filters), input.resultCount, process.env.RESEARCH_FIXTURES_ENABLED === "true"],
  );
  return result.rows[0].id;
}
