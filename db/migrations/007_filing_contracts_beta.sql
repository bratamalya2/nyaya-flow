begin;

-- Internal-only preparation workspaces. None of these tables stores a court receipt,
-- signing-provider credential, stamp purchase, or external submission reference.
create table filing_rule_packs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  forum text not null check (char_length(forum) between 2 and 200),
  name text not null check (char_length(name) between 2 and 240),
  version text not null check (char_length(version) between 1 and 80),
  source_reference text not null check (char_length(source_reference) between 3 and 2000),
  source_state source_state not null default 'unverified',
  effective_from date,
  effective_until date,
  enabled boolean not null default false,
  is_fixture boolean not null default false,
  created_by uuid not null references app_users(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (effective_until is null or effective_from is null or effective_until >= effective_from),
  unique(organization_id,forum,version), unique(organization_id,id)
);

create table filing_bundles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  matter_id uuid not null references matters(id) on delete cascade,
  rule_pack_id uuid not null references filing_rule_packs(id) on delete restrict,
  title text not null check (char_length(title) between 3 and 240),
  review_state text not null default 'draft' check (review_state in ('draft','review_required','approved','exported','blocked')),
  created_by uuid not null references app_users(id) on delete restrict,
  approved_by uuid references app_users(id) on delete restrict,
  approved_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (organization_id,matter_id) references matters(organization_id,id) on delete cascade,
  foreign key (organization_id,rule_pack_id) references filing_rule_packs(organization_id,id) on delete restrict,
  check ((review_state <> 'approved' and review_state <> 'exported') or (approved_by is not null and approved_at is not null)),
  unique(organization_id,id)
);

create table filing_bundle_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  bundle_id uuid not null references filing_bundles(id) on delete cascade,
  document_version_id uuid not null references document_versions(id) on delete restrict,
  label text not null check (char_length(label) between 1 and 240),
  sort_order integer not null check (sort_order >= 0),
  folio_start integer check (folio_start is null or folio_start > 0),
  folio_end integer check (folio_end is null or folio_end >= folio_start),
  document_sha256 text not null check (document_sha256 ~ '^[a-fA-F0-9]{64}$'),
  created_at timestamptz not null default now(),
  foreign key (organization_id,bundle_id) references filing_bundles(organization_id,id) on delete cascade,
  foreign key (organization_id,document_version_id) references document_versions(organization_id,id) on delete restrict,
  unique(bundle_id,document_version_id), unique(bundle_id,sort_order)
);

create table filing_findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  bundle_id uuid not null references filing_bundles(id) on delete cascade,
  rule_key text not null check (char_length(rule_key) between 1 and 120),
  rule_version text not null check (char_length(rule_version) between 1 and 80),
  outcome text not null check (outcome in ('pass','warning','fail','manual_review')),
  evidence text not null check (char_length(evidence) between 1 and 4000),
  source_reference text not null check (char_length(source_reference) between 1 and 2000),
  review_state text not null default 'review_required' check (review_state in ('review_required','reviewed','dismissed')),
  reviewed_by uuid references app_users(id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (organization_id,bundle_id) references filing_bundles(organization_id,id) on delete cascade
);

create table filing_exports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  bundle_id uuid not null references filing_bundles(id) on delete cascade,
  manifest_sha256 text not null check (manifest_sha256 ~ '^[a-fA-F0-9]{64}$'),
  export_kind text not null default 'local_manifest' check (export_kind='local_manifest'),
  created_by uuid not null references app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (organization_id,bundle_id) references filing_bundles(organization_id,id) on delete cascade
);

create table contract_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 240),
  version text not null check (char_length(version) between 1 and 80),
  body text not null check (char_length(body) between 1 and 50000),
  source_reference text not null check (char_length(source_reference) between 2 and 2000),
  source_state source_state not null default 'unverified',
  status text not null default 'draft' check (status in ('draft','approved','retired')),
  is_fixture boolean not null default false,
  approved_by uuid references app_users(id) on delete restrict,
  approved_at timestamptz,
  created_by uuid not null references app_users(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(organization_id,title,version)
);

create table contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  matter_id uuid references matters(id) on delete set null,
  title text not null check (char_length(title) between 3 and 240),
  counterparty text not null check (char_length(counterparty) between 2 and 240),
  status text not null default 'draft' check (status in ('draft','review_required','approved','executed','blocked')),
  template_snapshot jsonb not null default '{}'::jsonb,
  current_document_version_id uuid references document_versions(id) on delete set null,
  created_by uuid not null references app_users(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (organization_id,matter_id) references matters(organization_id,id) on delete set null,
  foreign key (organization_id,current_document_version_id) references document_versions(organization_id,id) on delete set null,
  unique(organization_id,id)
);

create table contract_clause_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  contract_id uuid not null references contracts(id) on delete cascade,
  clause_label text not null check (char_length(clause_label) between 1 and 240),
  source_locator text not null check (char_length(source_locator) between 1 and 500),
  finding text not null check (finding in ('no_issue','review_required','high_risk')),
  note text not null check (char_length(note) between 1 and 5000),
  review_state text not null default 'open' check (review_state in ('open','in_review','reviewed','dismissed')),
  assigned_to uuid references app_users(id) on delete set null,
  reviewed_by uuid references app_users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (organization_id,contract_id) references contracts(organization_id,id) on delete cascade
);

create table contract_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  contract_id uuid not null references contracts(id) on delete cascade,
  decision text not null check (decision in ('approved','rejected')),
  note text check (note is null or char_length(note) <= 2000),
  decided_by uuid not null references app_users(id) on delete restrict,
  decided_at timestamptz not null default now(),
  foreign key (organization_id,contract_id) references contracts(organization_id,id) on delete cascade
);

