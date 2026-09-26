"use client";

import {
  Bell,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronDown,
  FileCheck2,
  Files,
  FolderLock,
  Gavel,
  HelpCircle,
  Landmark,
  Menu,
  PlusCircle,
  ReceiptIndianRupee,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { ThemeSwitcher } from "@/components/theme-switcher";

type NavItem = { href: string; label: string; icon: ComponentType<{ size?: number }>; preview?: boolean };

const core: NavItem[] = [
  { href: "/today", label: "Today & Cause List", icon: CalendarDays },
  { href: "/matters", label: "Matters 360", icon: BriefcaseBusiness },
  { href: "/vault", label: "Smart Vault & OCR", icon: FolderLock },
  { href: "/admin", label: "Firm Admin & Privacy", icon: ShieldCheck },
];

const previews: NavItem[] = [
  { href: "/preview/research", label: "Precedent Research", icon: BookOpen, preview: true },
  { href: "/preview/bns", label: "BNS / BNSS Matrix", icon: Landmark, preview: true },
  { href: "/preview/filing", label: "E-Filing Suite", icon: FileCheck2, preview: true },
  { href: "/preview/client", label: "Client Portal", icon: Users, preview: true },
  { href: "/preview/billing", label: "Finance & Billing", icon: ReceiptIndianRupee, preview: true },
  { href: "/preview/contracts", label: "Contracts & CLM", icon: Files, preview: true },
  { href: "/preview/analytics", label: "Portfolio Analytics", icon: ChartNoAxesCombined, preview: true },
];

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = pathname === item.href || (item.href !== "/today" && pathname.startsWith(`${item.href}/`));
  const Icon = item.icon;
  return (
    <Link className={`nav-link ${active ? "active" : ""} ${item.preview ? "preview-link" : ""}`} href={item.href}>
      <Icon size={18} />
      <span>{item.label}</span>
      {item.preview ? <span className="preview-dot">Preview</span> : null}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="app-layout">
      <header className="topbar">
        <div className="brand">
          <Image src="/favicon.png" alt="NyayaFlow" width={38} height={34} priority />
          <div><span className="brand-word">NyayaFlow</span> <span className="brand-chip">IN CORE</span></div>
          <div className="firm-label"><strong>Sen & Deshmukh Chambers</strong><span>New Delhi · Pilot workspace</span></div>
        </div>
        <div className="global-search">
          <Search size={17} aria-hidden="true" />
          <input aria-label="Search matters and documents" placeholder="Search matters, CNRs and documents…" />
          <kbd>⌘ K</kbd>
        </div>
        <div className="top-actions">
          <ThemeSwitcher />
          <button className="icon-button" aria-label="Notifications" type="button"><Bell size={18} /></button>
          <button className="icon-button" aria-label="Help" type="button"><HelpCircle size={18} /></button>
          <div className="user">
            <div className="avatar">VS</div>
            <div className="user-copy"><strong>Adv. Vikram Sen</strong><span>Managing Partner</span></div>
            <ChevronDown size={14} className="muted" />
          </div>
        </div>
      </header>
      <aside className="sidebar">
        <Link className="new-matter" href="/matters?create=true"><PlusCircle size={15} style={{ verticalAlign: "-3px", marginRight: 6 }} />New Matter</Link>
        <nav className="sidebar-nav" aria-label="Primary navigation">
          <div className="nav-label">Workspace</div>
          {core.map((item) => <NavLink key={item.href} item={item} />)}
          <div className="nav-label">Roadmap previews</div>
          {previews.map((item) => <NavLink key={item.href} item={item} />)}
        </nav>
        <div className="sidebar-foot">
          <div className="policy-state">Manual-source mode</div>
          <p>No live court connector enabled · India-hosted pilot</p>
        </div>
      </aside>
      <main className="page-shell">{children}</main>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {[
          { href: "/today", label: "Today", icon: Gavel },
          { href: "/matters", label: "Matters", icon: BriefcaseBusiness },
          { href: "/vault", label: "Vault", icon: FolderLock },
          { href: "/admin", label: "Admin", icon: ShieldCheck },
          { href: "/preview/research", label: "Preview", icon: Menu },
        ].map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return <Link className={`mobile-link ${active ? "active" : ""}`} href={item.href} key={item.href}><Icon size={19} /><span>{item.label}</span></Link>;
        })}
      </nav>
    </div>
  );
}
