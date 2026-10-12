-- CMS-03B-20 execute (BE03b "Schedule execution (CMS-03B-20)": "A schedule whose entry is not `active` at execution
-- is `cancelled` with `entry_unavailable`"; tracker P2-S11-AC-083; review finding A-M7; orchestrator ruling
-- 2026-10-11, which supersedes DEC-158(d)'s "ScheduleExecutionResult omits cancelled" for this one case).
--
-- THE RACE.  A sweeper CLAIMS a due schedule (executing, lease held) and only then the entry leaves `active`.  The
-- review invalidation that the lifecycle change fires cancels `pending` and `failed_retryable` schedules; an
-- executing one is left to its executor, which found the review invalidated and BLOCKED the schedule
-- `approval_invalidated` - the wrong closed reason and the wrong state for an entry that is gone.
--
-- THE FIX, in the executor's own transaction.  The executor already holds the entry row FOR SHARE (global lock
-- order position 0), so the lifecycle it reads there cannot change before the transaction ends: an archive or hold
-- needs a conflicting row lock and waits.  Right after the fence (state, lease, version CAS) and the locks, and
-- BEFORE the review is re-read, an entry that is not `active` cancels the schedule `entry_unavailable`: version CAS
-- + 1, lease released, attempt count unchanged, one audit record (`cms.publication.schedule.cancel`), no lineage
-- row, no publication event (`cms.publication.changed.v1` is emitted only by an executed publication; the
-- invalidation already emitted the review event), no accessibility summary (no proof was verified).  An entry that
-- is still `active` keeps every earlier outcome: a superseded revision or a stale manifest still BLOCKS
-- `approval_invalidated`.
--
--   cms_schedule_cancel(schedule, version, reason, correlation, audit_event)          the executing -> cancelled CAS
--   cms_schedule_cancelled_result(schedule, reason, correlation [, audit_event])      the cancelled ScheduleExecutionResult
--
-- The executor body changes by exactly three anchors (the installed source is pinned by MD5 and the replacement is
-- proved reversible); its owner, ACL, search_path and every other pg_proc attribute are preserved.  The schedule
-- state guard admits executing -> cancelled (entry_unavailable only) in 20261010170000.  Forward-only: rollback is a
-- reviewed forward migration restoring the prior definition.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function platform_private.cms_schedule_cancel(
  p_schedule_id uuid,
  p_expected_version bigint,
  p_reason_code text,
  p_correlation_id uuid,
  p_audit_event_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $body$
declare
  schedule_row platform_private.cms_publication_schedules%rowtype;
  stamp timestamptz := pg_catalog.clock_timestamp();
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  -- The only closed reason an EXECUTING schedule is cancelled for; every other invalidation blocks it.
  if p_reason_code is distinct from 'entry_unavailable' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  select schedule_item.* into schedule_row
    from platform_private.cms_publication_schedules schedule_item
   where schedule_item.id = p_schedule_id
     for update;
  if not found or schedule_row.state <> 'executing' or schedule_row.version <> p_expected_version then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  update platform_private.cms_publication_schedules schedule_item
     set state = 'cancelled', reason_code = p_reason_code, lease_id = null, lease_until = null,
         next_attempt_at = null, version = schedule_item.version + 1, updated_at = stamp
   where schedule_item.id = schedule_row.id;
  perform platform_private.cms_record_audit_event(
    'cms.publication.schedule.cancel', null, schedule_row.owner_id, 'cms_publication_schedule',
    schedule_row.id, 'CMS_PUBLICATION_SCHEDULE_CANCELLED', p_correlation_id, p_audit_event_id);
end;
$body$;

comment on function platform_private.cms_schedule_cancel(uuid, bigint, text, uuid, uuid) is
  'BE03b CMS-03B-20: an executing schedule whose entry is no longer active ends cancelled with the closed reason entry_unavailable (the only reason an executing schedule is cancelled for); releases the lease, leaves the attempt count, version + 1 under the CAS; one audit record, written with the caller-chosen id (NULL = a fresh one), and no outbox event. Private.';

create or replace function platform_private.cms_schedule_cancelled_result(
  p_schedule platform_private.cms_publication_schedules,
  p_reason_code text,
  p_correlation_id uuid,
  p_audit_event_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
begin
  perform platform_private.cms_schedule_cancel(
    p_schedule.id, p_schedule.version, p_reason_code, p_correlation_id, p_audit_event_id);
  return pg_catalog.jsonb_build_object(
    'scheduleId', p_schedule.id, 'outcome', 'cancelled', 'reasonCode', p_reason_code,
    'publicationVersionId', null, 'actualUtc', null, 'deviationSeconds', null);
end;
$body$;

comment on function platform_private.cms_schedule_cancelled_result(platform_private.cms_publication_schedules, text, uuid, uuid) is
  'BE03b CMS-03B-20: cancels the executing schedule entry_unavailable (its one audit record carries the caller-chosen id) and answers the cancelled ScheduleExecutionResult (the prior publication stays intact). Private.';

-- SEC-2: new functions are owned by the CMS definer with no API-role execute.
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_schedule_cancel(uuid, bigint, text, uuid, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_schedule_cancelled_result(platform_private.cms_publication_schedules, text, uuid, uuid) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;

revoke all on function
  platform_private.cms_schedule_cancel(uuid, bigint, text, uuid, uuid),
  platform_private.cms_schedule_cancelled_result(platform_private.cms_publication_schedules, text, uuid, uuid)
  from public, anon, authenticated, service_role;

do $migration$
declare
  identity text := 'platform_private.cms_execute_publication_schedule(jsonb)';
  cms_owner oid := 'wejammin_cms_definer'::pg_catalog.regrole;
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  original_definition text;
  replacement_definition text;
  actual_definition text;
  replacement_source text;
  inverse_source text;
  original_metadata jsonb;
  original_comment text;
  anchor_index integer;
  old_anchors text[] := array[
    $old$  head_observation jsonb;
  execution_audit uuid := extensions.gen_random_uuid();$old$,
    $old$  perform 1
    from platform_private.cms_content_entries entry_item
   where entry_item.id = schedule_row.entry_id
     for share;
  perform platform_private.cms_lock_person_authority($old$,
    $old$  -- 2'. the approved review, still exactly what the schedule relied on, with every frozen identity current
$old$
  ];
  new_anchors text[] := array[
    $new$  head_observation jsonb;
  entry_lifecycle text;
  execution_audit uuid := extensions.gen_random_uuid();$new$,
    $new$  -- The lifecycle is read under the entry row's FOR SHARE lock (global lock order position 0), so it cannot change before
  -- this transaction ends: an archive or hold needs a conflicting row lock and waits for this execution.
  select entry_item.lifecycle into entry_lifecycle
    from platform_private.cms_content_entries entry_item
   where entry_item.id = schedule_row.entry_id
     for share;
  perform platform_private.cms_lock_person_authority($new$,
    $new$  -- 2''. BE03b CMS-03B-20 ("A schedule whose entry is not `active` at execution is `cancelled` with `entry_unavailable`";
  -- orchestrator ruling 2026-10-11 over DEC-158(d)): the entry is checked FIRST, before the review is re-read, because
  -- the lifecycle change that made the entry unavailable has already invalidated the review (entry_unavailable), and the
  -- right answer is the schedule's cancellation, not a block approval_invalidated.  Its own transaction: CAS, one audit
  -- record, no outbox event, no accessibility summary (no proof was verified), the prior publication intact.
  if entry_lifecycle is distinct from 'active' then
    return platform_private.cms_schedule_cancelled_result(schedule_row, 'entry_unavailable', correlation_id);
  end if;

  -- 2'. the approved review, still exactly what the schedule relied on, with every frozen identity current
$new$
  ];
begin
  if not exists (
    select 1 from pg_catalog.pg_roles role
     where role.oid = cms_owner
       and not role.rolcanlogin and not role.rolsuper and not role.rolbypassrls
  ) or pg_catalog.has_schema_privilege(cms_owner, 'platform_private', 'CREATE') then
    raise exception 'CMS schedule cancel executor owner baseline mismatch' using errcode = '55000';
  end if;

  select proc.* into original
    from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found then
    raise exception 'CMS schedule cancel executor function missing' using errcode = '55000';
  end if;
  original_definition := pg_catalog.pg_get_functiondef(original.oid);
  if pg_catalog.md5(original.prosrc) is distinct from '0fbd39030a79f8f8201174d141af9029'
     or pg_catalog.md5(original_definition) is distinct from '4507634e9ee370c658622fed3c48cd2d'
     or original.proowner is distinct from cms_owner
     or original.prokind is distinct from 'f'
     or original.provolatile is distinct from 'v'
     or original.prosecdef is distinct from true
     or original.proisstrict is distinct from false
     or original.proleakproof is distinct from false
     or original.proparallel is distinct from 'u'
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.proacl is distinct from
       array['wejammin_cms_definer=X/wejammin_cms_definer']::pg_catalog.aclitem[]
     or original.pronargs is distinct from 1
     or original.pronargdefaults is distinct from 0
     or original.proargnames is distinct from array['p_request']::text[]
     or pg_catalog.oidvectortypes(original.proargtypes) is distinct from 'jsonb'
     or original.prorettype is distinct from 'jsonb'::pg_catalog.regtype
     or original.proretset is distinct from false
     or original.prolang is distinct from (
       select lang.oid from pg_catalog.pg_language lang where lang.lanname = 'plpgsql'
     ) then
    raise exception 'CMS schedule cancel executor function baseline mismatch (installed source md5 %, definition md5 %)',
      pg_catalog.md5(original.prosrc), pg_catalog.md5(original_definition) using errcode = '55000';
  end if;
  original_metadata := pg_catalog.to_jsonb(original) - 'prosrc';
  original_comment := pg_catalog.obj_description(original.oid, 'pg_proc');
  if pg_catalog.cardinality(old_anchors) <> 3 or pg_catalog.cardinality(new_anchors) <> 3
     or (pg_catalog.length(original_definition) - pg_catalog.length(
       pg_catalog.replace(original_definition, original.prosrc, '')
     )) / pg_catalog.length(original.prosrc) <> 1 then
    raise exception 'CMS schedule cancel executor definition shape mismatch' using errcode = '55000';
  end if;

  replacement_source := original.prosrc;
  for anchor_index in 1..pg_catalog.cardinality(old_anchors) loop
    if (pg_catalog.length(replacement_source) - pg_catalog.length(
         pg_catalog.replace(replacement_source, old_anchors[anchor_index], '')
       )) / pg_catalog.length(old_anchors[anchor_index]) <> 1
       or pg_catalog.strpos(original.prosrc, new_anchors[anchor_index]) <> 0 then
      raise exception 'CMS schedule cancel executor anchor % mismatch', anchor_index using errcode = '55000';
    end if;
    replacement_source := pg_catalog.replace(
      replacement_source, old_anchors[anchor_index], new_anchors[anchor_index]
    );
  end loop;
  -- Inverse proof: undoing every replacement in reverse order restores the installed source byte for byte, so the
  -- listed anchors are the ONLY body change.
  inverse_source := replacement_source;
  for anchor_index in reverse pg_catalog.cardinality(new_anchors)..1 loop
    if (pg_catalog.length(inverse_source) - pg_catalog.length(
         pg_catalog.replace(inverse_source, new_anchors[anchor_index], '')
       )) / pg_catalog.length(new_anchors[anchor_index]) <> 1 then
      raise exception 'CMS schedule cancel executor inverse anchor % mismatch', anchor_index using errcode = '55000';
    end if;
    inverse_source := pg_catalog.replace(
      inverse_source, new_anchors[anchor_index], old_anchors[anchor_index]
    );
  end loop;
  if inverse_source is distinct from original.prosrc then
    raise exception 'CMS schedule cancel executor source inverse mismatch' using errcode = '55000';
  end if;

  replacement_definition := pg_catalog.replace(
    original_definition, original.prosrc, replacement_source
  );
  if (pg_catalog.length(replacement_definition) - pg_catalog.length(
       pg_catalog.replace(replacement_definition, replacement_source, '')
     )) / pg_catalog.length(replacement_source) <> 1
     or pg_catalog.replace(replacement_definition, replacement_source, inverse_source)
       is distinct from original_definition then
    raise exception 'CMS schedule cancel executor definition inverse mismatch' using errcode = '55000';
  end if;

  execute replacement_definition;

  select proc.* into actual from pg_catalog.pg_proc proc where proc.oid = original.oid;
  if not found then
    raise exception 'CMS schedule cancel executor replacement missing' using errcode = '55000';
  end if;
  actual_definition := pg_catalog.pg_get_functiondef(actual.oid);
  inverse_source := actual.prosrc;
  for anchor_index in reverse pg_catalog.cardinality(new_anchors)..1 loop
    inverse_source := pg_catalog.replace(
      inverse_source, new_anchors[anchor_index], old_anchors[anchor_index]
    );
  end loop;
  if actual.prosrc is distinct from replacement_source
     or (pg_catalog.to_jsonb(actual) - 'prosrc') is distinct from original_metadata
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from original_comment
     or actual_definition is distinct from replacement_definition
     or inverse_source is distinct from original.prosrc
     or pg_catalog.replace(actual_definition, actual.prosrc, inverse_source)
       is distinct from original_definition then
    raise exception 'CMS schedule cancel executor preservation mismatch' using errcode = '55000';
  end if;
end;
$migration$;

comment on function platform_private.cms_execute_publication_schedule(jsonb) is
  'CMS-03B-20 execute: re-reads the approved review and every frozen identity, rechecks the creator''s publisher grant (DEC-120), runs the 17-category execute-phase preflight with the verified proof (stale or mis-bound proof is the typed conflict preflight_evidence_stale and consumes nothing), applies the action under the lineage rules from the head observed before any shared lock (publication_conflict is retried) and completes the schedule with its actual instant and deviation, or blocks it (closed reason) or retries it (15 s / 60 s / 300 s, then retries_exhausted). A schedule whose entry is no longer active (read under the entry row''s FOR SHARE lock, before the review is re-read) is cancelled entry_unavailable in this transaction. Its accessibility summary is keyed to the exact audit event it wrote. Idempotent per (schedule, version, lease): a completed schedule answers already_completed. Private; the Worker scheduled sweep calls the platform_api wrapper.';

commit;
