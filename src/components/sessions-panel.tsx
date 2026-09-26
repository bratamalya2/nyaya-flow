"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/ui/modal";
import { callApi } from "@/lib/client-api";
import { formatDateTime, relativeTime } from "@/lib/format";
import type { SessionSummary } from "@/lib/auth";

export function SessionsPanel({ sessions, demoMode }: { sessions: SessionSummary[]; demoMode: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function revoke(body: { sessionId: string } | { others: true }) {
    if (demoMode) { setError("Demo mode has no real sessions."); return; }
    setBusy(true);
    setError(null);
    const result = await callApi<{ signedOut: boolean }>("/api/v1/sessions", { method: "DELETE", body });
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    if (result.data.signedOut) { router.push("/sign-in"); return; }
    router.refresh();
  }
  return (
    <section className="card card-pad">
      <div className="section-heading"><div><p className="eyebrow">Active sessions</p><h2>Where you are signed in</h2></div>{sessions.length > 1 ? <button className="button" disabled={busy} onClick={() => void revoke({ others: true })} type="button">Sign out other sessions</button> : null}</div>
      <p className="lede" style={{ marginTop: 0 }}>Sessions end after 60 minutes without activity and 12 hours at most. Revoking takes effect on the next request.</p>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Session</th><th>Signed in</th><th>Last active</th><th>Expires</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{sessions.map((session) => (
            <tr key={session.id}>
              <td>{session.current ? <strong>This browser</strong> : "Another browser or device"}</td>
              <td className="tabular">{formatDateTime(session.createdAt)}</td>
              <td>{relativeTime(session.lastSeenAt)}</td>
              <td className="tabular">{formatDateTime(session.expiresAt)}</td>
              <td><button className="button small" disabled={busy} onClick={() => void revoke({ sessionId: session.id })} type="button">{session.current ? "Sign out" : "Revoke"}</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <FormError message={error} />
    </section>
  );
}
