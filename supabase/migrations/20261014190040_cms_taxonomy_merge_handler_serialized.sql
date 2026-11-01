-- DEC-194: preserve the claimed continuation's existing protocol, capability,
-- ordered vocabulary/term locks, batch and continuation key. Position-1 authority
-- precedes the shared party mutex; the claim is reread AFTER that wait and again
-- after domain-lock waits before any convergence. A final fence also rolls back
-- provisional effects if a late BE00 receipt wait outlives or loses the claim.
-- The ordinary outer merge takes this same mutex before its domain locks.
-- Private; forward-only. The existing service-role transport is unchanged.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_run_taxonomy_merge_converge(
  p_job_id uuid, p_version bigint, p_lease_token uuid, p_batch integer
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  curator constant text := 'cms.taxonomy_curator';
  job platform_private.jobs%rowtype;
  person_id uuid;
  lock_row record;
  retired record;
  budget integer := p_batch;
  total integer := 0;
  step jsonb;
  remaining bigint;
  continuation uuid;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  if p_job_id is null or p_version is null or p_version < 1 or p_lease_token is null
     or p_batch is null or p_batch not between 1 and 5000 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  -- Immutable identity only; this is not an authoritative claim snapshot.
  select * into job from platform_private.jobs where id = p_job_id and job_type = 'cms.taxonomy.merge_converge';
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  -- Position 1 precedes the party mutex, matching the outer merge path.
  perform platform_private.cms_lock_governed_authority(job.actor_id, job.acting_party_id, curator);
  perform platform_private.cms_taxonomy_merge_enqueue_lock(job.acting_party_id);
  -- Fresh claim after the mutex wait. BE00 retains sole write ownership of Jobs.
  select * into job from platform_private.jobs where id = p_job_id;
  if job.state is distinct from 'running' or job.version is distinct from p_version
     or job.lease_token is distinct from p_lease_token
     or job.lease_until is null or job.lease_until <= pg_catalog.clock_timestamp() then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  begin
    person_id := platform_private.identity_actor_person(job.actor_id);
  exception when others then
    person_id := null;
  end;
  if person_id is null or not platform_private.cms_person_holds_capability(job.acting_party_id, person_id, curator) then
    raise exception 'capability_missing' using errcode = 'P0001';
  end if;
  -- Position 3.
  perform 1
    from platform_private.cms_taxonomy_versions active_row
   where active_row.owner_id = job.acting_party_id and active_row.state = 'active'
     and active_row.taxonomy_id in (
       select term.taxonomy_id from platform_private.cms_taxonomy_merge_work(job.acting_party_id, null) work
         join platform_private.cms_terms term on term.id = work.term_id)
   order by active_row.id
     for share;
  -- Position 6: every retired term and survivor in one ascending-id lock set.
  for lock_row in
    select locked.id
      from platform_private.cms_terms locked
     where locked.id in (
       select term.id from platform_private.cms_taxonomy_merge_work(job.acting_party_id, null) work
         join platform_private.cms_terms term on term.id = work.term_id
       union
       select term.successor_id from platform_private.cms_taxonomy_merge_work(job.acting_party_id, null) work
         join platform_private.cms_terms term on term.id = work.term_id)
     order by locked.id
       for update
  loop
    null;
  end loop;
  -- Domain locks may also have waited; no pre-wait claim authorizes effects.
  select * into job from platform_private.jobs where id = p_job_id;
  if job.state is distinct from 'running' or job.version is distinct from p_version
     or job.lease_token is distinct from p_lease_token
     or job.lease_until is null or job.lease_until <= pg_catalog.clock_timestamp() then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;

  for retired in
    select distinct work.term_id from platform_private.cms_taxonomy_merge_work(job.acting_party_id, null) work order by work.term_id
  loop
    exit when budget <= 0;
    step := platform_private.cms_converge_taxonomy_merge(retired.term_id, budget);
    total := total + (step->>'converged')::integer;
    budget := budget - (step->>'converged')::integer;
  end loop;
  select pg_catalog.count(*) into remaining from platform_private.cms_taxonomy_merge_work(job.acting_party_id, null);
  if remaining > 0 then
    select accepted.job_id into continuation
      from platform_private.accept_job_with_outbox(
        job.actor_id, job.acting_party_id, 'cms.taxonomy.merge_converge', job.correlation_id,
        extensions.digest('cms.taxonomy.merge_converge.continuation:' || job.id::text, 'sha256'),
        extensions.digest('cms.taxonomy.merge_converge.continuation:' || job.acting_party_id::text || ':' || job.id::text, 'sha256'),
        pg_catalog.clock_timestamp() + interval '7 days') accepted;
  end if;
  -- A claim lost during convergence or the late receipt wait commits no effect.
  select * into job from platform_private.jobs where id = p_job_id;
  if job.state is distinct from 'running' or job.version is distinct from p_version
     or job.lease_token is distinct from p_lease_token
     or job.lease_until is null or job.lease_until <= pg_catalog.clock_timestamp() then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  return pg_catalog.jsonb_build_object('converged', total, 'remaining', remaining, 'continuationJobId', continuation);
end;
$body$;

comment on function platform_private.cms_run_taxonomy_merge_converge(uuid, bigint, uuid, integer) is
  'DEC-194 / BE03c claimed merge continuation: authority -> party enqueue transaction mutex -> fresh claim/capability -> ordered vocabulary/term locks -> fresh claim -> bounded convergence and existing idempotent continuation acceptance -> final claim fence. Unchanged answer/protocol; no Job writes. Private.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_run_taxonomy_merge_converge(uuid, bigint, uuid, integer) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_run_taxonomy_merge_converge(uuid, bigint, uuid, integer)
  from public, anon, authenticated, service_role;

commit;
