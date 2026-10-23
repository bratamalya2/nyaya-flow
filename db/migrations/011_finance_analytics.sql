begin;

-- Internal finance records. Amounts are stored as integer paise so totals and
-- allocations never depend on floating point arithmetic. This module never
-- stores payment-provider credentials, webhooks, tax returns, or a UPI handle.
create table billing_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 240),
  created_by uuid not null references app_users(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(organization_id,display_name), unique(organization_id,id)
);

create table billing_charges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  matter_id uuid not null references matters(id) on delete cascade,
  billing_account_id uuid not null references billing_accounts(id) on delete restrict,
  charge_kind text not null check (charge_kind in ('time','hearing','fixed_fee','expense')),
  description text not null check (char_length(description) between 3 and 500),
  occurred_on date not null,
  quantity numeric(12,2) not null default 1 check (quantity > 0 and quantity <= 100000),
  unit_amount_paise bigint not null check (unit_amount_paise > 0 and unit_amount_paise <= 100000000000),
  amount_paise bigint not null check (amount_paise > 0 and amount_paise <= 100000000000),
  status text not null default 'draft' check (status in ('draft','submitted','approved','rejected','invoiced','void')),
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references app_users(id) on delete restrict,
  rejection_reason text check (rejection_reason is null or char_length(rejection_reason) between 3 and 500),
  created_by uuid not null references app_users(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (organization_id,matter_id) references matters(organization_id,id) on delete cascade,
  foreign key (organization_id,billing_account_id) references billing_accounts(organization_id,id) on delete restrict,
  check ((status in ('approved','invoiced')) = (approved_at is not null and approved_by is not null)),
  check ((status='rejected') = (rejection_reason is not null)),
  unique(organization_id,id)
);

create table billing_charge_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  charge_id uuid not null references billing_charges(id) on delete cascade,
  decision text not null check (decision in ('approved','rejected')),
  reason text not null check (char_length(reason) between 3 and 500),
  decided_by uuid not null references app_users(id) on delete restrict,
  decided_at timestamptz not null default now(),
  foreign key (organization_id,charge_id) references billing_charges(organization_id,id) on delete cascade
);

create table billing_advances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  billing_account_id uuid not null references billing_accounts(id) on delete restrict,
  received_on date not null,
  amount_paise bigint not null check (amount_paise > 0 and amount_paise <= 100000000000),
  reference_note text check (reference_note is null or char_length(reference_note) <= 500),
  created_by uuid not null references app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (organization_id,billing_account_id) references billing_accounts(organization_id,id) on delete restrict,
  unique(organization_id,id)
);

create table billing_invoice_sequences (
  organization_id uuid primary key references organizations(id) on delete cascade,
  last_value integer not null default 0 check (last_value >= 0)
);

create table billing_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  matter_id uuid not null references matters(id) on delete restrict,
  billing_account_id uuid not null references billing_accounts(id) on delete restrict,
  invoice_number text not null check (invoice_number ~ '^NF-[0-9]{4}-[0-9]{5}$'),
  issue_date date not null,
  status text not null default 'draft_issued' check (status in ('draft_issued','partially_paid','paid','credited','void')),
  total_paise bigint not null check (total_paise > 0),
  paid_paise bigint not null default 0 check (paid_paise >= 0 and paid_paise <= total_paise),
  snapshot jsonb not null,
  created_by uuid not null references app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (organization_id,matter_id) references matters(organization_id,id) on delete restrict,
  foreign key (organization_id,billing_account_id) references billing_accounts(organization_id,id) on delete restrict,
  unique(organization_id,invoice_number), unique(organization_id,id)
);

create table billing_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  invoice_id uuid not null references billing_invoices(id) on delete cascade,
  charge_id uuid not null references billing_charges(id) on delete restrict,
  description_snapshot text not null,
  amount_paise bigint not null check (amount_paise > 0),
  foreign key (organization_id,invoice_id) references billing_invoices(organization_id,id) on delete cascade,
  foreign key (organization_id,charge_id) references billing_charges(organization_id,id) on delete restrict,
  unique(invoice_id,charge_id)
);

create table billing_credit_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  invoice_id uuid not null references billing_invoices(id) on delete restrict,
  credit_number text not null check (credit_number ~ '^CN-[0-9]{4}-[0-9]{5}$'),
  amount_paise bigint not null check (amount_paise > 0),
  reason text not null check (char_length(reason) between 3 and 500),
  snapshot jsonb not null,
  created_by uuid not null references app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (organization_id,invoice_id) references billing_invoices(organization_id,id) on delete restrict,
  unique(organization_id,credit_number)
);

