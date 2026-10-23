begin;

-- Operational records are deliberately separate from matter fee ledgers (011).  These
-- tables hold firm workflow and NyayaFlow subscription data, never client retainers.
create type app_permission as enum (
  'view_command_centre','manage_deadlines','review_chronology','run_conflict_check',
  'approve_hearing_brief','manage_billing','manage_subscription'
);
create type review_state as enum ('proposed','in_review','confirmed','rejected','merged','superseded');
create type subscription_status as enum ('trialing','pending_payment','active','past_due','cancelled','expired','paused');

create table member_permission_overrides (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade, permission app_permission not null, allowed boolean not null,
  set_by uuid not null references app_users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id,user_id,permission)
);

create function has_app_permission(org_id uuid, requested app_permission) returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(
    (select allowed from member_permission_overrides where organization_id=org_id and user_id=current_app_user_id() and permission=requested),
    exists(select 1 from memberships where organization_id=org_id and user_id=current_app_user_id() and active and case requested
      when 'view_command_centre' then role in ('owner','managing_partner','admin','advocate','associate','paralegal')
      when 'manage_deadlines' then role in ('owner','managing_partner','admin','advocate','associate','paralegal')
      when 'review_chronology' then role in ('owner','managing_partner','admin','advocate','associate')
      when 'run_conflict_check' then role in ('owner','managing_partner','admin','advocate','associate','paralegal')
      when 'approve_hearing_brief' then role in ('owner','managing_partner','admin','advocate')
      when 'manage_billing' then role in ('owner','managing_partner','admin','finance')
      when 'manage_subscription' then role in ('owner','managing_partner','admin') end)
  )
$$;

create table chronology_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  matter_id uuid not null references matters(id) on delete cascade, event_type text not null, title text not null, description text,
  occurred_on date not null, occurred_end_on date, date_precision text not null default 'day' check (date_precision in ('day','month','year','unknown')),
  source_state source_state not null default 'manual', confidence integer check (confidence between 0 and 100), review_state review_state not null default 'proposed',
  version integer not null default 1, reviewed_by uuid references app_users(id), reviewed_at timestamptz, created_by uuid not null references app_users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check (occurred_end_on is null or occurred_end_on >= occurred_on)
);
create index chronology_events_matter_date_idx on chronology_events(matter_id,occurred_on);
create table chronology_event_sources (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  chronology_event_id uuid not null references chronology_events(id) on delete cascade, source_type text not null, source_id uuid, locator text,
  excerpt text, source_state source_state not null default 'manual', extraction_version text, created_at timestamptz not null default now()
);
create table chronology_event_revisions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  chronology_event_id uuid not null references chronology_events(id) on delete cascade, version integer not null, snapshot jsonb not null,
  reason text not null, created_by uuid not null references app_users(id), created_at timestamptz not null default now(), unique(chronology_event_id,version)
);
create table chronology_review_actions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  chronology_event_id uuid not null references chronology_events(id) on delete cascade, action text not null check (action in ('confirm','reject','merge','reopen')),
  reason text, target_event_id uuid references chronology_events(id), acted_by uuid not null references app_users(id), acted_at timestamptz not null default now()
);

create table deadline_rules (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  name text not null, forum text, enabled boolean not null default true, source_note text not null,
  created_by uuid not null references app_users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,name)
);
create table deadline_rule_versions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  deadline_rule_id uuid not null references deadline_rules(id) on delete cascade, version integer not null, trigger_type text not null,
  days_after integer not null check(days_after >= 0), business_days boolean not null default false, excluded_weekdays integer[] not null default '{}',
  assumptions jsonb not null default '{}'::jsonb, effective_from date not null default current_date, effective_to date,
  created_by uuid not null references app_users(id), created_at timestamptz not null default now(), unique(deadline_rule_id,version)
);
create table matter_deadlines (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  matter_id uuid not null references matters(id) on delete cascade, deadline_rule_version_id uuid references deadline_rule_versions(id),
  title text not null, trigger_on date, due_on date not null, calculation jsonb not null default '{}'::jsonb, review_state review_state not null default 'proposed',
  risk_level text not null default 'normal' check(risk_level in ('normal','high','critical')), assigned_to uuid references app_users(id),
  confirmed_by uuid references app_users(id), confirmed_at timestamptz, created_by uuid not null references app_users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index matter_deadlines_queue_idx on matter_deadlines(organization_id,due_on) where review_state not in ('rejected','superseded');
create table deadline_revisions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  matter_deadline_id uuid not null references matter_deadlines(id) on delete cascade, version integer not null, snapshot jsonb not null, reason text not null,
  changed_by uuid not null references app_users(id), created_at timestamptz not null default now(), unique(matter_deadline_id,version)
);
create table deadline_reminders (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  matter_deadline_id uuid not null references matter_deadlines(id) on delete cascade, recipient_id uuid not null references app_users(id),
  channel text not null default 'email' check(channel='email'), scheduled_for timestamptz not null, sent_at timestamptz, status text not null default 'queued' check(status in ('queued','sent','failed','cancelled')),
  dedupe_key text not null, created_at timestamptz not null default now(), unique(organization_id,dedupe_key)
);

