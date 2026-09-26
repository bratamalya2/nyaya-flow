import { SignInForm } from "@/components/sign-in-form";
import Image from "next/image";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  return <main className="auth-page">
    <section className="auth-brand"><Image src="/logo.png" alt="NyayaFlow" width={220} height={73} priority /><div><p className="eyebrow" style={{ color: "#84d2e2" }}>India-hosted litigation workspace</p><h1>Every matter, hearing and document—with its source in view.</h1><p>Secure daily operations for small litigation teams, designed around matter-level access and human verification.</p></div><div className="auth-proof"><span>Private Storage</span><span>Matter-level grants</span><span>English + Hindi OCR</span><span>Tamper-evident audit</span></div></section>
    <section className="auth-panel"><div className="card auth-card"><p className="eyebrow">Operator-provisioned access</p><h2>Welcome back</h2><p className="lede">Sign in to your firm workspace.</p>{demoMode ? <div className="preview-banner" style={{ marginTop: 16 }}>Demo mode is enabled. The prefilled account uses synthetic data.</div> : null}<SignInForm /></div></section>
  </main>;
}
