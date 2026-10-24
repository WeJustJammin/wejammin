-- Slice 12 lane taxonomy-terms, merge convergence (BE03c Term actions and merge convergence at 1377, job transport at 1334, lock order at 1338, 1344
-- and 1351, term assignment row at 1430; P2-S12-AC-003, AC-021): "re-points every active TermAssignment of the retired term to the survivor by
-- appending superseding assignment versions: up to 5,000 assignments converge in the same transaction, a larger set continues through the
-- idempotent job cms.taxonomy.merge_converge from a durable cursor, and the retired id resolves permanently to the survivor throughout".
--
-- Assignment rows are append-only (updated_at = created_at, UPDATE and DELETE refused), so supersession is itself an appended row.  An
-- assignment LINEAGE is (revision_id, field_definition_id, term_id) and its CURRENT row is the highest version.  Converging one current
-- ACTIVE row of the retired term appends
--   * a `superseded` row of the retired term at version + 1 (same field, position, provenance, creator), and
--   * an `active` row of the survivor at the survivor lineage's next version, copying field, position and provenance - unless the survivor is
--     already actively assigned at that (revision, field), in which case the retired assignment simply ends (convergence, no duplicate).
-- The durable cursor (BE03c 1334) is the data itself: a converged assignment is no longer a current active row of a merged term, so a re-run,
-- a continuation and a retry are idempotent without any stored position.  The BE00 jobs row is owned by the job runtime (claim, lease, outcome);
-- the CMS definer holds SELECT on it only, so the handler reads the row and never writes it (see the lane report, decision D9).  A `revoked` or
-- `superseded` current row is never touched.
--   cms_taxonomy_merge_work(owner, term)                      the unconverged current active assignments of merged terms (one predicate, four users)
--   cms_converge_taxonomy_merge(retired term, batch)          one batch of 1 .. 5000 under the term row locks -> { converged, remaining }
--   cms_request_taxonomy_merge_converge(actor, party, term, corr) the BE00 jobs row bound to the actor and acting party (idempotent per term)
--   cms_run_taxonomy_merge_converge(job id, batch)            the job handler: positions 1, 3 and 6, then the merged terms of the job's party
-- Private; SECURITY DEFINER; owned by the CMS definer; executable by no API role (the Worker reaches the handler through
-- platform_api.cms_run_taxonomy_merge_converge, 20261014120310).  Forward-only.
begin;
set local lock_timeout = '5s';

-- The current ACTIVE assignment rows of MERGED terms of one owner (of one retired term when p_term_id is not null): the work left to converge.
create or replace function platform_private.cms_taxonomy_merge_work(p_owner_id uuid, p_term_id uuid)
returns setof platform_private.cms_term_assignments
language sql
stable
security definer
set search_path = ''
as $body$
  select assignment.*
    from platform_private.cms_term_assignments assignment
    join platform_private.cms_terms term on term.id = assignment.term_id
   where assignment.owner_id = p_owner_id and term.owner_id = p_owner_id and term.lifecycle = 'merged'
     and (p_term_id is null or term.id = p_term_id)
     and assignment.state = 'active'
     and not exists (
       select 1 from platform_private.cms_term_assignments later
        where later.revision_id = assignment.revision_id and later.field_definition_id = assignment.field_definition_id
          and later.term_id = assignment.term_id and later.version > assignment.version)
$body$;

comment on function platform_private.cms_taxonomy_merge_work(uuid, uuid) is
  'BE03c 1377: the current active assignment rows of merged terms of an owner (optionally of one retired term) that have not converged onto the survivor yet. Private; STABLE.';

