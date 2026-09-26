import { LogOut, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { OperatorsConsole } from "@/components/platform/operators-console";
import { requirePlatformSession } from "@/lib/platform";
import { listPlatformOrganizations } from "@/lib/repositories/platform";

export const metadata = { title: "Platform" };

export default async function PlatformPage() {
  const session = await requirePlatformSession();
  const organizations = await listPlatformOrganizations();
  return <div className="platform-shell">
    <header className="platform-bar">
      <div className="brand"><Image src="/favicon.png" alt="NyayaFlow" width={34} height={30} style={{ width: 34, height: "auto" }} /><span className="brand-word">NyayaFlow</span><span className="brand-chip">PLATFORM</span></div>
      <div className="actions">
        <span className="secondary" style={{ fontSize: 11 }}><ShieldCheck size={12} style={{ verticalAlign: "-2px" }} /> {session.email}</span>
        <form action="/api/v1/auth/platform/sign-out" method="post"><button className="button small" type="submit"><LogOut size={12} />Sign out</button></form>
      </div>
    </header>
    <main className="page" id="main">
      <header className="page-heading"><div><p className="eyebrow">Platform administration</p><h1>Operators</h1><p className="lede">Each operator is a firm workspace with its own members, matters, documents, and audit chain, isolated by PostgreSQL row-level security.</p></div></header>
      <OperatorsConsole organizations={organizations} />
    </main>
  </div>;
}
