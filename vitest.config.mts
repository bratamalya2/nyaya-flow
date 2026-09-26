import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["tests/integration/**", "tests/e2e/**", "node_modules/**"],
    coverage: { reporter: ["text", "json", "html"] },
  },
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
});
