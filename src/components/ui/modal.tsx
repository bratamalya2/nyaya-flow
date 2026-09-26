"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

/** Accessible modal built on the native <dialog> element (focus trapping, Escape, and backdrop). */
export function Modal({ open, onClose, title, eyebrow, width = 560, children }: { open: boolean; onClose: () => void; title: string; eyebrow?: string; width?: number; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={ref} className="modal" aria-labelledby={titleId} onClose={onClose} onCancel={(event) => { event.preventDefault(); onClose(); }}>
      {open ? (
        <div className="card card-pad modal-card" style={{ width: `min(${width}px, calc(100vw - 32px))` }}>
          <div className="section-heading">
            <div>{eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}<h2 id={titleId}>{title}</h2></div>
            <button aria-label="Close" className="icon-button" onClick={onClose} type="button"><X size={18} /></button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}

export function FormError({ message }: { message: string | null }) {
  return message ? <p className="form-error" role="alert">{message}</p> : null;
}
