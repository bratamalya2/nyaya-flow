"use client";

import {
  Bell, BookOpen, BriefcaseBusiness, CalendarDays, ChartNoAxesCombined, FileCheck2, Files, FolderLock, Gavel, LayoutDashboard,
  Landmark, PlusCircle, ReceiptIndianRupee, ShieldCheck, Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { GlobalSearch } from "@/components/global-search";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { UserMenu } from "@/components/user-menu";

type NavItem = { href: string; label: string; icon: ComponentType<{ size?: number }>; preview?: boolean };

const core: NavItem[] = [
  { href: "/command-centre", label: "Command Centre", icon: LayoutDashboard },
  { href: "/today", label: "Today & Cause List", icon: CalendarDays },
  { href: "/matters", label: "Matters 360", icon: BriefcaseBusiness },
  { href: "/vault", label: "Smart Vault & OCR", icon: FolderLock },
  { href: "/research", label: "Precedent Research", icon: BookOpen },
  { href: "/bns", label: "BNS / BNSS Matrix", icon: Landmark },
  { href: "/filing", label: "E-Filing Suite", icon: FileCheck2 },
  { href: "/contracts", label: "Contracts & CLM", icon: Files },
  { href: "/clients", label: "Client Portal", icon: Users },
  { href: "/billing", label: "Finance & Billing", icon: ReceiptIndianRupee },
  { href: "/analytics", label: "Portfolio Analytics", icon: ChartNoAxesCombined },
  { href: "/admin", label: "Firm Admin & Privacy", icon: ShieldCheck },
];

const previews: NavItem[] = [];

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;
  return (
    <Link aria-current={active ? "page" : undefined} className={`nav-link ${active ? "active" : ""} ${item.preview ? "preview-link" : ""}`} href={item.href}>
      <Icon size={18} />
      <span>{item.label}</span>
      {item.preview ? <span className="preview-dot">Preview</span> : null}
    </Link>
  );
}

export interface ShellProps {
  children: ReactNode;
  user: { name: string; initials: string; roleLabel: string; email: string };
  organization: { id: string; name: string };
  memberships: { organizationId: string; organizationName: string; roleLabel: string }[];
  demoMode: boolean;
}

export function AppShell({ children, user, organization, memberships, demoMode }: ShellProps) {
  const pathname = usePathname();
  return (
    <div className="app-layout">
      <header className="topbar">
        <div className="brand">
          <Image src="/favicon.png" alt="NyayaFlow" width={38} height={33} priority />
          <div><span className="brand-word">NyayaFlow</span></div>
          <div className="firm-label"><strong>{organization.name}</strong><span>{demoMode ? "Synthetic demo workspace" : "Firm workspace"}</span></div>
        </div>
        <GlobalSearch />
        <div className="top-actions">
          <ThemeSwitcher />
          <button className="icon-button" aria-label="Notifications (not yet available)" disabled title="Notifications arrive with the Expansion release" type="button"><Bell size={18} /></button>
          <UserMenu memberships={memberships} organizationId={organization.id} user={user} />
        </div>
      </header>
      <aside className="sidebar">
        <Link className="new-matter" href="/matters?create=true"><PlusCircle size={15} style={{ verticalAlign: "-3px", marginRight: 6 }} />New Matter</Link>
        <nav className="sidebar-nav" aria-label="Primary navigation">
          <div className="nav-label">Workspace</div>
          {core.map((item) => <NavLink key={item.href} item={item} />)}
          {previews.length ? <><div className="nav-label">Roadmap previews</div>{previews.map((item) => <NavLink key={item.href} item={item} />)}</> : null}
        </nav>
        <div className="sidebar-foot">
          <div className="policy-state">Manual-source mode</div>
          <p>No live court connector is enabled. Court dates are entered by your team.</p>
        </div>
      </aside>
      <main className="page-shell" id="main">{children}</main>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {[
          { href: "/today", label: "Today", icon: Gavel },
          { href: "/matters", label: "Matters", icon: BriefcaseBusiness },
          { href: "/vault", label: "Vault", icon: FolderLock },
          { href: "/admin", label: "Admin", icon: ShieldCheck },
          { href: "/research", label: "Research", icon: BookOpen },
          { href: "/billing", label: "Billing", icon: ReceiptIndianRupee },
          { href: "/analytics", label: "Analytics", icon: ChartNoAxesCombined },
        ].map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href.replace(/\/research$/, "")}/`);
          return <Link aria-current={active ? "page" : undefined} className={`mobile-link ${active ? "active" : ""}`} href={item.href} key={item.href}><Icon size={19} /><span>{item.label}</span></Link>;
        })}
      </nav>
    </div>
  );
}
