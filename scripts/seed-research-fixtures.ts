import { createHash } from "node:crypto";
import { Client } from "pg";
import { loadLocalEnv } from "./load-env";

type FixtureDocument = {
  externalId: string; title: string; citation: string; court: string; decisionDate: string; passages: { locator: string; heading: string; body: string }[];
};

const documents: FixtureDocument[] = [
  {
    externalId: "SYN-SC-2026-001", title: "Meridian Registry v. Aruna Systems (fictional fixture)", citation: "[SYN] SC 2026 001", court: "Synthetic Supreme Court", decisionDate: "2026-01-15",
    passages: [
      { locator: "¶ 12", heading: "Question presented", body: "Fixture only. The fictional court frames whether a public register may change a procedural field without a notice mechanism." },
      { locator: "¶ 18", heading: "Reasoning", body: "Fixture only. The fictional court says a review record should identify the source, version, and reviewer before operational use." },
    ],
  },
  {
    externalId: "SYN-DHC-2025-014", title: "Kiteworks Cooperative v. Registry Officer (fictional fixture)", citation: "[SYN] DHC 2025 014", court: "Synthetic Delhi High Court", decisionDate: "2025-11-03",
    passages: [
      { locator: "¶ 7", heading: "Record provenance", body: "Fixture only. The fictional court distinguishes an unverified index entry from a reviewed source record." },
      { locator: "¶ 21", heading: "Disposition", body: "Fixture only. The fictional court remits the matter for a documented review; it is not a statement of real law." },
    ],
  },
  {
    externalId: "SYN-SC-2024-008", title: "People of Suryanagar v. Devika Rao (fictional fixture)", citation: "[SYN] SC 2024 008", court: "Synthetic Supreme Court", decisionDate: "2024-08-22",
    passages: [
      { locator: "¶ 9", heading: "Scope", body: "Fixture only. The fictional authority uses a narrow procedural holding and cautions against inferring facts outside the record." },
      { locator: "¶ 26", heading: "Citation treatment", body: "Fixture only. A later authority may be described only with its evidence locator and review state." },
    ],
  },
];

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

async function main() {
  loadLocalEnv();
  if (process.env.NODE_ENV === "production") throw new Error("Fixture corpus seeding is disabled in production.");
  if (process.env.RESEARCH_FIXTURES_ENABLED !== "true") throw new Error("Set RESEARCH_FIXTURES_ENABLED=true explicitly before loading fictional fixture authorities.");
  const connectionString = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_ADMIN_URL or DATABASE_URL is required.");
  const client = new Client({ connectionString, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false });
  await client.connect();
  try {
    await client.query("begin");
    const source = await client.query<{ id: string }>(
      `insert into research_sources(slug,name,rights_basis,rights_reference,attribution,source_state,is_fixture,enabled)
       values('nyayaflow-fixture','NyayaFlow fictional research fixture corpus','fixture','Internal development fixture; not a legal source.','Created solely for development and automated tests.','verified',true,true)
       on conflict(slug) do update set name=excluded.name,rights_basis=excluded.rights_basis,rights_reference=excluded.rights_reference,
         attribution=excluded.attribution,source_state=excluded.source_state,is_fixture=true,enabled=true returning id`,
    );
    const ids = new Map<string, string>();
    for (const fixture of documents) {
      const content = fixture.passages.map((passage) => `${passage.locator}\n${passage.body}`).join("\n");
      const document = await client.query<{ id: string }>(
        `insert into research_documents(source_id,external_id,title,citation,jurisdiction,court,document_type,decision_date,bench_strength,bench_metadata_state,source_edition,content_sha256,source_state,published_at)
         values($1,$2,$3,$4,'India (fictional fixture)',$5,'judgment',$6,3,'verified','fixture-1.0',$7,'verified',now())
         on conflict(source_id,external_id) do update set title=excluded.title,citation=excluded.citation,court=excluded.court,decision_date=excluded.decision_date,
           content_sha256=excluded.content_sha256,source_state='verified',source_edition='fixture-1.0' returning id`,
        [source.rows[0].id, fixture.externalId, fixture.title, fixture.citation, fixture.court, fixture.decisionDate, hash(content)],
      );
      ids.set(fixture.externalId, document.rows[0].id);
      for (const [index, passage] of fixture.passages.entries()) {
        await client.query(
          `insert into research_passages(document_id,ordinal,locator,heading,body,checksum) values($1,$2,$3,$4,$5,$6)
           on conflict(document_id,locator) do update set ordinal=excluded.ordinal,heading=excluded.heading,body=excluded.body,checksum=excluded.checksum`,
          [document.rows[0].id, index + 1, passage.locator, passage.heading, passage.body, hash(passage.body)],
        );
      }
    }
    const meridian = ids.get("SYN-SC-2026-001")!;
    const kiteworks = ids.get("SYN-DHC-2025-014")!;
    const devika = ids.get("SYN-SC-2024-008")!;
    const meridianPassage = await client.query<{ id: string }>("select id from research_passages where document_id=$1 and locator='¶ 18'", [meridian]);
    await client.query(
      `insert into research_citation_edges(citing_document_id,cited_document_id,citing_passage_id,treatment,evidence_locator,evidence_text,source_state,reviewed_at,reviewer_reference)
       values($1,$2,$3,'followed','¶ 18','Fixture only. The fictional authority follows a reviewed-source workflow.','verified',now(),'fixture-review-1')
       on conflict(citing_document_id,cited_document_id,evidence_locator) do update set treatment=excluded.treatment,evidence_text=excluded.evidence_text,source_state='verified',reviewed_at=now(),reviewer_reference='fixture-review-1'`,
      [meridian, kiteworks, meridianPassage.rows[0].id],
    );
    await client.query(
      `insert into research_citation_edges(citing_document_id,cited_document_id,treatment,evidence_locator,evidence_text,source_state,reviewed_at,reviewer_reference)
       values($1,$2,'distinguished','¶ 26','Fixture only. The fictional authority distinguishes a narrow procedural record.','verified',now(),'fixture-review-1')
       on conflict(citing_document_id,cited_document_id,evidence_locator) do update set treatment=excluded.treatment,evidence_text=excluded.evidence_text,source_state='verified',reviewed_at=now(),reviewer_reference='fixture-review-1'`,
      [devika, meridian],
    );
    for (const id of ids.values()) {
      await client.query("insert into research_graph_jobs(document_id) values($1)", [id]);
    }
    await client.query("commit");
    process.stdout.write(`Seeded ${ids.size} fictional fixture authorities. Start the worker after Neo4j setup to project their citation graph.\n`);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
