import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import nodemailer from "nodemailer";
import { Pool, type PoolClient } from "pg";
import { recordAudit } from "../src/lib/audit";
import { isNeo4jConfigured, withNeo4jSession } from "../src/lib/neo4j";
import { resolveStoragePath } from "../src/lib/storage";
import { loadLocalEnv } from "../scripts/load-env";

loadLocalEnv();

type JobType = "malware_scan" | "page_count" | "ocr" | "search_index" | "retention_delete" | "audit_verify" | "court_sync" | "corpus_ingest" | "chronology_extract" | "deadline_reminder" | "email_delivery" | "usage_rollup" | "razorpay_reconcile" | "invoice_generate" | "provider_event_process";
type Job = {
  id: string;
  organization_id: string;
  job_type: JobType;
  payload: { documentVersionId?: string; ocrLanguage?: string; emailDeliveryId?: string };
  attempts: number;
  max_attempts: number;
};
type Version = { id: string; document_id: string; organization_id: string; storage_path: string; mime_type: string; page_count: number | null };
type OcrPage = { text: string; confidence: number | null };
type ResearchGraphJob = { id: string; document_id: string; attempts: number; max_attempts: number };
type ResearchAuthority = {
  id: string; title: string; citation: string; jurisdiction: string; court: string; document_type: string; decision_date: string | null;
  bench_strength: number | null; source_state: string; source_name: string; rights_basis: string; source_url: string | null; source_edition: string; is_fixture: boolean;
};
type ResearchEdge = {
  id: string; cited_document_id: string; treatment: string; evidence_locator: string; evidence_text: string; source_state: string; reviewed_at: string | null;
  title: string; citation: string; court: string; decision_date: string | null;
};

const workerId = `${os.hostname()}-${process.pid}`;
const runOnce = process.argv.includes("--once");
const configuredLanguages = (process.env.OCR_LANGUAGES || "eng+hin").split("+");
const supportedOcrLanguages = new Set(["eng", "hin", "mar", "guj", "tam", "tel", "ben", "kan", "pan"]);
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

function resolveOcrLanguage(requested?: string) {
  const languages = (requested || configuredLanguages.join("+")).split("+");
  if (!languages.length || languages.some((language) => !supportedOcrLanguages.has(language) || !configuredLanguages.includes(language))) throw new Error("Requested OCR language is not enabled for this worker.");
  return languages.join("+");
}
async function recognize(image: string, outputBase: string, language: string): Promise<OcrPage> {
  const result = await execute("tesseract", [image, outputBase, "-l", language, "txt", "tsv"]);
  if (result.code !== 0) throw new Error(`OCR failed: ${result.stderr.trim().slice(0, 500)}`);
  const [text, tsv] = await Promise.all([readFile(`${outputBase}.txt`, "utf8"), readFile(`${outputBase}.tsv`, "utf8")]);
  return { text, confidence: parseTsv(tsv) };
}

