-- Slice 12 lane governed-b (BE03c "Scheduled activation (OD-6)", CMS-03C-19 mirroring CMS-03B-20; tracker P2-S12-AC-142 .. AC-147): the
-- schedule state helpers shared by the claim and the executor.  They reuse the generic 03b pieces cms_schedule_correlation (the deterministic
-- correlation id of one claimed execution) and cms_schedule_retry_delay (15 s, 60 s, 300 s) and add the governed counterparts of
-- cms_schedule_record_failure and cms_schedule_block, which move cms_governed_activation_schedules (CAS on state and version).
--
--   cms_governed_schedule_record_failure(schedule, version, correlation)  an `executing` schedule failed retryably: attempt_count + 1 and the
--       retry instant, or `blocked` retries_exhausted when three attempts are spent; the lease is released; one audit record; answers
--       'failed_retryable' | 'blocked'
--   cms_governed_schedule_block(schedule, version, reason, correlation)   an `executing` schedule ends `blocked` with a closed reason code
--   cms_governed_try_lock_subject(kind, subject)                          the subject row FOR UPDATE SKIP LOCKED (true when taken): the claim never
--       waits on position 3 while it holds a position 6 schedule row
--   cms_governed_block_scheduled_subject(kind, subject)                   scheduled -> blocked (lifecycle + 1); any other state is left alone
-- Neither schedule helper touches the subject: the executor holds the subject lock and calls cms_governed_block_scheduled_subject itself.
-- Private; owned by the CMS definer role.  Forward-only.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_governed_schedule_record_failure(
  p_schedule_id uuid, p_expected_version bigint, p_correlation_id uuid
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  v_schedule platform_private.cms_governed_activation_schedules%rowtype;
  v_number integer;
  v_stamp timestamptz := pg_catalog.clock_timestamp();
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  select schedule_item.* into v_schedule from platform_private.cms_governed_activation_schedules schedule_item
   where schedule_item.id = p_schedule_id for update;
  if not found or v_schedule.state <> 'executing' or v_schedule.version <> p_expected_version then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  v_number := v_schedule.attempt_count + 1;
  if v_number > 3 then
    update platform_private.cms_governed_activation_schedules schedule_item
       set state = 'blocked', reason_code = 'retries_exhausted', lease_id = null, lease_until = null,
           next_attempt_at = null, version = schedule_item.version + 1, updated_at = v_stamp
     where schedule_item.id = v_schedule.id;
    perform platform_private.cms_record_audit(
      'cms.governed.schedule.block', null, v_schedule.owner_id, 'cms_governed_activation_schedule',
      v_schedule.id, 'CMS_GOVERNED_SCHEDULE_BLOCKED', p_correlation_id);
    return 'blocked';
  end if;
  update platform_private.cms_governed_activation_schedules schedule_item
     set state = 'failed_retryable', attempt_count = v_number,
         next_attempt_at = v_stamp + platform_private.cms_schedule_retry_delay(v_number),
         lease_id = null, lease_until = null, version = schedule_item.version + 1, updated_at = v_stamp
   where schedule_item.id = v_schedule.id;
  perform platform_private.cms_record_audit(
    'cms.governed.schedule.retry', null, v_schedule.owner_id, 'cms_governed_activation_schedule',
    v_schedule.id, 'CMS_GOVERNED_SCHEDULE_RETRY', p_correlation_id);
  return 'failed_retryable';
end;
$body$;

comment on function platform_private.cms_governed_schedule_record_failure(uuid, bigint, uuid) is
  'BE03c Scheduled activation: an executing schedule failed retryably. Releases the lease and either sets the retry (attempt_count + 1, next_attempt_at = now + 15 s / 60 s / 300 s) or, when three attempts are spent, blocks it retries_exhausted. One audit record. Answers failed_retryable or blocked. Private.';

create or replace function platform_private.cms_governed_schedule_block(
  p_schedule_id uuid, p_expected_version bigint, p_reason_code text, p_correlation_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  v_schedule platform_private.cms_governed_activation_schedules%rowtype;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  if p_reason_code is null or p_reason_code not in (
       'approval_invalidated', 'dependency_changed', 'activation_authority_ended',
       'canonical_source_unavailable', 'retries_exhausted') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  select schedule_item.* into v_schedule from platform_private.cms_governed_activation_schedules schedule_item
   where schedule_item.id = p_schedule_id for update;
  if not found or v_schedule.state <> 'executing' or v_schedule.version <> p_expected_version then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  update platform_private.cms_governed_activation_schedules schedule_item
     set state = 'blocked', reason_code = p_reason_code, lease_id = null, lease_until = null,
         next_attempt_at = null, version = schedule_item.version + 1, updated_at = pg_catalog.clock_timestamp()
   where schedule_item.id = v_schedule.id;
  perform platform_private.cms_record_audit(
    'cms.governed.schedule.block', null, v_schedule.owner_id, 'cms_governed_activation_schedule',
    v_schedule.id, 'CMS_GOVERNED_SCHEDULE_BLOCKED', p_correlation_id);
end;
$body$;

comment on function platform_private.cms_governed_schedule_block(uuid, bigint, text, uuid) is
  'BE03c Scheduled activation: an executing schedule ends blocked with a closed reason code (approval_invalidated, dependency_changed, activation_authority_ended, canonical_source_unavailable or retries_exhausted); releases the lease; one audit record. Private.';

create or replace function platform_private.cms_governed_try_lock_subject(p_kind text, p_subject_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  v_id uuid;
begin
  if p_kind = 'template_version' then
    select item.id into v_id from platform_private.cms_template_versions item
     where item.id = p_subject_id for update skip locked;
  elsif p_kind = 'pattern_version' then
    select item.id into v_id from platform_private.cms_pattern_versions item
     where item.id = p_subject_id for update skip locked;
  elsif p_kind = 'taxonomy_version' then
    select item.id into v_id from platform_private.cms_taxonomy_versions item
     where item.id = p_subject_id for update skip locked;
  end if;
  return v_id is not null;
end;
$body$;

create or replace function platform_private.cms_governed_block_scheduled_subject(p_kind text, p_subject_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  v_subject jsonb := platform_private.cms_governed_subject_resolve(p_kind, p_subject_id);
begin
  if v_subject is not null and v_subject->>'state' = 'scheduled' then
    perform platform_private.cms_governed_move_subject(p_kind, p_subject_id, 'blocked');
  end if;
end;
$body$;

comment on function platform_private.cms_governed_try_lock_subject(text, uuid) is
  'BE03c Slice 12 lock order: takes the subject version row FOR UPDATE SKIP LOCKED (true when taken) so a caller holding a schedule row (position 6) never waits on position 3. Private.';
comment on function platform_private.cms_governed_block_scheduled_subject(text, uuid) is
  'BE03c Subject state machine: a scheduled subject becomes blocked (lifecycle_version + 1) when its schedule ends terminally; a subject in any other state is left alone. Private.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_governed_schedule_record_failure(uuid, bigint, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_governed_schedule_block(uuid, bigint, text, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_governed_try_lock_subject(text, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_governed_block_scheduled_subject(text, uuid) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function
  platform_private.cms_governed_schedule_record_failure(uuid, bigint, uuid),
  platform_private.cms_governed_schedule_block(uuid, bigint, text, uuid),
  platform_private.cms_governed_try_lock_subject(text, uuid),
  platform_private.cms_governed_block_scheduled_subject(text, uuid)
  from public, anon, authenticated, service_role;

commit;