create table billing_advance_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  advance_id uuid not null references billing_advances(id) on delete restrict,
  invoice_id uuid not null references billing_invoices(id) on delete restrict,
  amount_paise bigint not null check (amount_paise > 0),
  allocated_by uuid not null references app_users(id) on delete restrict,
  allocated_at timestamptz not null default now(),
  foreign key (organization_id,advance_id) references billing_advances(organization_id,id) on delete restrict,
  foreign key (organization_id,invoice_id) references billing_invoices(organization_id,id) on delete restrict
);

create table billing_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  invoice_id uuid not null references billing_invoices(id) on delete restrict,
  amount_paise bigint not null check (amount_paise > 0),
  received_on date not null,
  method text not null check (method in ('cash','bank')),
  reference_note text check (reference_note is null or char_length(reference_note) <= 500),
  status text not null default 'recorded' check (status in ('recorded','reconciled','void')),
  recorded_by uuid not null references app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (organization_id,invoice_id) references billing_invoices(organization_id,id) on delete restrict,
  unique(organization_id,id)
);

create table billing_payment_reconciliations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  payment_id uuid not null references billing_payments(id) on delete cascade,
  reconciliation_note text not null check (char_length(reconciliation_note) between 3 and 500),
  reconciled_by uuid not null references app_users(id) on delete restrict,
  reconciled_at timestamptz not null default now(),
  foreign key (organization_id,payment_id) references billing_payments(organization_id,id) on delete cascade,
  unique(payment_id)
);

create function can_access_billing_matter(target uuid,required matter_permission default 'view') returns boolean language sql stable security definer set search_path=public as $$
  select can_access_matter(target,required) or (
    required in ('view','edit') and exists(
      select 1 from matters m join memberships ms on ms.organization_id=m.organization_id
      where m.id=target and not m.restricted and ms.user_id=current_app_user_id() and ms.active and ms.role='finance'
    )
  )
$$;

create function has_finance_access(org uuid) returns boolean language sql stable security definer set search_path=public as $$
  select has_org_role(org,array['owner','managing_partner','admin','finance']::app_role[])
$$;

create function guard_billing_charge() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.amount_paise <> round(new.quantity * new.unit_amount_paise)::bigint then
    raise exception 'Charge amount must equal quantity multiplied by unit amount.' using errcode='23514';
  end if;
  if tg_op='UPDATE' and old.status in ('approved','invoiced') and (new.description,new.occurred_on,new.quantity,new.unit_amount_paise,new.amount_paise,new.billing_account_id,new.matter_id) is distinct from (old.description,old.occurred_on,old.quantity,old.unit_amount_paise,old.amount_paise,old.billing_account_id,old.matter_id) then
    raise exception 'Approved and invoiced charges are immutable.' using errcode='P0001';
  end if;
  if tg_op='UPDATE' and new.created_by<>old.created_by then
    raise exception 'The charge creator cannot be changed.' using errcode='42501';
  end if;
  if tg_op='UPDATE' and new.status<>old.status then
    if not ((old.status='draft' and new.status in ('submitted','void')) or (old.status='submitted' and new.status in ('approved','rejected','void') and has_finance_access(new.organization_id)) or (old.status='rejected' and new.status in ('draft','void')) or (old.status='approved' and new.status in ('invoiced','void') and has_finance_access(new.organization_id))) then
      raise exception 'This charge state transition is not permitted.' using errcode='42501';
    end if;
  end if;
  return new;
end $$;
create trigger billing_charges_guard before insert or update on billing_charges for each row execute function guard_billing_charge();

create function guard_billing_invoice() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if (new.organization_id,new.matter_id,new.billing_account_id,new.invoice_number,new.issue_date,new.total_paise,new.snapshot,new.created_by) is distinct from (old.organization_id,old.matter_id,old.billing_account_id,old.invoice_number,old.issue_date,old.total_paise,old.snapshot,old.created_by) then
    raise exception 'Issued invoice-draft snapshots are immutable.' using errcode='P0001';
  end if;
  if new.paid_paise<old.paid_paise or new.paid_paise>new.total_paise then raise exception 'Invoice payment total is invalid.' using errcode='23514'; end if;
  if not has_finance_access(new.organization_id) then raise exception 'Finance authority is required to update an invoice.' using errcode='42501'; end if;
  return new;
end $$;
create trigger billing_invoices_guard before update on billing_invoices for each row execute function guard_billing_invoice();

