import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import { loadLocalEnv } from "./load-env";

async function main() {
  loadLocalEnv();
  const connectionString = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_ADMIN_URL or DATABASE_URL is required.");

  const client = new Client({ connectionString, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false });
  await client.connect();
  try {
    await client.query(`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`);
    const directory = path.resolve(process.env.MIGRATIONS_DIR || path.join(process.cwd(), "db/migrations"));
    const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      const exists = await client.query("select 1 from schema_migrations where name=$1", [file]);
      if (exists.rowCount) continue;
      const sql = await readFile(path.join(directory, file), "utf8");
      await client.query(sql);
      await client.query("insert into schema_migrations(name) values($1)", [file]);
      process.stdout.write(`Applied ${file}\n`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
