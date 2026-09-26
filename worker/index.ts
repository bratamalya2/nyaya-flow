import { spawn } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Pool, type PoolClient } from "pg";
import { resolveStoragePath } from "../src/lib/storage";

type Job = {
  id: string;
  organization_id: string;
  job_type: "malware_scan" | "page_count" | "ocr" | "search_index" | "retention_delete" | "audit_verify";
  payload: { documentVersionId?: string };
  attempts: number;
  max_attempts: number;
};

type Version = { id: string; document_id: string; organization_id: string; storage_path: string; mime_type: string; page_count: number | null };
const workerId = `${os.hostname()}-${process.pid}`;
const connectionString = process.env.WORKER_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error("WORKER_DATABASE_URL is required.");
const pool = new Pool({ connectionString, max: 3, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false });

function execute(command: string, args: string[], options: { stdout?: boolean } = {}) {
  return new Promise<{ stdout: string; stderr: string; code: number }>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = ""; let stderr = "";
    child.stdout.on("data", (chunk) => { if (options.stdout !== false) stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? 1 }));
  });
}

async function versionFor(client: PoolClient, id?: string) {
  if (!id) throw new Error("Job is missing documentVersionId.");
  const result = await client.query<Version>("select id,document_id,organization_id,storage_path,mime_type,page_count from document_versions where id=$1", [id]);
  if (!result.rows[0]) throw new Error("Document version no longer exists.");
  return result.rows[0];
}

async function enqueue(client: PoolClient, version: Version, jobType: Job["job_type"]) {
  await client.query("insert into background_jobs(organization_id,job_type,payload) values($1,$2,jsonb_build_object('documentVersionId',$3::text))", [version.organization_id, jobType, version.id]);
}

async function malwareScan(client: PoolClient, job: Job) {
  const version = await versionFor(client, job.payload.documentVersionId);
  const file = resolveStoragePath(version.storage_path);
  await client.query("update document_versions set status='scanning' where id=$1", [version.id]);
  const result = await execute("clamdscan", ["--fdpass", "--no-summary", file]);
  if (result.code === 1) {
    await client.query("update document_versions set status='blocked',malware_scan_result=$2 where id=$1", [version.id, result.stdout.trim().slice(0, 500)]);
    await client.query("update documents set status='blocked' where id=$1", [version.document_id]);
    return;
  }
  if (result.code !== 0) throw new Error(`ClamAV failed: ${result.stderr.trim().slice(0, 500)}`);
  await client.query("update document_versions set status='ocr_pending',malware_scan_result='clean' where id=$1", [version.id]);
  await client.query("update documents set status='ocr_pending' where id=$1", [version.document_id]);
  await enqueue(client, version, "page_count");
}

async function countPages(client: PoolClient, job: Job) {
  const version = await versionFor(client, job.payload.documentVersionId);
  const file = resolveStoragePath(version.storage_path);
  let pages = 1;
  if (version.mime_type === "application/pdf") {
    const result = await execute("pdfinfo", [file]);
    if (result.code !== 0) throw new Error(`pdfinfo failed: ${result.stderr.trim().slice(0, 500)}`);
    const match = result.stdout.match(/^Pages:\s+(\d+)$/m);
    if (!match) throw new Error("Could not determine PDF page count.");
    pages = Number(match[1]);
  }
  if (pages < 1 || pages > 500) {
    await client.query("update document_versions set status='blocked',page_count=$2 where id=$1", [version.id, pages]);
    await client.query("update documents set status='blocked' where id=$1", [version.document_id]);
    return;
  }
  await client.query("update document_versions set page_count=$2,status='processing' where id=$1", [version.id, pages]);
  await client.query("update documents set status='processing' where id=$1", [version.document_id]);
  await enqueue(client, { ...version, page_count: pages }, "ocr");
}

function meanConfidence(tsv: string) {
  const values = tsv.split("\n").slice(1).map((line) => Number(line.split("\t")[10])).filter((value) => Number.isFinite(value) && value >= 0);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

async function ocr(client: PoolClient, job: Job) {
  const version = await versionFor(client, job.payload.documentVersionId);
  const file = resolveStoragePath(version.storage_path);
  const temporary = await mkdtemp(path.join(os.tmpdir(), "nyayaflow-ocr-"));
  try {
    let pageFiles: string[];
    if (version.mime_type === "application/pdf") {
      const rendered = await execute("pdftoppm", ["-r", "200", "-png", file, path.join(temporary, "page")], { stdout: false });
      if (rendered.code !== 0) throw new Error(`PDF rendering failed: ${rendered.stderr.trim().slice(0, 500)}`);
      pageFiles = (await readdir(temporary)).filter((name) => name.endsWith(".png")).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map((name) => path.join(temporary, name));
    } else pageFiles = [file];
    if (!pageFiles.length || pageFiles.length > 500) throw new Error("Rendered page count is outside the allowed range.");

    await client.query("delete from ocr_pages where document_version_id=$1", [version.id]);
    for (let index = 0; index < pageFiles.length; index += 1) {
      const [text, tsv] = await Promise.all([
        execute("tesseract", [pageFiles[index], "stdout", "-l", process.env.OCR_LANGUAGES || "eng+hin"]),
        execute("tesseract", [pageFiles[index], "stdout", "-l", process.env.OCR_LANGUAGES || "eng+hin", "tsv"]),
      ]);
      if (text.code !== 0) throw new Error(`OCR failed on page ${index + 1}: ${text.stderr.trim().slice(0, 500)}`);
      await client.query(
        `insert into ocr_pages(organization_id,document_version_id,page_number,language,confidence,extracted_text)
         values($1,$2,$3,$4,$5,$6)`,
        [version.organization_id, version.id, index + 1, process.env.OCR_LANGUAGES || "eng+hin", meanConfidence(tsv.stdout), text.stdout],
      );
    }
    await client.query("update document_versions set status='ready',page_count=$2,approved_at=now() where id=$1", [version.id, pageFiles.length]);
    await client.query("update documents set status='ready' where id=$1", [version.document_id]);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

async function processJob(job: Job) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    if (job.job_type === "malware_scan") await malwareScan(client, job);
    else if (job.job_type === "page_count") await countPages(client, job);
    else if (job.job_type === "ocr") await ocr(client, job);
    else throw new Error(`Unsupported worker job: ${job.job_type}`);
    await client.query("update background_jobs set status='completed',completed_at=now(),leased_until=null where id=$1", [job.id]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    const message = error instanceof Error ? error.message : String(error);
    const dead = job.attempts >= job.max_attempts;
    await client.query(
      `update background_jobs set status=$2,last_error=$3,leased_until=null,leased_by=null,available_at=now()+make_interval(secs => least(3600,power(2,attempts)::int*30)) where id=$1`,
      [job.id, dead ? "dead_letter" : "failed", message.slice(0, 2000)],
    );
  } finally { client.release(); }
}

async function claim() {
  const result = await pool.query<Job>("select * from claim_background_job($1)", [workerId]);
  return result.rows[0];
}

let stopping = false;
process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });
process.stdout.write(`NyayaFlow worker ${workerId} started.\n`);
while (!stopping) {
  const job = await claim().catch((error) => { process.stderr.write(`${String(error)}\n`); return undefined; });
  if (job) await processJob(job);
  else await new Promise((resolve) => setTimeout(resolve, Number(process.env.WORKER_POLL_MS || 3000)));
}
await pool.end();