create function guard_billing_payment_update() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status<>old.status and not (old.status='recorded' and new.status='reconciled' and exists(select 1 from billing_payment_reconciliations where payment_id=old.id)) then
    raise exception 'A payment becomes reconciled only after a reconciliation record is created.' using errcode='42501';
  end if;
  if (new.organization_id,new.invoice_id,new.amount_paise,new.received_on,new.method,new.reference_note,new.recorded_by) is distinct from (old.organization_id,old.invoice_id,old.amount_paise,old.received_on,old.method,old.reference_note,old.recorded_by) then
    raise exception 'Recorded payment details are immutable.' using errcode='P0001';
  end if;
  return new;
end $$;
create trigger billing_payments_guard_update before update on billing_payments for each row execute function guard_billing_payment_update();

create function guard_advance_allocation() returns trigger language plpgsql security definer set search_path=public as $$
declare available bigint; invoice_account uuid; advance_account uuid; invoice_due bigint;
begin
  select amount_paise - coalesce((select sum(amount_paise) from billing_advance_allocations where advance_id=new.advance_id and id is distinct from new.id),0), billing_account_id into available,advance_account from billing_advances where id=new.advance_id for update;
  select billing_account_id,total_paise-paid_paise-coalesce((select sum(amount_paise) from billing_credit_notes where invoice_id=new.invoice_id),0) into invoice_account,invoice_due from billing_invoices where id=new.invoice_id for update;
  if available is null or invoice_due is null or advance_account<>invoice_account then raise exception 'Advance and invoice must belong to the same billing account.' using errcode='23514'; end if;
  if new.amount_paise>available then raise exception 'Advance allocation exceeds the available balance.' using errcode='23514'; end if;
  if new.amount_paise>invoice_due then raise exception 'Advance allocation exceeds the invoice balance.' using errcode='23514'; end if;
  return new;
end $$;
create trigger billing_advance_allocations_guard before insert or update on billing_advance_allocations for each row execute function guard_advance_allocation();

create function guard_billing_payment() returns trigger language plpgsql security definer set search_path=public as $$
declare due bigint;
begin
  select total_paise-paid_paise-coalesce((select sum(amount_paise) from billing_credit_notes where invoice_id=new.invoice_id),0)-coalesce((select sum(amount_paise) from billing_payments where invoice_id=new.invoice_id and status='recorded' and id is distinct from new.id),0) into due from billing_invoices where id=new.invoice_id for update;
  if due is null or new.amount_paise>due then raise exception 'Payment exceeds the outstanding invoice balance.' using errcode='23514'; end if;
  return new;
end $$;
create trigger billing_payments_guard before insert on billing_payments for each row execute function guard_billing_payment();

do $$ declare table_name text; begin
  foreach table_name in array array['billing_accounts','billing_charges'] loop
    execute format('create trigger %I_updated before update on %I for each row execute function set_updated_at()',table_name,table_name);
  end loop;
end $$;
create index billing_charges_matter_idx on billing_charges(organization_id,matter_id,status,occurred_on desc);
create index billing_invoices_matter_idx on billing_invoices(organization_id,matter_id,issue_date desc);
create index billing_payments_invoice_idx on billing_payments(invoice_id,status);

do $$ declare table_name text; begin
  foreach table_name in array array['billing_accounts','billing_charges','billing_charge_approvals','billing_advances','billing_invoice_sequences','billing_invoices','billing_invoice_lines','billing_credit_notes','billing_advance_allocations','billing_payments','billing_payment_reconciliations'] loop
    execute format('alter table %I enable row level security',table_name);
    execute format('alter table %I force row level security',table_name);
  end loop;
end $$;

