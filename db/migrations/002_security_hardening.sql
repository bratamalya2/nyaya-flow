begin;

-- The security-definer RLS helpers (is_org_member, has_org_role, can_access_matter, seal_audit_event)
-- read tables that have FORCE ROW LEVEL SECURITY. Unless their owner bypasses RLS they recurse into
-- their own policies ("stack depth limit exceeded"), so refuse to migrate without that attribute.
do $$ begin
  if not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then
    raise exception 'Run migrations as the schema owner role created WITH BYPASSRLS (see README).';
  end if;
end $$;
do $$ begin
  if exists(select 1 from pg_proc where proname='can_access_matter' and pg_get_userbyid(proowner)<>current_user) then
    raise exception 'Run migrations as the same role that owns the existing schema functions.';
  end if;
end $$;

-- Matter lead (FR-010); existing matters default to their creator.
alter table matters add column lead_id uuid references app_users(id);
update matters set lead_id=created_by where lead_id is null;

-- ---------------------------------------------------------------------------------------------
-- Tenant consistency: child rows must belong to the same organization as their parent.
-- ---------------------------------------------------------------------------------------------
alter table matters add constraint matters_org_id_key unique (organization_id,id);
alter table documents add constraint documents_org_id_key unique (organization_id,id);
alter table document_versions add constraint document_versions_org_id_key unique (organization_id,id);
alter table ocr_pages add constraint ocr_pages_org_id_key unique (organization_id,id);
alter table hearings add constraint hearings_org_id_key unique (organization_id,id);

do $$ declare t text; begin
  foreach t in array array['matter_grants','parties','hearings','tasks','documents','upload_intents','legal_holds','source_records'] loop
    execute format('alter table %I add constraint %I foreign key (organization_id,matter_id) references matters(organization_id,id) on delete cascade', t, t || '_matter_org_fk');
  end loop;
end $$;
alter table document_versions add constraint document_versions_document_org_fk foreign key (organization_id,document_id) references documents(organization_id,id) on delete cascade;
alter table upload_intents add constraint upload_intents_version_org_fk foreign key (organization_id,document_version_id) references document_versions(organization_id,id) on delete cascade;
alter table ocr_pages add constraint ocr_pages_version_org_fk foreign key (organization_id,document_version_id) references document_versions(organization_id,id) on delete cascade;
alter table ocr_corrections add constraint ocr_corrections_page_org_fk foreign key (organization_id,ocr_page_id) references ocr_pages(organization_id,id) on delete cascade;

-- ---------------------------------------------------------------------------------------------
-- Matter access: explicit role matrix for non-restricted matters; grants add access on top.
--   view            every active member
--   edit            owner, managing_partner, admin, advocate, associate, paralegal
--   manage/export   owner, managing_partner, admin
-- Restricted matters: owner, managing_partner, admin, or an explicit unexpired grant.
-- ---------------------------------------------------------------------------------------------
create or replace function can_access_matter(target uuid,required matter_permission default 'view') returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from matters m
    join memberships ms on ms.organization_id=m.organization_id and ms.user_id=current_app_user_id() and ms.active
    where m.id=target and (
      ms.role in ('owner','managing_partner','admin')
      or (not m.restricted and case required
            when 'view' then true
            when 'edit' then ms.role in ('advocate','associate','paralegal')
            else false end)
      or exists(
        select 1 from matter_grants g
        where g.matter_id=m.id and g.user_id=current_app_user_id() and (g.expires_at is null or g.expires_at>now()) and
          case required
            when 'view' then g.permission in ('view','edit','manage','export')
            when 'edit' then g.permission in ('edit','manage')
            when 'manage' then g.permission='manage'
            when 'export' then g.permission in ('export','manage') end)))
$$;

create or replace function is_active_member(org_id uuid,member uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from memberships where organization_id=org_id and user_id=member and active)
$$;

