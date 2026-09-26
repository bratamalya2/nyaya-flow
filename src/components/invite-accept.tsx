"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/ui/modal";
import { callApi, submitWith } from "@/lib/client-api";
import { useHydrated } from "@/lib/use-hydrated";

export function InviteAccept({ token, mode, email }: { token: string; mode: "new-account" | "accept-signed-in"; email: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hydrated = useHydrated();
  async function submit(data: FormData) {
    setError(null);
    if (mode === "new-account" && data.get("password") !== data.get("confirm")) { setError("The passwords do not match."); return; }
    setBusy(true);
    const result = await callApi<{ mfaSetupRequired: boolean }>("/api/v1/invitations/accept", { method: "POST", body: mode === "new-account" ? { token, displayName: data.get("name"), password: data.get("password") } : { token } });
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    router.push(result.data.mfaSetupRequired ? "/mfa" : "/today");
    router.refresh();
  }
  return (
    <form method="post" onSubmit={submitWith(submit)}>
      {mode === "new-account" ? <>
        <div className="field"><label htmlFor="email">WORK EMAIL</label><input id="email" readOnly value={email} /></div>
        <div className="field"><label htmlFor="name">FULL NAME</label><input autoComplete="name" id="name" maxLength={120} minLength={2} name="name" placeholder="Adv. First Last" required /></div>
        <div className="field"><label htmlFor="password">PASSWORD</label><input autoComplete="new-password" id="password" maxLength={256} minLength={14} name="password" required type="password" /><small>At least 14 characters. A passphrase works well.</small></div>
        <div className="field"><label htmlFor="confirm">CONFIRM PASSWORD</label><input autoComplete="new-password" id="confirm" maxLength={256} minLength={14} name="confirm" required type="password" /></div>
      </> : <p className="lede">You are signed in as {email}. Accept to join this organization.</p>}
      <FormError message={error} />
      <p className="form-help">You will enrol an authenticator app before any firm data is shown.</p>
      <button className="button primary" disabled={busy || !hydrated} type="submit">{busy ? "Joining…" : "Accept invitation"}<ArrowRight size={15} /></button>
    </form>
  );
}
