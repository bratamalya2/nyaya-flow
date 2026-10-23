begin;
alter table background_jobs drop constraint background_jobs_job_type_check;
alter table background_jobs add constraint background_jobs_job_type_check check(job_type in ('malware_scan','page_count','ocr','search_index','retention_delete','audit_verify','court_sync','corpus_ingest','chronology_extract','deadline_reminder','email_delivery','usage_rollup','razorpay_reconcile','invoice_generate','provider_event_process'));
create function sync_subscription_entitlements(target_subscription uuid) returns void language plpgsql security definer set search_path=public as $$
declare sub organization_subscriptions; limits jsonb; features jsonb; feature record; limit_row record;
begin
 select s.* into sub from organization_subscriptions s where s.id=target_subscription for update;
 if sub.id is null then raise exception 'Subscription not found'; end if;
 select p.limits,p.features into limits,features from plan_catalog p join plan_prices pp on pp.plan_id=p.id where pp.id=sub.plan_price_id;
 update entitlements set effective_to=now() where organization_id=sub.organization_id and effective_to is null;
 for limit_row in select key,value from jsonb_each(limits) loop insert into entitlements(organization_id,subscription_id,entitlement_key,value) values(sub.organization_id,sub.id,limit_row.key,limit_row.value); end loop;
 for feature in select key,value from jsonb_each(features) loop insert into entitlements(organization_id,subscription_id,entitlement_key,value) values(sub.organization_id,sub.id,feature.key,feature.value); end loop;
end $$;
do $$ begin if exists(select 1 from pg_roles where rolname='nyayaflow_app') then grant execute on function sync_subscription_entitlements(uuid) to nyayaflow_app; end if; if exists(select 1 from pg_roles where rolname='nyayaflow_worker') then grant select,insert,update on deadline_reminders,usage_counters,provider_events,subscription_invoices,organization_subscriptions,billing_attempts to nyayaflow_worker; end if; end $$;
commit;
