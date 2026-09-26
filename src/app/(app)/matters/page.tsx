import { BriefcaseBusiness } from "lucide-react";
import { Suspense } from "react";
import { MattersWorkspace } from "@/components/matters-workspace";
import { demoMode, listMatters, workspaceContext } from "@/lib/repositories/workspace";

export const metadata = { title: "Matters" };

export default async function MattersPage() {
  const [matters, context] = await Promise.all([listMatters(), workspaceContext()]);
  return <div className="page">
    <header className="page-heading"><div><p className="eyebrow"><BriefcaseBusiness size={13} /> Matter registry</p><h1>Matters 360</h1><p className="lede">Authorized matters, parties, case identifiers, assignments, and source state.</p></div></header>
    <Suspense><MattersWorkspace initialMatters={matters} organizationId={context.organizationId} demoMode={demoMode()} /></Suspense>
  </div>;
}
