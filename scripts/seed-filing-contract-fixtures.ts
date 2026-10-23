import { Client } from "pg";
import { loadLocalEnv } from "./load-env";

async function main() {
  loadLocalEnv();
  if (process.env.NODE_ENV === "production") throw new Error("Filing and contract fixture seeding is disabled in production.");
  if (process.env.FILING_FIXTURES_ENABLED !== "true" || process.env.CONTRACTS_FIXTURES_ENABLED !== "true") throw new Error("Set FILING_FIXTURES_ENABLED=true and CONTRACTS_FIXTURES_ENABLED=true explicitly before loading fictional fixtures.");
  const connectionString = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_ADMIN_URL or DATABASE_URL is required.");
  const client = new Client({ connectionString, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false }); await client.connect();
  try {
    await client.query("begin");
    const fixtureSlug = process.env.BETA_FIXTURE_ORGANIZATION_SLUG || process.env.ORGANIZATION_SLUG;
    if (!fixtureSlug) throw new Error("Set BETA_FIXTURE_ORGANIZATION_SLUG to the one development firm that should receive fixtures.");
    const org = await client.query<{ id: string }>("select id from organizations where slug=$1", [fixtureSlug]);
    if (org.rows.length !== 1) throw new Error("The selected fixture organization was not found.");
    const actor = await client.query<{ user_id: string }>("select user_id from memberships where organization_id=$1 and active order by created_at limit 1", [org.rows[0].id]); if (!actor.rows[0]) throw new Error("Fixture organization needs one active member.");
    await client.query(`insert into filing_rule_packs(organization_id,forum,name,version,source_reference,source_state,effective_from,enabled,is_fixture,created_by)
      values($1,'Fictional Development Forum','Fictional internal checklist','fixture-1.0','Internal fixture only; not a court rule or source.','unverified','2026-01-01',true,true,$2)
      on conflict(organization_id,forum,version) do update set enabled=true,is_fixture=true,source_reference=excluded.source_reference`, [org.rows[0].id, actor.rows[0].user_id]);
    await client.query(`insert into contract_templates(organization_id,title,version,body,source_reference,source_state,status,is_fixture,approved_by,approved_at,created_by)
      values($1,'Fictional Services Agreement','fixture-1.0','Fixture only. This is placeholder template text for product development and is not a legal form.','Internal fixture only; not a reviewed template.','unverified','approved',true,$2,now(),$2)
      on conflict(organization_id,title,version) do update set status='approved',is_fixture=true,body=excluded.body,source_reference=excluded.source_reference`, [org.rows[0].id, actor.rows[0].user_id]);
    await client.query("commit"); process.stdout.write("Seeded fictional E-Filing rule pack and Contracts & CLM template. No court, signing, or stamp transaction was created.\n");
  } catch (error) { await client.query("rollback"); throw error; } finally { await client.end(); }
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exit(1); });