create policy billing_accounts_select on billing_accounts for select using(created_by=current_app_user_id() or exists(select 1 from billing_charges c where c.billing_account_id=id and can_access_billing_matter(c.matter_id,'view')));
create policy billing_accounts_insert on billing_accounts for insert with check(has_finance_access(organization_id) and created_by=current_app_user_id());
create policy billing_accounts_update on billing_accounts for update using(has_finance_access(organization_id)) with check(has_finance_access(organization_id));
create policy billing_charges_select on billing_charges for select using(can_access_billing_matter(matter_id,'view'));
create policy billing_charges_insert on billing_charges for insert with check(can_access_billing_matter(matter_id,'edit') and created_by=current_app_user_id());
create policy billing_charges_update on billing_charges for update using(can_access_billing_matter(matter_id,'edit')) with check(can_access_billing_matter(matter_id,'edit'));
create policy billing_charge_approvals_select on billing_charge_approvals for select using(exists(select 1 from billing_charges c where c.id=charge_id and can_access_billing_matter(c.matter_id,'view')));
create policy billing_charge_approvals_insert on billing_charge_approvals for insert with check(has_finance_access(organization_id) and decided_by=current_app_user_id());
create policy billing_advances_select on billing_advances for select using(exists(select 1 from billing_charges c where c.billing_account_id=billing_account_id and can_access_billing_matter(c.matter_id,'view')));
create policy billing_advances_write on billing_advances for all using(has_finance_access(organization_id)) with check(has_finance_access(organization_id) and created_by=current_app_user_id());
create policy billing_invoices_select on billing_invoices for select using(can_access_billing_matter(matter_id,'view'));
create policy billing_invoices_insert on billing_invoices for insert with check(can_access_billing_matter(matter_id,'edit') and created_by=current_app_user_id());
create policy billing_invoices_update on billing_invoices for update using(has_finance_access(organization_id)) with check(has_finance_access(organization_id));
create policy billing_lines_select on billing_invoice_lines for select using(exists(select 1 from billing_invoices i where i.id=invoice_id and can_access_billing_matter(i.matter_id,'view')));
create policy billing_lines_insert on billing_invoice_lines for insert with check(exists(select 1 from billing_invoices i where i.id=invoice_id and can_access_billing_matter(i.matter_id,'edit')));
create policy billing_credit_notes_select on billing_credit_notes for select using(exists(select 1 from billing_invoices i where i.id=invoice_id and can_access_billing_matter(i.matter_id,'view')));
create policy billing_credit_notes_insert on billing_credit_notes for insert with check(has_finance_access(organization_id) and created_by=current_app_user_id());
create policy billing_allocations_select on billing_advance_allocations for select using(exists(select 1 from billing_invoices i where i.id=invoice_id and can_access_billing_matter(i.matter_id,'view')));
create policy billing_allocations_insert on billing_advance_allocations for insert with check(has_finance_access(organization_id) and allocated_by=current_app_user_id());
create policy billing_payments_select on billing_payments for select using(exists(select 1 from billing_invoices i where i.id=invoice_id and can_access_billing_matter(i.matter_id,'view')));
create policy billing_payments_insert on billing_payments for insert with check(has_finance_access(organization_id) and recorded_by=current_app_user_id());
create policy billing_payments_update on billing_payments for update using(has_finance_access(organization_id)) with check(has_finance_access(organization_id));
create policy billing_reconciliation_select on billing_payment_reconciliations for select using(exists(select 1 from billing_payments p join billing_invoices i on i.id=p.invoice_id where p.id=payment_id and can_access_billing_matter(i.matter_id,'view')));
create policy billing_reconciliation_insert on billing_payment_reconciliations for insert with check(has_finance_access(organization_id) and reconciled_by=current_app_user_id());
create policy billing_sequence_access on billing_invoice_sequences for all using(has_finance_access(organization_id)) with check(has_finance_access(organization_id));

-- Aggregate-only financial values for finance users who cannot access a restricted matter.
-- Keep the function narrow: it returns no matter/client/invoice identity or drill-down key.
create function finance_aggregate_summary(p_org uuid) returns table(approved_paise bigint,invoiced_paise bigint,collected_paise bigint,outstanding_paise bigint,advance_paise bigint)
language sql stable security definer set search_path=public as $$
  select
    coalesce((select sum(amount_paise) from billing_charges where organization_id=p_org and status in ('approved','invoiced')),0)::bigint,
    coalesce((select sum(total_paise) from billing_invoices where organization_id=p_org and status<>'void'),0)::bigint,
    coalesce((select sum(amount_paise) from billing_payments where organization_id=p_org and status='reconciled'),0)::bigint,
    coalesce((select sum(total_paise-paid_paise) from billing_invoices where organization_id=p_org and status not in ('void','credited')),0)::bigint,
    coalesce((select sum(a.amount_paise-coalesce(x.allocated,0)) from billing_advances a left join (select advance_id,sum(amount_paise) allocated from billing_advance_allocations group by advance_id) x on x.advance_id=a.id where a.organization_id=p_org),0)::bigint
  where has_finance_access(p_org)
$$;

revoke all on billing_accounts,billing_charges,billing_charge_approvals,billing_advances,billing_invoice_sequences,billing_invoices,billing_invoice_lines,billing_credit_notes,billing_advance_allocations,billing_payments,billing_payment_reconciliations from public;
do $$ begin if exists(select 1 from pg_roles where rolname='nyayaflow_app') then
  grant select,insert,update on billing_accounts,billing_charges,billing_charge_approvals,billing_advances,billing_invoice_sequences,billing_invoices,billing_invoice_lines,billing_credit_notes,billing_advance_allocations,billing_payments,billing_payment_reconciliations to nyayaflow_app;
  grant execute on function finance_aggregate_summary(uuid) to nyayaflow_app;
end if; end $$;

commit;
