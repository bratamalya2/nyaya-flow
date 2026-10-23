import { Client } from "pg";
import { loadLocalEnv } from "./load-env";

async function main() {
  loadLocalEnv();
  if (!process.argv.includes("--fixtures")) throw new Error("Pass --fixtures to requeue only failed/dead jobs for the fictional fixture corpus.");
  const connectionString = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_ADMIN_URL or DATABASE_URL is required.");
  const client = new Client({ connectionString, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false });
  await client.connect();
  try {
    const result = await client.query(
      `update research_graph_jobs j set status='queued',attempts=0,available_at=now(),leased_until=null,leased_by=null,last_error=null,completed_at=null
       from research_documents d join research_sources s on s.id=d.source_id
       where j.document_id=d.id and s.is_fixture and j.status in ('failed','dead_letter')
         and not exists(select 1 from research_graph_jobs active where active.document_id=j.document_id and active.id<>j.id and active.status in ('queued','leased'))`,
    );
    process.stdout.write(`Requeued ${result.rowCount ?? 0} failed/dead fictional research graph jobs.\n`);
  } finally { await client.end(); }
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exit(1); });
