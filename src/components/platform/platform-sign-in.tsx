"use client";

import { ArrowRight, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/ui/modal";
import { callApi, submitWith } from "@/lib/client-api";
import { useHydrated } from "@/lib/use-hydrated";

export function PlatformSignIn() {
  const router = useRouter();
  const hydrated = useHydrated();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(data: FormData) {
    setError(null);
    setBusy(true);
    const result = await callApi("/api/v1/auth/platform/sign-in", { method: "POST", body: { email: data.get("email"), password: data.get("password"), code: data.get("code") } });
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    router.replace("/platform");
    router.refresh();
  }
  return (
    <form method="post" onSubmit={submitWith(submit)}>
      <div className="field"><label htmlFor="email">SUPERADMIN EMAIL</label><input autoComplete="username" id="email" name="email" required type="email" /></div>
      <div className="field"><label htmlFor="password">PASSWORD</label><input autoComplete="current-password" id="password" name="password" required type="password" /></div>
      <div className="field"><label htmlFor="code">AUTHENTICATOR CODE</label><input autoComplete="one-time-code" id="code" inputMode="numeric" maxLength={6} name="code" pattern="[0-9]{6}" required /></div>
      <FormError message={error} />
      <p className="form-help"><ShieldCheck size={12} style={{ verticalAlign: "-2px" }} /> Platform access is logged. Sessions end after 30 minutes of inactivity.</p>
      <button className="button primary" disabled={busy || !hydrated} type="submit">{busy ? "Verifying…" : "Sign in"}<ArrowRight size={15} /></button>
    </form>
  );
}