create table conflict_checks (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  status text not null default 'queued' check(status in ('queued','running','completed','failed')), query_summary text not null, requested_by uuid not null references app_users(id),
  completed_at timestamptz, created_at timestamptz not null default now()
);
create table conflict_check_subjects (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  conflict_check_id uuid not null references conflict_checks(id) on delete cascade, subject_type text not null, display_name text not null, normalized_name text not null,
  created_at timestamptz not null default now()
);
create table conflict_subject_aliases (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  conflict_check_subject_id uuid not null references conflict_check_subjects(id) on delete cascade, alias text not null, normalized_alias text not null, created_at timestamptz not null default now()
);
create table conflict_matches (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  conflict_check_id uuid not null references conflict_checks(id) on delete cascade, conflict_check_subject_id uuid not null references conflict_check_subjects(id) on delete cascade,
  matter_id uuid references matters(id) on delete set null, confidence integer not null check(confidence between 0 and 100), bucket text not null check(bucket in ('low','medium','high')),
  explanation text not null, state text not null default 'open' check(state in ('open','dismissed','escalated','accepted')), created_at timestamptz not null default now()
);
create table conflict_decisions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  conflict_match_id uuid not null references conflict_matches(id) on delete cascade, decision text not null check(decision in ('dismiss','escalate','accept')),
  reason text not null, decided_by uuid not null references app_users(id), decided_at timestamptz not null default now()
);

create table hearing_briefs (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  hearing_id uuid not null references hearings(id) on delete cascade, title text not null, status review_state not null default 'proposed', version integer not null default 1,
  approved_by uuid references app_users(id), approved_at timestamptz, created_by uuid not null references app_users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(hearing_id,version)
);
create table hearing_brief_sections (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  hearing_brief_id uuid not null references hearing_briefs(id) on delete cascade, section_key text not null, heading text not null, body text not null default '', position integer not null default 0, created_at timestamptz not null default now()
);
create table hearing_brief_sources (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  hearing_brief_id uuid not null references hearing_briefs(id) on delete cascade, source_type text not null, source_id uuid, locator text, created_at timestamptz not null default now()
);
create table hearing_brief_checklist_items (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  hearing_brief_id uuid not null references hearing_briefs(id) on delete cascade, label text not null, completed_at timestamptz, completed_by uuid references app_users(id), created_at timestamptz not null default now()
);
create table hearing_brief_approvals (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade,
  hearing_brief_id uuid not null references hearing_briefs(id) on delete cascade, decision text not null check(decision in ('approved','rejected')), note text, decided_by uuid not null references app_users(id), decided_at timestamptz not null default now()
);

