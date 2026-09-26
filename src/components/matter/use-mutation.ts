"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { callApi } from "@/lib/client-api";

/** Runs an API mutation, exposes busy/error state, and refreshes server data on success. */
export function useMutation(demoMode: boolean) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function mutate<T>(url: string, method: string, body?: unknown): Promise<T | null> {
    setError(null);
    if (demoMode) { setError("Demo mode does not save changes. Connect a database to use this workflow."); return null; }
    setBusy(true);
    const result = await callApi<T>(url, { method, body });
    setBusy(false);
    if (!result.ok) { setError(result.error); return null; }
    router.refresh();
    return result.data;
  }
  return { busy, error, setError, mutate };
}
