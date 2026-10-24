-- Slice 12 lane dec194, the bounded recovery sweep of a failed merge convergence (owner decision DEC-194; BE03c "Merge convergence recovery
-- (DEC-194; BE00 571 domain recovery reference)"; P2-S12-AC-226): "For each acting party that has a failed cms.taxonomy.merge_converge Job, still
-- has merged-term work, and has no queued or running Job of the type, it requests one fresh convergence Job bound to the failed Job's actor and
-- acting party, under an idempotency key derived from the failed Job's id (so a replayed tick requests nothing twice). It requests at most one Job
-- per acting party per 15 minutes and stops after 3 consecutive failed generations for that party".  It answers { requested } and records each
-- reconciled failed Job once in platform_private.taxonomy_merge_recoveries (20261014190020; DEC-212).
--
-- This file is the single definition of the private body: the first draft of the sweep (a body without the party mutex or the durable marker)
-- was squashed into it before promotion (review R2-01 option A, DEC-212), so history never carries a body that was superseded unobserved.
-- Its platform_api wrapper is 20261014190010 (a plpgsql wrapper that binds the private body at call time).
--
-- Serialization: admission is serialized against all three enqueue producers (the outer merge, the fenced continuation, this sweep) by the
-- per-acting-party transaction mutex platform_private.cms_taxonomy_merge_enqueue_lock (20261014190020).  The sweep takes ONLY that mutex, parties
-- in ascending id (BE03c "Slice 12 lock order"), then reselects Q and refreshes every eligibility fact.  The pre-lock scan routes parties only; no
-- failed Job identity or eligibility decision survives a mutex wait.  Review R2-03: the routing scan is itself a lock-free necessary condition
-- (the party's failed head is unmarked and no queued or running job of the type exists), so the lock set is the candidate set, not every party
-- that ever had a failed Job (jobs are never purged; transaction-scoped advisory locks are held to commit).  The post-lock re-selection below
-- stays the authority.  READ COMMITTED RPC isolation is required for these fresh SQL snapshots; proving the actual RPC boundary is a separate
-- gate.  BE00 acceptance and the durable Q -> R insert are one atomic RPC transaction, including a replayed receipt.  The public wrapper and
-- { requested } are unchanged.
--
-- Interpretation, stated where the spec is silent (each is pinned by supabase/tests/phase_02_slice_12_dec194_sweep):
--   * "the failed Job" is the party's most recent failed job of the type (created_at, then id, descending); its id derives the idempotency key
--     (cms.taxonomy.merge_converge.reconcile:<failed job id>, a namespace new per failed job: the first request of a term is keyed
--     cms.taxonomy.merge_converge:<term id> and a continuation cms.taxonomy.merge_converge.continuation:<job id>, so neither is ever reused);
--   * "per 15 minutes" is measured from the party's last job activity of the type (the greatest updated_at over its jobs of the type), so the back-off
--     runs from the failure itself and a request never follows any job activity of the party within 15 minutes;
--   * a "generation" is one job of the type; the run of consecutive failed generations is counted from the party's newest job backwards and any job
--     that is not failed (succeeded, cancelled) ends it.  A queued or running job is live and excludes the party before the count is reached.
-- A replayed key (the failed job was already reconciled) counts nothing: requested is the number of FIRST acceptances.  The body takes the RPC
-- context itself (the work predicate reads forced-RLS tables); its platform_api wrapper restores the caller's flag.
-- Private; SECURITY DEFINER; owned by the CMS definer; executable by no API role.  Forward-only.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_reconcile_taxonomy_merge_converge()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  party record;
  candidate record;
  step record;
  accepted record;
  failed_run integer;
  requested integer := 0;
  now_at timestamp with time zone;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  -- Routing scan (R2-03): parties in ascending id whose failed head (latest failed job of the type) has no recovery marker and which have no
  -- queued or running job of the type. Both are necessary conditions of the post-lock tests below, so skipping any other party loses nothing.
  for party in
    select head.acting_party_id
      from (select distinct on (job.acting_party_id) job.id, job.acting_party_id
              from platform_private.jobs job
             where job.job_type = 'cms.taxonomy.merge_converge' and job.state = 'failed'
             order by job.acting_party_id, job.created_at desc, job.id desc) head
     where not exists (
             select 1 from platform_private.taxonomy_merge_recoveries recovery
              where recovery.failed_job_id = head.id)
       and not exists (
             select 1 from platform_private.jobs live
              where live.job_type = 'cms.taxonomy.merge_converge' and live.acting_party_id = head.acting_party_id
                and live.state in ('queued', 'running'))
     order by head.acting_party_id
  loop
    perform platform_private.cms_taxonomy_merge_enqueue_lock(party.acting_party_id);
    select job.id, job.actor_id, job.acting_party_id, job.correlation_id into candidate
      from platform_private.jobs job
     where job.job_type = 'cms.taxonomy.merge_converge' and job.state = 'failed'
       and job.acting_party_id = party.acting_party_id
     order by job.created_at desc, job.id desc limit 1;
    continue when not found;
    continue when exists (
      select 1 from platform_private.taxonomy_merge_recoveries recovery
       where recovery.failed_job_id = candidate.id);
    continue when exists (
      select 1 from platform_private.jobs live
       where live.job_type = 'cms.taxonomy.merge_converge' and live.acting_party_id = candidate.acting_party_id
         and live.state in ('queued', 'running'));
    -- Capture current time AFTER the mutex wait, never at function entry.
    now_at := pg_catalog.clock_timestamp();
    continue when exists (
      select 1 from platform_private.jobs recent
       where recent.job_type = 'cms.taxonomy.merge_converge' and recent.acting_party_id = candidate.acting_party_id
         and recent.updated_at > now_at - interval '15 minutes');
    continue when not exists (select 1 from platform_private.cms_taxonomy_merge_work(candidate.acting_party_id, null));
    failed_run := 0;
    for step in
      select history.state
        from platform_private.jobs history
       where history.job_type = 'cms.taxonomy.merge_converge' and history.acting_party_id = candidate.acting_party_id
       order by history.created_at desc, history.id desc
    loop
      exit when step.state <> 'failed';
      failed_run := failed_run + 1;
      exit when failed_run >= 3;
    end loop;
    continue when failed_run >= 3;
    select job.job_id, job.replayed into accepted
      from platform_private.accept_job_with_outbox(
        candidate.actor_id, candidate.acting_party_id, 'cms.taxonomy.merge_converge', candidate.correlation_id,
        extensions.digest('cms.taxonomy.merge_converge.reconcile:' || candidate.id::text, 'sha256'),
        extensions.digest('cms.taxonomy.merge_converge.reconcile:' || candidate.acting_party_id::text || ':' || candidate.id::text, 'sha256'),
        now_at + interval '7 days') job;
    begin
      insert into platform_private.taxonomy_merge_recoveries(failed_job_id, recovery_job_id)
      values (candidate.id, accepted.job_id);
    exception when integrity_constraint_violation then
      -- Preserve safe P0001 error vocabulary; rethrow out of the RPC so the
      -- preceding BE00 job/outbox/audit/receipt effects roll back with the marker.
      -- Deadlocks/lock failures are NOT caught here: the existing wrapper maps them.
      raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
    end;
    if not accepted.replayed then requested := requested + 1; end if;
  end loop;
  return pg_catalog.jsonb_build_object('requested', requested);
end;
$body$;

comment on function platform_private.cms_reconcile_taxonomy_merge_converge() is
  'DEC-194 recovery: routes only parties whose latest failed Q is unmarked and that have no live job, takes the shared party transaction mutex (ascending party id), then reselects latest failed Q and refreshes no-live, 15-minute, remaining-work and failed-streak gates; atomically records durable Q->accepted R (platform_private.taxonomy_merge_recoveries, DEC-212) after fresh/replayed BE00 acceptance. Counts fresh acceptances only; returns { requested }. Private.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_reconcile_taxonomy_merge_converge() owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_reconcile_taxonomy_merge_converge()
  from public, anon, authenticated, service_role;

commit;
