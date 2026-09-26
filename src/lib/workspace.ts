import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getSession, requireSession, type AppSession } from "@/lib/auth";
import { withActor } from "@/lib/db";
import { DEMO_ORGANIZATION_ID, isDemoMode } from "@/lib/runtime";
import type { AppRole } from "@/lib/types";

export const ORG_COOKIE = "nf_org";

export interface Membership {
  organizationId: string;
  organizationName: string;
  role: AppRole;
}

export interface Workspace {
  session: AppSession;
  userId: string;
  organizationId: string;
  organizationName: string;
  role: AppRole;
  memberships: Membership[];
}

/** The signed-in user's active organization, chosen by the nf_org cookie among active memberships. */
export const getWorkspace = cache(async (): Promise<Workspace | null> => {
  const session = await getSession();
  if (!session) return null;
  if (isDemoMode()) {
    const membership: Membership = { organizationId: DEMO_ORGANIZATION_ID, organizationName: "Iyer & Rao Chambers (demo)", role: "managing_partner" };
    return { session, userId: session.userId, ...membership, memberships: [membership] };
  }
  const result = await withActor(session.userId, (client) => client.query<{ organization_id: string; name: string; role: AppRole }>(
    `select m.organization_id, o.name, m.role from memberships m join organizations o on o.id = m.organization_id
     where m.user_id = $1 and m.active order by o.name`,
    [session.userId],
  ));
  const memberships = result.rows.map((row) => ({ organizationId: row.organization_id, organizationName: row.name, role: row.role }));
  if (!memberships.length) return null;
  const preferred = (await cookies()).get(ORG_COOKIE)?.value;
  const active = memberships.find((membership) => membership.organizationId === preferred) ?? memberships[0];
  return { session, userId: session.userId, ...active, memberships };
});

export async function requireWorkspace() {
  await requireSession();
  const workspace = await getWorkspace();
  if (!workspace) redirect("/no-access");
  return workspace;
}
