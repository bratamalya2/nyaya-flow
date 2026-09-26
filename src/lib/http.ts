/** RFC 6266/5987 attachment header: ASCII fallback plus the exact UTF-8 name (Hindi titles included). */
export function contentDisposition(filename: string) {
  const fallback = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_") || "document";
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

/** Quotes a CSV cell and neutralizes spreadsheet formula injection. */
export function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Relative 303 redirect. Never build redirect targets from `request.url`: behind Nginx (or with
 * HOSTNAME=127.0.0.1) Next reports the bind address, so an absolute URL would send the browser to
 * another origin — which the CSP form-action rule then blocks.
 */
export function seeOther(path: string) {
  return new Response(null, { status: 303, headers: { location: path, "cache-control": "no-store" } });
}
