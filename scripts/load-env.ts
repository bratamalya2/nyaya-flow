// Development convenience: read .env.local and .env like `next dev` does. Variables already set in the
// environment always win, and production (systemd EnvironmentFile) never reads project files.
export function loadLocalEnv() {
  if (process.env.NODE_ENV === "production") return;
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(file);
    } catch {
      // Missing files are fine.
    }
  }
}
