begin;
create function apply_razorpay_payment_event(event_id text, event_type text, event_payload jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare attempt billing_attempts; event_row provider_events; payment_id text; payment_status text; captured_amount bigint; subscription_row organization_subscriptions;
begin
  insert into provider_events(provider,provider_event_id,event_type,signature_valid,payload,occurred_at)
  values('razorpay',event_id,event_type,true,event_payload,coalesce(to_timestamp((event_payload->>'created_at')::double precision),now()))
  on conflict(provider,provider_event_id) do nothing returning * into event_row;
  if event_row.id is null then return null; end if;
  select * into attempt from billing_attempts where provider='razorpay' and provider_order_id=coalesce(event_payload#>>'{payload,payment,entity,order_id}',event_payload#>>'{payload,subscription,entity,notes,billingAttemptId}');
  if attempt.id is null then update provider_events set processing_error='No matching billing attempt',processed_at=now() where id=event_row.id; return event_row.id; end if;
  payment_id:=coalesce(event_payload#>>'{payload,payment,entity,id}',event_payload#>>'{payload,payment_link,entity,id}',event_id);
  payment_status:=coalesce(event_payload#>>'{payload,payment,entity,status}','captured');
  captured_amount:=coalesce((event_payload#>>'{payload,payment,entity,amount}')::bigint,attempt.amount_paise);
  if event_type in ('payment.captured','subscription.charged') and payment_status in ('captured','authorized') and captured_amount=attempt.amount_paise then
    insert into payment_transactions(organization_id,billing_attempt_id,provider,provider_payment_id,amount_paise,currency,status,payload) values(attempt.organization_id,attempt.id,'razorpay',payment_id,captured_amount,attempt.currency,'captured',event_payload) on conflict(provider,provider_payment_id) do nothing;
    update billing_attempts set status='succeeded' where id=attempt.id and status in ('created','pending');
    select * into subscription_row from organization_subscriptions where id=attempt.subscription_id for update;
    if subscription_row.status in ('pending_payment','past_due','trialing') then
      update organization_subscriptions set status='active',current_period_start=now(),current_period_end=case when (select interval from plan_prices where id=subscription_row.plan_price_id)='year' then now()+interval '1 year' else now()+interval '1 month' end,grace_ends_at=null where id=subscription_row.id;
      perform sync_subscription_entitlements(subscription_row.id);
      insert into subscription_events(organization_id,subscription_id,provider_event_id,event_type,previous_state,new_state,effective_at) values(attempt.organization_id,subscription_row.id,event_row.id,'payment_captured',jsonb_build_object('status',subscription_row.status),jsonb_build_object('status','active'),now());
    end if;
  elsif event_type in ('payment.failed','subscription.payment_failed') then
    update billing_attempts set status='failed' where id=attempt.id and status in ('created','pending');
    update organization_subscriptions set status='past_due',grace_ends_at=now()+interval '7 days' where id=attempt.subscription_id and status in ('pending_payment','active');
  end if;
  update provider_events set organization_id=attempt.organization_id,processed_at=now() where id=event_row.id;
  return event_row.id;
end $$;
do $$ begin if exists(select 1 from pg_roles where rolname='nyayaflow_app') then grant execute on function apply_razorpay_payment_event(text,text,jsonb) to nyayaflow_app; end if; end $$;
commit;
