import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Pool, type PoolClient } from "pg";
import { recordAudit } from "../src/lib/audit";
import { resolveStoragePath } from "../src/lib/storage";
import { loadLocalEnv } from "../scripts/load-env";

loadLocalEnv();

type JobType = "malware_scan" | "page_count" | "ocr" | "search_index" | "retention_delete" | "audit_verify";
type Job = {
  id: string;
  organization_id: string;
  job_type: JobType;
  payload: { documentVersionId?: string };
  attempts: number;
  max_attempts: number;
};
type Version = { id: string; document_id: string; organization_id: string; storage_path: string; mime_type: string; page_count: number | null };
type OcrPage = { text: string; confidence: number | null };

const workerId = `${os.hostname()}-${process.pid}`;
const runOnce = process.argv.includes("--once");
const languages = process.env.OCR_LANGUAGES || "eng+hin";
const storedLanguage = ["eng", "hin", "eng+hin"].includes(languages) ? languages : "unknown";
const AUDIT_VERIFY_INTERVAL_MS = 60 * 60 * 1000;

const connectionString = process.env.WORKER_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error("WORKER_DATABASE_URL is required.");
const pool = new Pool({ connectionString, max: 3, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false });

function execute(command: string, args: string[]) {
  return new Promise<{ stdout: string; stderr: string; code: number }>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? 1 }));
  });
}

