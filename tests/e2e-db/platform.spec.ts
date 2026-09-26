import { expect, test, type Page } from "@playwright/test";
import { authenticator } from "otplib";
import { Pool } from "pg";

// Superadmin console against the real database: sign-in with TOTP, operator creation, owner onboarding.
test.describe.configure({ mode: "serial" });

const admin = { email: process.env.SUPERADMIN_EMAIL!, password: process.env.SUPERADMIN_PASSWORD!, secret: process.env.SUPERADMIN_TOTP_SECRET! };
const db = new Pool({ connectionString: process.env.TEST_DATABASE_ADMIN_URL, max: 2 });
let page: Page;
let ownerLink = "";

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
});
test.afterAll(async () => {
  await db.end();
});

test("the console requires the superadmin's password and TOTP", async () => {
  await page.goto("/platform");
  await expect(page).toHaveURL(/\/platform\/sign-in/);
  expect((await page.request.get("/api/v1/platform/organizations")).status()).toBe(401);
  await page.getByLabel("SUPERADMIN EMAIL").fill(admin.email);
  await page.getByLabel("PASSWORD").fill(admin.password);
  await page.getByLabel("AUTHENTICATOR CODE").fill(String((Number(authenticator.generate(admin.secret)) + 500_000) % 1_000_000).padStart(6, "0"));
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".form-error")).toContainText("Invalid sign-in details");
  await page.getByLabel("AUTHENTICATOR CODE").fill(authenticator.generate(admin.secret));
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/platform$/);
  await expect(page.getByRole("heading", { name: "Operators", exact: true, level: 1 })).toBeVisible();
});

test("creates an operator and shows the owner link once", async () => {
  await page.getByLabel("Organization name").fill("Harbor & Vale Chambers");
  await expect(page.getByLabel("Workspace slug")).toHaveValue("harbor-and-vale-chambers");
  await page.getByLabel("Owner email").fill("owner@harbor.e2e.test");
  await page.getByRole("button", { name: "Create operator" }).click();
  const dialog = page.getByRole("dialog", { name: /Invitation for Harbor & Vale Chambers/ });
  ownerLink = await dialog.getByLabel("Owner invitation link").inputValue();
  expect(ownerLink).toContain("/invite/");
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("cell", { name: /Harbor & Vale Chambers/ })).toBeVisible();

  await page.getByLabel("Organization name").fill("Harbor Duplicate");
  await page.getByLabel("Workspace slug").fill("harbor-and-vale-chambers");
  await page.getByLabel("Owner email").fill("someone@harbor.e2e.test");
  await page.getByRole("button", { name: "Create operator" }).click();
  await expect(page.locator(".form-error")).toContainText("already taken");
});

test("the invited owner sets a password, enrols MFA, and lands in the new workspace", async ({ browser }) => {
  const owner = await (await browser.newContext()).newPage();
  await owner.goto(ownerLink);
  await expect(owner.getByText(/Join Harbor & Vale Chambers as owner/)).toBeVisible();
  await owner.getByLabel("FULL NAME").fill("Adv. Harbor Owner");
  await owner.getByLabel("PASSWORD", { exact: true }).fill("harbor-owner-passphrase");
  await owner.getByLabel("CONFIRM PASSWORD").fill("harbor-owner-passphrase");
  await owner.getByRole("button", { name: /Accept invitation/ }).click();
  await expect(owner).toHaveURL(/\/mfa/);
  const key = (await owner.getByText(/Manual key:/).innerText()).replace("Manual key:", "").trim();
  await owner.getByLabel("SIX-DIGIT CODE").fill(authenticator.generate(key));
  await owner.getByRole("button", { name: "Enable MFA" }).click();
  await expect(owner).toHaveURL(/\/today/);
  await expect(owner.getByText("Harbor & Vale Chambers").first()).toBeVisible();
  // A tenant session grants nothing on the platform API.
  expect((await owner.request.get("/api/v1/platform/organizations")).status()).toBe(401);
  await owner.context().close();

  await page.reload();
  await expect(page.getByRole("cell", { name: "owner@harbor.e2e.test" })).toBeVisible();
});

test("platform actions are audited and sign-out ends the session", async () => {
  const actions = await db.query<{ action: string; outcome: string }>("select action, outcome from platform_audit_events order by id");
  expect(actions.rows).toEqual(expect.arrayContaining([
    { action: "platform.sign_in", outcome: "denied" },
    { action: "platform.sign_in", outcome: "success" },
    { action: "platform.organization.create", outcome: "success" },
  ]));
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/platform\/sign-in$/);
  expect((await page.context().cookies()).some((cookie) => cookie.name === "nf_platform")).toBe(false);
  expect((await page.request.get("/api/v1/platform/organizations")).status()).toBe(401);
});
