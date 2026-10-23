begin;
create function immutable_brief_after_approval() returns trigger language plpgsql as $$ begin if old.status='confirmed' then raise exception 'Approved hearing briefs are immutable; create a new version.'; end if; return new; end $$;
create trigger hearing_brief_immutable_before_update before update on hearing_briefs for each row execute function immutable_brief_after_approval();
create table email_deliveries (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id) on delete cascade, recipient_id uuid references app_users(id) on delete set null,
 recipient_email citext not null, subject text not null, body text not null, category text not null, related_resource_type text, related_resource_id uuid,
 status text not null default 'queued' check(status in ('queued','sending','sent','failed','cancelled')), attempts integer not null default 0, scheduled_at timestamptz not null default now(), sent_at timestamptz, provider_message_id text, last_error text, dedupe_key text not null, created_at timestamptz not null default now(), unique(organization_id,dedupe_key)
);
alter table email_deliveries enable row level security; alter table email_deliveries force row level security;
create policy email_delivery_access on email_deliveries for select using(recipient_id=current_app_user_id() or has_app_permission(organization_id,'manage_billing') or has_app_permission(organization_id,'manage_deadlines'));
do $$ begin if exists(select 1 from pg_roles where rolname='nyayaflow_app') then grant select,insert,update on email_deliveries to nyayaflow_app; end if; if exists(select 1 from pg_roles where rolname='nyayaflow_worker') then grant select,insert,update on email_deliveries to nyayaflow_worker; end if; end $$;
commit;
