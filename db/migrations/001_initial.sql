begin;

create extension if not exists pgcrypto;
create extension if not exists citext;

create type app_role as enum ('owner','managing_partner','advocate','associate','paralegal','admin','finance');
create type matter_permission as enum ('view','edit','manage','export');
create type matter_status as enum ('draft','active','stayed','closed');
create type hearing_status as enum ('proposed','confirmed','adjourned','completed','cancelled');
create type source_state as enum ('manual','unverified','verified','stale');
create type document_status as enum ('uploaded','quarantined','scanning','ocr_pending','processing','ready','failed','blocked');
create type job_status as enum ('queued','leased','completed','failed','dead_letter');

create table app_users (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  display_name text not null,
  password_hash text not null,
  mfa_enabled boolean not null default false,
  mfa_secret_encrypted text,
  mfa_pending_secret_encrypted text,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  token_hash text not null unique,
  mfa_verified boolean not null default false,
  ip_hash text not null,
  user_agent_hash text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index sessions_active_idx on sessions(token_hash, expires_at) where revoked_at is null;

create table auth_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  token_hash text not null unique,
  attempts integer not null default 0 check (attempts between 0 and 5),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table security_events (
  id bigint generated always as identity primary key,
  event_type text not null,
  outcome text not null check (outcome in ('success','denied','error')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  timezone text not null default 'Asia/Kolkata',
  external_ai_enabled boolean not null default false,
  automatic_deletion_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  role app_role not null,
  active boolean not null default true,
  mfa_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,user_id)
);
create index memberships_actor_idx on memberships(user_id,organization_id) where active;

create table invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email citext not null,
  role app_role not null,
  token_hash text not null unique,
  invited_by uuid not null references app_users(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index invitations_active_idx on invitations(organization_id,email) where accepted_at is null and revoked_at is null;

create table matters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 240),
  reference text not null,
  cnr text,
  forum text not null,
  court_room text,
  stage text not null default 'Intake',
  status matter_status not null default 'draft',
  source_state source_state not null default 'manual',
  client_name text not null,
  restricted boolean not null default false,
  closed_reason text,
  created_by uuid not null references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,forum,reference)
);
create unique index matters_cnr_idx on matters(organization_id,forum,cnr) where cnr is not null;
create index matters_org_idx on matters(organization_id,status,updated_at desc);

create table matter_grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  matter_id uuid not null references matters(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  permission matter_permission not null,
  expires_at timestamptz,
  granted_by uuid not null references app_users(id),
  created_at timestamptz not null default now(),
  unique (matter_id,user_id,permission)
);
create index matter_grants_actor_idx on matter_grants(user_id,matter_id,permission);

create table parties (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  matter_id uuid not null references matters(id) on delete cascade, name text not null,
  party_type text not null check (party_type in ('petitioner','respondent','appellant','defendant','other')),
  created_at timestamptz not null default now()
);

