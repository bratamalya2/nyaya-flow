-- Run in an isolated test database after db/migrations/001_initial.sql.
-- The executing role must not be the table owner and must not have BYPASSRLS.
begin;
select set_config('app.user_id','00000000-0000-4000-8000-000000000101',true);

do $$
begin
  if exists(select 1 from matters where organization_id='00000000-0000-4000-8000-000000000999') then
    raise exception 'cross-tenant matter was visible';
  end if;
  if exists(select 1 from documents d where not can_access_matter(d.matter_id,'view')) then
    raise exception 'unauthorized document metadata was visible';
  end if;
end $$;

rollback;
