import { getSession } from "@/lib/auth";
import { withActor } from "@/lib/db";
import { auditEvents as demoAudit, documents as demoDocuments, hearings as demoHearings, matters as demoMatters, people, tasks as demoTasks } from "@/lib/sample-data";
import type { AuditEvent, Hearing, Matter, Person, Task, VaultDocument } from "@/lib/types";

export const demoMode = () => process.env.NEXT_PUBLIC_DEMO_MODE === "true";

type Context = { userId: string; organizationId: string };
export async function workspaceContext(): Promise<Context> {
  const session = await getSession();
  if (!session) throw new Error("Authentication required.");
  if (demoMode()) return { userId: session.userId, organizationId: process.env.DEMO_ORGANIZATION_ID || "00000000-0000-4000-8000-000000000001" };
  const result = await withActor(session.userId, (client) => client.query<{ id: string }>("select id from organizations order by name limit 1"));
  if (!result.rows[0]) throw new Error("No active firm membership was found.");
  return { userId: session.userId, organizationId: result.rows[0].id };
}

export async function listMatters(): Promise<Matter[]> {
  if (demoMode()) return demoMatters;
  const context = await workspaceContext();
  const result = await withActor(context.userId, (client) => client.query<{
    id:string; title:string; reference:string; cnr:string|null; forum:string; court_room:string|null; stage:string; status:Matter["status"]; source_state:Matter["sourceState"]; client_name:string; restricted:boolean; created_by:string; creator_name:string; next_listing_at:string|null;
  }>(`select m.*,u.display_name creator_name,(select min(h.starts_at) from hearings h where h.matter_id=m.id and h.starts_at>=now() and h.status in ('proposed','confirmed')) next_listing_at
      from matters m join app_users u on u.id=m.created_by order by m.updated_at desc`));
  return result.rows.map((row) => ({ id:row.id,title:row.title,reference:row.reference,cnr:row.cnr || undefined,forum:row.forum,courtRoom:row.court_room || undefined,stage:row.stage,status:row.status,sourceState:row.source_state,client:row.client_name,restricted:row.restricted,lead:{ id:row.created_by,name:row.creator_name,initials:row.creator_name.split(/\s+/).map((part)=>part[0]).join("").slice(0,2),role:"advocate" },nextListingAt:row.next_listing_at || undefined,tags:[] }));
}

export async function listHearings(): Promise<Hearing[]> {
  if (demoMode()) return demoHearings;
  const context = await workspaceContext();
  const result = await withActor(context.userId, (client) => client.query<{
    id:string; matter_id:string; title:string; reference:string; forum:string; court_room:string|null; starts_at:string; ends_at:string; item_number:number|null; advocate_id:string; advocate_name:string; status:Hearing["status"]; source_state:Hearing["sourceState"]; notes:string|null;
  }>(`select h.id,h.matter_id,m.title,m.reference,h.forum,h.court_room,h.starts_at,h.ends_at,h.item_number,h.advocate_id,u.display_name advocate_name,h.status,h.source_state,h.notes
      from hearings h join matters m on m.id=h.matter_id join app_users u on u.id=h.advocate_id
      where h.starts_at::date=(now() at time zone 'Asia/Kolkata')::date order by h.starts_at`));
  return result.rows.map((row)=>({id:row.id,matterId:row.matter_id,matterTitle:row.title,reference:row.reference,forum:row.forum,courtRoom:row.court_room || "Court not assigned",startsAt:row.starts_at,endsAt:row.ends_at,itemNumber:row.item_number || undefined,advocate:{id:row.advocate_id,name:row.advocate_name,initials:row.advocate_name.slice(0,2).toUpperCase(),role:"advocate"},status:row.status,sourceState:row.source_state,note:row.notes || undefined}));
}