-- RLS lets any editor update a matter row; restriction changes must additionally require manage,
-- otherwise an edit grant on a restricted matter could publish it to the whole firm.
create function guard_matter_update() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.organization_id<>old.organization_id or new.created_by<>old.created_by then
    raise exception 'Matter organization and creator cannot be changed.' using errcode='42501';
  end if;
  if new.restricted is distinct from old.restricted and current_app_user_id() is not null and not can_access_matter(old.id,'manage') then
    raise exception 'Changing matter restriction requires manage permission.' using errcode='42501';
  end if;
  return new;
end $$;
create trigger matters_guard before update on matters for each row execute function guard_matter_update();

drop policy matter_insert on matters;
create policy matter_insert on matters for insert with check(
  has_org_role(organization_id,array['owner','managing_partner','admin','advocate','associate','paralegal']::app_role[])
  and created_by=current_app_user_id()
  and (lead_id is null or is_active_member(organization_id,lead_id)));

-- Only owners may create, change, or remove owner memberships and owner invitations.
drop policy membership_manage on memberships;
create policy membership_insert on memberships for insert with check(
  has_org_role(organization_id,array['owner','admin']::app_role[]) and (role<>'owner' or has_org_role(organization_id,array['owner']::app_role[])));
create policy membership_update on memberships for update
  using(has_org_role(organization_id,array['owner','admin']::app_role[]) and (role<>'owner' or has_org_role(organization_id,array['owner']::app_role[])))
  with check(has_org_role(organization_id,array['owner','admin']::app_role[]) and (role<>'owner' or has_org_role(organization_id,array['owner']::app_role[])));
create policy membership_delete on memberships for delete
  using(has_org_role(organization_id,array['owner','admin']::app_role[]) and (role<>'owner' or has_org_role(organization_id,array['owner']::app_role[])));

drop policy invitation_manage on invitations;
create policy invitation_manage on invitations for all
  using(has_org_role(organization_id,array['owner','admin']::app_role[]))
  with check(has_org_role(organization_id,array['owner','admin']::app_role[]) and (role<>'owner' or has_org_role(organization_id,array['owner']::app_role[])));

-- Grants may only name active members of the matter's organization.
drop policy grant_manage on matter_grants;
create policy grant_manage on matter_grants for all using(can_access_matter(matter_id,'manage'))
  with check(can_access_matter(matter_id,'manage') and is_active_member(organization_id,user_id));

-- Hearing advocates and task assignees must be active members.
drop policy hearing_write on hearings;
create policy hearing_write on hearings for all using(can_access_matter(matter_id,'edit'))
  with check(can_access_matter(matter_id,'edit') and is_active_member(organization_id,advocate_id));
drop policy task_write on tasks;
create policy task_write on tasks for all using(can_access_matter(matter_id,'edit'))
  with check(can_access_matter(matter_id,'edit') and (assignee_id is null or is_active_member(organization_id,assignee_id)));

drop policy ocr_correct on ocr_pages;
create policy ocr_correct on ocr_pages for update
  using(exists(select 1 from document_versions v join documents d on d.id=v.document_id where v.id=document_version_id and can_access_matter(d.matter_id,'edit')))
  with check(exists(select 1 from document_versions v join documents d on d.id=v.document_id where v.id=document_version_id and can_access_matter(d.matter_id,'edit')));

-- OCR corrections contain document text: scope them to the matter, not the whole firm.
drop policy correction_access on ocr_corrections;
drop policy correction_insert on ocr_corrections;
create policy correction_access on ocr_corrections for select using(exists(
  select 1 from ocr_pages p join document_versions v on v.id=p.document_version_id join documents d on d.id=v.document_id
  where p.id=ocr_page_id and can_access_matter(d.matter_id,'view')));
create policy correction_insert on ocr_corrections for insert with check(corrected_by=current_app_user_id() and exists(
  select 1 from ocr_pages p join document_versions v on v.id=p.document_version_id join documents d on d.id=v.document_id
  where p.id=ocr_page_id and can_access_matter(d.matter_id,'edit')));

