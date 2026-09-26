"use client";

import { ArrowRight, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignInForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  async function submit(formData: FormData) {
    setError(null);
    setLoading(true);
    if (demoMode) {
      router.push("/today");
      return;
    }
    const endpoint = challenge ? "/api/v1/auth/mfa/verify" : "/api/v1/auth/sign-in";
    const payload = challenge
      ? { challenge, code: String(formData.get("code")) }
      : { email: String(formData.get("email")), password: String(formData.get("password")) };
    const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok) { setError(result.error || "Sign-in failed."); setLoading(false); return; }
    if (result.mfaRequired) { setChallenge(result.challenge); setLoading(false); return; }
    router.push(result.mfaSetupRequired ? "/mfa" : "/today");
    router.refresh();
  }

  return <form action={submit}>
    {!challenge ? <><div className="field"><label htmlFor="email">WORK EMAIL</label><input id="email" name="email" type="email" autoComplete="email" defaultValue={demoMode ? "vikram@demo.nyayaflow.in" : ""} required /></div>
    <div className="field"><label htmlFor="password">PASSWORD</label><input id="password" name="password" type="password" autoComplete="current-password" defaultValue={demoMode ? "demo-access" : ""} required /></div></> : <div className="field"><label htmlFor="code">AUTHENTICATOR CODE</label><input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus /></div>}
    {error ? <p className="danger" role="alert">{error}</p> : null}
    <p className="form-help"><LockKeyhole size={12} style={{ verticalAlign: "-2px" }} /> Staff MFA is required after password verification. Access also requires an active firm membership.</p>
    <button className="button primary" disabled={loading} type="submit">{loading ? "Verifying…" : demoMode ? "Enter secure demo" : challenge ? "Verify MFA" : "Continue securely"}<ArrowRight size={15} /></button>
  </form>;
}
