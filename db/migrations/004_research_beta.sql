begin;

-- The authority corpus is globally shared only after source rights are recorded. Firm research
-- activity remains organization-scoped in PostgreSQL and is never projected into Neo4j.
create table research_sources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  name text not null check (char_length(name) between 2 and 240),
  rights_basis text not null check (rights_basis in ('licensed','permission','public_domain','fixture')),
  rights_reference text not null check (char_length(rights_reference) between 3 and 1000),
  attribution text,
  source_state source_state not null default 'unverified',
  is_fixture boolean not null default false,
  enabled boolean not null default false,
  last_published_at timestamptz,
  rights_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((is_fixture and rights_basis = 'fixture') or (not is_fixture and rights_basis <> 'fixture')),
  check (is_fixture or rights_verified_at is not null)
);

create table research_documents (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references research_sources(id) on delete restrict,
  external_id text not null check (char_length(external_id) between 1 and 240),
  title text not null check (char_length(title) between 3 and 500),
  citation text not null check (char_length(citation) between 2 and 500),
  jurisdiction text not null check (char_length(jurisdiction) between 2 and 160),
  court text not null check (char_length(court) between 2 and 200),
  document_type text not null check (document_type in ('judgment','statute','rule','order','commentary')),
  decision_date date,
  bench_strength integer check (bench_strength between 1 and 25),
  bench_metadata_state source_state not null default 'unverified',
  source_url text,
  source_edition text not null default '1.0',
  content_sha256 text not null check (content_sha256 ~ '^[a-fA-F0-9]{64}$'),
  source_state source_state not null default 'unverified',
  published_at timestamptz,
  graph_synced_at timestamptz,
  graph_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_id, external_id)
);
create index research_documents_search_scope_idx on research_documents(jurisdiction,court,document_type,decision_date desc);

create table research_passages (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references research_documents(id) on delete cascade,
  ordinal integer not null check (ordinal > 0 and ordinal <= 100000),
  locator text not null check (char_length(locator) between 1 and 240),
  heading text,
  body text not null check (char_length(body) between 1 and 30000),
  checksum text not null check (checksum ~ '^[a-fA-F0-9]{64}$'),
  search_vector tsvector generated always as (to_tsvector('simple',coalesce(heading,'') || ' ' || body)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(document_id, ordinal),
  unique(document_id, locator)
);
create index research_passages_search_idx on research_passages using gin(search_vector);

create table research_citation_edges (
  id uuid primary key default gen_random_uuid(),
  citing_document_id uuid not null references research_documents(id) on delete cascade,
  cited_document_id uuid not null references research_documents(id) on delete cascade,
  citing_passage_id uuid references research_passages(id) on delete set null,
  cited_passage_id uuid references research_passages(id) on delete set null,
  treatment text not null check (treatment in ('cited','followed','affirmed','distinguished','overruled','doubted','referred_to_larger_bench')),
  evidence_locator text not null check (char_length(evidence_locator) between 1 and 240),
  evidence_text text not null check (char_length(evidence_text) between 1 and 30000),
  source_state source_state not null default 'unverified',
  reviewed_at timestamptz,
  reviewer_reference text,
  graph_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (citing_document_id <> cited_document_id),
  unique(citing_document_id, cited_document_id, evidence_locator)
);
create index research_citation_edges_cited_idx on research_citation_edges(cited_document_id,treatment);
create index research_citation_edges_citing_idx on research_citation_edges(citing_document_id,treatment);

-- This queue is intentionally separate from background_jobs: authority projections do not
-- belong to a firm, and no tenant query, note, matter, or document is ever sent to Neo4j.
create table research_graph_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references research_documents(id) on delete cascade,
  status job_status not null default 'queued',
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 20),
  available_at timestamptz not null default now(),
  leased_until timestamptz,
  leased_by text,
  last_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index research_graph_jobs_claim_idx on research_graph_jobs(status,available_at) where status in ('queued','failed');
