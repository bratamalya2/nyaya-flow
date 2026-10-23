import { expect, test } from "@playwright/test";

test("daily workboard shows truthful source state and conflict", async ({ page }) => {
  await page.goto("/today");
  await expect(page.getByRole("heading", { name: "Today's Cause List & Workboard" })).toBeVisible();
  await expect(page.getByText("HEARING OVERLAP", { exact: false })).toBeVisible();
  await expect(page.locator(".status-badge.manual").first()).toBeVisible();
});

test("roadmap modules are visibly synthetic and non-operational", async ({ page }) => {
  await page.goto("/preview/research");
  await expect(page.getByText("Synthetic preview—no live integration.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Production action unavailable/ })).toBeDisabled();
});

test("mobile navigation reaches the vault", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/today");
  await page.getByRole("link", { name: "Vault" }).click();
  await expect(page.getByRole("heading", { name: "Smart Vault & OCR" })).toBeVisible();
});

const PREVIEWS = ["/preview/research", "/preview/research?view=citator", "/preview/research?view=review", "/preview/bns", "/preview/bns?code=crpc", "/preview/filing", "/preview/filing?view=indexer", "/preview/contracts"];
const BANNED = [/\bLive\b/, /Supabase/, /Neo4j/, /100%/, /Tata/, /Shardul/, /Singhania/, /Bhajan Lal/, /Hexacom/, /Indus Towers/, /HDFC/, /State Bank/, /Zero[- ]Hallucination/i];

for (const path of PREVIEWS) {
  test(`preview ${path} is synthetic, inert, and truthful`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByText("Synthetic preview—no live integration.")).toBeVisible();
    const body = page.locator("[data-preview-body]");
    await expect(body).toBeVisible();
    expect(await body.locator("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])").count()).toBe(0);
    const text = await body.innerText();
    for (const banned of BANNED) expect(text, `found ${banned}`).not.toMatch(banned);
    // Mobile emulation widens window.innerWidth to fit overflowing content, so compare with the device width.
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  });
}

test("core pages render their MVP workflows", async ({ page }) => {
  await page.goto("/matters/00000000-0000-4000-9000-000000000001?tab=access");
  await expect(page.getByRole("heading", { name: "Who else can access" })).toBeVisible();
  await page.goto("/matters/00000000-0000-4000-9000-000000000001?tab=proceedings");
  await expect(page.getByText(/Board shows matter moved/)).toBeVisible();
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Role & matter isolation matrix" })).toBeVisible();
  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "Where you are signed in" })).toBeVisible();
  await page.goto("/vault?q=synopsis");
  await expect(page.getByText(/page 2/)).toBeVisible();
});

for (const path of ["/today", "/matters", "/matters/00000000-0000-4000-9000-000000000001", "/vault", "/admin", "/account", "/clients", "/billing", "/analytics", "/research", "/bns", "/filing", "/contracts", "/portal/sign-in", "/sign-in"]) {
  test(`${path} fits the viewport without horizontal scrolling`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    await expect(page.locator("h1").first()).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  });
}

test("sign-in hydrates without a disabled-button deadlock", async ({ page, request }) => {
  // A native POST fallback keeps credentials out of the URL without deadlocking selective hydration
  // behind a server-rendered disabled button.
  const html = await (await request.get("/sign-in")).text();
  expect(html).toMatch(/<form[^>]*method="post"/);
  expect(html).toMatch(/<button[^>]*type="submit"/);
  expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*type="submit"/);

  await page.goto("/sign-in");
  const submit = page.getByRole("button", { name: "Enter synthetic demo" });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page).toHaveURL(/\/today$/);
});