create table hearings (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  matter_id uuid not null references matters(id) on delete cascade, advocate_id uuid not null references app_users(id),
  forum text not null, court_room text, item_number integer check (item_number is null or item_number > 0),
  starts_at timestamptz not null, ends_at timestamptz not null check (ends_at > starts_at),
  status hearing_status not null default 'proposed', source_state source_state not null default 'manual',
  dismissal_reason text, notes text, created_by uuid not null references app_users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index hearings_actor_time_idx on hearings(organization_id,advocate_id,starts_at,ends_at);

create table tasks (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  matter_id uuid not null references matters(id) on delete cascade, title text not null,
  assignee_id uuid references app_users(id), due_at timestamptz,
  state text not null default 'open' check (state in ('open','in_progress','done','cancelled')),
  priority text not null default 'normal' check (priority in ('normal','urgent')),
  completed_at timestamptz, created_by uuid not null references app_users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index tasks_actor_due_idx on tasks(organization_id,assignee_id,due_at) where state in ('open','in_progress');

create table documents (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  matter_id uuid not null references matters(id) on delete cascade, title text not null,
  classification text not null default 'Unclassified', status document_status not null default 'uploaded',
  created_by uuid not null references app_users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table document_versions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade, version_number integer not null default 1 check (version_number > 0),
  storage_path text not null unique, mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png','image/tiff')),
  size_bytes bigint not null check (size_bytes between 1 and 104857600), page_count integer check (page_count between 1 and 500),
  sha256 text not null check (sha256 ~ '^[a-fA-F0-9]{64}$'), status document_status not null default 'uploaded',
  malware_scan_result text, uploaded_by uuid not null references app_users(id), uploaded_at timestamptz not null default now(), approved_at timestamptz,
  unique (document_id,version_number)
);

create table upload_intents (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  matter_id uuid not null references matters(id) on delete cascade, document_version_id uuid not null references document_versions(id) on delete cascade,
  user_id uuid not null references app_users(id), token_hash text not null unique, expected_bytes bigint not null,
  expected_sha256 text not null, expires_at timestamptz not null, claimed_at timestamptz, used_at timestamptz, created_at timestamptz not null default now()
);

create table ocr_pages (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  document_version_id uuid not null references document_versions(id) on delete cascade,
  page_number integer not null check (page_number between 1 and 500), language text not null check (language in ('eng','hin','eng+hin','unknown')),
  confidence numeric(5,2) check (confidence between 0 and 100), extracted_text text not null default '', corrected_text text,
  search_vector tsvector generated always as (to_tsvector('simple',coalesce(corrected_text,extracted_text,''))) stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(document_version_id,page_number)
);
create index ocr_pages_search_idx on ocr_pages using gin(search_vector);

create table ocr_corrections (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  ocr_page_id uuid not null references ocr_pages(id) on delete cascade, previous_text text not null, corrected_text text not null,
  corrected_by uuid not null references app_users(id), corrected_at timestamptz not null default now()
);

create table source_records (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  matter_id uuid references matters(id) on delete cascade, source_type text not null default 'manual', source_state source_state not null default 'manual',
  source_reference text, observed_at timestamptz not null default now(), parser_version text, checksum text,
  payload jsonb not null default '{}'::jsonb, created_by uuid references app_users(id), created_at timestamptz not null default now()
);

create table consent_records (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  subject_reference text not null, purpose text not null, legal_basis text not null, notice_version text not null,
  status text not null check (status in ('recorded','withdrawn','not_required')), recorded_by uuid not null references app_users(id),
  recorded_at timestamptz not null default now(), withdrawn_at timestamptz
);

create table retention_classes (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  name text not null, retention_days integer check (retention_days is null or retention_days > 0), automatic_deletion boolean not null default false,
  approved_by uuid references app_users(id), approved_at timestamptz, unique(organization_id,name)
);

create table legal_holds (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  matter_id uuid not null references matters(id) on delete cascade, reason text not null, active boolean not null default true,
  created_by uuid not null references app_users(id), created_at timestamptz not null default now(),
  released_by uuid references app_users(id), released_at timestamptz
);
create unique index legal_holds_active_idx on legal_holds(matter_id) where active;

create table data_requests (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  requester_reference text not null, request_type text not null check (request_type in ('access','correction','erasure','export')),
  status text not null default 'received' check (status in ('received','identity_review','legal_hold_review','processing','fulfilled','denied')),
  decision_reason text, assigned_to uuid references app_users(id), created_by uuid not null references app_users(id),
  created_at timestamptz not null default now(), completed_at timestamptz
);

create table audit_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  actor_id uuid references app_users(id), action text not null, resource_type text not null, resource_id text,
  outcome text not null check (outcome in ('success','denied','error')), correlation_id text not null,
  metadata jsonb not null default '{}'::jsonb, previous_hash text, chain_hash text not null, created_at timestamptz not null default now()
);
create index audit_events_org_time_idx on audit_events(organization_id,created_at desc);

create table outbox_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  aggregate_type text not null, aggregate_id uuid not null, event_type text not null, payload jsonb not null,
  created_at timestamptz not null default now(), dispatched_at timestamptz, attempts integer not null default 0
);

create table background_jobs (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  job_type text not null check (job_type in ('malware_scan','page_count','ocr','search_index','retention_delete','audit_verify')),
  status job_status not null default 'queued', payload jsonb not null, attempts integer not null default 0, max_attempts integer not null default 5,
  available_at timestamptz not null default now(), leased_until timestamptz, leased_by text, last_error text,
  created_at timestamptz not null default now(), completed_at timestamptz
);
create index jobs_claim_idx on background_jobs(status,available_at) where status in ('queued','failed');

create function set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
do $$ declare table_name text; begin foreach table_name in array array['app_users','organizations','memberships','matters','hearings','tasks','documents','ocr_pages'] loop execute format('create trigger %I_updated before update on %I for each row execute function set_updated_at()',table_name,table_name); end loop; end $$;

