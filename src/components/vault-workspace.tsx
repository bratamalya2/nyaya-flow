"use client";

import { AlertTriangle, CheckCircle2, Download, FileScan, FileText, Search, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { FormError, Modal } from "@/components/ui/modal";
import { callApi } from "@/lib/client-api";
import type { Matter, OcrPage, SearchHit, VaultDocument } from "@/lib/types";

const MAX_BYTES = 100 * 1024 * 1024;
const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/tiff"];
const PENDING = new Set(["uploaded", "quarantined", "scanning", "ocr_pending", "processing"]);

interface Props {
  initialDocuments: VaultDocument[];
  matters: Matter[];
  selectedMatterId?: string;
  initialQuery?: string;
  canEdit: boolean;
  demoMode: boolean;
}

/** Renders ts_headline output («match») as highlighted text without injecting HTML. */
function Snippet({ text }: { text: string }) {
  const parts = text.split(/(«[^»]*»)/g);
  return <p className="reading">{parts.map((part, index) => part.startsWith("«") ? <mark key={index}>{part.slice(1, -1)}</mark> : <Fragment key={index}>{part}</Fragment>)}</p>;
}

export function VaultWorkspace({ initialDocuments, matters, selectedMatterId, initialQuery = "", canEdit, demoMode }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  // Server data arrives through props (router.refresh); demo uploads live only in local state.
  const [demoUploads, setDemoUploads] = useState<VaultDocument[]>([]);
  const documents = useMemo(() => [...demoUploads, ...initialDocuments.filter((document) => !demoUploads.some((upload) => upload.documentId === document.documentId))], [demoUploads, initialDocuments]);
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState("all");
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [matterId, setMatterId] = useState(selectedMatterId ?? matters[0]?.id ?? "");
  const [targetDocumentId, setTargetDocumentId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [searchText, setSearchText] = useState(initialQuery);
  const [search, setSearch] = useState<{ term: string; hits?: SearchHit[]; error?: string } | null>(null);
  const [viewer, setViewer] = useState<{ document: VaultDocument; page?: number } | null>(null);

  // Keep processing statuses current without a manual reload.
  const hasPending = documents.some((document) => PENDING.has(document.status));
  useEffect(() => {
    if (!hasPending || demoMode) return;
    const timer = window.setInterval(() => router.refresh(), 8000);
    return () => window.clearInterval(timer);
  }, [hasPending, demoMode, router]);

  const term = searchText.trim();
  useEffect(() => {
    if (term.length < 2) return;
    const timer = window.setTimeout(async () => {
      const result = await callApi<{ data: SearchHit[] }>(`/api/v1/search?q=${encodeURIComponent(term)}`);
      setSearch(result.ok ? { term, hits: result.data.data } : { term, error: result.error });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [term]);
  const current = search?.term === term && term.length >= 2 ? search : null;
  const hits = current?.hits ?? null;
  const searchError = current?.error ?? null;

  const matterById = useMemo(() => new Map(matters.map((matter) => [matter.id, matter])), [matters]);
  const filtered = useMemo(() => documents.filter((document) => {
    const matter = matterById.get(document.matterId);
    const haystack = `${document.title} ${matter?.title ?? ""} ${matter?.reference ?? ""} ${document.classification}`.toLowerCase();
    return haystack.includes(filter.toLowerCase()) && (status === "all" || document.status === status || (status === "processing" && PENDING.has(document.status)));
  }), [documents, matterById, filter, status]);
  const matterDocuments = documents.filter((document) => document.matterId === matterId);

  const selectFile = async (file?: File) => {
    if (!file) return;
    setMessage(null);
    if (!ALLOWED.includes(file.type)) { setMessage({ kind: "error", text: "Unsupported type. Upload PDF, JPEG, PNG, or TIFF only." }); return; }
    if (file.size > MAX_BYTES) { setMessage({ kind: "error", text: "File exceeds the 100 MB upload limit." }); return; }
    if (!matterId) { setMessage({ kind: "error", text: "Select a matter before uploading." }); return; }
    setUploading(true);
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))).map((value) => value.toString(16).padStart(2, "0")).join("");
    const target = documents.find((document) => document.documentId === targetDocumentId);
    if (demoMode) {
      setDemoUploads((current) => [{ id: crypto.randomUUID(), documentId: target?.documentId ?? crypto.randomUUID(), matterId, title: target?.title ?? file.name, version: `v${(target?.versionNumber ?? 0) + 1}.0`, versionNumber: (target?.versionNumber ?? 0) + 1, pages: 0, size: `${(file.size / 1024 / 1024).toFixed(1)} MB`, status: "quarantined", classification: "Unclassified", language: "Unknown", uploadedAt: new Date().toISOString(), uploadedBy: "You", hash: `${digest.slice(0, 4)}…${digest.slice(-4)}` }, ...current.filter((document) => document.documentId !== target?.documentId)]);
      setMessage({ kind: "success", text: `${file.name} entered quarantine (demo — nothing was stored).` });
      setUploading(false);
      return;
    }
    const intent = await callApi<{ uploadUrl: string; versionNumber: number }>("/api/v1/documents/upload-intents", { method: "POST", body: { matterId, documentId: targetDocumentId || undefined, fileName: file.name, mimeType: file.type, sizeBytes: file.size, sha256: digest } });
    if (!intent.ok) { setMessage({ kind: "error", text: intent.error }); setUploading(false); return; }
    try {
      const upload = await fetch(intent.data.uploadUrl, { method: "PUT", headers: { "content-type": file.type }, body: file });
      const body = await upload.json().catch(() => ({}));
      if (!upload.ok) { setMessage({ kind: "error", text: body.error || "Upload failed." }); return; }
      setMessage({ kind: "success", text: `${file.name} (version ${intent.data.versionNumber}) entered quarantine. Malware scan and page validation run before OCR.` });
      setTargetDocumentId("");
      router.refresh();
    } catch {
      setMessage({ kind: "error", text: "Upload interrupted. Check your connection and try again." });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return <>
    <div className="content-grid" style={{ marginBottom: 16 }}>
      <div className="upload-zone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (canEdit) void selectFile(event.dataTransfer.files[0]); }}>
        <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,application/pdf,image/png,image/jpeg,image/tiff" onChange={(event) => void selectFile(event.target.files?.[0])} aria-label="Choose a file to upload" />
        <span>
          <UploadCloud size={25} className="teal" />
          <strong>Drop a court document or choose a file</strong>
          <p>PDF, JPEG, PNG, TIFF · 100 MB · 500 pages · English/Hindi OCR</p>
          <span className="actions" style={{ justifyContent: "center", margin: "10px 0" }}>
            <select aria-label="Matter for upload" value={matterId} onChange={(event) => { setMatterId(event.target.value); setTargetDocumentId(""); }} style={{ maxWidth: 260 }}>
              <option value="">Select matter</option>
              {matters.map((matter) => <option value={matter.id} key={matter.id}>{matter.reference} — {matter.title.slice(0, 40)}</option>)}
            </select>
            <select aria-label="Upload as" value={targetDocumentId} onChange={(event) => setTargetDocumentId(event.target.value)} style={{ maxWidth: 260 }}>
              <option value="">As a new document</option>
              {matterDocuments.map((document) => <option key={document.documentId} value={document.documentId}>New version of {document.title}</option>)}
            </select>
          </span>
          <button className="button" disabled={uploading || !canEdit} onClick={() => fileRef.current?.click()} title={canEdit ? undefined : "Your role cannot upload documents"} type="button">{uploading ? "Securing upload…" : "Choose file"}</button>
        </span>
      </div>
      <div className="card card-pad">
        <p className="eyebrow"><FileScan size={13} /> Processing boundary</p><h2>Private by default</h2>
        <p className="lede">Files stay quarantined until content validation and a malware scan pass. OCR runs on the India-hosted worker, and each version is immutable. Downloads re-check your access on every request.</p>
        <p className="form-help">No document content is sent to external AI services.</p>
      </div>
    </div>
    {message ? <div className={message.kind === "error" ? "form-error" : "form-success"} role={message.kind === "error" ? "alert" : "status"} style={{ display: "flex", gap: 8, alignItems: "center" }}>{message.kind === "error" ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />} {message.text}</div> : null}

    <section aria-labelledby="text-search-heading" className="section-block">
      <div className="section-heading"><div><h2 id="text-search-heading">Search document text</h2><p>Full-text search across OCR output of cleared documents you can access.</p></div></div>
      <div className="global-search" style={{ display: "block", maxWidth: 520, marginBottom: 12, justifySelf: "start" }}>
        <Search size={16} aria-hidden="true" />
        <input aria-label="Search document text" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="e.g. interim order, अग्रिम जमानत, Section 482" />
      </div>
      {searchError ? <FormError message={searchError} /> : null}
      {hits ? (
        <div className="search-results" aria-live="polite">
          {hits.length ? hits.map((hit) => {
            const document = documents.find((item) => item.id === hit.versionId);
            return (
              <article className="card search-hit" key={`${hit.versionId}-${hit.pageNumber}`}>
                <div className="section-heading" style={{ margin: 0 }}>
                  <strong style={{ fontSize: 12 }}><FileText size={12} style={{ verticalAlign: "-2px" }} /> {hit.title} · page {hit.pageNumber}</strong>
                  <span className="muted" style={{ fontSize: 10 }}>{matterById.get(hit.matterId)?.reference}</span>
                </div>
                <Snippet text={hit.snippet} />
                {document ? <div><button className="button small" onClick={() => setViewer({ document, page: hit.pageNumber })} type="button">Open page text</button></div> : null}
              </article>
            );
          }) : <div className="card empty-state">No matches in documents you can access.</div>}
        </div>
      ) : null}
    </section>

    <div className="filters">
      <div className="global-search" style={{ display: "block", maxWidth: 320, marginRight: 6, flex: "0 0 auto", width: 300 }}><Search size={16} aria-hidden="true" /><input aria-label="Filter documents" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter by title or matter…" /></div>
      {["all", "ready", "processing", "blocked", "failed"].map((item) => <button aria-pressed={status === item} className={`filter-chip ${status === item ? "active" : ""}`} key={item} onClick={() => setStatus(item)} type="button">{item === "processing" ? "in progress" : item}</button>)}
      {selectedMatterId ? <Link className="filter-chip" href="/vault">Show all matters ✕</Link> : null}
    </div>
    <div className="card table-card">
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Document & matter</th><th>Version</th><th>Pages / size</th><th>OCR</th><th>Integrity</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{filtered.map((document) => {
            const matter = matterById.get(document.matterId);
            const ready = document.status === "ready";
            return <tr key={document.id}>
              <td className="primary-cell"><strong>{document.title}</strong><span>{matter ? <Link href={`/matters/${matter.id}`}>{matter.reference}</Link> : "—"} · {document.classification} · {document.uploadedBy}</span></td>
              <td><strong>{document.version}</strong><div className="muted">Immutable</div></td>
              <td className="tabular">{document.pages || "—"} / {document.size}</td>
              <td>{document.ocrConfidence ? <><strong className="tabular">{document.ocrConfidence}%</strong><div className="muted">{document.language}</div></> : <span className="muted">{ready ? "No text" : "Pending"}</span>}</td>
              <td className="tabular" title="SHA-256">{document.hash}</td>
              <td><StatusBadge value={document.status} /></td>
              <td><div className="row-actions">
                <button className="button small" disabled={!ready} onClick={() => setViewer({ document })} type="button">Text</button>
                {ready && !demoMode ? <a className="button small" href={`/api/v1/documents/${document.id}/download`}><Download size={11} />Download</a> : <button className="button small" disabled type="button"><Download size={11} />Download</button>}
                {canEdit ? <button className="button small" onClick={() => { setMatterId(document.matterId); setTargetDocumentId(document.documentId); fileRef.current?.click(); }} type="button">New version</button> : null}
              </div></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      {!filtered.length ? <div className="empty-state"><strong>No documents.</strong>{documents.length ? "Adjust the filters." : "Upload the first file for a matter."}</div> : null}
    </div>
    {viewer ? <OcrViewer canEdit={canEdit} demoMode={demoMode} document={viewer.document} focusPage={viewer.page} onClose={() => setViewer(null)} /> : null}
  </>;
}

function OcrViewer({ document, focusPage, canEdit, demoMode, onClose }: { document: VaultDocument; focusPage?: number; canEdit: boolean; demoMode: boolean; onClose: () => void }) {
  const [pages, setPages] = useState<OcrPage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    void callApi<{ data: OcrPage[] }>(`/api/v1/documents/versions/${document.id}/pages`).then((result) => {
      if (result.ok) setPages(result.data.data); else setError(result.error);
    });
  }, [document.id]);
  useEffect(() => {
    if (pages && focusPage) window.document.getElementById(`ocr-page-${focusPage}`)?.scrollIntoView({ block: "start" });
  }, [pages, focusPage]);

  async function save(page: OcrPage, text: string) {
    setError(null);
    if (demoMode) { setError("Demo mode does not save corrections."); return; }
    const result = await callApi(`/api/v1/ocr/pages/${page.id}/corrections`, { method: "POST", body: { correctedText: text } });
    if (!result.ok) { setError(result.error); return; }
    setPages((current) => current?.map((item) => item.id === page.id ? { ...item, correctedText: text } : item) ?? null);
    setEditing(null);
    setSaved(`Page ${page.pageNumber} saved. The original extraction and every correction are kept.`);
  }

  return (
    <Modal eyebrow={`OCR text · ${document.version}`} onClose={onClose} open title={document.title} width={860}>
      {error ? <FormError message={error} /> : null}
      {saved ? <p className="form-success" role="status">{saved}</p> : null}
      {!pages && !error ? <p className="secondary">Loading page text…</p> : null}
      {pages?.length === 0 ? <p className="secondary">No text was extracted from this document.</p> : null}
      {pages?.map((page) => (
        <article className="ocr-page" id={`ocr-page-${page.pageNumber}`} key={page.id}>
          <header>
            <span>Page {page.pageNumber} · {page.language}{page.confidence !== undefined ? ` · ${page.confidence}% confidence` : ""}{page.correctedText ? " · corrected" : ""}</span>
            {canEdit && editing !== page.id ? <button className="button small" onClick={() => setEditing(page.id)} type="button">Correct text</button> : null}
          </header>
          {editing === page.id ? (
            <form action={(data) => void save(page, String(data.get("text") ?? ""))}>
              <label className="sr-only" htmlFor={`text-${page.id}`}>Corrected text for page {page.pageNumber}</label>
              <textarea defaultValue={page.correctedText ?? page.extractedText} id={`text-${page.id}`} name="text" required />
              <div className="modal-actions"><button className="button" onClick={() => setEditing(null)} type="button">Cancel</button><button className="button primary" type="submit">Save correction</button></div>
            </form>
          ) : <pre className="ocr-text">{page.correctedText ?? page.extractedText}</pre>}
        </article>
      ))}
    </Modal>
  );
}
