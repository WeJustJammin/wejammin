-- Slice 12 lane taxonomy-terms, follow-up f2: the cms.taxonomy.merge_converge handler, fenced, authority-proved and chained.
-- Replaces platform_private.cms_run_taxonomy_merge_converge(uuid, integer) of 20261014120300 (dropped by 20261014120820, once its transport is
-- replaced) with a handler of a CLAIMED BE00 job.  Three review findings meet in this one function:
--
-- F1 LEASE AND STATE FENCE.  The handler of a BE00 jobs-row job re-proves the claim before it writes (20261005018400 cms_schema_dry_run_claim_snapshot:
-- state `running`, version, lease token, unexpired lease; BE00 consumer registry for platform.job.execute: "Re-read job/aggregate/authority ...
-- cancelled/terminal/stale -> no-op ack", lease acquisition CAS on Job.version).  An unclaimed, expired, re-claimed, cancelled or succeeded job is
-- refused CONFLICT and writes nothing.  The job row itself is still never written here: the BE00 runtime owns claim, lease and outcome (the CMS
-- definer holds SELECT on platform_private.jobs only).
--
-- F3 CAPABILITY RE-PROOF.  BE03c 1354 rule 1: "A writer takes its positions before it reads what it will write and re-proves its capability under the
-- position 1 locks. A revocation committed first wins: the writer is refused 403 with the operation's catalog code and writes no row", and BE03c 1351
-- lists `cms.taxonomy.merge_converge` as taking "the positions of the CMS-03C-03 merge it continues (1, 3 and 6)".  There is no spec text that exempts
-- the job, so the handler proves the job actor's `cms.taxonomy_curator` capability under the position 1 locks and refuses `capability_missing` (the
-- CMS-03C-03 catalog code, 403) with nothing written.  What the refusal leaves: the unconverged assignments stay current ACTIVE rows of a MERGED term,
-- which BE03c 1377 already resolves permanently to its survivor ("the retired id resolves permanently to the survivor throughout"), so a delayed tail is
-- never a wrong answer; and the handler converges the whole acting party's merged terms, so the next run under any holder of the capability drains it.
-- There is no spec'd command that re-requests a continuation by another curator (BOUNDARY, lane report).
--
-- F2 CHAINED CONTINUATION.  BE00 caps a job at 32 attempt summaries (platform_private.jobs.attempts; claim_job refuses a 33rd claim, 20260830120000)
-- and platform.job.execute allows 4 deliveries including the initial one, so re-queueing the SAME job after each batch strands a long merge after at
-- most 32 claims (4 queue deliveries).  When work remains the handler therefore hands it to a FRESH BE00 job bound to the same actor, acting party and
-- correlation - exactly how BE03c 1334 / 1377 already start the first continuation ("a BE00 jobs row bound to the merge command's actor and acting
-- party") - and the Worker records the current job `succeeded` with the answer.  The fresh job is requested with an idempotency key derived from the
-- current job id, so a re-delivery of the current job names the SAME continuation (no duplicate), and every job in the chain is claimed once.
-- The durable cursor of BE03c 1334 stays the data (decision D9); each continuation job row is the durable record that work remains.
--   request  (job id, claimed version, lease token, batch 1 .. 5000)
--   answer   { converged, remaining, continuationJobId }  (continuationJobId is null when remaining = 0)
-- Private; SECURITY DEFINER; owned by the CMS definer; executable by no API role.  Forward-only.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_run_taxonomy_merge_converge(
  p_job_id uuid, p_version bigint, p_lease_token uuid, p_batch integer
)
returns jsonb
language plpgsql
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
  -- the identity of the job (actor and acting party never change); the claim is proved below, under the position 1 locks
  select * into job from platform_private.jobs where id = p_job_id and job_type = 'cms.taxonomy.merge_converge';
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  -- position 1
  perform platform_private.cms_lock_governed_authority(job.actor_id, job.acting_party_id, curator);
  -- F1: the lease and state fence, read after the locks
  select * into job from platform_private.jobs where id = p_job_id;
  if job.state is distinct from 'running' or job.version is distinct from p_version
     or job.lease_token is distinct from p_lease_token
     or job.lease_until is null or job.lease_until <= pg_catalog.clock_timestamp() then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  -- F3: the capability, re-proved under the position 1 locks
  begin
    person_id := platform_private.identity_actor_person(job.actor_id);
  exception when others then
    person_id := null;
  end;
  if person_id is null or not platform_private.cms_person_holds_capability(job.acting_party_id, person_id, curator) then
    raise exception 'capability_missing' using errcode = 'P0001';
  end if;
  -- position 3
  perform 1
    from platform_private.cms_taxonomy_versions active_row
   where active_row.owner_id = job.acting_party_id and active_row.state = 'active'
     and active_row.taxonomy_id in (
       select term.taxonomy_id from platform_private.cms_taxonomy_merge_work(job.acting_party_id, null) work
         join platform_private.cms_terms term on term.id = work.term_id)
   order by active_row.id
     for share;
  -- position 6
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

  for retired in
    select distinct work.term_id from platform_private.cms_taxonomy_merge_work(job.acting_party_id, null) work order by work.term_id
  loop
    exit when budget <= 0;
    step := platform_private.cms_converge_taxonomy_merge(retired.term_id, budget);
    total := total + (step->>'converged')::integer;
    budget := budget - (step->>'converged')::integer;
  end loop;
  select pg_catalog.count(*) into remaining from platform_private.cms_taxonomy_merge_work(job.acting_party_id, null);
  -- F2: what is left continues on a FRESH job, idempotent per current job
  if remaining > 0 then
    select accepted.job_id into continuation
      from platform_private.accept_job_with_outbox(
        job.actor_id, job.acting_party_id, 'cms.taxonomy.merge_converge', job.correlation_id,
        extensions.digest('cms.taxonomy.merge_converge.continuation:' || job.id::text, 'sha256'),
        extensions.digest('cms.taxonomy.merge_converge.continuation:' || job.acting_party_id::text || ':' || job.id::text, 'sha256'),
        pg_catalog.clock_timestamp() + interval '7 days') accepted;
  end if;
  return pg_catalog.jsonb_build_object('converged', total, 'remaining', remaining, 'continuationJobId', continuation);
end;
$body$;

comment on function platform_private.cms_run_taxonomy_merge_converge(uuid, bigint, uuid, integer) is
  'BE03c 1334, 1351, 1354, 1377: the handler of a CLAIMED BE00 job cms.taxonomy.merge_converge. Proves the lease (running, version, token, unexpired) and the actor''s curator capability under the position 1 locks, takes positions 3 and 6, converges up to p_batch assignments of the acting party''s merged terms and, when work remains, requests a FRESH continuation job (idempotent per current job). Returns { converged, remaining, continuationJobId }. Never writes the job row. Private; the Worker calls the platform_api wrapper.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_run_taxonomy_merge_converge(uuid, bigint, uuid, integer) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_run_taxonomy_merge_converge(uuid, bigint, uuid, integer)
  from public, anon, authenticated, service_role;

commit;