create function current_app_user_id() returns uuid language sql stable as $$ select nullif(current_setting('app.user_id',true),'')::uuid $$;
create function is_org_member(org_id uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from memberships where organization_id=org_id and user_id=current_app_user_id() and active)
$$;
create function has_org_role(org_id uuid,allowed app_role[]) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from memberships where organization_id=org_id and user_id=current_app_user_id() and active and role=any(allowed))
$$;
create function can_access_matter(target uuid,required matter_permission default 'view') returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from matters m join memberships ms on ms.organization_id=m.organization_id and ms.user_id=current_app_user_id() and ms.active
  where m.id=target and (not m.restricted or ms.role in ('owner','managing_partner','admin') or exists(
    select 1 from matter_grants g where g.matter_id=m.id and g.user_id=current_app_user_id() and (g.expires_at is null or g.expires_at>now()) and
    case required when 'view' then g.permission in ('view','edit','manage','export') when 'edit' then g.permission in ('edit','manage') when 'manage' then g.permission='manage' when 'export' then g.permission in ('export','manage') end)))
$$;

create function seal_audit_event() returns trigger language plpgsql security definer set search_path=public as $$
declare prior text; begin perform pg_advisory_xact_lock(hashtext(new.organization_id::text));
select chain_hash into prior from audit_events where organization_id=new.organization_id order by created_at desc,id desc limit 1;
new.previous_hash=prior; new.chain_hash=encode(digest(coalesce(prior,'')||new.organization_id::text||coalesce(new.actor_id::text,'')||new.action||new.resource_type||coalesce(new.resource_id,'')||new.outcome||new.correlation_id||new.created_at::text||new.metadata::text,'sha256'),'hex'); return new; end $$;
create trigger audit_seal before insert on audit_events for each row execute function seal_audit_event();
create function prevent_audit_mutation() returns trigger language plpgsql as $$ begin raise exception 'audit events are append-only'; end $$;
create trigger audit_append_only before update or delete on audit_events for each row execute function prevent_audit_mutation();

create function document_search(search_query text) returns table(document_id uuid,version_id uuid,page_number integer,title text,snippet text,rank real)
language sql stable security definer set search_path=public as $$
  select d.id,v.id,p.page_number,d.title,ts_headline('simple',coalesce(p.corrected_text,p.extracted_text),websearch_to_tsquery('simple',search_query),'MaxFragments=2, MaxWords=32'),ts_rank(p.search_vector,websearch_to_tsquery('simple',search_query))
  from ocr_pages p join document_versions v on v.id=p.document_version_id join documents d on d.id=v.document_id
  where p.search_vector@@websearch_to_tsquery('simple',search_query) and can_access_matter(d.matter_id,'view') and v.status='ready' order by 6 desc limit 50
$$;

create function claim_background_job(worker_name text) returns setof background_jobs language plpgsql security definer set search_path=public as $$
declare claimed background_jobs; begin
  select * into claimed from background_jobs where status in ('queued','failed') and available_at<=now() and (leased_until is null or leased_until<now()) and attempts<max_attempts order by created_at for update skip locked limit 1;
  if claimed.id is null then return; end if;
  update background_jobs set status='leased',leased_by=worker_name,leased_until=now()+interval '10 minutes',attempts=attempts+1 where id=claimed.id returning * into claimed;
  return next claimed;
end $$;

do $$ declare t text; begin foreach t in array array['organizations','memberships','invitations','matters','matter_grants','parties','hearings','tasks','documents','document_versions','upload_intents','ocr_pages','ocr_corrections','source_records','consent_records','retention_classes','legal_holds','data_requests','audit_events'] loop execute format('alter table %I enable row level security',t); execute format('alter table %I force row level security',t); end loop; end $$;

