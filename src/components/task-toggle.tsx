"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { callApi } from "@/lib/client-api";

export function TaskToggle({ id, initialDone, label }: { id: string; initialDone: boolean; label: string }) {
  const router = useRouter();
  const [done, setDone] = useState(initialDone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function change(next: boolean) {
    setDone(next);
    setBusy(true);
    setError(null);
    const result = await callApi(`/api/v1/tasks/${encodeURIComponent(id)}`, { method: "PATCH", body: { state: next ? "done" : "open" } });
    setBusy(false);
    if (!result.ok) { setDone(!next); setError(result.error); return; }
    router.refresh();
  }
  return (
    <>
      <input aria-label={`Mark "${label}" complete`} className="task-check" type="checkbox" checked={done} disabled={busy} onChange={(event) => void change(event.target.checked)} />
      {error ? <span className="sr-only" role="alert">{error}</span> : null}
    </>
  );
}