create unique index research_graph_jobs_active_document_idx on research_graph_jobs(document_id,status) where status in ('queued','leased','failed');

create function claim_research_graph_job(worker_name text) returns setof research_graph_jobs
language plpgsql security definer set search_path=public as $$
declare claimed research_graph_jobs; begin
  select * into claimed from research_graph_jobs
    where status in ('queued','failed') and available_at<=now() and (leased_until is null or leased_until<now()) and attempts<max_attempts
    order by created_at for update skip locked limit 1;
  if not found then return; end if;
  update research_graph_jobs set status='leased',leased_by=worker_name,leased_until=now()+interval '10 minutes',attempts=attempts+1
    where id=claimed.id returning * into claimed;
  return next claimed;
end $$;

create table research_queries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  created_by uuid not null references app_users(id) on delete restrict,
  query_text text not null check (char_length(query_text) between 2 and 2000),
  filters jsonb not null default '{}'::jsonb,
  result_count integer not null default 0 check (result_count >= 0),
  corpus_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index research_queries_org_time_idx on research_queries(organization_id,created_at desc);

create table research_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  matter_id uuid references matters(id) on delete set null,
  query_id uuid references research_queries(id) on delete set null,
  title text not null check (char_length(title) between 3 and 240),
  body text not null check (char_length(body) between 1 and 20000),
  verification_state text not null default 'draft' check (verification_state in ('draft','reviewed','exportable','blocked')),
  created_by uuid not null references app_users(id) on delete restrict,
  reviewed_by uuid references app_users(id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index research_notes_org_time_idx on research_notes(organization_id,updated_at desc);
create index research_notes_matter_idx on research_notes(matter_id) where matter_id is not null;

create table research_note_citations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  note_id uuid not null references research_notes(id) on delete cascade,
  passage_id uuid not null references research_passages(id) on delete restrict,
  claim_text text not null check (char_length(claim_text) between 1 and 5000),
  created_at timestamptz not null default now(),
  unique(note_id, passage_id, claim_text)
);

create function research_search(p_query text, p_jurisdiction text default null, p_court text default null, p_document_type text default null, p_limit integer default 20)
returns table(document_id uuid, passage_id uuid, title text, citation text, jurisdiction text, court text, document_type text,
              decision_date date, bench_strength integer, bench_metadata_state source_state, locator text, snippet text,
              source_name text, rights_basis text, source_state source_state, is_fixture boolean, rank real)
language sql stable security definer set search_path=public as $$
  select d.id, p.id, d.title, d.citation, d.jurisdiction, d.court, d.document_type, d.decision_date, d.bench_strength,
    d.bench_metadata_state, p.locator,
    ts_headline('simple', p.body, websearch_to_tsquery('simple', p_query), 'MaxFragments=2, MaxWords=38'),
    s.name, s.rights_basis, d.source_state, s.is_fixture, ts_rank(p.search_vector, websearch_to_tsquery('simple', p_query))
  from research_passages p
  join research_documents d on d.id=p.document_id
  join research_sources s on s.id=d.source_id
  where s.enabled and d.source_state in ('verified','stale','manual')
    and exists(select 1 from memberships m where m.user_id=current_app_user_id() and m.active)
    and p.search_vector @@ websearch_to_tsquery('simple', p_query)
    and (p_jurisdiction is null or d.jurisdiction = p_jurisdiction)
    and (p_court is null or d.court = p_court)
    and (p_document_type is null or d.document_type = p_document_type)
  order by 15 desc, d.decision_date desc nulls last
  limit greatest(1,least(p_limit,50))
$$;

do $$ declare table_name text; begin
  foreach table_name in array array['research_sources','research_documents','research_passages','research_citation_edges','research_notes'] loop
    execute format('create trigger %I_updated before update on %I for each row execute function set_updated_at()',table_name,table_name);
  end loop;
