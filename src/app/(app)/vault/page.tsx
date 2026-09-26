import { FolderLock } from "lucide-react";
import { VaultWorkspace } from "@/components/vault-workspace";
import { canEditMatters } from "@/lib/permissions";
import { listDocuments, listMatters } from "@/lib/repositories/workspace";
import { isDemoMode } from "@/lib/runtime";
import { requireWorkspace } from "@/lib/workspace";

export const metadata = { title: "Smart Vault" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function VaultPage({ searchParams }: { searchParams: Promise<{ matter?: string; q?: string }> }) {
  const workspace = await requireWorkspace();
  const params = await searchParams;
  const matterId = params.matter && UUID.test(params.matter) ? params.matter : undefined;
  const [documents, matters] = await Promise.all([listDocuments(workspace, { matterId }), listMatters(workspace)]);
  const selected = matters.find((matter) => matter.id === matterId);
  return <div className="page">
    <header className="page-heading"><div><p className="eyebrow"><FolderLock size={13} /> Private document repository</p><h1>Smart Vault & OCR</h1><p className="lede">{selected ? `Documents for ${selected.reference} — ${selected.title}.` : "Immutable versions, controlled access, page-level English/Hindi OCR, and organization-scoped search."}</p></div></header>
    <VaultWorkspace canEdit={canEditMatters(workspace.role)} demoMode={isDemoMode()} initialDocuments={documents} initialQuery={params.q?.slice(0, 200) ?? ""} matters={matters} selectedMatterId={selected?.id} />
  </div>;
}
