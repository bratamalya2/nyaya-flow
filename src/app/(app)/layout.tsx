import { AppShell } from "@/components/app-shell";
import { initialsOf } from "@/lib/repositories/workspace";
import { roleLabel } from "@/lib/permissions";
import { isDemoMode } from "@/lib/runtime";
import { requireWorkspace } from "@/lib/workspace";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const workspace = await requireWorkspace();
  const { session } = workspace;
  return (
    <AppShell
      demoMode={isDemoMode()}
      memberships={workspace.memberships.map((membership) => ({ organizationId: membership.organizationId, organizationName: membership.organizationName, roleLabel: roleLabel(membership.role) }))}
      organization={{ id: workspace.organizationId, name: workspace.organizationName }}
      user={{ name: session.displayName, initials: initialsOf(session.displayName), roleLabel: roleLabel(workspace.role), email: session.email }}
    >
      {children}
    </AppShell>
  );
}