async function transaction<T>(operation: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await operation(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function versionFor(id?: string) {
  if (!id) throw new Error("Job is missing documentVersionId.");
  const result = await pool.query<Version>("select id,document_id,organization_id,storage_path,mime_type,page_count from document_versions where id=$1", [id]);
  if (!result.rows[0]) throw new Error("Document version no longer exists.");
  return result.rows[0];
}

async function setStatus(client: PoolClient, version: Version, status: string, extra: { pageCount?: number; scanResult?: string; approved?: boolean } = {}) {
  await client.query(
    `update document_versions set status=$2, page_count=coalesce($3,page_count), malware_scan_result=coalesce($4,malware_scan_result),
       approved_at=case when $5 then now() else approved_at end where id=$1`,
    [version.id, status, extra.pageCount ?? null, extra.scanResult ?? null, extra.approved ?? false],
  );
  await client.query("update documents set status=$2 where id=$1", [version.document_id, status]);
}

async function enqueue(client: PoolClient, version: Version, jobType: JobType) {
  await client.query("insert into background_jobs(organization_id,job_type,payload) values($1,$2,jsonb_build_object('documentVersionId',$3::text))", [version.organization_id, jobType, version.id]);
}

async function completeJob(client: PoolClient, job: Job) {
  await client.query("update background_jobs set status='completed',completed_at=now(),leased_until=null where id=$1", [job.id]);
}

async function extendLease(job: Job, minutes: number) {
  await pool.query("update background_jobs set leased_until=now()+make_interval(mins => $2) where id=$1 and leased_by=$3", [job.id, minutes, workerId]);
}

async function malwareScan(job: Job) {
  const version = await versionFor(job.payload.documentVersionId);
  await transaction((client) => setStatus(client, version, "scanning"));
  const result = await execute("clamdscan", ["--fdpass", "--no-summary", resolveStoragePath(version.storage_path)]);
  if (result.code !== 0 && result.code !== 1) throw new Error(`ClamAV failed: ${result.stderr.trim().slice(0, 500)}`);
  const infected = result.code === 1;
  await transaction(async (client) => {
    if (infected) {
      await setStatus(client, version, "blocked", { scanResult: result.stdout.trim().slice(0, 500) });
    } else {
      await setStatus(client, version, "ocr_pending", { scanResult: "clean" });
      await enqueue(client, version, "page_count");
    }
    await recordAudit(client, { organizationId: version.organization_id, action: "document.malware_scan", resourceType: "document_version", resourceId: version.id, outcome: infected ? "denied" : "success", correlationId: job.id });
    await completeJob(client, job);
  });
}

async function countPages(job: Job) {
  const version = await versionFor(job.payload.documentVersionId);
  let pages = 1;
  if (version.mime_type === "application/pdf") {
    const result = await execute("pdfinfo", [resolveStoragePath(version.storage_path)]);
    if (result.code !== 0) throw new Error(`pdfinfo failed: ${result.stderr.trim().slice(0, 500)}`);
    const match = result.stdout.match(/^Pages:\s+(\d+)$/m);
    if (!match) throw new Error("Could not determine PDF page count.");
    pages = Number(match[1]);
  }
  const maxPages = Number(process.env.MAX_UPLOAD_PAGES || 500);
  await transaction(async (client) => {
    if (pages < 1 || pages > maxPages) {
      await setStatus(client, version, "blocked", { pageCount: Math.min(Math.max(pages, 1), 500), scanResult: `Page count ${pages} is outside 1-${maxPages}.` });
    } else {
      await setStatus(client, version, "processing", { pageCount: pages });
      await enqueue(client, { ...version, page_count: pages }, "ocr");
    }
    await completeJob(client, job);
  });
}

function parseTsv(tsv: string) {
  const values = tsv.split("\n").slice(1).map((line) => Number(line.split("\t")[10])).filter((value) => Number.isFinite(value) && value >= 0);
  return values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100 : null;
}

async function recognize(image: string, outputBase: string): Promise<OcrPage> {
  const result = await execute("tesseract", [image, outputBase, "-l", languages, "txt", "tsv"]);
  if (result.code !== 0) throw new Error(`OCR failed: ${result.stderr.trim().slice(0, 500)}`);
  const [text, tsv] = await Promise.all([readFile(`${outputBase}.txt`, "utf8"), readFile(`${outputBase}.tsv`, "utf8")]);
  return { text, confidence: parseTsv(tsv) };
}

async function ocr(job: Job) {
  const version = await versionFor(job.payload.documentVersionId);
  const file = resolveStoragePath(version.storage_path);
  // Roughly 20 seconds per page plus headroom; the claim function's default lease is 10 minutes.
  await extendLease(job, 10 + Math.ceil(((version.page_count || 1) * 20) / 60));
  const temporary = await mkdtemp(path.join(os.tmpdir(), "nyayaflow-ocr-"));
  try {
    let pageFiles: string[];
    if (version.mime_type === "application/pdf") {
      const rendered = await execute("pdftoppm", ["-r", "200", "-png", file, path.join(temporary, "page")]);
      if (rendered.code !== 0) throw new Error(`PDF rendering failed: ${rendered.stderr.trim().slice(0, 500)}`);
      pageFiles = (await readdir(temporary)).filter((name) => name.endsWith(".png")).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map((name) => path.join(temporary, name));
    } else pageFiles = [file];
    if (!pageFiles.length || pageFiles.length > 500) throw new Error("Rendered page count is outside the allowed range.");

    const pages: OcrPage[] = [];
    for (let index = 0; index < pageFiles.length; index += 1) {
      pages.push(await recognize(pageFiles[index], path.join(temporary, `ocr-${index + 1}`)));
    }

    await transaction(async (client) => {
      await client.query("delete from ocr_pages where document_version_id=$1", [version.id]);
      for (let index = 0; index < pages.length; index += 1) {
        await client.query(
          "insert into ocr_pages(organization_id,document_version_id,page_number,language,confidence,extracted_text) values($1,$2,$3,$4,$5,$6)",
          [version.organization_id, version.id, index + 1, storedLanguage, pages[index].confidence, pages[index].text],
        );
      }
      await setStatus(client, version, "ready", { pageCount: pages.length, approved: true });
      await recordAudit(client, { organizationId: version.organization_id, action: "document.ocr", resourceType: "document_version", resourceId: version.id, outcome: "success", correlationId: job.id, metadata: { pages: pages.length } });
      await completeJob(client, job);
    });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

async function processJob(job: Job) {
  try {
    if (job.job_type === "malware_scan") await malwareScan(job);
    else if (job.job_type === "page_count") await countPages(job);
    else if (job.job_type === "ocr") await ocr(job);
    else throw new Error(`Unsupported worker job: ${job.job_type}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const dead = job.attempts >= job.max_attempts;
    await pool.query(
      `update background_jobs set status=$2,last_error=$3,leased_until=null,leased_by=null,available_at=now()+make_interval(secs => least(3600,power(2,attempts)::int*30)) where id=$1`,
      [job.id, dead ? "dead_letter" : "failed", message.slice(0, 2000)],
    );
    if (dead && job.payload.documentVersionId) {
      await transaction(async (client) => {
        const version = await versionFor(job.payload.documentVersionId).catch(() => null);
        if (version) await setStatus(client, version, "failed", { scanResult: message.slice(0, 500) });
      }).catch(() => undefined);
    }
    process.stderr.write(`Job ${job.id} (${job.job_type}) failed: ${message}\n`);
  }
}

async function claim() {
  const result = await pool.query<Job>("select * from claim_background_job($1)", [workerId]);
  return result.rows[0];
}

let lastAuditCheck = 0;
async function verifyAuditChains() {
  if (Date.now() - lastAuditCheck < AUDIT_VERIFY_INTERVAL_MS) return;
  lastAuditCheck = Date.now();
  const due = await pool.query<{ id: string }>(
    `select o.id from organizations o
     where not exists(select 1 from audit_verifications a where a.organization_id=o.id and a.verified_at>now()-interval '24 hours')`,
  );
  for (const organization of due.rows) {
    const result = await pool.query<{ ok: boolean; checked: string; first_bad_index: string | null }>("select * from verify_audit_chain($1)", [organization.id]);
    const row = result.rows[0];
    await pool.query("insert into audit_verifications(organization_id,ok,checked_count,first_bad_index) values($1,$2,$3,$4)", [organization.id, row.ok, row.checked, row.first_bad_index]);
    if (!row.ok) process.stderr.write(`Audit chain verification FAILED for organization ${organization.id} at index ${row.first_bad_index}.\n`);
  }
}

async function main() {
  let stopping = false;
  process.on("SIGTERM", () => { stopping = true; });
  process.on("SIGINT", () => { stopping = true; });
  process.stdout.write(`NyayaFlow worker ${workerId} started${runOnce ? " (single pass)" : ""}.\n`);
  while (!stopping) {
    await verifyAuditChains().catch((error) => process.stderr.write(`Audit verification error: ${String(error)}\n`));
    const job = await claim().catch((error) => { process.stderr.write(`${String(error)}\n`); return undefined; });
    if (job) await processJob(job);
    else if (runOnce) break;
    else await new Promise((resolve) => setTimeout(resolve, Number(process.env.WORKER_POLL_MS || 3000)));
  }
  await pool.end();
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
