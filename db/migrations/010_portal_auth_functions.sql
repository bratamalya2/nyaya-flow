begin;
-- Public portal authentication can only resolve a presented opaque invitation hash or client email.
-- These functions do not expose invitation rows, grants, or other clients to the app role.
create function consume_portal_invitation(p_token_hash text,p_password_hash text) returns table(client_id uuid,user_id uuid)
language plpgsql security definer set search_path=public as $$
declare invitation portal_invitations%rowtype; profile portal_clients%rowtype;
begin
  select i.* into invitation from portal_invitations i where i.token_hash=p_token_hash and i.revoked_at is null and i.accepted_at is null and i.expires_at>now() for update;
  if invitation.id is null then return; end if;
  select * into profile from portal_clients where id=invitation.client_id and disabled_at is null;
  if profile.id is null then return; end if;
  update app_users set password_hash=p_password_hash where id=profile.user_id and is_portal_client and disabled_at is null;
  if not found then return; end if;
  update portal_invitations set accepted_at=now() where id=invitation.id;
  return query select profile.id,profile.user_id;
end $$;
create function portal_client_credentials(p_email citext) returns table(client_id uuid,password_hash text)
language sql stable security definer set search_path=public as $$
  select pc.id,u.password_hash from portal_clients pc join app_users u on u.id=pc.user_id
  where lower(u.email)=lower(p_email) and pc.disabled_at is null and u.disabled_at is null and u.is_portal_client
$$;
revoke execute on function consume_portal_invitation(text,text),portal_client_credentials(citext) from public;
do $$ begin if exists(select 1 from pg_roles where rolname='nyayaflow_app') then
  grant execute on function consume_portal_invitation(text,text),portal_client_credentials(citext) to nyayaflow_app;
end if; end $$;
commit;
