import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hasDatabase, ids, ownerPool, seed } from "./fixtures";

const hasTesseract = spawnSync("tesseract", ["--version"]).status === 0;
const workerBundle = path.resolve(".worker-build/worker.cjs");
const versionId = "00000000-0000-4000-8000-000000005002";
const documentId = "00000000-0000-4000-8000-000000005001";

describe.skipIf(!hasDatabase || !hasTesseract || !existsSync(workerBundle))("document worker", () => {
  let owner: Pool;
  let storageRoot: string;

  beforeAll(async () => {
    owner = ownerPool();
    await seed(owner);
    storageRoot = await mkdtemp(path.join(os.tmpdir(), "nyayaflow-docs-"));
    const relative = `${ids.orgA}/${ids.openMatterA}/${versionId}/original`;
    await mkdir(path.dirname(path.join(storageRoot, relative)), { recursive: true });

    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 900, height: 260 } });
    await page.setContent('<body style="margin:40px;font:48px Georgia,serif;background:#fff;color:#000">Interim order adjourned to November</body>');
    await page.screenshot({ path: path.join(storageRoot, relative), type: "png" });
    await browser.close();

    await owner.query("insert into documents(id,organization_id,matter_id,title,status,created_by) values ($1,$2,$3,'Interim order.png','processing',$4)", [documentId, ids.orgA, ids.openMatterA, ids.advocateA]);
    await owner.query("insert into document_versions(id,organization_id,document_id,storage_path,mime_type,size_bytes,sha256,status,uploaded_by,page_count) values ($1,$2,$3,$4,'image/png',100,$5,'processing',$6,1)", [versionId, ids.orgA, documentId, relative, "b".repeat(64), ids.advocateA]);
    await owner.query("insert into background_jobs(organization_id,job_type,payload) values ($1,'ocr',jsonb_build_object('documentVersionId',$2::text))", [ids.orgA, versionId]);
  }, 60_000);

  afterAll(async () => {
    await owner?.end();
    if (storageRoot) await rm(storageRoot, { recursive: true, force: true });
  });

  it("extracts text, marks the version ready, audits, and verifies the chain", () => {
    execFileSync(process.execPath, [workerBundle, "--once"], {
      env: { ...process.env, WORKER_DATABASE_URL: process.env.TEST_DATABASE_WORKER_URL, DOCUMENT_STORAGE_ROOT: storageRoot, OCR_LANGUAGES: "eng" },
      stdio: "pipe",
      timeout: 60_000,
    });
  }, 70_000);

  it("stored searchable OCR output", async () => {
    const version = await owner.query<{ status: string; page_count: number }>("select status,page_count from document_versions where id=$1", [versionId]);
    expect(version.rows[0]).toEqual({ status: "ready", page_count: 1 });
    const pages = await owner.query<{ extracted_text: string; language: string; confidence: string }>("select extracted_text,language,confidence from ocr_pages where document_version_id=$1", [versionId]);
    expect(pages.rows[0].extracted_text.toLowerCase()).toContain("adjourned");
    expect(pages.rows[0].language).toBe("eng");
    expect(Number(pages.rows[0].confidence)).toBeGreaterThan(50);
    const audit = await owner.query("select 1 from audit_events where action='document.ocr' and resource_id=$1", [versionId]);
    expect(audit.rowCount).toBe(1);
    const verification = await owner.query<{ ok: boolean }>("select ok from audit_verifications where organization_id=$1", [ids.orgA]);
    expect(verification.rows[0]?.ok).toBe(true);
    const job = await owner.query<{ status: string }>("select status from background_jobs where organization_id=$1 and job_type='ocr'", [ids.orgA]);
    expect(job.rows[0].status).toBe("completed");
  });
});
