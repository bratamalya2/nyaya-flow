import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { PlatformSignIn } from "@/components/platform/platform-sign-in";
import { getPlatformSession, isPlatformEnabled } from "@/lib/platform";

export const metadata = { title: "Platform sign-in" };

export default async function PlatformSignInPage() {
  await connection();
  if (!isPlatformEnabled()) notFound();
  if (await getPlatformSession()) redirect("/platform");
  return <main className="auth-page" id="main">
    <section className="auth-brand"><Image src="/logo.png" alt="NyayaFlow" width={220} height={73} priority /><div><p className="eyebrow" style={{ color: "#84d2e2" }}>Platform administration</p><h1>Create and manage firm workspaces.</h1><p>The platform console shows organization metadata only. It never opens matters, documents, or firm audit contents.</p></div></section>
    <section className="auth-panel"><div className="card auth-card"><p className="eyebrow">Superadmin</p><h2>Platform sign-in</h2><PlatformSignIn /></div></section>
  </main>;
}