create policy org_select on organizations for select using(is_org_member(id));
create policy org_update on organizations for update using(has_org_role(id,array['owner','admin']::app_role[])) with check(has_org_role(id,array['owner','admin']::app_role[]));
create policy membership_select on memberships for select using(is_org_member(organization_id));
create policy membership_manage on memberships for all using(has_org_role(organization_id,array['owner','admin']::app_role[])) with check(has_org_role(organization_id,array['owner','admin']::app_role[]));
create policy invitation_manage on invitations for all using(has_org_role(organization_id,array['owner','admin']::app_role[])) with check(has_org_role(organization_id,array['owner','admin']::app_role[]));
create policy matter_select on matters for select using(can_access_matter(id,'view'));
create policy matter_insert on matters for insert with check(is_org_member(organization_id) and created_by=current_app_user_id());
create policy matter_update on matters for update using(can_access_matter(id,'edit')) with check(can_access_matter(id,'edit'));
create policy matter_delete on matters for delete using(can_access_matter(id,'manage') and status='draft');
create policy grant_access on matter_grants for select using(can_access_matter(matter_id,'view'));
create policy grant_manage on matter_grants for all using(can_access_matter(matter_id,'manage')) with check(can_access_matter(matter_id,'manage'));
create policy party_access on parties for select using(can_access_matter(matter_id,'view'));
create policy party_write on parties for all using(can_access_matter(matter_id,'edit')) with check(can_access_matter(matter_id,'edit'));
create policy hearing_access on hearings for select using(can_access_matter(matter_id,'view'));
create policy hearing_write on hearings for all using(can_access_matter(matter_id,'edit')) with check(can_access_matter(matter_id,'edit'));
create policy task_access on tasks for select using(can_access_matter(matter_id,'view'));
create policy task_write on tasks for all using(can_access_matter(matter_id,'edit')) with check(can_access_matter(matter_id,'edit'));
create policy document_access on documents for select using(can_access_matter(matter_id,'view'));
create policy document_write on documents for all using(can_access_matter(matter_id,'edit')) with check(can_access_matter(matter_id,'edit'));
create policy version_access on document_versions for select using(exists(select 1 from documents d where d.id=document_id and can_access_matter(d.matter_id,'view')));
create policy version_write on document_versions for all using(exists(select 1 from documents d where d.id=document_id and can_access_matter(d.matter_id,'edit'))) with check(exists(select 1 from documents d where d.id=document_id and can_access_matter(d.matter_id,'edit')));
create policy upload_access on upload_intents for all using(user_id=current_app_user_id() and can_access_matter(matter_id,'edit')) with check(user_id=current_app_user_id() and can_access_matter(matter_id,'edit'));
create policy ocr_access on ocr_pages for select using(exists(select 1 from document_versions v join documents d on d.id=v.document_id where v.id=document_version_id and can_access_matter(d.matter_id,'view')));
create policy ocr_correct on ocr_pages for update using(exists(select 1 from document_versions v join documents d on d.id=v.document_id where v.id=document_version_id and can_access_matter(d.matter_id,'edit')));
create policy correction_access on ocr_corrections for select using(is_org_member(organization_id));
create policy correction_insert on ocr_corrections for insert with check(is_org_member(organization_id) and corrected_by=current_app_user_id());
create policy source_access on source_records for select using(is_org_member(organization_id) and (matter_id is null or can_access_matter(matter_id,'view')));
create policy source_write on source_records for insert with check(is_org_member(organization_id) and (matter_id is null or can_access_matter(matter_id,'edit')));
create policy consent_admin on consent_records for all using(has_org_role(organization_id,array['owner','admin']::app_role[])) with check(has_org_role(organization_id,array['owner','admin']::app_role[]));
create policy retention_admin on retention_classes for all using(has_org_role(organization_id,array['owner','admin']::app_role[])) with check(has_org_role(organization_id,array['owner','admin']::app_role[]));
create policy hold_access on legal_holds for select using(can_access_matter(matter_id,'view'));
create policy hold_manage on legal_holds for all using(can_access_matter(matter_id,'manage')) with check(can_access_matter(matter_id,'manage'));
create policy request_admin on data_requests for all using(has_org_role(organization_id,array['owner','admin']::app_role[])) with check(has_org_role(organization_id,array['owner','admin']::app_role[]));
create policy audit_access on audit_events for select using(has_org_role(organization_id,array['owner','managing_partner','admin']::app_role[]));

do $$ begin if exists(select 1 from pg_roles where rolname='nyayaflow_app') then
  grant usage on schema public to nyayaflow_app;
  grant select,insert,update,delete on all tables in schema public to nyayaflow_app;
  grant usage,select on all sequences in schema public to nyayaflow_app;
  grant execute on function document_search(text),claim_background_job(text),current_app_user_id(),is_org_member(uuid),has_org_role(uuid,app_role[]),can_access_matter(uuid,matter_permission) to nyayaflow_app;
end if; end $$;

do $$ begin if exists(select 1 from pg_roles where rolname='nyayaflow_worker') then
  grant usage on schema public to nyayaflow_worker;
  grant select,insert,update on documents,document_versions,ocr_pages,background_jobs,outbox_events to nyayaflow_worker;
  grant usage,select on all sequences in schema public to nyayaflow_worker;
  grant execute on function claim_background_job(text) to nyayaflow_worker;
end if; end $$;

commit;
