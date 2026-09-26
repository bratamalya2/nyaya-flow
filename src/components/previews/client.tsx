import { CalendarDays, Download, FileCheck2, Gavel, Headset, Landmark, LockKeyhole, ShieldCheck, UploadCloud, UserRound } from "lucide-react";
import { Chip, DisabledAction, Fact, Note, Panel } from "@/components/previews/primitives";
import { previewMatter, previewPeople } from "@/lib/preview-data";

const MILESTONES = [
  { upcoming: true, tag: "Upcoming deadline", date: "Target: 22 Oct 2026", title: "Filing of rejoinder to the respondents' counter affidavit", body: `Draft under review by ${previewPeople.associate.name}. Your team has been asked for the audited tariff variance appendix.` },
  { tag: "Hearing held · order uploaded", date: "12 Oct 2026", title: "Interim protection continued; counter affidavit directed within two weeks", body: "Summary approved by your lead counsel. The certified order copy is in your documents below.", approvedBy: previewPeople.lead.name },
  { tag: "Conference", date: "08 Oct 2026", title: "Strategy call with your in-house legal team", body: "Relief sought and revised prayer discussed; minutes shared separately." },
  { tag: "Notice issued", date: "14 Aug 2026", title: "Notice issued to the respondents", body: "The court issued notice and listed the matter for completion of pleadings." },
];

export function ClientPreview() {
  return <>
    <section className="pv-hero" aria-label="Client view frame">
      <p className="eyebrow"><LockKeyhole size={12} /> Client view preview · shown as your client would see it</p>
      <h2>Case tracker for {previewMatter.client}</h2>
      <p>Clients see only milestones and document versions your team explicitly approves. Revoking access blocks new requests immediately.</p>
    </section>
    <section className="card pv-panel" style={{ marginBottom: 14 }}>
      <div className="actions"><Chip>{previewMatter.reference}</Chip><Chip>CNR {previewMatter.cnr}</Chip><Chip tone="manual">Dates entered by counsel · last updated 12 Oct 2026</Chip></div>
      <h2 className="legal-title" style={{ fontSize: 24, marginTop: 10 }}>{previewMatter.title}</h2>
      <p className="lede">{previewMatter.forum} · writ jurisdiction · challenge to a tariff notification</p>
      <div className="pv-facts">
        <Fact label="Next listing" value={previewMatter.nextListing} sub={`${previewMatter.court} · Item ${previewMatter.item} (as entered by counsel)`} />
        <Fact label="Interim protection" value="In force until next date" />
        <Fact label="Pending stage" value={previewMatter.stage} />
        <Fact label="Lead counsel" value={previewPeople.lead.name} />
      </div>
    </section>
    <div className="pv-layout">
      <div className="pv-column">
        <Panel eyebrow="Approved milestones only" icon={Gavel} title="Case milestones">
          <ol className="pv-timeline">
            {MILESTONES.map((milestone) => (
              <li className={milestone.upcoming ? "upcoming" : ""} key={milestone.title}>
                <div className="actions"><Chip tone={milestone.upcoming ? "stale" : "verified"}>{milestone.tag}</Chip><span className="pv-mono">{milestone.date}</span></div>
                <h3>{milestone.title}</h3>
                <p>{milestone.body}</p>
                {milestone.approvedBy ? <p className="pv-mono" style={{ marginTop: 4 }}>Approved for client view by {milestone.approvedBy}</p> : null}
              </li>
            ))}
          </ol>
        </Panel>
        <Panel eyebrow="Shared documents" icon={FileCheck2} title="Orders and filings">
          <div className="pv-list">
            {[["Order_12-10-2026.pdf", "Daily order · 420 KB"], ["Writ_Petition_as_filed.pdf", "Indexed paperbook · 18.4 MB"], ["Counter_Affidavit_Respondent_1.pdf", "Respondent reply · 6.2 MB"]].map(([name, meta]) => (
              <div className="pv-row" key={name}><div><strong>{name}</strong><p>{meta} · SHA-256 recorded</p></div><DisabledAction icon={Download}>Download</DisabledAction></div>
            ))}
          </div>
          <Note tone="manual">Downloads re-check the client&apos;s access on every request; there are no long-lived links.</Note>
        </Panel>
      </div>
      <div className="pv-column">
        <Panel eyebrow="Requested by counsel" icon={UploadCloud} title="Evidence upload">
          <div className="pv-list">
            <div className="pv-row"><div><strong>Board resolution & authorisation</strong></div><Chip tone="conflict">urgent</Chip></div>
            <div className="pv-row"><div><strong>Signed affidavit</strong></div><Chip tone="stale">required</Chip></div>
            <div className="pv-row"><div><strong>Supporting invoices (Q1–Q2)</strong></div><Chip tone="verified">received</Chip></div>
          </div>
          <div className="pv-dropzone"><UploadCloud size={22} /><p>Uploads go to a quarantine queue for review. They never enter a filing package directly.</p><DisabledAction>Choose files</DisabledAction></div>
        </Panel>
        <Panel eyebrow="Your counsel" icon={Headset} title="Assigned team">
          <div className="pv-list">
            {[previewPeople.lead, previewPeople.associate].map((person) => (
              <div className="pv-row" key={person.name}><div className="avatar" style={{ width: 32, height: 32 }}>{person.initials}</div><div style={{ flex: 1 }}><strong>{person.name}</strong><p>{person.role}</p></div><UserRound size={14} className="muted" /></div>
            ))}
          </div>
          <div className="actions" style={{ marginTop: 10 }}><DisabledAction icon={CalendarDays} variant="primary">Request a conference</DisabledAction></div>
        </Panel>
        <Panel eyebrow="Privacy" icon={ShieldCheck} title="Your data">
          <p className="lede" style={{ marginTop: 0 }}>Consent and notice records, plus a request channel for access, correction, or erasure, subject to legal holds and retention obligations.</p>
          <div className="actions"><DisabledAction icon={Landmark}>Manage consent</DisabledAction><DisabledAction>Request my data</DisabledAction></div>
        </Panel>
      </div>
    </div>
  </>;
}
