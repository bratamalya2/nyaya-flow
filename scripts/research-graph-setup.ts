import { closeNeo4jDriver, isNeo4jConfigured, withNeo4jSession } from "../src/lib/neo4j";
import { loadLocalEnv } from "./load-env";

async function main() {
  loadLocalEnv();
  if (!isNeo4jConfigured()) throw new Error("Set NEO4J_URI, NEO4J_USERNAME, and NEO4J_PASSWORD before initializing the research graph.");
  await withNeo4jSession("WRITE", async (session) => {
    await session.executeWrite((tx) => tx.run("create constraint authority_id_unique if not exists for (a:Authority) require a.id is unique"));
    await session.executeWrite((tx) => tx.run("create constraint citation_edge_id_unique if not exists for ()-[e:CITES]-() require e.id is unique"));
    await session.executeWrite((tx) => tx.run("create index authority_citation_idx if not exists for (a:Authority) on (a.citation)"));
  });
  await closeNeo4jDriver();
  process.stdout.write("Neo4j research graph constraints are ready.\n");
}

main().catch(async (error) => {
  await closeNeo4jDriver().catch(() => undefined);
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
