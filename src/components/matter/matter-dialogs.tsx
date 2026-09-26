"use client";

import { CalendarPlus, ListPlus, Pencil } from "lucide-react";
import { useState } from "react";
import { useMutation } from "@/components/matter/use-mutation";
import { FormError, Modal } from "@/components/ui/modal";
import { istDateInput, istDateTime, istTimeInput, todayIst } from "@/lib/client-api";
import type { Hearing, Matter, Person } from "@/lib/types";

const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();

export function EditMatterButton({ matter, members, canManage, demoMode }: { matter: Matter; members: Person[]; canManage: boolean; demoMode: boolean }) {
  const [open, setOpen] = useState(false);
  const { busy, error, mutate } = useMutation(demoMode);
  async function submit(data: FormData) {
    const body = {
      title: text(data, "title"), stage: text(data, "stage"), status: text(data, "status"), leadId: text(data, "leadId"),
      courtRoom: text(data, "courtRoom"), reason: text(data, "reason"),
      ...(canManage ? { restricted: data.get("restricted") === "on" } : {}),
    };
    if (await mutate(`/api/v1/matters/${matter.id}`, "PATCH", body)) setOpen(false);
  }
  return (
    <>
      <button className="button" onClick={() => setOpen(true)} type="button"><Pencil size={13} />Edit matter</button>
      <Modal eyebrow="Matter record" onClose={() => setOpen(false)} open={open} title="Edit matter" width={620}>
        <form action={submit}>
          <div className="form-grid">
            <div className="field span-2"><label htmlFor="m-title">Title</label><input defaultValue={matter.title} id="m-title" maxLength={240} minLength={3} name="title" required /></div>
            <div className="field"><label htmlFor="m-stage">Stage</label><input defaultValue={matter.stage} id="m-stage" maxLength={120} minLength={2} name="stage" required /></div>
            <div className="field"><label htmlFor="m-status">Status</label><select defaultValue={matter.status} id="m-status" name="status">{["draft", "active", "stayed", "closed"].map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
            <div className="field"><label htmlFor="m-lead">Lead advocate</label><select defaultValue={matter.lead.id} id="m-lead" name="leadId">{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></div>
            <div className="field"><label htmlFor="m-room">Court room</label><input defaultValue={matter.courtRoom ?? ""} id="m-room" maxLength={80} name="courtRoom" /></div>
          </div>
          {canManage ? <label className="check-field"><input defaultChecked={matter.restricted} name="restricted" type="checkbox" /><span><strong>Restricted.</strong> Limit access to leadership and explicit grants.</span></label> : null}
          <div className="field"><label htmlFor="m-reason">Reason for change</label><textarea id="m-reason" maxLength={500} minLength={3} name="reason" placeholder="Recorded in the matter's history" required /></div>
          <FormError message={error} />
          <div className="modal-actions"><button className="button" onClick={() => setOpen(false)} type="button">Cancel</button><button className="button primary" disabled={busy} type="submit">Save changes</button></div>
        </form>
      </Modal>
    </>
  );
}

export function HearingDialogButton({ matterId, members, hearing, defaultAdvocateId, demoMode }: { matterId: string; members: Person[]; hearing?: Hearing; defaultAdvocateId: string; demoMode: boolean }) {
  const [open, setOpen] = useState(false);
  const { busy, error, mutate } = useMutation(demoMode);
  const editing = Boolean(hearing);
  async function submit(data: FormData) {
    const date = text(data, "date");
    const common = {
      advocateId: text(data, "advocateId"),
      startsAt: istDateTime(date, text(data, "start")),
      endsAt: istDateTime(date, text(data, "end")),
      courtRoom: text(data, "courtRoom"),
      itemNumber: text(data, "itemNumber") ? Number(text(data, "itemNumber")) : editing ? null : undefined,
      status: text(data, "status"),
      notes: text(data, "notes"),
    };
    const ok = editing
      ? await mutate(`/api/v1/hearings/${hearing!.id}`, "PATCH", { ...common, reason: text(data, "reason") })
      : await mutate(`/api/v1/matters/${matterId}/hearings`, "POST", common);
    if (ok) setOpen(false);
  }
  return (
    <>
      {editing ? <button className="button small" onClick={() => setOpen(true)} type="button"><Pencil size={11} />Edit</button> : <button className="button primary" onClick={() => setOpen(true)} type="button"><CalendarPlus size={14} />Add hearing</button>}
      <Modal eyebrow="Manual listing · times in IST" onClose={() => setOpen(false)} open={open} title={editing ? "Update hearing" : "Add hearing"} width={620}>
        <form action={submit}>
          <div className="form-grid">
            <div className="field"><label htmlFor="h-date">Date</label><input defaultValue={hearing ? istDateInput(hearing.startsAt) : todayIst()} id="h-date" name="date" required type="date" /></div>
            <div className="field"><label htmlFor="h-advocate">Appearing advocate</label><select defaultValue={hearing?.advocate.id ?? defaultAdvocateId} id="h-advocate" name="advocateId">{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></div>
            <div className="field"><label htmlFor="h-start">Start (IST)</label><input defaultValue={hearing ? istTimeInput(hearing.startsAt) : "10:30"} id="h-start" name="start" required type="time" /></div>
            <div className="field"><label htmlFor="h-end">End (IST)</label><input defaultValue={hearing ? istTimeInput(hearing.endsAt) : "11:30"} id="h-end" name="end" required type="time" /></div>
            <div className="field"><label htmlFor="h-room">Court room</label><input defaultValue={hearing?.courtRoom === "Court not assigned" ? "" : hearing?.courtRoom ?? ""} id="h-room" maxLength={80} name="courtRoom" /></div>
            <div className="field"><label htmlFor="h-item">Item number</label><input defaultValue={hearing?.itemNumber ?? ""} id="h-item" max={9999} min={1} name="itemNumber" type="number" /></div>
            <div className="field"><label htmlFor="h-status">Status</label><select defaultValue={hearing?.status ?? "proposed"} id="h-status" name="status">{(editing ? ["proposed", "confirmed", "adjourned", "completed", "cancelled"] : ["proposed", "confirmed"]).map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
            <div className="field span-2"><label htmlFor="h-notes">Notes</label><textarea defaultValue={hearing?.note ?? ""} id="h-notes" maxLength={2000} name="notes" /></div>
            {editing ? <div className="field span-2"><label htmlFor="h-reason">Reason for change</label><textarea id="h-reason" maxLength={500} minLength={3} name="reason" placeholder="e.g. Board shows the matter passed over to 2:30 PM" required /></div> : null}
          </div>
          <p className="form-help">Entered manually. Confirm against the official cause list; the source state stays “manual”.</p>
          <FormError message={error} />
          <div className="modal-actions"><button className="button" onClick={() => setOpen(false)} type="button">Cancel</button><button className="button primary" disabled={busy} type="submit">{editing ? "Save update" : "Add hearing"}</button></div>
        </form>
      </Modal>
    </>
  );
}

export function TaskDialogButton({ matterId, members, defaultAssigneeId, demoMode }: { matterId: string; members: Person[]; defaultAssigneeId: string; demoMode: boolean }) {
  const [open, setOpen] = useState(false);
  const { busy, error, mutate } = useMutation(demoMode);
  async function submit(data: FormData) {
    const body = { title: text(data, "title"), dueAt: istDateTime(text(data, "date"), text(data, "time")), assigneeId: text(data, "assigneeId") || undefined, priority: text(data, "priority") };
    if (await mutate(`/api/v1/matters/${matterId}/tasks`, "POST", body)) setOpen(false);
  }
  return (
    <>
      <button className="button" onClick={() => setOpen(true)} style={{ width: "100%", marginTop: 12 }} type="button"><ListPlus size={14} />Add task</button>
      <Modal eyebrow="Matter task" onClose={() => setOpen(false)} open={open} title="Add task">
        <form action={submit}>
          <div className="field"><label htmlFor="t-title">Task</label><input id="t-title" maxLength={240} minLength={3} name="title" required /></div>
          <div className="form-grid">
            <div className="field"><label htmlFor="t-date">Due date</label><input defaultValue={todayIst()} id="t-date" name="date" required type="date" /></div>
            <div className="field"><label htmlFor="t-time">Due time (IST)</label><input defaultValue="17:00" id="t-time" name="time" required type="time" /></div>
            <div className="field"><label htmlFor="t-assignee">Assignee</label><select defaultValue={defaultAssigneeId} id="t-assignee" name="assigneeId"><option value="">Unassigned</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></div>
            <div className="field"><label htmlFor="t-priority">Priority</label><select defaultValue="normal" id="t-priority" name="priority"><option value="normal">Normal</option><option value="urgent">Urgent</option></select></div>
          </div>
          <FormError message={error} />
          <div className="modal-actions"><button className="button" onClick={() => setOpen(false)} type="button">Cancel</button><button className="button primary" disabled={busy} type="submit">Add task</button></div>
        </form>
      </Modal>
    </>
  );
}
