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
