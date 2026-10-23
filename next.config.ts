import type { NextConfig } from "next";
import path from "node:path";

const isDev = process.env.NODE_ENV === "development";
const isProduction = process.env.NODE_ENV === "production";
const configuredDevOrigins = (process.env.DEV_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProduction ? ["upgrade-insecure-requests"] : []),
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  output: "standalone",
  // This repository is nested below an unrelated package-lock; keep production tracing
  // scoped to this application so standalone output is deterministic.
  outputFileTracingRoot: path.join(__dirname),
  // Next.js blocks dev assets and HMR from alternate hostnames unless they are explicitly trusted.
  // Values are hostnames only (no scheme, port, or path), as required by Next 16.
  allowedDevOrigins: isDev ? [...new Set(["127.0.0.1", ...configuredDevOrigins])] : undefined,
  // Lets the e2e server run beside a developer's own `next dev` (each dist dir has its own dev lock).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          ...(isProduction ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
        ],
      },
    ];
  },
};

export default nextConfig;
