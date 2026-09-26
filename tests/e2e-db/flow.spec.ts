import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { authenticator } from "otplib";
import { Pool } from "pg";

// One realistic day in the product, against a real PostgreSQL database, real RLS, and the real worker.
test.describe.configure({ mode: "serial" });

const owner = { email: process.env.E2E_OWNER_EMAIL!, password: process.env.E2E_OWNER_PASSWORD! };
const db = new Pool({ connectionString: process.env.TEST_DATABASE_ADMIN_URL, max: 2 });
let page: Page;
let matterUrl = "";
let versionId = "";

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
});
test.afterAll(async () => {
  await db.end();
});

async function enrolMfa(target: Page) {
  await expect(target.getByText(/Manual key:/)).toBeVisible();
  const key = (await target.getByText(/Manual key:/).innerText()).replace("Manual key:", "").trim();
  await target.getByLabel("SIX-DIGIT CODE").fill(authenticator.generate(key));
  await target.getByRole("button", { name: "Enable MFA" }).click();
}

test("owner signs in and enrols TOTP before seeing firm data", async () => {
  await page.goto("/today");
  await expect(page).toHaveURL(/\/sign-in/);
  await page.getByLabel("WORK EMAIL").fill(owner.email);
  await page.getByLabel("PASSWORD").fill("wrong-password-attempt");
  await page.getByRole("button", { name: /Continue securely/ }).click();
  await expect(page.locator(".form-error")).toContainText("Invalid credentials");
  await page.getByLabel("PASSWORD").fill(owner.password);
  await page.getByRole("button", { name: /Continue securely/ }).click();
  await expect(page).toHaveURL(/\/mfa/);
  await enrolMfa(page);
  await expect(page).toHaveURL(/\/today/);
  await expect(page.getByText("E2E Chambers")).toBeVisible();
});

test("creates a matter with a validated CNR", async () => {
  await page.goto("/matters?create=true");
  const dialog = page.getByRole("dialog", { name: "Create matter" });
  await dialog.getByLabel("Matter title").fill("Riverbend Housing Society v. Municipal Corporation");
  await dialog.getByLabel("Case reference").fill("W.P.(C) 777/2026");
  await dialog.getByLabel("CNR (optional)").fill("DLHC01-bad");
  await expect(dialog.getByText("Use 4 letters followed by 12 digits.")).toBeVisible();
  await dialog.getByLabel("CNR (optional)").fill("DLHC010007772026");
  await dialog.getByLabel("Client", { exact: true }).fill("Riverbend Housing Society");
  await dialog.getByLabel("Party 1 name").fill("Riverbend Housing Society");
  await dialog.getByLabel("Party 2 name").fill("Municipal Corporation");
  await dialog.getByRole("button", { name: "Create draft" }).click();
  await page.waitForURL(/\/matters\/[0-9a-f-]{36}$/);
  matterUrl = new URL(page.url()).pathname;
  await expect(page.getByRole("heading", { name: /Riverbend Housing Society/ })).toBeVisible();
  await expect(page.getByText("DLHC010007772026")).toBeVisible();
});

