"use client";

import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export function MfaSetup() {
  const router = useRouter();
  const [setup, setSetup] = useState<{ qrCode: string; manualKey: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { fetch("/api/v1/auth/mfa/setup").then((response) => response.json()).then((value) => value.alreadyEnabled ? router.replace("/today") : setSetup(value)).catch(() => setError("Could not start MFA setup.")); }, [router]);
  async function verify(formData: FormData) {
    setError(null);
    const response = await fetch("/api/v1/auth/mfa/setup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: formData.get("code") }) });
    const value = await response.json();
    if (!response.ok) { setError(value.error); return; }
    router.replace("/today"); router.refresh();
  }
  return <form action={verify}>
    <p className="lede">Scan this QR code with your authenticator. MFA is required before firm data becomes accessible.</p>
    {setup ? <div style={{ textAlign: "center", margin: "18px 0" }}><Image src={setup.qrCode} alt="NyayaFlow authenticator QR code" width={190} height={190} unoptimized /><p className="tabular muted" style={{ wordBreak: "break-all" }}>Manual key: {setup.manualKey}</p></div> : <p>Preparing secure setup…</p>}
    <div className="field"><label htmlFor="code">SIX-DIGIT CODE</label><input id="code" name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required /></div>
    {error ? <p className="danger" role="alert">{error}</p> : null}
    <button className="button primary" disabled={!setup} type="submit"><ShieldCheck size={15} />Enable MFA</button>
  </form>;
}
