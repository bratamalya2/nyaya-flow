"use client";

import { ShieldCheck } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { callApi } from "@/lib/client-api";

type Setup = { qrCode?: string; manualKey?: string; alreadyEnabled?: boolean };

export function MfaSetup() {
  const router = useRouter();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void callApi<Setup>("/api/v1/auth/mfa/setup", { method: "POST", body: { action: "start" } }).then((result) => {
      if (!result.ok) { setError(result.error); return; }
      if (result.data.alreadyEnabled) router.replace("/today"); else setSetup(result.data);
    });
  }, [router]);
  async function verify(formData: FormData) {
    setError(null);
    const result = await callApi("/api/v1/auth/mfa/setup", { method: "POST", body: { action: "confirm", code: String(formData.get("code") ?? "") } });
    if (!result.ok) { setError(result.error); return; }
    router.replace("/today");
    router.refresh();
  }
  return <form action={verify}>
    <p className="lede">Scan this QR code with your authenticator app. MFA is required before firm data becomes accessible.</p>
    {setup?.qrCode ? <div style={{ textAlign: "center", margin: "18px 0" }}><Image src={setup.qrCode} alt="Authenticator setup QR code" width={190} height={190} unoptimized /><p className="tabular muted" style={{ wordBreak: "break-all" }}>Manual key: {setup.manualKey}</p></div> : <p>{error ? "" : "Preparing secure setup…"}</p>}
    <div className="field"><label htmlFor="code">SIX-DIGIT CODE</label><input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></div>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <button className="button primary" disabled={!setup?.qrCode} type="submit"><ShieldCheck size={15} />Enable MFA</button>
  </form>;
}