create table plan_catalog (
  id uuid primary key default gen_random_uuid(), code text not null unique, display_name text not null, description text not null, limits jsonb not null, features jsonb not null,
  active_from timestamptz not null default now(), active_to timestamptz, created_at timestamptz not null default now()
);
create table plan_prices (
  id uuid primary key default gen_random_uuid(), plan_id uuid not null references plan_catalog(id) on delete cascade, interval text not null check(interval in ('month','year')),
  amount_paise bigint not null check(amount_paise >= 0), currency text not null default 'INR', gst_inclusive boolean not null default true, tax_metadata jsonb not null default '{}'::jsonb,
  provider_plan_id text, active_from timestamptz not null default now(), active_to timestamptz, created_at timestamptz not null default now(), unique(plan_id,interval,active_from)
);
create table organization_billing_profiles (
  organization_id uuid primary key references organizations(id) on delete cascade, legal_name text, gstin text, place_of_supply text, invoice_prefix text not null default 'NYF',
  next_invoice_number bigint not null default 1, tax_metadata jsonb not null default '{}'::jsonb, commercial_retention_days integer, automatic_deletion boolean not null default false, updated_at timestamptz not null default now()
);
create table organization_subscriptions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade, plan_price_id uuid not null references plan_prices(id),
  status subscription_status not null, provider text, provider_subscription_id text, current_period_start timestamptz, current_period_end timestamptz, trial_ends_at timestamptz,
  grace_ends_at timestamptz, cancel_at_period_end boolean not null default false, created_by uuid references app_users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index organization_one_live_subscription on organization_subscriptions(organization_id) where status in ('trialing','pending_payment','active','past_due','paused');
create table entitlements (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade, subscription_id uuid references organization_subscriptions(id) on delete cascade,
  entitlement_key text not null, value jsonb not null, effective_from timestamptz not null default now(), effective_to timestamptz, created_at timestamptz not null default now(), unique(organization_id,entitlement_key,effective_from)
);
create table usage_counters (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade, metric text not null, period_start date not null,
  period_end date not null, quantity bigint not null default 0 check(quantity>=0), updated_at timestamptz not null default now(), unique(organization_id,metric,period_start,period_end)
);
create table billing_customers (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade, provider text not null, provider_customer_id text not null,
  created_at timestamptz not null default now(), unique(provider,provider_customer_id), unique(organization_id,provider)
);
create table billing_attempts (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade, plan_price_id uuid not null references plan_prices(id),
  subscription_id uuid references organization_subscriptions(id), provider text not null, provider_order_id text, provider_subscription_id text, amount_paise bigint not null, currency text not null,
  status text not null default 'created' check(status in ('created','pending','succeeded','failed','cancelled')), idempotency_key text not null, initiated_by uuid references app_users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,idempotency_key)
);
create table payment_transactions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade, billing_attempt_id uuid references billing_attempts(id), provider text not null,
  provider_payment_id text not null, amount_paise bigint not null, currency text not null, status text not null, occurred_at timestamptz not null default now(), payload jsonb not null default '{}'::jsonb, unique(provider,provider_payment_id)
);
create table provider_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid references organizations(id) on delete set null, provider text not null, provider_event_id text not null, event_type text not null,
  occurred_at timestamptz, signature_valid boolean not null, payload jsonb not null, processed_at timestamptz, processing_error text, created_at timestamptz not null default now(), unique(provider,provider_event_id)
);
create table subscription_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade, subscription_id uuid not null references organization_subscriptions(id) on delete cascade,
  provider_event_id uuid references provider_events(id), event_type text not null, previous_state jsonb not null default '{}'::jsonb, new_state jsonb not null, effective_at timestamptz not null,
  actor_id uuid references app_users(id), created_at timestamptz not null default now()
);
create table billing_adjustments (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade, subscription_id uuid references organization_subscriptions(id),
  kind text not null check(kind in ('refund','credit','writeoff','dispute')), amount_paise bigint not null check(amount_paise>=0), currency text not null default 'INR', reason text not null,
  provider_reference text, created_by uuid references app_users(id), created_at timestamptz not null default now()
);
create table subscription_invoices (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade, subscription_id uuid references organization_subscriptions(id),
  invoice_number text not null, amount_paise bigint not null, currency text not null default 'INR', status text not null default 'issued' check(status in ('draft','issued','paid','void','refunded')),
  tax_metadata jsonb not null default '{}'::jsonb, issued_at timestamptz not null default now(), paid_at timestamptz, storage_path text, unique(organization_id,invoice_number)
);

