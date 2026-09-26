import { MfaSetup } from "@/components/mfa-setup";
import { requireSession } from "@/lib/auth";
import Image from "next/image";

export const metadata = { title: "Set up MFA" };
export default async function MfaPage() {
  await requireSession({ allowUnverified: true });
  return <main className="auth-page"><section className="auth-brand"><Image src="/logo.png" alt="NyayaFlow" width={220} height={73} priority /><div><p className="eyebrow" style={{ color: "#84d2e2" }}>Required security step</p><h1>Protect privileged matter access.</h1><p>Every staff account must verify a time-based one-time password before entering the workspace.</p></div></section><section className="auth-panel"><div className="card auth-card"><p className="eyebrow">Authenticator setup</p><h2>Enable multi-factor authentication</h2><MfaSetup /></div></section></main>;
}
