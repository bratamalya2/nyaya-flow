import type { ComponentType, ReactNode } from "react";

// Building blocks for the static roadmap previews. Everything renders on the server with no client
// state; every action is a disabled control so the previews cannot be mistaken for working features.

export type Tone = "verified" | "stale" | "conflict" | "manual";

export function Chip({ tone = "manual", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`status-badge ${tone}`}>{children}</span>;
}

export function DisabledAction({ children, variant = "default", icon: Icon }: { children: ReactNode; variant?: "default" | "primary" | "teal"; icon?: ComponentType<{ size?: number }> }) {
  const style = variant === "primary" ? "primary" : variant === "teal" ? "teal-button" : "";
  return <button className={`button ${style}`} disabled title="Preview only — not connected" type="button">{Icon ? <Icon size={13} /> : null}{children}</button>;
}

export function Panel({ eyebrow, title, icon: Icon, aside, children, className = "" }: { eyebrow?: string; title: string; icon?: ComponentType<{ size?: number }>; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card pv-panel ${className}`}>
      <div className="section-heading">
        <div>{eyebrow ? <p className="eyebrow">{Icon ? <Icon size={13} /> : null}{eyebrow}</p> : null}<h2>{title}</h2></div>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Kpi({ label, value, hint, tone, bar }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone; bar?: number }) {
  return (
    <div className={`card pv-kpi ${tone ? `pv-kpi-${tone}` : ""}`}>
      <span className="metric-label">{label}</span>
      <strong className="tabular">{value}</strong>
      {hint ? <p>{hint}</p> : null}
      {bar !== undefined ? <Bar value={bar} tone={tone} /> : null}
    </div>
  );
}

export function Bar({ value, tone = "verified" }: { value: number; tone?: Tone }) {
  return <div className="pv-bar" role="img" aria-label={`${value}%`}><span className={`pv-fill-${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

export function StackedBar({ parts }: { parts: { value: number; tone: Tone; label: string }[] }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0) || 1;
  return (
    <div className="pv-stack" role="img" aria-label={parts.map((part) => `${part.label} ${part.value}`).join(", ")}>
      {parts.map((part) => <span className={`pv-fill-${part.tone}`} key={part.label} style={{ width: `${(part.value / total) * 100}%` }} />)}
    </div>
  );
}

export function StaticField({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <label className={`field pv-field ${wide ? "span-2" : ""}`}>
      <span>{label}</span>
      <input disabled readOnly value={value} />
    </label>
  );
}

export function DataTable({ columns, rows, align = [] }: { columns: string[]; rows: ReactNode[][]; align?: ("left" | "right" | "center")[] }) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead><tr>{columns.map((column, index) => <th key={column} style={{ textAlign: align[index] ?? "left" }}>{column}</th>)}</tr></thead>
        <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, index) => <td className={align[index] === "right" ? "tabular" : undefined} key={index} style={{ textAlign: align[index] ?? "left" }}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function SegmentLinks({ items, active, label }: { items: { key: string; label: string; href: string }[]; active: string; label: string }) {
  return (
    <nav aria-label={label} className="segmented pv-segments">
      {items.map((item) => <a aria-current={item.key === active ? "true" : undefined} className={item.key === active ? "active" : ""} href={item.href} key={item.key}>{item.label}</a>)}
    </nav>
  );
}

export function Fact({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return <div className="pv-fact"><span>{label}</span><strong>{value}</strong>{sub ? <small>{sub}</small> : null}</div>;
}

export function Note({ children, tone = "stale" }: { children: ReactNode; tone?: Tone }) {
  return <p className={`pv-note pv-note-${tone}`}>{children}</p>;
}
