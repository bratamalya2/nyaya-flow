"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/** Searches authorized document text; ⌘K / Ctrl+K focuses the field from anywhere. */
export function GlobalSearch() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const focus = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); input.current?.focus(); }
    };
    window.addEventListener("keydown", focus);
    return () => window.removeEventListener("keydown", focus);
  }, []);
  return (
    <form className="global-search" role="search" onSubmit={(event) => {
      event.preventDefault();
      const value = input.current?.value.trim() ?? "";
      if (value.length >= 2) router.push(`/vault?q=${encodeURIComponent(value)}`);
    }}>
      <Search size={17} aria-hidden="true" />
      <input ref={input} aria-label="Search document text" name="q" placeholder="Search document text and OCR…" minLength={2} />
      <kbd>⌘ K</kbd>
    </form>
  );
}
