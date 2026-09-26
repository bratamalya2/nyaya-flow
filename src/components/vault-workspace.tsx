"use client";

import { AlertTriangle, CheckCircle2, FileScan, Search, UploadCloud } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import type { Matter, VaultDocument } from "@/lib/types";

const MAX_BYTES = 100 * 1024 * 1024;
const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/tiff"];

export function VaultWorkspace({ initialDocuments, matters, organizationId, demoMode }: { initialDocuments: VaultDocument[]; matters: Matter[]; organizationId: string; demoMode: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<VaultDocument[]>(initialDocuments);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [status, setStatus] = useState("all");
  const [matterId, setMatterId] = useState(matters[0]?.id || "");
  const [uploading, setUploading] = useState(false);
  const filtered = useMemo(() => documents.filter((document) => {
    const matter = matters.find((item) => item.id === document.matterId);
    const search = `${document.title} ${matter?.title ?? ""} ${document.classification}`.toLowerCase();
    return search.includes(query.toLowerCase()) && (status === "all" || document.status === status);
  }), [documents, matters, query, status]);

  const selectFile = async (file?: File) => {
    if (!file) return;
    if (!ALLOWED.includes(file.type)) {
      setMessage({ kind: "error", text: "Unsupported type. Upload PDF, JPEG, PNG, or TIFF only." });
      return;
    }
    if (file.size > MAX_BYTES) {
      setMessage({ kind: "error", text: "File exceeds the 100 MB upload limit." });
      return;
    }
    if (!matterId) { setMessage({ kind: "error", text: "Create or select a matter before uploading." }); return; }
    setUploading(true);
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))).map((value) => value.toString(16).padStart(2, "0")).join("");
    let versionId = crypto.randomUUID();
    if (!demoMode) {
      const intentResponse = await fetch("/api/v1/documents/upload-intents", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ organizationId, matterId, fileName:file.name, mimeType:file.type, sizeBytes:file.size, sha256:digest }) });
      const intent = await intentResponse.json();
      if (!intentResponse.ok) { setMessage({ kind:"error", text:intent.error || "Could not prepare upload." }); setUploading(false); return; }
      const uploadResponse = await fetch(intent.uploadUrl, { method:"PUT", headers:{"content-type":file.type,"content-length":String(file.size)}, body:file });
      const upload = await uploadResponse.json();
      if (!uploadResponse.ok) { setMessage({ kind:"error", text:upload.error || "Upload failed." }); setUploading(false); return; }
      versionId = intent.versionId;
    }
    setDocuments((current) => [{ id: versionId, matterId, title: file.name, version: "v1.0", pages: 0, size: `${(file.size / 1024 / 1024).toFixed(1)} MB`, status: "quarantined", classification: "Unclassified", language: "Mixed", uploadedAt: new Date().toISOString(), uploadedBy: "Current user", hash: `${digest.slice(0,4)}…${digest.slice(-4)}` }, ...current]);
    setMessage({ kind: "success", text: `${file.name} entered quarantine. Malware scan and page validation will run before OCR.` });
    setUploading(false);
  };

  return <>
    <div className="content-grid" style={{ marginBottom: 16 }}>
      <label className="upload-zone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); selectFile(event.dataTransfer.files[0]); }}>
        <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff" onChange={(event) => selectFile(event.target.files?.[0])} />
        <span><UploadCloud size={25} className="teal" /><strong>Drop a court document or choose a file</strong><p>PDF, JPEG, PNG, TIFF · 100 MB · 500 pages · English/Hindi OCR</p><select aria-label="Matter for upload" value={matterId} onChange={(event)=>setMatterId(event.target.value)} style={{ margin:"8px 0",maxWidth:280 }}><option value="">Select matter</option>{matters.map((matter)=><option value={matter.id} key={matter.id}>{matter.reference}</option>)}</select><br /><button className="button" disabled={uploading} onClick={() => fileRef.current?.click()} type="button">{uploading ? "Securing upload…" : "Choose file"}</button></span>
      </label>
      <div className="card card-pad">
        <p className="eyebrow"><FileScan size={13} /> Processing boundary</p><h2>Private by default</h2>
        <p className="lede">Files stay quarantined until content validation and malware scanning pass. OCR runs on the India-hosted worker.</p>
        <div style={{ marginTop: 12 }}><StatusBadge value="manual" /> <span className="muted" style={{ fontSize: 10, marginLeft: 6 }}>No document content is sent to OpenAI.</span></div>
      </div>
    </div>
    {message ? <div className={`preview-banner ${message.kind === "error" ? "danger" : ""}`}>{message.kind === "error" ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />} {message.text}</div> : null}
    <div className="filters">
      <div className="global-search" style={{ display: "block", maxWidth: 380, marginRight: 6 }}><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documents, OCR text or matter…" /></div>
      {["all", "ready", "processing", "ocr_pending", "quarantined", "blocked"].map((item) => <button className={`filter-chip ${status === item ? "active" : ""}`} key={item} onClick={() => setStatus(item)} type="button">{item.replaceAll("_", " ")}</button>)}
    </div>
    <div className="card table-card"><table className="data-table"><thead><tr><th>Document & matter</th><th>Version</th><th>Pages / size</th><th>OCR</th><th>Integrity</th><th>Status</th></tr></thead><tbody>{filtered.map((document) => {
      const matter = matters.find((item) => item.id === document.matterId);
      return <tr key={document.id}><td className="primary-cell"><strong>{document.title}</strong><span>{matter?.reference} · {document.classification}</span></td><td><strong>{document.version}</strong><div className="muted">Immutable object</div></td><td className="tabular">{document.pages || "—"} / {document.size}</td><td>{document.ocrConfidence ? <><strong>{document.ocrConfidence}%</strong><div className="muted">{document.language}</div></> : <span className="muted">Pending</span>}</td><td className="tabular">{document.hash}</td><td><StatusBadge value={document.status} /></td></tr>;
    })}</tbody></table></div>
  </>;
}