async function addHearing(start: string, end: string, room: string) {
  await page.getByRole("button", { name: "Add hearing" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add hearing" });
  await dialog.getByLabel("Start (IST)").fill(start);
  await dialog.getByLabel("End (IST)").fill(end);
  await dialog.getByLabel("Court room").fill(room);
  await dialog.getByLabel("Status").selectOption("confirmed");
  await dialog.getByRole("button", { name: "Add hearing" }).click();
  await expect(dialog).toBeHidden();
}

test("detects and dismisses a same-advocate hearing overlap", async () => {
  await addHearing("10:30", "11:30", "Court 12");
  await addHearing("11:00", "12:00", "Court 4");
  await page.goto("/today");
  await expect(page.getByText(/HEARING OVERLAP/)).toBeVisible();
  await page.getByRole("button", { name: "Dismiss with reason" }).click();
  await page.getByRole("dialog").getByLabel("Reason").fill("Junior counsel will mention in Court 4");
  await page.getByRole("button", { name: "Dismiss conflict" }).click();
  await expect(page.getByText(/HEARING OVERLAP/)).toBeHidden();
});

test("edits a hearing with a reason and shows the revision history", async () => {
  await page.goto(matterUrl);
  await page.getByRole("button", { name: "Edit", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Update hearing" });
  await dialog.getByLabel("Item number").fill("7");
  await dialog.getByLabel("Reason for change").fill("Registry board shows item 7");
  await dialog.getByRole("button", { name: "Save update" }).click();
  await expect(dialog).toBeHidden();
  await page.goto(`${matterUrl}?tab=proceedings`);
  await expect(page.getByText("Registry board shows item 7")).toBeVisible();
});

test("uploads a document that the worker OCRs into searchable text", async ({ browser }) => {
  const renderer = await browser.newPage({ viewport: { width: 1000, height: 300 } });
  await renderer.setContent('<body style="margin:40px;font:44px Georgia,serif;background:#fff;color:#000">Interim order: status quo on the society land</body>');
  const image = await renderer.screenshot({ type: "png" });
  await renderer.close();

  const matterId = matterUrl.split("/").pop()!;
  await page.goto(`/vault?matter=${matterId}`);
  await page.locator('input[type="file"]').setInputFiles({ name: "Interim_Order.png", mimeType: "image/png", buffer: image });
  await expect(page.getByText(/entered quarantine/)).toBeVisible();

  // ClamAV is not available in development; mark the scan clean and hand the version to the real OCR worker.
  const version = await db.query<{ id: string; organization_id: string }>("select v.id, v.organization_id from document_versions v join documents d on d.id = v.document_id where d.title = 'Interim_Order.png'");
  versionId = version.rows[0].id;
  await db.query("update background_jobs set status = 'completed' where payload->>'documentVersionId' = $1", [versionId]);
  await db.query("update document_versions set status = 'processing', malware_scan_result = 'clean (e2e)', page_count = 1 where id = $1", [versionId]);
  await db.query("insert into background_jobs (organization_id, job_type, payload) values ($1, 'ocr', jsonb_build_object('documentVersionId', $2::text))", [version.rows[0].organization_id, versionId]);
  execFileSync(process.execPath, [path.resolve(".worker-build/worker.cjs"), "--once"], {
    env: { ...process.env, WORKER_DATABASE_URL: process.env.TEST_DATABASE_WORKER_URL, OCR_LANGUAGES: "eng" },
    stdio: "pipe",
    timeout: 90_000,
  });

  await page.reload();
  await expect(page.getByRole("row", { name: /Interim_Order\.png/ }).getByText("ready")).toBeVisible();
  await page.getByPlaceholder(/interim order/).fill("status quo");
  await expect(page.getByText(/Interim_Order\.png · page 1/)).toBeVisible();
});

test("corrects OCR text and downloads the original with an authorization check", async () => {
  await page.getByRole("button", { name: "Open page text" }).click();
  await page.getByRole("button", { name: "Correct text" }).click();
  await page.getByLabel(/Corrected text for page 1/).fill("Interim order: status quo on the society land (verified)");
  await page.getByRole("button", { name: "Save correction" }).click();
  await expect(page.getByText(/Page 1 saved/)).toBeVisible();
  await page.keyboard.press("Escape");

  const download = await page.request.get(`/api/v1/documents/${versionId}/download`);
  expect(download.status()).toBe(200);
  expect(download.headers()["content-disposition"]).toContain("filename*=UTF-8''Interim_Order.png");
  expect(download.headers()["cache-control"]).toContain("no-store");
});

test("rejects cross-origin mutations", async () => {
  const response = await page.request.post("/api/v1/matters", { headers: { origin: "https://evil.example" }, data: { title: "Forged matter", reference: "X/1", forum: "Forum", client: "Client" } });
  expect(response.status()).toBe(403);
});

test("invites a member who must enrol MFA", async ({ browser }) => {
  await page.goto("/admin");
  await expect(page.getByRole("cell", { name: "matter.create" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Invite member" }).click();
  const dialog = page.getByRole("dialog", { name: "Invite a member" });
  await dialog.getByLabel("Work email").fill("associate@e2e.nyayaflow.test");
  await dialog.getByLabel("Role").selectOption("associate");
  await dialog.getByRole("button", { name: "Create invitation" }).click();
  const link = await dialog.getByLabel("Invitation link").inputValue();
  expect(link).toContain("/invite/");
  await dialog.getByRole("button", { name: "Done" }).click();

  const invitee = await (await browser.newContext()).newPage();
  await invitee.goto(link);
  await invitee.getByLabel("FULL NAME").fill("Adv. Invited Associate");
  await invitee.getByLabel("PASSWORD", { exact: true }).fill("invited-associate-passphrase");
  await invitee.getByLabel("CONFIRM PASSWORD").fill("invited-associate-passphrase");
  await invitee.getByRole("button", { name: /Accept invitation/ }).click();
  await expect(invitee).toHaveURL(/\/mfa/);
  await enrolMfa(invitee);
  await expect(invitee).toHaveURL(/\/today/);
  await invitee.goto("/admin");
  await expect(invitee.getByText("Owners, managing partners, and admins can review and export the audit trail.")).toBeVisible();
  await invitee.context().close();

  await page.reload();
  await expect(page.getByRole("cell", { name: /Adv\. Invited Associate associate@e2e\.nyayaflow\.test/ })).toBeVisible();
});

test("exports a verifiable audit chain", async () => {
  const csv = await page.request.get("/api/v1/audit/export");
  expect(csv.status()).toBe(200);
  const body = await csv.text();
  for (const action of ["auth.sign_in", "matter.create", "hearing.update", "document.upload", "document.download", "ocr.correct", "membership.invite"]) expect(body).toContain(action);
  const verification = await db.query<{ ok: boolean }>("select v.ok from organizations o cross join lateral verify_audit_chain(o.id) v where o.slug = 'e2e-chambers'");
  expect(verification.rows[0].ok).toBe(true);
});

test("signing out revokes the session", async () => {
  await page.goto("/account");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  await page.goto("/today");
  await expect(page).toHaveURL(/\/sign-in/);
  const denied = await page.request.get("/api/v1/matters");
  expect(denied.status()).toBe(401);
});
