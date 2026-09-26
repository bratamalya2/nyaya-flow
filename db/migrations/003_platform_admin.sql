begin;

do $$ begin
  if not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then
    raise exception 'Run migrations as the schema owner role created WITH BYPASSRLS (see README).';
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Platform administration. The superadmin is configured in the server environment, not stored as
-- an app user, and sees organization metadata only — never matters, documents, or audit contents.
-- ---------------------------------------------------------------------------------------------

-- Owner invitations issued by the platform administrator have no inviting app user.
alter table invitations alter column invited_by drop not null;

create table platform_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  admin_email_hash text not null,
  ip_hash text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index platform_sessions_active_idx on platform_sessions(token_hash, expires_at) where revoked_at is null;

-- Last accepted TOTP step per administrator, so a code cannot be replayed.
create table platform_totp_steps (
  admin_email_hash text primary key,
  last_step bigint not null
);

create table platform_audit_events (
  id bigint generated always as identity primary key,
  actor_email_hash text,
  action text not null,
  resource_type text not null,
  resource_id text,
  outcome text not null check (outcome in ('success','denied','error')),
  ip_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index platform_audit_events_time_idx on platform_audit_events(created_at desc);

-- Creates a tenant and a one-time owner invitation atomically, and opens the tenant's audit chain.
create function platform_create_organization(p_name text, p_slug text, p_owner_email text, p_token_hash text, p_expires_days integer)
returns table(organization_id uuid, invitation_id uuid, expires_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare org organizations; inv invitations;
begin
  if p_expires_days not between 1 and 14 then raise exception 'Invitation lifetime must be 1-14 days.' using errcode='P0001'; end if;
  insert into organizations(name, slug) values (p_name, p_slug) returning * into org;
  insert into invitations(organization_id, email, role, token_hash, invited_by, expires_at)
    values (org.id, lower(p_owner_email), 'owner', p_token_hash, null, now() + make_interval(days => p_expires_days))
    returning * into inv;
  insert into audit_events(organization_id, actor_id, action, resource_type, resource_id, outcome, correlation_id, metadata)
    values (org.id, null, 'organization.provision', 'organization', org.id::text, 'success', gen_random_uuid()::text,
            jsonb_build_object('by', 'platform', 'ownerInvitationId', inv.id));
  return query select org.id, inv.id, inv.expires_at;
end $$;

-- Replaces any pending owner invitations for an organization with a new one-time link.
create function platform_issue_owner_invitation(p_organization uuid, p_owner_email text, p_token_hash text, p_expires_days integer)
returns table(invitation_id uuid, expires_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare inv invitations;
begin
  if p_expires_days not between 1 and 14 then raise exception 'Invitation lifetime must be 1-14 days.' using errcode='P0001'; end if;
  if not exists(select 1 from organizations where id = p_organization) then raise exception 'Organization not found.' using errcode='P0002'; end if;
  update invitations set revoked_at = now()
    where organization_id = p_organization and role = 'owner' and accepted_at is null and revoked_at is null;
  insert into invitations(organization_id, email, role, token_hash, invited_by, expires_at)
    values (p_organization, lower(p_owner_email), 'owner', p_token_hash, null, now() + make_interval(days => p_expires_days))
    returning * into inv;
  insert into audit_events(organization_id, actor_id, action, resource_type, resource_id, outcome, correlation_id, metadata)
    values (p_organization, null, 'membership.invite', 'invitation', inv.id::text, 'success', gen_random_uuid()::text,
            jsonb_build_object('by', 'platform', 'role', 'owner'));
  return query select inv.id, inv.expires_at;
end $$;

-- Organization metadata for the platform console. Deliberately excludes all matter and document data.
create function platform_organizations()
returns table(id uuid, name text, slug text, created_at timestamptz, active_members bigint, owner_emails text,
              pending_owner_email text, pending_owner_expires_at timestamptz)
language sql stable security definer set search_path=public as $$
  select o.id, o.name, o.slug, o.created_at,
    (select count(*) from memberships m where m.organization_id = o.id and m.active),
    (select string_agg(u.email::text, ', ' order by u.email) from memberships m join app_users u on u.id = m.user_id
      where m.organization_id = o.id and m.active and m.role = 'owner'),
    pending.email::text, pending.expires_at
  from organizations o
  left join lateral (
    select i.email, i.expires_at from invitations i
    where i.organization_id = o.id and i.role = 'owner' and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
    order by i.created_at desc limit 1
  ) pending on true
  order by o.created_at desc
$$;

revoke execute on function platform_create_organization(text,text,text,text,integer) from public;
revoke execute on function platform_issue_owner_invitation(uuid,text,text,integer) from public;
revoke execute on function platform_organizations() from public;
revoke all on platform_sessions, platform_totp_steps, platform_audit_events from public;

do $$ begin if exists(select 1 from pg_roles where rolname='nyayaflow_app') then
  grant select, insert, update on platform_sessions, platform_totp_steps to nyayaflow_app;
  grant select, insert on platform_audit_events to nyayaflow_app;
  grant execute on function platform_create_organization(text,text,text,text,integer),
    platform_issue_owner_invitation(uuid,text,text,integer), platform_organizations() to nyayaflow_app;
end if; end $$;

commit;
