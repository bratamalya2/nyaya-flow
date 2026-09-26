import Image from "next/image";
import { connection } from "next/server";
import { SignInForm } from "@/components/sign-in-form";
import { isDemoMode } from "@/lib/runtime";

export const metadata = { title: "Sign in" };

export default async function SignInPage() {
  // Demo mode is a runtime flag; render per request so a build never freezes it.
  await connection();
  const demoMode = isDemoMode();
  return <main className="auth-page" id="main">
    <section className="auth-brand"><Image src="/logo.png" alt="NyayaFlow" width={220} height={73} priority /><div><p className="eyebrow" style={{ color: "#84d2e2" }}>India-hosted litigation workspace</p><h1>Every matter, hearing and document—with its source in view.</h1><p>Secure daily operations for small litigation teams, designed around matter-level access and human verification.</p></div><div className="auth-proof"><span>Private document storage</span><span>Matter-level grants</span><span>English + Hindi OCR</span><span>Tamper-evident audit</span></div></section>
    <section className="auth-panel"><div className="card auth-card"><p className="eyebrow">Operator-provisioned access</p><h2>Welcome back</h2><p className="lede">Sign in to your firm workspace.</p>{demoMode ? <div className="preview-banner" style={{ marginTop: 16 }}>Demo mode is enabled. Everything you see is synthetic and nothing is saved.</div> : null}<SignInForm demoMode={demoMode} /></div></section>
  </main>;
}