async function ocr(job: Job) {
  const version = await versionFor(job.payload.documentVersionId);
  const ocrLanguage = resolveOcrLanguage(job.payload.ocrLanguage);
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
      pages.push(await recognize(pageFiles[index], path.join(temporary, `ocr-${index + 1}`), ocrLanguage));
    }

    await transaction(async (client) => {
      await client.query("delete from ocr_pages where document_version_id=$1", [version.id]);
      for (let index = 0; index < pages.length; index += 1) {
        await client.query(
          "insert into ocr_pages(organization_id,document_version_id,page_number,language,confidence,extracted_text) values($1,$2,$3,$4,$5,$6)",
          [version.organization_id, version.id, index + 1, ocrLanguage, pages[index].confidence, pages[index].text],
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

/** Projects only the approved, shared authority corpus. This must never receive firm or matter data. */
async function syncResearchGraph(job: ResearchGraphJob) {
  if (!isNeo4jConfigured()) throw new Error("Neo4j is not configured; set NEO4J_URI, NEO4J_USERNAME, and NEO4J_PASSWORD before enabling graph sync.");
  const authority = await pool.query<ResearchAuthority>(
    `select d.id,d.title,d.citation,d.jurisdiction,d.court,d.document_type,d.bench_strength,d.source_state,
       to_char(d.decision_date,'YYYY-MM-DD') as decision_date,s.name as source_name,s.rights_basis,d.source_url,d.source_edition,s.is_fixture
     from research_documents d join research_sources s on s.id=d.source_id where d.id=$1 and s.enabled`, [job.document_id],
  );
  if (!authority.rows[0]) {
    await pool.query("update research_graph_jobs set status='completed',completed_at=now(),leased_until=null,last_error='Source is disabled or was removed.' where id=$1", [job.id]);
    return;
  }
  const row = authority.rows[0];
  const edges = await pool.query<ResearchEdge>(
    `select e.id,e.cited_document_id,e.treatment,e.evidence_locator,e.evidence_text,e.source_state,
       to_char(e.reviewed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') as reviewed_at,
       cited.title,cited.citation,cited.court,to_char(cited.decision_date,'YYYY-MM-DD') as decision_date
     from research_citation_edges e join research_documents cited on cited.id=e.cited_document_id
     join research_sources s on s.id=cited.source_id
     where e.citing_document_id=$1 and s.enabled`, [job.document_id],
  );
  await withNeo4jSession("WRITE", async (session) => {
    await session.executeWrite((tx) => tx.run(
      `merge (a:Authority {id:$id})
       set a.title=$title,a.citation=$citation,a.jurisdiction=$jurisdiction,a.court=$court,a.documentType=$documentType,
           a.decisionDate=$decisionDate,a.benchStrength=$benchStrength,a.sourceState=$sourceState,a.sourceName=$sourceName,
           a.rightsBasis=$rightsBasis,a.sourceUrl=$sourceUrl,a.sourceEdition=$sourceEdition,a.isFixture=$isFixture,a.syncedAt=datetime()`,
      { id: row.id, title: row.title, citation: row.citation, jurisdiction: row.jurisdiction, court: row.court, documentType: row.document_type,
        decisionDate: row.decision_date, benchStrength: row.bench_strength, sourceState: row.source_state, sourceName: row.source_name,
        rightsBasis: row.rights_basis, sourceUrl: row.source_url, sourceEdition: row.source_edition, isFixture: row.is_fixture },
    ));
    await session.executeWrite((tx) => tx.run("match (:Authority {id:$id})-[edge:CITES]->() delete edge", { id: row.id }));
    for (const edge of edges.rows) {
      await session.executeWrite((tx) => tx.run(
        `match (from:Authority {id:$fromId})
         merge (to:Authority {id:$toId})
         on create set to.title=$title,to.citation=$citation,to.court=$court,to.decisionDate=$decisionDate
         merge (from)-[edge:CITES {id:$id}]->(to)
         set edge.treatment=$treatment,edge.evidenceLocator=$evidenceLocator,edge.evidenceText=$evidenceText,
             edge.sourceState=$sourceState,edge.reviewedAt=$reviewedAt,edge.syncedAt=datetime()`,
        { fromId: row.id, toId: edge.cited_document_id, id: edge.id, title: edge.title, citation: edge.citation, court: edge.court,
          decisionDate: edge.decision_date, treatment: edge.treatment, evidenceLocator: edge.evidence_locator, evidenceText: edge.evidence_text,
          sourceState: edge.source_state, reviewedAt: edge.reviewed_at },
      ));
    }
  });
  await transaction(async (client) => {
    await client.query("update research_documents set graph_synced_at=now(),graph_sync_error=null where id=$1", [job.document_id]);
    await client.query("update research_citation_edges set graph_synced_at=now() where citing_document_id=$1", [job.document_id]);
    await client.query("update research_graph_jobs set status='completed',completed_at=now(),leased_until=null,last_error=null where id=$1", [job.id]);
  });
}

async function processJob(job: Job) {
  try {
    if (job.job_type === "malware_scan") await malwareScan(job);
    else if (job.job_type === "page_count") await countPages(job);
    else if (job.job_type === "ocr") await ocr(job);
    else if (job.job_type === "email_delivery") await deliverEmail(job);
    else if (job.job_type === "deadline_reminder") await stageDeadlineReminders(job);
    else if (job.job_type === "usage_rollup") await rollupUsage(job);
    else throw new Error(`No authorized adapter is configured for worker job: ${job.job_type}`);
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

type EmailDelivery = { id: string; recipient_email: string; subject: string; body: string; attempts: number };
async function deliverEmail(job: Job) {
  if (!job.payload.emailDeliveryId) throw new Error("Email delivery job is missing emailDeliveryId.");
  const delivery = await pool.query<EmailDelivery>("select id,recipient_email,subject,body,attempts from email_deliveries where id=$1 and status in ('queued','failed') for update", [job.payload.emailDeliveryId]);
  const row = delivery.rows[0]; if (!row) { await transaction((client) => completeJob(client, job)); return; }
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) throw new Error("SMTP is not configured.");
  await pool.query("update email_deliveries set status='sending',attempts=attempts+1 where id=$1", [row.id]);
  const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === "true", auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined });
  const result = await transport.sendMail({ from: process.env.SMTP_FROM, to: row.recipient_email, subject: row.subject, text: row.body });
  await transaction(async (client) => { await client.query("update email_deliveries set status='sent',sent_at=now(),provider_message_id=$2,last_error=null where id=$1", [row.id,result.messageId]); await completeJob(client, job); });
}

async function stageDeadlineReminders(job: Job) {
  await transaction(async (client) => {
    const reminders = await client.query<{ id: string; organization_id: string; email: string; title: string; due_on: string }>(`select r.id,r.organization_id,u.email,d.title,d.due_on from deadline_reminders r join app_users u on u.id=r.recipient_id join matter_deadlines d on d.id=r.matter_deadline_id where r.status='queued' and r.scheduled_for<=now() limit 100`);
    for (const reminder of reminders.rows) {
      const inserted = await client.query<{ id: string }>(`insert into email_deliveries(organization_id,recipient_email,subject,body,category,related_resource_type,related_resource_id,dedupe_key) values($1,$2,$3,$4,'deadline','matter_deadline',$5,$6) on conflict(organization_id,dedupe_key) do nothing returning id`, [reminder.organization_id,reminder.email,"NyayaFlow deadline reminder",`Deadline: ${reminder.title}. Due on ${reminder.due_on}. Verify the date and source rule before filing.`,reminder.id,`deadline-reminder:${reminder.id}`]);
      if (inserted.rows[0]) await client.query("insert into background_jobs(organization_id,job_type,payload) values($1,'email_delivery',jsonb_build_object('emailDeliveryId',$2::text))", [reminder.organization_id,inserted.rows[0].id]);
      await client.query("update deadline_reminders set status='sent',sent_at=now() where id=$1", [reminder.id]);
    }
    await completeJob(client, job);
  });
}

async function rollupUsage(job: Job) {
  await transaction(async (client) => {
    const organizations = await client.query<{ id: string }>("select id from organizations");
    const month = new Date(); const start = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1)).toISOString().slice(0, 10); const end = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    for (const organization of organizations.rows) {
      const [seats, matters, storage, ocr] = await Promise.all([client.query<{ count: string }>("select count(*) from memberships where organization_id=$1 and active", [organization.id]),client.query<{ count: string }>("select count(*) from matters where organization_id=$1 and status='active'", [organization.id]),client.query<{ bytes: string }>("select coalesce(sum(size_bytes),0) bytes from document_versions where organization_id=$1", [organization.id]),client.query<{ count: string }>("select count(*) from ocr_pages where organization_id=$1 and created_at >= $2", [organization.id,start])]);
      for (const [metric, quantity] of [["seats",seats.rows[0].count],["matters",matters.rows[0].count],["storage_bytes",storage.rows[0].bytes],["ocr_pages",ocr.rows[0].count]]) await client.query(`insert into usage_counters(organization_id,metric,period_start,period_end,quantity) values($1,$2,$3,$4,$5) on conflict(organization_id,metric,period_start,period_end) do update set quantity=excluded.quantity`, [organization.id,metric,start,end,quantity]);
    }
    await completeJob(client, job);
  });
}

async function processResearchGraphJob(job: ResearchGraphJob) {
  try {
    await syncResearchGraph(job);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const dead = job.attempts >= job.max_attempts;
    await pool.query(
      "update research_graph_jobs set status=$2,last_error=$3,leased_until=null,leased_by=null,available_at=now()+make_interval(secs => least(3600,power(2,attempts)::int*30)) where id=$1",
      [job.id, dead ? "dead_letter" : "failed", message.slice(0, 2000)],
    );
    await pool.query("update research_documents set graph_sync_error=$2 where id=$1", [job.document_id, message.slice(0, 2000)]).catch(() => undefined);
    process.stderr.write(`Research graph job ${job.id} failed: ${message}\n`);
  }
}

async function claim() {
  const result = await pool.query<Job>("select * from claim_background_job($1)", [workerId]);
  return result.rows[0];
}

async function claimResearchGraphJob() {
  const result = await pool.query<ResearchGraphJob>("select * from claim_research_graph_job($1)", [workerId]);
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
    else {
      const graphJob = await claimResearchGraphJob().catch((error) => { process.stderr.write(`${String(error)}\n`); return undefined; });
      if (graphJob) await processResearchGraphJob(graphJob);
      else if (runOnce) break;
      else await new Promise((resolve) => setTimeout(resolve, Number(process.env.WORKER_POLL_MS || 3000)));
      continue;
    }
    if (runOnce) break;
  }
  await pool.end();
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