-- The first catalog is explicit and GST-inclusive as directed. Its history is immutable
-- through price rows rather than updates to an existing subscription.
insert into plan_catalog(code,display_name,description,limits,features) values
 ('trial','Free Trial','Fourteen-day evaluation', '{"seats":2,"matters":10,"storage_bytes":1073741824,"ocr_pages":100,"conflict_checks":5}'::jsonb, '{}'::jsonb),
 ('solo','Solo','Individual advocate', '{"seats":1,"matters":100,"storage_bytes":26843545600,"ocr_pages":2000,"conflict_checks":25}'::jsonb, '{}'::jsonb),
 ('firm','Firm','Small firm', '{"seats":5,"matters":-1,"storage_bytes":107374182400,"ocr_pages":10000,"conflict_checks":-1}'::jsonb, '{}'::jsonb),
 ('professional','Professional','Growing firm', '{"seats":15,"matters":-1,"storage_bytes":536870912000,"ocr_pages":50000,"conflict_checks":-1}'::jsonb, '{}'::jsonb),
 ('enterprise','Enterprise','Contract-managed deployment', '{"seats":-1,"matters":-1,"storage_bytes":-1,"ocr_pages":-1,"conflict_checks":-1}'::jsonb, '{}'::jsonb);
insert into plan_prices(plan_id,interval,amount_paise) select id,'month',0 from plan_catalog where code='trial';
insert into plan_prices(plan_id,interval,amount_paise) select id,'month',149900 from plan_catalog where code='solo';
insert into plan_prices(plan_id,interval,amount_paise) select id,'year',1499000 from plan_catalog where code='solo';
insert into plan_prices(plan_id,interval,amount_paise) select id,'month',499900 from plan_catalog where code='firm';
insert into plan_prices(plan_id,interval,amount_paise) select id,'year',4999000 from plan_catalog where code='firm';
insert into plan_prices(plan_id,interval,amount_paise) select id,'month',1199900 from plan_catalog where code='professional';
insert into plan_prices(plan_id,interval,amount_paise) select id,'year',11999000 from plan_catalog where code='professional';

create function immutable_after_approval() returns trigger language plpgsql as $$ begin
  if old.review_state in ('confirmed','merged') then raise exception 'Approved chronology records are immutable; create a new version.'; end if; return new;
end $$;
create trigger chronology_immutable_before_update before update on chronology_events for each row execute function immutable_after_approval();
create function immutable_deadline_after_confirmation() returns trigger language plpgsql as $$ begin
  if old.review_state='confirmed' then raise exception 'Confirmed deadlines are immutable; create a replacement version.'; end if; return new;
