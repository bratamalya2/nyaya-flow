begin;
alter table organization_subscriptions add column scheduled_plan_price_id uuid references plan_prices(id);
commit;