create or replace function platform_private.cms_converge_taxonomy_merge(p_retired_term_id uuid, p_batch integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  retired platform_private.cms_terms%rowtype;
  survivor platform_private.cms_terms%rowtype;
  lock_row record;
  work_row platform_private.cms_term_assignments%rowtype;
  survivor_version bigint;
  survivor_active boolean;
  converged integer := 0;
  remaining bigint;
begin
  if p_batch is null or p_batch not between 1 and 5000 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  -- The redirect target of a merged term never changes (the stored guards), so it is read unlocked; position 6 then takes the retired term and its
  -- survivor in ONE statement in ascending id order (BE03c 1338) - never retired first - and the facts are re-read under the locks.
  select * into retired from platform_private.cms_terms where id = p_retired_term_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if retired.lifecycle <> 'merged' or retired.successor_id is null then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  for lock_row in
    select locked.id
      from platform_private.cms_terms locked
     where locked.id in (retired.id, retired.successor_id)
     order by locked.id
       for update
  loop
    null;
  end loop;
  select * into retired from platform_private.cms_terms where id = p_retired_term_id;
  select * into survivor from platform_private.cms_terms where id = retired.successor_id;

  for work_row in
    select work.*
      from platform_private.cms_taxonomy_merge_work(retired.owner_id, retired.id) work
     order by work.revision_id, work.field_definition_id
     limit p_batch
  loop
    insert into platform_private.cms_term_assignments (owner_id, state, version, revision_id, field_definition_id, term_id,
                                                        taxonomy_version_id, position, provenance, created_by)
    values (work_row.owner_id, 'superseded', work_row.version + 1, work_row.revision_id, work_row.field_definition_id,
            work_row.term_id, work_row.taxonomy_version_id, work_row.position, work_row.provenance, work_row.created_by);

    select latest.version, latest.state = 'active' into survivor_version, survivor_active
      from platform_private.cms_term_assignments latest
     where latest.revision_id = work_row.revision_id and latest.field_definition_id = work_row.field_definition_id
       and latest.term_id = survivor.id
     order by latest.version desc limit 1;
    if survivor_version is null or not survivor_active then
      insert into platform_private.cms_term_assignments (owner_id, state, version, revision_id, field_definition_id, term_id,
                                                          taxonomy_version_id, position, provenance, created_by)
      values (work_row.owner_id, 'active', coalesce(survivor_version, 0) + 1, work_row.revision_id, work_row.field_definition_id,
              survivor.id, survivor.taxonomy_version_id, work_row.position, work_row.provenance, work_row.created_by);
    end if;
    survivor_version := null;
    survivor_active := null;
    converged := converged + 1;
  end loop;

  select pg_catalog.count(*) into remaining from platform_private.cms_taxonomy_merge_work(retired.owner_id, retired.id);
  return pg_catalog.jsonb_build_object('converged', converged, 'remaining', remaining);
end;
$body$;

comment on function platform_private.cms_converge_taxonomy_merge(uuid, integer) is
  'BE03c 1377: converges up to p_batch current active assignments of a merged term onto its survivor by appending superseding versions; idempotent, the retired term and its survivor locked in ascending id order. Returns { converged, remaining }. Private.';

create or replace function platform_private.cms_request_taxonomy_merge_converge(
  p_actor_id uuid, p_acting_party_id uuid, p_retired_term_id uuid, p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  accepted record;
begin
  select job.job_id, job.replayed into accepted
    from platform_private.accept_job_with_outbox(
      p_actor_id, p_acting_party_id, 'cms.taxonomy.merge_converge', p_correlation_id,
      extensions.digest('cms.taxonomy.merge_converge:' || p_retired_term_id::text, 'sha256'),
      extensions.digest('cms.taxonomy.merge_converge:' || p_acting_party_id::text || ':' || p_retired_term_id::text, 'sha256'),
      pg_catalog.clock_timestamp() + interval '7 days') job;
  return pg_catalog.jsonb_build_object('jobId', accepted.job_id, 'replayed', accepted.replayed);
end;
$body$;

comment on function platform_private.cms_request_taxonomy_merge_converge(uuid, uuid, uuid, uuid) is
  'BE03c 1334: enqueues the BE00 job cms.taxonomy.merge_converge for a merge whose assignments outgrew its transaction; one job per retired term (idempotent). Private.';

-- The handler.  BE03c 1351: "the positions of the CMS-03C-03 merge it continues (1, 3 and 6), per batch": 1 the job actor's curator grant rows
-- (FOR SHARE; the capability is NOT re-proved - the merge it continues is committed, and leaving its assignments unconverged because the curator
-- has since left would strand them), 3 the ACTIVE version row of every vocabulary that still has work (FOR SHARE, ascending id), 6 every
-- retired term with work and its survivor (FOR UPDATE, ascending id, one statement); the per-term batches then re-take rows already held.
create or replace function platform_private.cms_run_taxonomy_merge_converge(p_job_id uuid, p_batch integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  job platform_private.jobs%rowtype;
  lock_row record;
  retired record;
  budget integer := p_batch;
  total integer := 0;
  step jsonb;
  remaining bigint;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  if p_batch is null or p_batch not between 1 and 5000 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  select * into job from platform_private.jobs where id = p_job_id and job_type = 'cms.taxonomy.merge_converge';
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  -- position 1
  perform platform_private.cms_lock_governed_authority(job.actor_id, job.acting_party_id, 'cms.taxonomy_curator');
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
  return pg_catalog.jsonb_build_object('converged', total, 'remaining', remaining);
end;
$body$;

comment on function platform_private.cms_run_taxonomy_merge_converge(uuid, integer) is
  'BE03c 1334, 1351: the handler of the BE00 job cms.taxonomy.merge_converge. Takes lock positions 1, 3 and 6, converges up to p_batch assignments of the merged terms of the job''s acting party and reports { converged, remaining }; idempotent on re-delivery; never writes the job row. Private; the Worker calls the platform_api wrapper.';

grant execute on function platform_private.accept_job_with_outbox(uuid, uuid, text, uuid, bytea, bytea, timestamp with time zone, uuid, uuid) to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_taxonomy_merge_work(uuid, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_converge_taxonomy_merge(uuid, integer) owner to wejammin_cms_definer;
alter function platform_private.cms_request_taxonomy_merge_converge(uuid, uuid, uuid, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_run_taxonomy_merge_converge(uuid, integer) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function
  platform_private.cms_taxonomy_merge_work(uuid, uuid),
  platform_private.cms_converge_taxonomy_merge(uuid, integer),
  platform_private.cms_request_taxonomy_merge_converge(uuid, uuid, uuid, uuid),
  platform_private.cms_run_taxonomy_merge_converge(uuid, integer)
  from public, anon, authenticated, service_role;

commit;
