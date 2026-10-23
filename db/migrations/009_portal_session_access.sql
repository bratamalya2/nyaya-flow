begin;
-- The normal app role can insert/revoke only the current portal client's sessions. Token lookup is
-- deliberately a narrow security-definer function: it accepts one opaque hash and returns only a
-- currently valid session's public profile fields, never session hashes or other clients' rows.
create policy portal_sessions_client_insert on portal_sessions for insert with check(client_id=current_portal_client_id());
create policy portal_sessions_client_update on portal_sessions for update using(client_id=current_portal_client_id()) with check(client_id=current_portal_client_id());
create function portal_session_lookup(p_token_hash text) returns table(session_id uuid,client_id uuid,organization_id uuid,user_id uuid,email citext,display_name text)
language sql stable security definer set search_path=public as $$
  select s.id,pc.id,pc.organization_id,pc.user_id,u.email,pc.display_name
  from portal_sessions s join portal_clients pc on pc.id=s.client_id join app_users u on u.id=pc.user_id
  where s.token_hash=p_token_hash and s.revoked_at is null and s.expires_at>now() and pc.disabled_at is null and u.disabled_at is null
$$;
revoke all on portal_sessions from public;
do $$ begin if exists(select 1 from pg_roles where rolname='nyayaflow_app') then
  grant select,insert,update on portal_sessions to nyayaflow_app;
  grant execute on function portal_session_lookup(text) to nyayaflow_app;
end if; end $$;
commit;
