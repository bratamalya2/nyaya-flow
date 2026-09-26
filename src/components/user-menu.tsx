"use client";

import { Building2, Check, ChevronDown, LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { callApi } from "@/lib/client-api";

type MenuProps = {
  user: { name: string; initials: string; roleLabel: string; email: string };
  organizationId: string;
  memberships: { organizationId: string; organizationName: string; roleLabel: string }[];
};

export function UserMenu({ user, organizationId, memberships }: MenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); };
  }, [open]);

  async function switchOrganization(id: string) {
    if (id === organizationId) return;
    const result = await callApi("/api/v1/session/organization", { method: "POST", body: { organizationId: id } });
    if (!result.ok) { setError(result.error); return; }
    setOpen(false);
    router.push("/today");
    router.refresh();
  }

  return (
    <div className="user-menu" ref={ref}>
      <button aria-expanded={open} aria-haspopup="menu" className="user" onClick={() => setOpen((value) => !value)} type="button">
        <div className="avatar">{user.initials}</div>
        <div className="user-copy"><strong>{user.name}</strong><span>{user.roleLabel}</span></div>
        <ChevronDown size={14} className="muted" />
      </button>
      {open ? (
        <div className="menu-panel card" role="menu">
          <div className="menu-head"><strong>{user.name}</strong><span>{user.email}</span></div>
          {memberships.length > 1 ? (
            <div className="menu-section">
              <p className="nav-label">Organizations</p>
              {memberships.map((membership) => (
                <button className="menu-item" key={membership.organizationId} onClick={() => void switchOrganization(membership.organizationId)} role="menuitem" type="button">
                  <Building2 size={14} /><span>{membership.organizationName}<small>{membership.roleLabel}</small></span>
                  {membership.organizationId === organizationId ? <Check size={14} className="teal" /> : null}
                </button>
              ))}
            </div>
          ) : null}
          <div className="menu-section">
            <Link className="menu-item" href="/account" onClick={() => setOpen(false)} role="menuitem"><ShieldCheck size={14} /><span>Security & sessions</span></Link>
            <form action="/api/v1/auth/sign-out" method="post">
              <button className="menu-item" role="menuitem" type="submit"><LogOut size={14} /><span>Sign out</span></button>
            </form>
          </div>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
