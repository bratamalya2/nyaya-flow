"use client";

import { useState } from "react";

export function TaskToggle({ id, initialDone }: { id: string; initialDone: boolean }) {
  const [done,setDone]=useState(initialDone);
  const [busy,setBusy]=useState(false);
  async function change(next:boolean) {
    setDone(next); setBusy(true);
    const response=await fetch(`/api/v1/tasks/${encodeURIComponent(id)}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({state:next?"done":"open"})});
    if(!response.ok) setDone(!next);
    setBusy(false);
  }
  return <input aria-label="Mark task complete" className="task-check" type="checkbox" checked={done} disabled={busy} onChange={(event)=>void change(event.target.checked)} />;
}
