import { createHash } from "node:crypto";
import { Client } from "pg";
import { loadLocalEnv } from "./load-env";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
type Provision = { code: string; section: string; heading: string; from?: string; until?: string };
const provisions: Provision[] = [
  { code: "IPC", section: "420", heading: "Fixture legacy cheating provision", until: "2024-06-30" },
  { code: "BNS", section: "318(4)", heading: "Fixture current cheating provision", from: "2024-07-01" },
  { code: "CrPC", section: "438", heading: "Fixture legacy anticipatory-bail provision", until: "2024-06-30" },
  { code: "BNSS", section: "482", heading: "Fixture current anticipatory-bail provision", from: "2024-07-01" },
  { code: "IEA", section: "65B", heading: "Fixture legacy electronic-record provision", until: "2024-06-30" },
  { code: "BSA", section: "63", heading: "Fixture current electronic-record provision", from: "2024-07-01" },
];

async function main() {
  loadLocalEnv();
  if (process.env.NODE_ENV === "production") throw new Error("Transition fixture seeding is disabled in production.");
  if (process.env.BNS_FIXTURES_ENABLED !== "true") throw new Error("Set BNS_FIXTURES_ENABLED=true explicitly before loading fictional transition fixtures.");
  const connectionString = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_ADMIN_URL or DATABASE_URL is required.");
  const client = new Client({ connectionString, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false });
  await client.connect();
  try {
    await client.query("begin");
    const source = await client.query<{ id: string }>(
      `insert into research_sources(slug,name,rights_basis,rights_reference,attribution,source_state,is_fixture,enabled)
       values('nyayaflow-transition-fixture','NyayaFlow fictional transition fixture corpus','fixture','Internal development fixture; not an official statute or mapping.','Development-only fixture.','verified',true,true)
       on conflict(slug) do update set enabled=true,source_state='verified',is_fixture=true returning id`,
    );
    const ids = new Map<string, string>();
    for (const provision of provisions) {
      const text = `Fixture only. ${provision.code} Section ${provision.section} is a fictional transition record for product testing, not statutory text.`;
      const row = await client.query<{ id: string }>(
        `insert into transition_provisions(source_id,code,section_number,heading,operative_text,effective_from,effective_until,source_edition,content_sha256,source_state)
         values($1,$2,$3,$4,$5,$6,$7,'fixture-1.0',$8,'verified')
         on conflict(source_id,code,section_number,source_edition) do update set heading=excluded.heading,operative_text=excluded.operative_text,effective_from=excluded.effective_from,effective_until=excluded.effective_until,source_state='verified' returning id`,
        [source.rows[0].id, provision.code, provision.section, provision.heading, text, provision.from ?? null, provision.until ?? null, hash(text)],
      );
      ids.set(`${provision.code}:${provision.section}`, row.rows[0].id);
    }
    for (const [legacy, current, relation] of [["IPC:420", "BNS:318(4)", "consolidated"], ["CrPC:438", "BNSS:482", "renumbered"], ["IEA:65B", "BSA:63", "renumbered"]] as const) {
      await client.query(
        `insert into transition_mappings(legacy_provision_id,current_provision_id,relation,mapping_note,source_state,reviewed_at,reviewer_reference)
         values($1,$2,$3,'Fixture only. This mapping is fictional and must not be used for legal work.','verified',now(),'fixture-review-1')
         on conflict(legacy_provision_id,current_provision_id,relation) do update set mapping_note=excluded.mapping_note,source_state='verified',reviewed_at=now(),reviewer_reference='fixture-review-1'`,
        [ids.get(legacy), ids.get(current), relation],
      );
    }
    await client.query("commit");
    process.stdout.write("Seeded 3 fictional BNS/BNSS/BSA transition mappings.\n");
  } catch (error) { await client.query("rollback"); throw error; } finally { await client.end(); }
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exit(1); });
