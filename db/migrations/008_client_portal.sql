begin;

-- Portal clients are app users solely so their Vault uploads retain a real uploader identity.
-- They never receive a membership or app_role and therefore cannot enter the firm workspace.
alter table app_users add column is_portal_client boolean not null default false;

create table portal_clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  display_name text not null check(char_length(display_name) between 2 and 200),
  created_at timestamptz not null default now(), disabled_at timestamptz,
  unique(organization_id,user_id), unique(organization_id,id)
);
create table portal_sessions (
  id uuid primary key default gen_random_uuid(), client_id uuid not null references portal_clients(id) on delete cascade,
  token_hash text not null unique, expires_at timestamptz not null, last_seen_at timestamptz not null default now(), revoked_at timestamptz,
  created_at timestamptz not null default now(), ip_hash text not null, user_agent_hash text not null
);
create table portal_invitations (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  matter_id uuid not null references matters(id) on delete cascade, client_id uuid not null references portal_clients(id) on delete cascade,
  token_hash text not null unique, expires_at timestamptz not null, accepted_at timestamptz, revoked_at timestamptz,
  created_by uuid not null references app_users(id), created_at timestamptz not null default now(),
  foreign key(organization_id,matter_id) references matters(organization_id,id) on delete cascade,
  foreign key(organization_id,client_id) references portal_clients(organization_id,id) on delete cascade
);
create table portal_matter_grants (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  matter_id uuid not null references matters(id) on delete cascade, client_id uuid not null references portal_clients(id) on delete cascade,
  starts_at timestamptz not null default now(), expires_at timestamptz not null, revoked_at timestamptz, revoked_by uuid references app_users(id),
  granted_by uuid not null references app_users(id), created_at timestamptz not null default now(),
  foreign key(organization_id,matter_id) references matters(organization_id,id) on delete cascade,
  foreign key(organization_id,client_id) references portal_clients(organization_id,id) on delete cascade
);
create unique index portal_matter_grants_active_idx on portal_matter_grants(matter_id,client_id) where revoked_at is null;
create table portal_milestones (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  matter_id uuid not null references matters(id) on delete cascade, title text not null check(char_length(title) between 3 and 240), body text not null check(char_length(body) between 1 and 5000),
  occurred_at timestamptz not null default now(), source_state source_state not null default 'manual', status text not null default 'draft' check(status in ('draft','published','withdrawn')),
  published_by uuid references app_users(id), published_at timestamptz, created_by uuid not null references app_users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(organization_id,matter_id) references matters(organization_id,id) on delete cascade
);
create table portal_milestone_audiences (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  milestone_id uuid not null references portal_milestones(id) on delete cascade, client_id uuid not null references portal_clients(id) on delete cascade,
  created_at timestamptz not null default now(), unique(milestone_id,client_id),
  foreign key(organization_id,client_id) references portal_clients(organization_id,id) on delete cascade
);
create table portal_document_shares (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  matter_id uuid not null references matters(id) on delete cascade, document_version_id uuid not null references document_versions(id) on delete restrict, client_id uuid not null references portal_clients(id) on delete cascade,
  shared_by uuid not null references app_users(id), shared_at timestamptz not null default now(), revoked_at timestamptz, revoked_by uuid references app_users(id),
  foreign key(organization_id,matter_id) references matters(organization_id,id) on delete cascade,
  foreign key(organization_id,document_version_id) references document_versions(organization_id,id) on delete restrict,
  foreign key(organization_id,client_id) references portal_clients(organization_id,id) on delete cascade
);
create unique index portal_document_shares_active_idx on portal_document_shares(document_version_id,client_id) where revoked_at is null;
create table portal_evidence_requests (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  matter_id uuid not null references matters(id) on delete cascade, client_id uuid not null references portal_clients(id) on delete cascade,
  title text not null check(char_length(title) between 3 and 240), instructions text check(instructions is null or char_length(instructions)<=5000), due_at timestamptz,
  status text not null default 'requested' check(status in ('requested','received','cancelled')),
  created_by uuid not null references app_users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(organization_id,matter_id) references matters(organization_id,id) on delete cascade,
  foreign key(organization_id,client_id) references portal_clients(organization_id,id) on delete cascade
);
create table portal_uploads (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  evidence_request_id uuid not null references portal_evidence_requests(id) on delete restrict, document_version_id uuid not null references document_versions(id) on delete restrict,
  client_id uuid not null references portal_clients(id) on delete cascade, review_state text not null default 'pending' check(review_state in ('pending','accepted','rejected')),
  reviewed_by uuid references app_users(id), reviewed_at timestamptz, created_at timestamptz not null default now(),
  foreign key(organization_id,client_id) references portal_clients(organization_id,id) on delete cascade,
  foreign key(organization_id,document_version_id) references document_versions(organization_id,id) on delete restrict, unique(document_version_id)
);
alter table data_requests add column portal_client_id uuid references portal_clients(id) on delete set null;

create function current_portal_client_id() returns uuid language sql stable as $$ select nullif(current_setting('app.portal_client_id',true),'')::uuid $$;
create function current_portal_user_id() returns uuid language sql stable security definer set search_path=public as $$ select user_id from portal_clients where id=current_portal_client_id() $$;
create function can_portal_access_matter(target uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from portal_matter_grants g where g.matter_id=target and g.client_id=current_portal_client_id() and g.revoked_at is null and g.starts_at<=now() and g.expires_at>now())
$$;

