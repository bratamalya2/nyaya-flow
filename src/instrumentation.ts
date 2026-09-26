export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertSafeRuntime } = await import("@/lib/runtime");
  assertSafeRuntime();

  const { platformConfig } = await import("@/lib/platform");
  const superadminKeys = ["SUPERADMIN_EMAIL", "SUPERADMIN_PASSWORD_HASH", "SUPERADMIN_TOTP_SECRET"];
  if (superadminKeys.some((key) => process.env[key]) && !platformConfig()) {
    console.warn("Platform console disabled: SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD_HASH (encoded), and SUPERADMIN_TOTP_SECRET must all be valid. Regenerate them with `npm run superadmin:setup`.");
  }
  if (process.env.NODE_ENV === "production" && !process.env.APP_BASE_URL) {
    console.warn("APP_BASE_URL is not set: invitation links will use the server's bind address instead of your public URL.");
  }
}
