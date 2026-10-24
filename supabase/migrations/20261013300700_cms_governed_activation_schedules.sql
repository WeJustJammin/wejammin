-- Slice 12 lane L1 (BE03c Database Schema "GovernedActivationSchedule", "Governed activation, retirement and
-- scheduled activation (DEC-113, OD-6)", Scheduled activation; tracker P2-S12-AC-142 .. AC-147, AC-206, AC-255):
-- the scheduled governed activation, mirroring cms_publication_schedules (CMS-03B-20) column for column.
--
-- A schedule is accepted by CMS-03C-09 (insert, pending, version 1) for an APPROVED review at the version it
-- relied on, and afterwards advanced only by the claim and execute RPCs of CMS-03C-19 (and cancelled by the
-- review invalidation) under CAS: pending | failed_retryable -> executing | cancelled, executing -> completed |
-- failed_retryable | blocked.  Identity and time evidence never change.  `reason_code` is stored exactly for
-- blocked and cancelled rows; a cancelled row is always approval_invalidated; attempt_count is 0..3 and moves by
-- exactly +1 with each retryable failure; the lease is held exactly while the schedule is executing;
-- actual_at_utc and deviation_seconds are stored together, exactly when the schedule is completed.  One live
-- (pending, executing, failed_retryable) schedule per subject.  The state guard is defence in depth under the
-- RPCs; it is SECURITY INVOKER and owned by the CMS definer role.  Forward-only.
begin;
set local lock_timeout = '5s';

create table platform_private.cms_governed_activation_schedules (
  id uuid not null default extensions.gen_random_uuid() primary key,
  owner_id uuid not null references platform_private.party(id),
  state text not null default 'pending',
  version bigint not null default 1,
  review_id uuid not null,
  subject_kind text not null,
  subject_id uuid not null,
  local_datetime timestamp not null,
  timezone text not null,
  resolved_at_utc timestamptz not null,
  tzdb_version text not null,
  disambiguation text not null,
  expected_version bigint not null,
  attempt_count smallint not null default 0,
  next_attempt_at timestamptz null,
  lease_id uuid null,
  lease_until timestamptz null,
  reason_code text null,
  actual_at_utc timestamptz null,
  deviation_seconds bigint null,
  created_by uuid not null references platform_private.person_party(party_id),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint cms_governed_activation_schedules_state_check check (
    state in ('pending', 'executing', 'completed', 'failed_retryable', 'blocked', 'cancelled')
  ),
  constraint cms_governed_activation_schedules_version_check check (version > 0),
  constraint cms_governed_activation_schedules_subject_kind_check check (
    subject_kind in ('template_version', 'pattern_version', 'taxonomy_version')
  ),
  constraint cms_governed_activation_schedules_timezone_check check (pg_catalog.octet_length(timezone) between 1 and 64),
  constraint cms_governed_activation_schedules_tzdb_check check (pg_catalog.octet_length(tzdb_version) between 1 and 32),
  constraint cms_governed_activation_schedules_disambiguation_check check (disambiguation in ('none', 'earlier', 'later')),
  constraint cms_governed_activation_schedules_expected_version_check check (expected_version > 0),
  constraint cms_governed_activation_schedules_attempt_count_check check (attempt_count between 0 and 3),
  constraint cms_governed_activation_schedules_reason_code_check check (
    reason_code is null or reason_code in (
      'approval_invalidated', 'dependency_changed', 'activation_authority_ended',
      'canonical_source_unavailable', 'retries_exhausted')
  ),
  constraint cms_governed_activation_schedules_reason_state_check check (
    (state in ('blocked', 'cancelled')) = (reason_code is not null)
  ),
  constraint cms_governed_activation_schedules_cancelled_reason_check check (
    state <> 'cancelled' or reason_code = 'approval_invalidated'
  ),
  constraint cms_governed_activation_schedules_retries_exhausted_check check (
    reason_code is distinct from 'retries_exhausted' or attempt_count = 3
  ),
  constraint cms_governed_activation_schedules_lease_check check (
    (state = 'executing') = (lease_id is not null) and (lease_id is null) = (lease_until is null)
  ),
  constraint cms_governed_activation_schedules_retry_check check (
    state <> 'failed_retryable' or (next_attempt_at is not null and attempt_count between 1 and 3)
  ),
  constraint cms_governed_activation_schedules_completion_check check (
    (state = 'completed') = (actual_at_utc is not null) and (actual_at_utc is null) = (deviation_seconds is null)
  ),
  constraint cms_governed_activation_schedules_offset_check check (
    local_datetime - (resolved_at_utc at time zone 'UTC') between interval '-12 hours' and interval '14 hours'
  ),
  constraint cms_governed_activation_schedules_review_owner_fkey
    foreign key (review_id, owner_id) references platform_private.cms_governed_reviews(id, owner_id)
);

create unique index cms_governed_activation_schedules_live_subject_unique
  on platform_private.cms_governed_activation_schedules (subject_kind, subject_id)
  where state in ('pending', 'executing', 'failed_retryable');
create index cms_governed_activation_schedules_claim_idx
  on platform_private.cms_governed_activation_schedules (state, next_attempt_at, resolved_at_utc)
  where state in ('pending', 'failed_retryable');
create index cms_governed_activation_schedules_review_idx
  on platform_private.cms_governed_activation_schedules (review_id);

create or replace function platform_private.cms_governed_schedule_guard()
returns trigger
language plpgsql
set search_path = ''
as $body$
declare
  review_row platform_private.cms_governed_reviews%rowtype;
  moving constant text[] := array[
    'state', 'version', 'updated_at', 'attempt_count', 'next_attempt_at', 'lease_id', 'lease_until',
    'reason_code', 'actual_at_utc', 'deviation_seconds'
  ]::text[];
begin
  if tg_op = 'DELETE' then
    raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' then
    if (pg_catalog.to_jsonb(new) - moving) is distinct from (pg_catalog.to_jsonb(old) - moving) then
      raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
    end if;
    if new.version <> old.version + 1 or new.updated_at < old.updated_at then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    if not (
         (old.state in ('pending', 'failed_retryable') and new.state in ('executing', 'cancelled'))
      or (old.state = 'executing' and new.state in ('completed', 'failed_retryable', 'blocked'))
    ) then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    if new.attempt_count is distinct from old.attempt_count + (case when new.state = 'failed_retryable' then 1 else 0 end) then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if new.state <> 'pending' or new.version <> 1 or new.attempt_count <> 0 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  select review_item.* into review_row
    from platform_private.cms_governed_reviews review_item
   where review_item.id = new.review_id;
  if not found then
    return new;
  end if;
  if review_row.state <> 'approved'
     or review_row.version <> new.expected_version
     or review_row.subject_kind <> new.subject_kind
     or review_row.subject_id <> new.subject_id then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;

alter table platform_private.cms_governed_activation_schedules enable row level security;
alter table platform_private.cms_governed_activation_schedules force row level security;
revoke all on table platform_private.cms_governed_activation_schedules
  from public, anon, authenticated, service_role;
create policy cms_governed_activation_schedules_rpc_policy
  on platform_private.cms_governed_activation_schedules
  for all to public
  using (platform_private.cms_rpc_context_valid())
  with check (platform_private.cms_rpc_context_valid());

create trigger cms_governed_activation_schedules_write_guard
before insert or update or delete on platform_private.cms_governed_activation_schedules
for each row execute function platform_private.cms_write_guard();
create trigger cms_governed_activation_schedules_z_state_guard
before insert or update or delete on platform_private.cms_governed_activation_schedules
for each row execute function platform_private.cms_governed_schedule_guard();

grant insert, select, update on table platform_private.cms_governed_activation_schedules to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_governed_schedule_guard() owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_governed_schedule_guard()
  from public, anon, authenticated, service_role;

commit;