-- ---------------------------------------------------------------------------------------------
-- Matter lead, edit history, and conflict dismissals (FR-010, FR-011, FR-012).
-- ---------------------------------------------------------------------------------------------
create table record_revisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  matter_id uuid not null,
  resource_type text not null check (resource_type in ('matter','hearing','task')),
  resource_id uuid not null,
  previous jsonb not null,
  changes jsonb not null,
  reason text not null check (char_length(reason) between 3 and 500),
  changed_by uuid not null references app_users(id),
  changed_at timestamptz not null default now(),
  foreign key (organization_id,matter_id) references matters(organization_id,id) on delete cascade
);
create index record_revisions_resource_idx on record_revisions(resource_type,resource_id,changed_at desc);

create table conflict_dismissals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  first_hearing_id uuid not null,
  second_hearing_id uuid not null,
  reason text not null check (char_length(reason) between 3 and 500),
  dismissed_by uuid not null references app_users(id),
  dismissed_at timestamptz not null default now(),
  check (first_hearing_id < second_hearing_id),
  unique (first_hearing_id,second_hearing_id),
  foreign key (organization_id,first_hearing_id) references hearings(organization_id,id) on delete cascade,
  foreign key (organization_id,second_hearing_id) references hearings(organization_id,id) on delete cascade
);

-- ---------------------------------------------------------------------------------------------
-- Tamper-evident audit chain: per-organization position assigned under a lock, canonical hash
-- input, chain head kept outside RLS, append-only for the application.
-- ---------------------------------------------------------------------------------------------
create function audit_event_hash(p_index bigint,p_org uuid,p_actor uuid,p_action text,p_resource_type text,p_resource_id text,p_outcome text,p_correlation text,p_created timestamptz,p_metadata jsonb,p_prior text)
returns text language sql immutable set search_path=public as $$
  select encode(digest(jsonb_build_array(p_index,p_org,p_actor,p_action,p_resource_type,p_resource_id,p_outcome,p_correlation,
    to_char(p_created at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),p_metadata,p_prior)::text,'sha256'),'hex')
$$;

create table audit_chain_heads (
  organization_id uuid primary key references organizations(id) on delete cascade,
  last_index bigint not null,
  last_hash text not null,
  updated_at timestamptz not null default now()
);

alter table audit_events add column chain_index bigint;
alter table audit_events alter column chain_hash set default '';

do $$ declare r record; prior text; idx bigint; org uuid; begin
  alter table audit_events disable trigger audit_append_only;
  for r in select * from audit_events order by organization_id,created_at,id loop
    if org is distinct from r.organization_id then org:=r.organization_id; prior:=null; idx:=0; end if;
    idx:=idx+1;
    update audit_events set chain_index=idx,previous_hash=prior,
      chain_hash=audit_event_hash(idx,r.organization_id,r.actor_id,r.action,r.resource_type,r.resource_id,r.outcome,r.correlation_id,r.created_at,r.metadata,prior)
      where id=r.id returning chain_hash into prior;
  end loop;
  alter table audit_events enable trigger audit_append_only;
end $$;
insert into audit_chain_heads(organization_id,last_index,last_hash)
  select distinct on (organization_id) organization_id,chain_index,chain_hash from audit_events order by organization_id,chain_index desc;
alter table audit_events alter column chain_index set not null;
create unique index audit_events_chain_idx on audit_events(organization_id,chain_index);

create or replace function seal_audit_event() returns trigger language plpgsql security definer set search_path=public as $$
declare head audit_chain_heads;
begin
  perform pg_advisory_xact_lock(hashtext('nyayaflow-audit:' || new.organization_id::text));
  select * into head from audit_chain_heads where organization_id=new.organization_id;
  new.created_at:=now();
  new.chain_index:=coalesce(head.last_index,0)+1;
  new.previous_hash:=head.last_hash;
  new.chain_hash:=audit_event_hash(new.chain_index,new.organization_id,new.actor_id,new.action,new.resource_type,new.resource_id,new.outcome,new.correlation_id,new.created_at,new.metadata,new.previous_hash);
  insert into audit_chain_heads(organization_id,last_index,last_hash) values(new.organization_id,new.chain_index,new.chain_hash)
    on conflict(organization_id) do update set last_index=excluded.last_index,last_hash=excluded.last_hash,updated_at=now();
  return new;
