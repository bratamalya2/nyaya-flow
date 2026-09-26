import { FolderLock } from "lucide-react";
import { VaultWorkspace } from "@/components/vault-workspace";
import { demoMode, listDocuments, listMatters, workspaceContext } from "@/lib/repositories/workspace";

export const metadata = { title: "Smart Vault" };

export default async function VaultPage() {
  const [documents, matters, context] = await Promise.all([listDocuments(), listMatters(), workspaceContext()]);
  return <div className="page"><header className="page-heading"><div><p className="eyebrow"><FolderLock size={13} /> Private document repository</p><h1>Smart Vault & OCR</h1><p className="lede">Immutable versions, controlled access, page-level English/Hindi OCR, and tenant-scoped search.</p></div><div className="actions"><button className="button" type="button">Export authorized index</button></div></header><VaultWorkspace initialDocuments={documents} matters={matters} organizationId={context.organizationId} demoMode={demoMode()} /></div>;
}
