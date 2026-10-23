begin;
create function refresh_entitlements_on_subscription_activation() returns trigger language plpgsql security definer set search_path=public as $$ begin
  if new.status='active' and old.status is distinct from 'active' then perform sync_subscription_entitlements(new.id); end if;
  return new;
end $$;
create trigger subscription_activate_entitlements after update of status on organization_subscriptions for each row execute function refresh_entitlements_on_subscription_activation();
commit;