end $$;

create function verify_audit_chain(p_org uuid) returns table(ok boolean,checked bigint,first_bad_index bigint)
language plpgsql stable security definer set search_path=public as $$
declare r record; prior text; expected bigint:=0; head audit_chain_heads;
begin
  checked:=0;
  for r in select * from audit_events where organization_id=p_org order by chain_index loop
    expected:=expected+1; checked:=checked+1;
    if r.chain_index<>expected or r.previous_hash is distinct from prior or r.chain_hash<>audit_event_hash(r.chain_index,r.organization_id,r.actor_id,r.action,r.resource_type,r.resource_id,r.outcome,r.correlation_id,r.created_at,r.metadata,r.previous_hash) then
      ok:=false; first_bad_index:=r.chain_index; return next; return;
    end if;
    prior:=r.chain_hash;
  end loop;
  select * into head from audit_chain_heads where organization_id=p_org;
  if (head.organization_id is null and expected>0) or (head.organization_id is not null and (head.last_index<>expected or head.last_hash is distinct from prior)) then
    ok:=false; first_bad_index:=expected; return next; return;
  end if;
  ok:=true; first_bad_index:=null; return next;
end $$;

create table audit_verifications (
  id bigint generated always as identity primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  verified_at timestamptz not null default now(),
  ok boolean not null,
  checked_count bigint not null,
  first_bad_index bigint
);
create index audit_verifications_org_idx on audit_verifications(organization_id,verified_at desc);

create policy audit_insert on audit_events for insert with check(is_org_member(organization_id) and actor_id is not distinct from current_app_user_id());

-- ---------------------------------------------------------------------------------------------
-- Authentication hardening: TOTP replay protection, throttling, invitation acceptance.
-- ---------------------------------------------------------------------------------------------
alter table app_users add column mfa_last_step bigint;

create table auth_throttle (
  bucket text primary key,
  failures integer not null default 0,
  window_started_at timestamptz not null default now(),
  locked_until timestamptz
);

create function invitation_lookup(p_token_hash text) returns table(organization_name text,email citext,role app_role,expires_at timestamptz)
language sql stable security definer set search_path=public as $$
  select o.name,i.email,i.role,i.expires_at from invitations i join organizations o on o.id=i.organization_id
  where i.token_hash=p_token_hash and i.accepted_at is null and i.revoked_at is null and i.expires_at>now()
$$;