create table contract_executions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  contract_id uuid not null references contracts(id) on delete cascade,
  method text not null default 'manual' check (method='manual'),
  status text not null default 'unverified' check (status in ('unverified','verified')),
  reference_note text check (reference_note is null or char_length(reference_note) <= 2000),
  recorded_by uuid not null references app_users(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  foreign key (organization_id,contract_id) references contracts(organization_id,id) on delete cascade,
  unique(contract_id)
);

do $$ declare table_name text; begin
  foreach table_name in array array['filing_rule_packs','filing_bundles','filing_findings','contract_templates','contracts','contract_clause_reviews'] loop
    execute format('create trigger %I_updated before update on %I for each row execute function set_updated_at()',table_name,table_name);
  end loop;
end $$;

create index filing_bundles_matter_idx on filing_bundles(organization_id,matter_id,updated_at desc);
create index contracts_matter_idx on contracts(organization_id,matter_id,updated_at desc);
create index contract_clause_reviews_contract_idx on contract_clause_reviews(contract_id,review_state);

do $$ declare table_name text; begin
  foreach table_name in array array['filing_rule_packs','filing_bundles','filing_bundle_entries','filing_findings','filing_exports','contract_templates','contracts','contract_clause_reviews','contract_approvals','contract_executions'] loop
    execute format('alter table %I enable row level security',table_name);
    execute format('alter table %I force row level security',table_name);
  end loop;
end $$;

create policy filing_rule_packs_select on filing_rule_packs for select using(is_org_member(organization_id));
create policy filing_rule_packs_write on filing_rule_packs for all using(has_org_role(organization_id,array['owner','admin']::app_role[])) with check(has_org_role(organization_id,array['owner','admin']::app_role[]));
create policy filing_bundles_select on filing_bundles for select using(is_org_member(organization_id) and can_access_matter(matter_id,'view'));
create policy filing_bundles_write on filing_bundles for all using(can_access_matter(matter_id,'edit')) with check(can_access_matter(matter_id,'edit'));
create policy filing_entries_select on filing_bundle_entries for select using(exists(select 1 from filing_bundles b where b.id=bundle_id and can_access_matter(b.matter_id,'view')));
create policy filing_entries_write on filing_bundle_entries for all using(exists(select 1 from filing_bundles b where b.id=bundle_id and can_access_matter(b.matter_id,'edit'))) with check(exists(select 1 from filing_bundles b where b.id=bundle_id and can_access_matter(b.matter_id,'edit')));
create policy filing_findings_select on filing_findings for select using(exists(select 1 from filing_bundles b where b.id=bundle_id and can_access_matter(b.matter_id,'view')));
create policy filing_findings_write on filing_findings for all using(exists(select 1 from filing_bundles b where b.id=bundle_id and can_access_matter(b.matter_id,'edit'))) with check(exists(select 1 from filing_bundles b where b.id=bundle_id and can_access_matter(b.matter_id,'edit')));
create policy filing_exports_select on filing_exports for select using(exists(select 1 from filing_bundles b where b.id=bundle_id and can_access_matter(b.matter_id,'export')));
create policy filing_exports_insert on filing_exports for insert with check(exists(select 1 from filing_bundles b where b.id=bundle_id and can_access_matter(b.matter_id,'export')));

create policy contract_templates_select on contract_templates for select using(is_org_member(organization_id));
create policy contract_templates_write on contract_templates for all using(has_org_role(organization_id,array['owner','admin']::app_role[])) with check(has_org_role(organization_id,array['owner','admin']::app_role[]));
create policy contracts_select on contracts for select using(is_org_member(organization_id) and (matter_id is null or can_access_matter(matter_id,'view')));
create policy contracts_write on contracts for all using(is_org_member(organization_id) and (matter_id is null or can_access_matter(matter_id,'edit'))) with check(is_org_member(organization_id) and (matter_id is null or can_access_matter(matter_id,'edit')));
create policy clause_reviews_select on contract_clause_reviews for select using(exists(select 1 from contracts c where c.id=contract_id and (c.matter_id is null or can_access_matter(c.matter_id,'view'))));
create policy clause_reviews_write on contract_clause_reviews for all using(exists(select 1 from contracts c where c.id=contract_id and (c.matter_id is null or can_access_matter(c.matter_id,'edit')))) with check(exists(select 1 from contracts c where c.id=contract_id and (c.matter_id is null or can_access_matter(c.matter_id,'edit'))));
create policy contract_approvals_select on contract_approvals for select using(exists(select 1 from contracts c where c.id=contract_id and (c.matter_id is null or can_access_matter(c.matter_id,'view'))));
create policy contract_approvals_insert on contract_approvals for insert with check(exists(select 1 from contracts c where c.id=contract_id and is_org_member(c.organization_id) and (c.matter_id is null or can_access_matter(c.matter_id,'manage'))));
create policy contract_executions_select on contract_executions for select using(exists(select 1 from contracts c where c.id=contract_id and (c.matter_id is null or can_access_matter(c.matter_id,'view'))));
create policy contract_executions_insert on contract_executions for insert with check(exists(select 1 from contracts c where c.id=contract_id and is_org_member(c.organization_id) and (c.matter_id is null or can_access_matter(c.matter_id,'edit'))));

revoke all on filing_rule_packs,filing_bundles,filing_bundle_entries,filing_findings,filing_exports,contract_templates,contracts,contract_clause_reviews,contract_approvals,contract_executions from public;
do $$ begin if exists(select 1 from pg_roles where rolname='nyayaflow_app') then
  grant select,insert,update on filing_rule_packs,filing_bundles,filing_bundle_entries,filing_findings,filing_exports,contract_templates,contracts,contract_clause_reviews,contract_approvals,contract_executions to nyayaflow_app;
end if; end $$;

commit;