end $$;
create trigger deadline_immutable_before_update before update on matter_deadlines for each row execute function immutable_deadline_after_confirmation();
do $$ declare t text; begin foreach t in array array['member_permission_overrides','chronology_events','chronology_event_sources','chronology_event_revisions','chronology_review_actions','deadline_rules','deadline_rule_versions','matter_deadlines','deadline_revisions','deadline_reminders','conflict_checks','conflict_check_subjects','conflict_subject_aliases','conflict_matches','conflict_decisions','hearing_briefs','hearing_brief_sections','hearing_brief_sources','hearing_brief_checklist_items','hearing_brief_approvals','plan_catalog','plan_prices','organization_billing_profiles','organization_subscriptions','entitlements','usage_counters','billing_customers','billing_attempts','payment_transactions','provider_events','subscription_events','billing_adjustments','subscription_invoices'] loop execute format('alter table %I enable row level security',t); execute format('alter table %I force row level security',t); end loop; end $$;
create policy permission_override_admin on member_permission_overrides for all using(has_org_role(organization_id,array['owner','admin']::app_role[])) with check(has_org_role(organization_id,array['owner','admin']::app_role[]));
create policy chronology_access on chronology_events for select using(can_access_matter(matter_id,'view'));
create policy chronology_write on chronology_events for all using(can_access_matter(matter_id,'edit') and has_app_permission(organization_id,'review_chronology')) with check(can_access_matter(matter_id,'edit') and has_app_permission(organization_id,'review_chronology'));
create policy chronology_child_access on chronology_event_sources for select using(exists(select 1 from chronology_events e where e.id=chronology_event_id and can_access_matter(e.matter_id,'view')));
create policy chronology_child_write on chronology_event_sources for all using(exists(select 1 from chronology_events e where e.id=chronology_event_id and can_access_matter(e.matter_id,'edit') and has_app_permission(e.organization_id,'review_chronology'))) with check(exists(select 1 from chronology_events e where e.id=chronology_event_id and can_access_matter(e.matter_id,'edit') and has_app_permission(e.organization_id,'review_chronology')));
create policy chronology_revision_access on chronology_event_revisions for select using(exists(select 1 from chronology_events e where e.id=chronology_event_id and can_access_matter(e.matter_id,'view')));
create policy chronology_revision_write on chronology_event_revisions for insert with check(exists(select 1 from chronology_events e where e.id=chronology_event_id and can_access_matter(e.matter_id,'edit') and has_app_permission(e.organization_id,'review_chronology')));
create policy chronology_actions_access on chronology_review_actions for select using(exists(select 1 from chronology_events e where e.id=chronology_event_id and can_access_matter(e.matter_id,'view')));
create policy chronology_actions_write on chronology_review_actions for insert with check(exists(select 1 from chronology_events e where e.id=chronology_event_id and can_access_matter(e.matter_id,'edit') and has_app_permission(e.organization_id,'review_chronology')));
create policy deadline_rule_access on deadline_rules for select using(is_org_member(organization_id));
create policy deadline_rule_write on deadline_rules for all using(has_app_permission(organization_id,'manage_deadlines')) with check(has_app_permission(organization_id,'manage_deadlines'));
create policy deadline_version_access on deadline_rule_versions for select using(is_org_member(organization_id));
create policy deadline_version_write on deadline_rule_versions for all using(has_app_permission(organization_id,'manage_deadlines')) with check(has_app_permission(organization_id,'manage_deadlines'));
create policy deadline_access on matter_deadlines for select using(can_access_matter(matter_id,'view'));
create policy deadline_write on matter_deadlines for all using(can_access_matter(matter_id,'edit') and has_app_permission(organization_id,'manage_deadlines')) with check(can_access_matter(matter_id,'edit') and has_app_permission(organization_id,'manage_deadlines'));
create policy deadline_revision_access on deadline_revisions for select using(exists(select 1 from matter_deadlines d where d.id=matter_deadline_id and can_access_matter(d.matter_id,'view')));
create policy deadline_revision_write on deadline_revisions for insert with check(exists(select 1 from matter_deadlines d where d.id=matter_deadline_id and can_access_matter(d.matter_id,'edit') and has_app_permission(d.organization_id,'manage_deadlines')));
create policy deadline_reminder_access on deadline_reminders for select using(recipient_id=current_app_user_id() or has_app_permission(organization_id,'manage_deadlines'));
create policy conflict_check_access on conflict_checks for select using(requested_by=current_app_user_id() or has_org_role(organization_id,array['owner','managing_partner','admin']::app_role[]));
create policy conflict_check_write on conflict_checks for insert with check(requested_by=current_app_user_id() and has_app_permission(organization_id,'run_conflict_check'));
create policy conflict_subject_access on conflict_check_subjects for select using(exists(select 1 from conflict_checks c where c.id=conflict_check_id and (c.requested_by=current_app_user_id() or has_org_role(c.organization_id,array['owner','managing_partner','admin']::app_role[]))));
create policy conflict_subject_write on conflict_check_subjects for insert with check(exists(select 1 from conflict_checks c where c.id=conflict_check_id and c.requested_by=current_app_user_id() and has_app_permission(c.organization_id,'run_conflict_check')));
create policy conflict_alias_access on conflict_subject_aliases for select using(exists(select 1 from conflict_check_subjects s join conflict_checks c on c.id=s.conflict_check_id where s.id=conflict_check_subject_id and (c.requested_by=current_app_user_id() or has_org_role(c.organization_id,array['owner','managing_partner','admin']::app_role[]))));
create policy conflict_match_access on conflict_matches for select using((matter_id is null or can_access_matter(matter_id,'view')) and exists(select 1 from conflict_checks c where c.id=conflict_check_id and (c.requested_by=current_app_user_id() or has_org_role(c.organization_id,array['owner','managing_partner','admin']::app_role[]))));
create policy conflict_decision_access on conflict_decisions for select using(exists(select 1 from conflict_matches m where m.id=conflict_match_id and (m.matter_id is null or can_access_matter(m.matter_id,'view'))));
create policy conflict_decision_write on conflict_decisions for insert with check(decided_by=current_app_user_id() and exists(select 1 from conflict_matches m where m.id=conflict_match_id and (m.matter_id is null or can_access_matter(m.matter_id,'view')) and has_app_permission(m.organization_id,'run_conflict_check')));
create policy brief_access on hearing_briefs for select using(exists(select 1 from hearings h where h.id=hearing_id and can_access_matter(h.matter_id,'view')));
create policy brief_write on hearing_briefs for all using(exists(select 1 from hearings h where h.id=hearing_id and can_access_matter(h.matter_id,'edit'))) with check(exists(select 1 from hearings h where h.id=hearing_id and can_access_matter(h.matter_id,'edit')));
create policy brief_section_access on hearing_brief_sections for select using(exists(select 1 from hearing_briefs b join hearings h on h.id=b.hearing_id where b.id=hearing_brief_id and can_access_matter(h.matter_id,'view')));
create policy brief_section_write on hearing_brief_sections for all using(exists(select 1 from hearing_briefs b join hearings h on h.id=b.hearing_id where b.id=hearing_brief_id and can_access_matter(h.matter_id,'edit'))) with check(exists(select 1 from hearing_briefs b join hearings h on h.id=b.hearing_id where b.id=hearing_brief_id and can_access_matter(h.matter_id,'edit')));
create policy brief_checklist_access on hearing_brief_checklist_items for select using(exists(select 1 from hearing_briefs b join hearings h on h.id=b.hearing_id where b.id=hearing_brief_id and can_access_matter(h.matter_id,'view')));
create policy brief_checklist_write on hearing_brief_checklist_items for all using(exists(select 1 from hearing_briefs b join hearings h on h.id=b.hearing_id where b.id=hearing_brief_id and can_access_matter(h.matter_id,'edit'))) with check(exists(select 1 from hearing_briefs b join hearings h on h.id=b.hearing_id where b.id=hearing_brief_id and can_access_matter(h.matter_id,'edit')));
create policy brief_approval_access on hearing_brief_approvals for select using(exists(select 1 from hearing_briefs b join hearings h on h.id=b.hearing_id where b.id=hearing_brief_id and can_access_matter(h.matter_id,'view')));
create policy brief_approval_write on hearing_brief_approvals for insert with check(decided_by=current_app_user_id() and exists(select 1 from hearing_briefs b join hearings h on h.id=b.hearing_id where b.id=hearing_brief_id and can_access_matter(h.matter_id,'edit') and has_app_permission(b.organization_id,'approve_hearing_brief')));
create policy catalog_read on plan_catalog for select using(true); create policy price_read on plan_prices for select using(true);
create policy billing_profile_access on organization_billing_profiles for all using(has_app_permission(organization_id,'manage_billing')) with check(has_app_permission(organization_id,'manage_billing'));
create policy subscription_access on organization_subscriptions for select using(has_app_permission(organization_id,'manage_billing'));
create policy entitlement_access on entitlements for select using(is_org_member(organization_id));
create policy usage_access on usage_counters for select using(has_app_permission(organization_id,'manage_billing'));
create policy billing_customer_access on billing_customers for select using(has_app_permission(organization_id,'manage_billing'));
create policy billing_attempt_access on billing_attempts for select using(has_app_permission(organization_id,'manage_billing'));
create policy transaction_access on payment_transactions for select using(has_app_permission(organization_id,'manage_billing'));
create policy provider_event_access on provider_events for select using(organization_id is not null and has_app_permission(organization_id,'manage_billing'));
create policy subscription_event_access on subscription_events for select using(has_app_permission(organization_id,'manage_billing'));
create policy adjustment_access on billing_adjustments for select using(has_app_permission(organization_id,'manage_billing'));
create policy subscription_invoice_access on subscription_invoices for select using(has_app_permission(organization_id,'manage_billing'));

do $$ begin if exists(select 1 from pg_roles where rolname='nyayaflow_app') then
  grant select,insert,update,delete on member_permission_overrides,chronology_events,chronology_event_sources,chronology_event_revisions,chronology_review_actions,deadline_rules,deadline_rule_versions,matter_deadlines,deadline_revisions,deadline_reminders,conflict_checks,conflict_check_subjects,conflict_subject_aliases,conflict_matches,conflict_decisions,hearing_briefs,hearing_brief_sections,hearing_brief_sources,hearing_brief_checklist_items,hearing_brief_approvals,plan_catalog,plan_prices,organization_billing_profiles,organization_subscriptions,entitlements,usage_counters,billing_customers,billing_attempts,payment_transactions,provider_events,subscription_events,billing_adjustments,subscription_invoices to nyayaflow_app;
  grant execute on function has_app_permission(uuid,app_permission) to nyayaflow_app;
end if; end $$;
commit;