create function accept_invitation(p_token_hash text,p_user_id uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare inv invitations;
begin
  select * into inv from invitations where token_hash=p_token_hash and accepted_at is null and revoked_at is null and expires_at>now() for update;
  if inv.id is null then raise exception 'Invitation is invalid or expired.' using errcode='P0002'; end if;
  if not exists(select 1 from app_users where id=p_user_id and email=inv.email and disabled_at is null) then
    raise exception 'Invitation belongs to a different account.' using errcode='P0001';
  end if;
  insert into memberships(organization_id,user_id,role,active,mfa_required) values(inv.organization_id,p_user_id,inv.role,true,true)
    on conflict(organization_id,user_id) do update set role=excluded.role,active=true,mfa_required=true;
  update invitations set accepted_at=now() where id=inv.id;
  return inv.organization_id;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Consent withdrawal attribution; data requests link to a matter so legal holds can block erasure.
-- ---------------------------------------------------------------------------------------------
alter table consent_records add column withdrawn_by uuid references app_users(id);
alter table data_requests add column matter_id uuid;
alter table data_requests add constraint data_requests_matter_org_fk foreign key (organization_id,matter_id) references matters(organization_id,id) on delete set null (matter_id);
alter table data_requests add column hold_reviewed_by uuid references app_users(id);
alter table data_requests add column hold_reviewed_at timestamptz;
alter table data_requests add column hold_review_note text;

-- ---------------------------------------------------------------------------------------------
-- Search: organization-scoped and evaluated under the caller's own RLS.
-- ---------------------------------------------------------------------------------------------
drop function document_search(text);
create function document_search(search_query text,p_org uuid) returns table(document_id uuid,version_id uuid,matter_id uuid,page_number integer,title text,snippet text,rank real)
language sql stable set search_path=public as $$
  select d.id,v.id,d.matter_id,p.page_number,d.title,
    ts_headline('simple',coalesce(p.corrected_text,p.extracted_text),websearch_to_tsquery('simple',search_query),'MaxFragments=2, MaxWords=32, StartSel=«, StopSel=»'),
    ts_rank(p.search_vector,websearch_to_tsquery('simple',search_query))
  from ocr_pages p join document_versions v on v.id=p.document_version_id join documents d on d.id=v.document_id
  where d.organization_id=p_org and v.status='ready' and p.search_vector@@websearch_to_tsquery('simple',search_query)
  order by 7 desc limit 50
$$;

-- ---------------------------------------------------------------------------------------------
-- Job queue isolation: the web role may enqueue, never read, lease, or rewrite jobs.
-- ---------------------------------------------------------------------------------------------
alter table background_jobs enable row level security;
alter table background_jobs force row level security;
create policy job_enqueue on background_jobs for insert with check(is_org_member(organization_id) and status='queued' and attempts=0);
alter table outbox_events enable row level security;
alter table outbox_events force row level security;

do $$ declare t text; begin
  foreach t in array array['record_revisions','conflict_dismissals','audit_verifications'] loop
    execute format('alter table %I enable row level security',t);
    execute format('alter table %I force row level security',t);
  end loop;
end $$;
create policy revision_access on record_revisions for select using(can_access_matter(matter_id,'view'));
create policy revision_insert on record_revisions for insert with check(changed_by=current_app_user_id() and can_access_matter(matter_id,'edit'));
create policy dismissal_access on conflict_dismissals for select using(
  exists(select 1 from hearings h where h.id=first_hearing_id) and exists(select 1 from hearings h where h.id=second_hearing_id));
create policy dismissal_insert on conflict_dismissals for insert with check(dismissed_by=current_app_user_id() and
  exists(select 1 from hearings h where h.id=first_hearing_id and can_access_matter(h.matter_id,'edit')) and
  exists(select 1 from hearings h where h.id=second_hearing_id and can_access_matter(h.matter_id,'view')));
create policy verification_access on audit_verifications for select using(has_org_role(organization_id,array['owner','managing_partner','admin']::app_role[]));

-- ---------------------------------------------------------------------------------------------
-- Privileges. Functions are executable by PUBLIC by default; narrow the sensitive ones.
-- ---------------------------------------------------------------------------------------------
revoke execute on function claim_background_job(text) from public;
revoke execute on function verify_audit_chain(uuid) from public;
revoke execute on function accept_invitation(text,uuid) from public;
revoke execute on function invitation_lookup(text) from public;
revoke all on audit_chain_heads from public;

do $$ begin if exists(select 1 from pg_roles where rolname='nyayaflow_app') then
  revoke execute on function claim_background_job(text) from nyayaflow_app;
  revoke update,delete,truncate on audit_events from nyayaflow_app;
  revoke select,update,delete,truncate on background_jobs from nyayaflow_app;
  revoke all on outbox_events from nyayaflow_app;
  revoke update,delete,truncate on ocr_corrections from nyayaflow_app;
  grant select,insert on record_revisions,conflict_dismissals to nyayaflow_app;
  grant select on audit_verifications to nyayaflow_app;
  grant select,insert,update,delete on auth_throttle to nyayaflow_app;
  grant execute on function document_search(text,uuid),is_active_member(uuid,uuid),accept_invitation(text,uuid),invitation_lookup(text) to nyayaflow_app;
end if; end $$;

do $$ begin if exists(select 1 from pg_roles where rolname='nyayaflow_worker') then
  grant delete on ocr_pages to nyayaflow_worker;
  grant select on organizations to nyayaflow_worker;
  grant insert on audit_events to nyayaflow_worker;
  grant select,insert on audit_verifications to nyayaflow_worker;
  grant execute on function verify_audit_chain(uuid) to nyayaflow_worker;
end if; end $$;

commit;