do $$ declare t text; begin foreach t in array array['portal_clients','portal_sessions','portal_invitations','portal_matter_grants','portal_milestones','portal_milestone_audiences','portal_document_shares','portal_evidence_requests','portal_uploads'] loop execute format('alter table %I enable row level security',t); execute format('alter table %I force row level security',t); end loop; end $$;
do $$ declare t text; begin foreach t in array array['portal_milestones','portal_evidence_requests'] loop execute format('create trigger %I_updated before update on %I for each row execute function set_updated_at()',t,t); end loop; end $$;

create policy portal_clients_staff on portal_clients for all using(has_org_role(organization_id,array['owner','managing_partner','admin']::app_role[])) with check(has_org_role(organization_id,array['owner','managing_partner','admin']::app_role[]));
create policy portal_clients_self on portal_clients for select using(id=current_portal_client_id());
create policy portal_grants_staff on portal_matter_grants for all using(can_access_matter(matter_id,'manage')) with check(can_access_matter(matter_id,'manage'));
create policy portal_grants_self on portal_matter_grants for select using(client_id=current_portal_client_id());
create policy portal_invites_staff on portal_invitations for all using(can_access_matter(matter_id,'manage')) with check(can_access_matter(matter_id,'manage'));
create policy portal_milestones_staff on portal_milestones for all using(can_access_matter(matter_id,'edit')) with check(can_access_matter(matter_id,'edit'));
create policy portal_milestones_client on portal_milestones for select using(status='published' and exists(select 1 from portal_milestone_audiences a where a.milestone_id=id and a.client_id=current_portal_client_id()) and can_portal_access_matter(matter_id));
create policy portal_audience_staff on portal_milestone_audiences for all using(exists(select 1 from portal_milestones m where m.id=milestone_id and can_access_matter(m.matter_id,'edit'))) with check(exists(select 1 from portal_milestones m where m.id=milestone_id and can_access_matter(m.matter_id,'edit')));
create policy portal_shares_staff on portal_document_shares for all using(can_access_matter(matter_id,'manage')) with check(can_access_matter(matter_id,'manage'));
create policy portal_shares_client on portal_document_shares for select using(client_id=current_portal_client_id() and revoked_at is null and can_portal_access_matter(matter_id));
create policy portal_evidence_staff on portal_evidence_requests for all using(can_access_matter(matter_id,'edit')) with check(can_access_matter(matter_id,'edit'));
create policy portal_evidence_client on portal_evidence_requests for select using(client_id=current_portal_client_id() and can_portal_access_matter(matter_id));
create policy portal_uploads_staff on portal_uploads for all using(exists(select 1 from portal_evidence_requests r where r.id=evidence_request_id and can_access_matter(r.matter_id,'edit'))) with check(exists(select 1 from portal_evidence_requests r where r.id=evidence_request_id and can_access_matter(r.matter_id,'edit')));
create policy portal_uploads_client on portal_uploads for select using(client_id=current_portal_client_id());
create policy portal_document_insert on documents for insert with check(created_by=current_portal_user_id() and can_portal_access_matter(matter_id));
create policy portal_version_insert on document_versions for insert with check(uploaded_by=current_portal_user_id() and exists(select 1 from documents d where d.id=document_id and d.created_by=current_portal_user_id() and can_portal_access_matter(d.matter_id)));
create policy portal_intent_insert on upload_intents for insert with check(user_id=current_portal_user_id() and can_portal_access_matter(matter_id));
create policy portal_job_enqueue on background_jobs for insert with check(status='queued' and attempts=0 and job_type='malware_scan' and exists(select 1 from document_versions v join documents d on d.id=v.document_id where v.id=(payload->>'documentVersionId')::uuid and d.created_by=current_portal_user_id() and can_portal_access_matter(d.matter_id)));
create policy portal_audit_insert on audit_events for insert with check(actor_id=current_portal_user_id() and exists(select 1 from portal_clients pc where pc.id=current_portal_client_id() and pc.organization_id=audit_events.organization_id));
create policy portal_request_insert on data_requests for insert with check(portal_client_id=current_portal_client_id() and created_by=current_portal_user_id() and exists(select 1 from portal_clients pc where pc.id=current_portal_client_id() and pc.organization_id=data_requests.organization_id));
create policy portal_request_self on data_requests for select using(portal_client_id=current_portal_client_id());

revoke all on portal_clients,portal_sessions,portal_invitations,portal_matter_grants,portal_milestones,portal_milestone_audiences,portal_document_shares,portal_evidence_requests,portal_uploads from public;
do $$ begin if exists(select 1 from pg_roles where rolname='nyayaflow_app') then
  grant select,insert,update on portal_clients,portal_sessions,portal_invitations,portal_matter_grants,portal_milestones,portal_milestone_audiences,portal_document_shares,portal_evidence_requests,portal_uploads to nyayaflow_app;
  grant execute on function current_portal_client_id(),current_portal_user_id(),can_portal_access_matter(uuid) to nyayaflow_app;
end if; end $$;
commit;
