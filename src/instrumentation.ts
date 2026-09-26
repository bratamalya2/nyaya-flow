export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertSafeRuntime } = await import("@/lib/runtime");
    assertSafeRuntime();
  }
}