export async function listTasks(): Promise<Task[]> {
  if (demoMode()) return demoTasks;
  const context = await workspaceContext();
  const result = await withActor(context.userId, (client) => client.query<{id:string;matter_id:string;title:string;due_at:string;assignee_id:string;assignee_name:string;state:Task["state"];priority:Task["priority"]}>(`select t.id,t.matter_id,t.title,t.due_at,t.assignee_id,u.display_name assignee_name,t.state,t.priority from tasks t join app_users u on u.id=t.assignee_id where t.due_at::date<=(now() at time zone 'Asia/Kolkata')::date+1 order by t.due_at`));
  return result.rows.map((row)=>({id:row.id,matterId:row.matter_id,title:row.title,dueAt:row.due_at,assignee:{id:row.assignee_id,name:row.assignee_name,initials:row.assignee_name.slice(0,2).toUpperCase(),role:"advocate"},state:row.state,priority:row.priority}));
}

export async function listDocuments(): Promise<VaultDocument[]> {
  if (demoMode()) return demoDocuments;
  const context = await workspaceContext();
  const result = await withActor(context.userId, (client)=>client.query<{id:string;matter_id:string;title:string;version_number:number;page_count:number|null;size_bytes:string;status:VaultDocument["status"];classification:string;language:string|null;confidence:number|null;uploaded_at:string;uploader:string;sha256:string}>(`select v.id,d.matter_id,d.title,v.version_number,v.page_count,v.size_bytes::text,v.status,d.classification,
    (select language from ocr_pages p where p.document_version_id=v.id order by page_number limit 1) language,
    (select round(avg(confidence),2)::float from ocr_pages p where p.document_version_id=v.id) confidence,
    v.uploaded_at,u.display_name uploader,v.sha256 from document_versions v join documents d on d.id=v.document_id join app_users u on u.id=v.uploaded_by
    where v.version_number=(select max(v2.version_number) from document_versions v2 where v2.document_id=d.id) order by v.uploaded_at desc`));
  return result.rows.map((row)=>({id:row.id,matterId:row.matter_id,title:row.title,version:`v${row.version_number}.0`,pages:row.page_count || 0,size:`${(Number(row.size_bytes)/1024/1024).toFixed(1)} MB`,status:row.status,classification:row.classification,language:row.language === "hin" ? "Hindi" : row.language === "eng" ? "English" : "Mixed",ocrConfidence:row.confidence || undefined,uploadedAt:row.uploaded_at,uploadedBy:row.uploader,hash:`${row.sha256.slice(0,4)}…${row.sha256.slice(-4)}`}));
}

export async function listMembers(): Promise<Person[]> {
  if (demoMode()) return people;
  const context = await workspaceContext();
  const result = await withActor(context.userId,(client)=>client.query<{id:string;display_name:string;role:Person["role"]}>("select u.id,u.display_name,m.role from memberships m join app_users u on u.id=m.user_id where m.active order by u.display_name"));
  return result.rows.map((row)=>({id:row.id,name:row.display_name,initials:row.display_name.split(/\s+/).map((part)=>part[0]).join("").slice(0,2),role:row.role}));
}

export async function listAuditEvents(): Promise<AuditEvent[]> {
  if (demoMode()) return demoAudit;
  const context = await workspaceContext();
  const result = await withActor(context.userId,(client)=>client.query<{id:string;actor:string|null;action:string;resource_type:string;resource_id:string|null;outcome:AuditEvent["outcome"];created_at:string;correlation_id:string}>(`select a.id,u.display_name actor,a.action,a.resource_type,a.resource_id,a.outcome,a.created_at,a.correlation_id from audit_events a left join app_users u on u.id=a.actor_id order by a.created_at desc limit 100`));
  return result.rows.map((row)=>({id:row.id,actor:row.actor || "System",action:row.action,resource:`${row.resource_type}${row.resource_id ? ` · ${row.resource_id}` : ""}`,outcome:row.outcome,createdAt:row.created_at,correlationId:row.correlation_id}));
}
