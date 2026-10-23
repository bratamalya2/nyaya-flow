begin;

-- A provision is globally shared only through a recorded, enabled source. It holds source text
-- and version metadata, never firm documents or client facts.
create table transition_provisions (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references research_sources(id) on delete restrict,
  code text not null check (code in ('IPC','CrPC','IEA','BNS','BNSS','BSA')),
  section_number text not null check (char_length(section_number) between 1 and 80),
  heading text not null check (char_length(heading) between 2 and 500),
  operative_text text,
  effective_from date,
  effective_until date,
  source_edition text not null default '1.0',
  source_state source_state not null default 'unverified',
  content_sha256 text not null check (content_sha256 ~ '^[a-fA-F0-9]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_until is null or effective_from is null or effective_until >= effective_from),
  unique(source_id, code, section_number, source_edition)
);
create index transition_provisions_code_section_idx on transition_provisions(code,section_number);

create table transition_mappings (
  id uuid primary key default gen_random_uuid(),
  legacy_provision_id uuid not null references transition_provisions(id) on delete restrict,
  current_provision_id uuid references transition_provisions(id) on delete restrict,
  relation text not null check (relation in ('renumbered','consolidated','split','repealed_without_equivalent','procedural_continuity','unknown')),
  mapping_note text not null check (char_length(mapping_note) between 1 and 5000),
  source_state source_state not null default 'unverified',
  reviewed_at timestamptz,
  reviewer_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_provision_id is null or current_provision_id <> legacy_provision_id),
  unique(legacy_provision_id,current_provision_id,relation)
);
create index transition_mappings_legacy_idx on transition_mappings(legacy_provision_id);
create index transition_mappings_current_idx on transition_mappings(current_provision_id);

-- Saving a worksheet is optional. It records inputs and review state, never a legal conclusion.
create table transition_worksheets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  matter_id uuid references matters(id) on delete set null,
  mapping_id uuid references transition_mappings(id) on delete set null,
  offence_date date,
  fir_date date,
  proceeding_date date,
  review_state text not null default 'draft' check (review_state in ('draft','review_required','reviewed','blocked')),
  notes text check (notes is null or char_length(notes) <= 10000),
  created_by uuid not null references app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index transition_worksheets_org_updated_idx on transition_worksheets(organization_id,updated_at desc);

do $$ declare table_name text; begin
  foreach table_name in array array['transition_provisions','transition_mappings','transition_worksheets'] loop
    execute format('create trigger %I_updated before update on %I for each row execute function set_updated_at()',table_name,table_name);
  end loop;
end $$;

alter table transition_provisions enable row level security;
alter table transition_provisions force row level security;
alter table transition_mappings enable row level security;
alter table transition_mappings force row level security;
alter table transition_worksheets enable row level security;
alter table transition_worksheets force row level security;

create policy transition_provisions_select on transition_provisions for select using(exists(
  select 1 from research_sources s where s.id=source_id and s.enabled
) and exists(select 1 from memberships m where m.user_id=current_app_user_id() and m.active));
create policy transition_mappings_select on transition_mappings for select using(exists(
  select 1 from transition_provisions p join research_sources s on s.id=p.source_id
  where p.id=legacy_provision_id and s.enabled
) and exists(select 1 from memberships m where m.user_id=current_app_user_id() and m.active));
create policy transition_worksheets_select on transition_worksheets for select using(
  is_org_member(organization_id) and (matter_id is null or can_access_matter(matter_id,'view'))
);
create policy transition_worksheets_insert on transition_worksheets for insert with check(
  has_org_role(organization_id,array['owner','managing_partner','admin','advocate','associate','paralegal']::app_role[])
  and created_by=current_app_user_id() and (matter_id is null or can_access_matter(matter_id,'edit'))
);
create policy transition_worksheets_update on transition_worksheets for update using(
  (created_by=current_app_user_id() or has_org_role(organization_id,array['owner','managing_partner','admin']::app_role[]))
  and (matter_id is null or can_access_matter(matter_id,'edit'))
) with check(is_org_member(organization_id) and (matter_id is null or can_access_matter(matter_id,'edit')));

revoke all on transition_provisions,transition_mappings,transition_worksheets from public;
do $$ begin if exists(select 1 from pg_roles where rolname='nyayaflow_app') then
  grant select on transition_provisions,transition_mappings,transition_worksheets to nyayaflow_app;
  grant insert,update on transition_worksheets to nyayaflow_app;
end if; end $$;
do $$ begin if exists(select 1 from pg_roles where rolname='nyayaflow_worker') then
  grant select,insert,update,delete on transition_provisions,transition_mappings to nyayaflow_worker;
end if; end $$;

commit;