end $$;

alter table research_queries enable row level security;
alter table research_queries force row level security;
alter table research_sources enable row level security;
alter table research_sources force row level security;
alter table research_documents enable row level security;
alter table research_documents force row level security;
alter table research_passages enable row level security;
alter table research_passages force row level security;
alter table research_citation_edges enable row level security;
alter table research_citation_edges force row level security;
alter table research_notes enable row level security;
alter table research_notes force row level security;
alter table research_note_citations enable row level security;
alter table research_note_citations force row level security;

create policy research_queries_select on research_queries for select using(is_org_member(organization_id));
create policy research_queries_insert on research_queries for insert with check(is_org_member(organization_id) and created_by=current_app_user_id());

create policy research_sources_select on research_sources for select using(enabled and exists(select 1 from memberships m where m.user_id=current_app_user_id() and m.active));
create policy research_documents_select on research_documents for select using(exists(
  select 1 from research_sources s where s.id=source_id and s.enabled
) and exists(select 1 from memberships m where m.user_id=current_app_user_id() and m.active));
create policy research_passages_select on research_passages for select using(exists(
  select 1 from research_documents d join research_sources s on s.id=d.source_id where d.id=document_id and s.enabled
) and exists(select 1 from memberships m where m.user_id=current_app_user_id() and m.active));
create policy research_citation_edges_select on research_citation_edges for select using(exists(
  select 1 from research_documents d join research_sources s on s.id=d.source_id where d.id=citing_document_id and s.enabled
) and exists(select 1 from memberships m where m.user_id=current_app_user_id() and m.active));

create policy research_notes_select on research_notes for select using(
  is_org_member(organization_id) and (matter_id is null or can_access_matter(matter_id,'view'))
);
create policy research_notes_insert on research_notes for insert with check(
  has_org_role(organization_id,array['owner','managing_partner','admin','advocate','associate','paralegal']::app_role[])
  and created_by=current_app_user_id() and (matter_id is null or can_access_matter(matter_id,'edit'))
);
create policy research_notes_update on research_notes for update using(
  (created_by=current_app_user_id() or has_org_role(organization_id,array['owner','managing_partner','admin']::app_role[]))
  and (matter_id is null or can_access_matter(matter_id,'edit'))
) with check(is_org_member(organization_id) and (matter_id is null or can_access_matter(matter_id,'edit')));

create policy research_note_citations_select on research_note_citations for select using(is_org_member(organization_id));
create policy research_note_citations_insert on research_note_citations for insert with check(
  is_org_member(organization_id)
  and exists(select 1 from research_notes n where n.id=note_id and n.organization_id=organization_id)
  and exists(select 1 from research_passages p join research_documents d on d.id=p.document_id join research_sources s on s.id=d.source_id
             where p.id=passage_id and s.enabled and d.source_state in ('verified','stale','manual'))
);

revoke all on research_sources, research_documents, research_passages, research_citation_edges, research_graph_jobs, research_queries, research_notes, research_note_citations from public;
revoke execute on function research_search(text,text,text,text,integer) from public;
revoke execute on function claim_research_graph_job(text) from public;

do $$ begin if exists(select 1 from pg_roles where rolname='nyayaflow_app') then
  grant select on research_sources, research_documents, research_passages, research_citation_edges to nyayaflow_app;
  grant select,insert on research_queries, research_note_citations to nyayaflow_app;
  grant select,insert,update on research_notes to nyayaflow_app;
  grant execute on function research_search(text,text,text,text,integer) to nyayaflow_app;
end if; end $$;

do $$ begin if exists(select 1 from pg_roles where rolname='nyayaflow_worker') then
  grant select,insert,update,delete on research_sources, research_documents, research_passages, research_citation_edges, research_graph_jobs to nyayaflow_worker;
  grant execute on function claim_research_graph_job(text) to nyayaflow_worker;
end if; end $$;

commit;
