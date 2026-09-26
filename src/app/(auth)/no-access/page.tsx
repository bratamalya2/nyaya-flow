import Image from "next/image";
import { requireSession } from "@/lib/auth";

export const metadata = { title: "No active membership" };

export default async function NoAccessPage() {
  const session = await requireSession();
  return <main className="auth-page" id="main">
    <section className="auth-brand"><Image src="/logo.png" alt="NyayaFlow" width={220} height={73} priority /><div><p className="eyebrow" style={{ color: "#84d2e2" }}>Access</p><h1>Your account is not active in any firm workspace.</h1></div></section>
    <section className="auth-panel"><div className="card auth-card">
      <h2>No active membership</h2>
      <p className="lede">{session.email} signed in successfully, but no organization currently lists this account as an active member. Ask an owner or admin to invite or reactivate you.</p>
      <form action="/api/v1/auth/sign-out" method="post" style={{ marginTop: 18 }}><button className="button" type="submit">Sign out</button></form>
    </div></section>
  </main>;
}
