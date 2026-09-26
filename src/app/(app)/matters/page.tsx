import { BriefcaseBusiness } from "lucide-react";
import { Suspense } from "react";
import { MattersWorkspace } from "@/components/matters-workspace";
import { canEditMatters, canManageMatters } from "@/lib/permissions";
import { listMatters, listMembers } from "@/lib/repositories/workspace";
import { isDemoMode } from "@/lib/runtime";
import { requireWorkspace } from "@/lib/workspace";

export const metadata = { title: "Matters" };

export default async function MattersPage() {
  const workspace = await requireWorkspace();
  const [matters, members] = await Promise.all([listMatters(workspace), listMembers(workspace)]);
  return <div className="page">
    <header className="page-heading"><div><p className="eyebrow"><BriefcaseBusiness size={13} /> Matter registry</p><h1>Matters 360</h1><p className="lede">Matters you are authorized to see, with case identifiers, leads, next listings, and source state.</p></div></header>
    <Suspense>
      <MattersWorkspace
        canCreate={canEditMatters(workspace.role)}
        canCreateRestricted={canManageMatters(workspace.role)}
        currentUserId={workspace.userId}
        demoMode={isDemoMode()}
        initialMatters={matters}
        members={members.filter((member) => member.active)}
      />
    </Suspense>
  </div>;
}
