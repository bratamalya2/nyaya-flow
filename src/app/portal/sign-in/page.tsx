import { LockKeyhole } from "lucide-react";
import { PortalAuthForm } from "@/components/portal-auth-form";
export const metadata = { title: "Client Portal sign in" };
export default function PortalSignIn() { return <main className="auth-page" id="main"><section className="auth-brand"><p className="eyebrow" style={{ color: "#84d2e2" }}><LockKeyhole size={13} /> NyayaFlow Client Portal</p><h1>Approved case updates, in one private place.</h1><p>Your counsel controls what is shared. Emails and external messaging are not enabled.</p></section><section className="auth-panel"><div className="card auth-card"><p className="eyebrow">Client access</p><h2>Sign in</h2><p className="lede">Use the password created from your staff-provided activation link.</p><PortalAuthForm /></div></section></main>; }
