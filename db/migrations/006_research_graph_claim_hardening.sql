begin;

create or replace function claim_research_graph_job(worker_name text) returns setof research_graph_jobs
language plpgsql security definer set search_path=public as $$
declare claimed research_graph_jobs; begin
  -- A crashed worker must not permanently block its document. Preserve attempts and retry it;
  -- this function never rewrites a live lease held by another worker.
  update research_graph_jobs expired set status=case when exists(
      select 1 from research_graph_jobs active where active.document_id=expired.document_id and active.id<>expired.id and active.status in ('queued','failed')
    ) then 'dead_letter'::job_status else 'failed'::job_status end,
    leased_until=null,leased_by=null,last_error=coalesce(last_error,'Worker lease expired.'),available_at=now()
    where expired.status='leased' and expired.leased_until<now();

  select * into claimed from research_graph_jobs candidate
    where candidate.status in ('queued','failed') and candidate.available_at<=now() and candidate.attempts<candidate.max_attempts
      and not exists(select 1 from research_graph_jobs live where live.document_id=candidate.document_id and live.id<>candidate.id
        and live.status='leased' and live.leased_until>=now())
    order by candidate.created_at for update skip locked limit 1;
  if not found then return; end if;
  update research_graph_jobs set status='leased',leased_by=worker_name,leased_until=now()+interval '10 minutes',attempts=attempts+1
    where id=claimed.id returning * into claimed;
  return next claimed;
end $$;

commit;
