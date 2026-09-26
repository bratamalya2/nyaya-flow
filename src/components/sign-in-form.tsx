"use client";

import { ArrowRight, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { callApi, submitWith } from "@/lib/client-api";

type SignInResult = { authenticated?: boolean; mfaRequired?: boolean; challenge?: string; mfaSetupRequired?: boolean };

export function SignInForm({ demoMode }: { demoMode: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setError(null);
    setLoading(true);
    if (demoMode) {
      router.push("/today");
      return;
    }
    const result = challenge
      ? await callApi<SignInResult>("/api/v1/auth/mfa/verify", { method: "POST", body: { challenge, code: String(formData.get("code")) } })
      : await callApi<SignInResult>("/api/v1/auth/sign-in", { method: "POST", body: { email: String(formData.get("email")), password: String(formData.get("password")) } });
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      if (challenge && result.status === 401 && /expired/i.test(result.error)) setChallenge(null);
      return;
    }
    if (result.data.mfaRequired && result.data.challenge) { setChallenge(result.data.challenge); setLoading(false); return; }
    router.push(result.data.mfaSetupRequired ? "/mfa" : "/today");
    router.refresh();
  }

  return <form onSubmit={submitWith(submit)}>
    {!challenge ? <><div className="field"><label htmlFor="email">WORK EMAIL</label><input id="email" name="email" type="email" autoComplete="email" defaultValue={demoMode ? "advocate@demo.nyayaflow.test" : ""} required /></div>
    <div className="field"><label htmlFor="password">PASSWORD</label><input id="password" name="password" type="password" autoComplete="current-password" defaultValue={demoMode ? "demo-access-only" : ""} required /></div></> : <div className="field"><label htmlFor="code">AUTHENTICATOR CODE</label><input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus /></div>}
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <p className="form-help"><LockKeyhole size={12} style={{ verticalAlign: "-2px" }} /> Staff MFA is required after password verification. Access also requires an active firm membership.</p>
    <button className="button primary" disabled={loading} type="submit">{loading ? "Verifying…" : demoMode ? "Enter synthetic demo" : challenge ? "Verify code" : "Continue securely"}<ArrowRight size={15} /></button>
  </form>;
}
