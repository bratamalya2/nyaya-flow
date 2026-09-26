import type { DocumentStatus, SourceState } from "@/lib/types";

export function StatusBadge({ value }: { value: SourceState | DocumentStatus | string }) {
  const label = value.replaceAll("_", " ");
  return <span className={`status-badge ${value}`}>{label}</span>;
}
