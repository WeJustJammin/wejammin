-- Slice 11 data model (BE03b Database Schema "PublicationSchedule", Schedule
-- execution CMS-03B-20, Time authority E8, Separation of duties E11; tracker
-- P2-S11-AC-122): reconcile the Slice 10 foundation cms_publication_schedules
-- (20260927090000) to the locked shape.
--
--   * review_id (the approved review the schedule relies on) and audience (the
--     lineage is the revision's entry, the revision's locale and this audience)
--     are fixed at acceptance; the duplicate key gains the audience.
--   * the claim, lease and retry columns: attempt_count 0..3, next_attempt_at,
--     lease_id/lease_until (held exactly while the schedule is executing, so a
--     stale lease can never be mistaken for a live one) and the closed
--     reason_code catalog, stored exactly when the schedule is blocked or
--     cancelled (cancelled: approval_invalidated or entry_unavailable; blocked:
--     approval_invalidated, preflight_failed, publisher_authority_ended,
--     publication_not_active or retries_exhausted).
--   * actual_at_utc and deviation_seconds are stored together, exactly when the
--     schedule is completed.  A retryable schedule has failed at least once and
--     names its next attempt.
--   * the offset sanity bound of E8 as a row rule: localDateTime read as UTC
--     minus resolvedUtc lies within -12 and +14 hours.
--   * owner lineage declaratively: the entry owner, the revision of the entry
--     and the review of the revision are composite foreign keys.
--   * a state guard (defence in depth under the CMS-03B-07 acceptance RPC and the
--     CMS-03B-20 claim/execute RPCs): a schedule is created pending at version 1
--     with no attempt, for an APPROVED review at the version it relied on and the
--     review's dependency hash, never by the revision author for a publish (E11)
--     and only for an active entry; afterwards identity and evidence never change
--     (the job id is bound once), every update advances the CAS version by one,
--     the attempt count moves by exactly +1 with each retryable failure
--     (executing -> failed_retryable) and never otherwise, and states move
--     pending|failed_retryable -> executing | cancelled and executing ->
--     completed | failed_retryable | blocked; an executing schedule is never
--     cancelled (cancellation happens only in the review-invalidation transaction
--     for pending or failed_retryable schedules; an executing schedule whose
--     approval no longer matches is blocked approval_invalidated, DEC-158 d,
--     BE03b Schedule execution step 2); completed, blocked and cancelled are
--     terminal; a schedule is never deleted.  retries_exhausted (the fourth
--     retryable failure) is recorded only at attempt_count 3, the last count the
--     row can hold (BE03b Retry ladder).
-- The function is SECURITY INVOKER (it reads the review, the revision and the
-- entry).  The foundation holds no rows: nothing is back-filled.  Forward-only.
begin;

set local lock_timeout = '5s';

do $body$
begin
  if exists (select 1 from platform_private.cms_publication_schedules schedule_row) then
    raise exception 'CMS publication schedules pre-date the review binding'
      using errcode = 'P0001';
  end if;
end;
$body$;

alter table platform_private.cms_publication_schedules
  add column review_id uuid not null,
  add column audience text not null,
  add column attempt_count smallint not null default 0,
  add column next_attempt_at timestamptz null,
  add column lease_id uuid null,
  add column lease_until timestamptz null,
  add column reason_code text null;

alter table platform_private.cms_publication_schedules
  drop constraint cms_publication_schedules_identity_unique;

alter table platform_private.cms_publication_schedules
  add constraint cms_publication_schedules_identity_unique
    unique (entry_id, revision_id, action, local_datetime, timezone, audience),
  add constraint cms_publication_schedules_review_id_fkey
    foreign key (review_id) references platform_private.cms_editorial_reviews(id),
  add constraint cms_publication_schedules_audience_check
    check (audience ~ '^[a-z0-9_-]{1,48}$'),
  add constraint cms_publication_schedules_attempt_count_check
    check (attempt_count between 0 and 3),
  add constraint cms_publication_schedules_reason_code_check check (
    reason_code is null
    or reason_code in (
      'approval_invalidated', 'preflight_failed', 'publisher_authority_ended',
      'publication_not_active', 'retries_exhausted', 'entry_unavailable'
    )
  ),
  add constraint cms_publication_schedules_reason_state_check check (
    (state in ('blocked', 'cancelled')) = (reason_code is not null)
  ),
  add constraint cms_publication_schedules_reason_state_map_check check (
    (state <> 'cancelled' or reason_code in ('approval_invalidated', 'entry_unavailable'))
    and (state <> 'blocked' or reason_code <> 'entry_unavailable')
  ),
  add constraint cms_publication_schedules_retries_exhausted_check check (
    reason_code is distinct from 'retries_exhausted' or attempt_count = 3
  ),
  add constraint cms_publication_schedules_lease_check check (
    (state = 'executing') = (lease_id is not null)
    and (lease_id is null) = (lease_until is null)
  ),
  add constraint cms_publication_schedules_retry_check check (
    state <> 'failed_retryable'
    or (next_attempt_at is not null and attempt_count between 1 and 3)
  ),
  add constraint cms_publication_schedules_completion_check check (
    (state = 'completed') = (actual_at_utc is not null)
    and (actual_at_utc is null) = (deviation_seconds is null)
  ),
  add constraint cms_publication_schedules_offset_check check (
    local_datetime - (resolved_at_utc at time zone 'UTC')
      between interval '-12 hours' and interval '14 hours'
  ),
  add constraint cms_publication_schedules_entry_owner_fkey
    foreign key (entry_id, owner_id)
    references platform_private.cms_content_entries(id, owner_id),
  add constraint cms_publication_schedules_revision_entry_fkey
    foreign key (revision_id, entry_id)
    references platform_private.cms_entry_revisions(id, entry_id),
  add constraint cms_publication_schedules_review_revision_fkey
    foreign key (review_id, revision_id)
    references platform_private.cms_editorial_reviews(id, revision_id);

create index cms_publication_schedules_revision_state_idx
  on platform_private.cms_publication_schedules (revision_id, state);
create index cms_publication_schedules_review_idx
  on platform_private.cms_publication_schedules (review_id);
-- The due-claim index of CMS-03B-20: only schedules that can still be claimed.
create index cms_publication_schedules_claim_idx
  on platform_private.cms_publication_schedules (state, next_attempt_at, resolved_at_utc)
  where state in ('pending', 'failed_retryable');

create or replace function platform_private.cms_schedule_state_guard()
returns trigger
language plpgsql
set search_path = ''
as $body$
declare
  review_row platform_private.cms_editorial_reviews%rowtype;
  revision_author uuid;
  entry_lifecycle text;
begin
  if tg_op = 'DELETE' then
    raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' then
    -- Identity and evidence never change; only the claim, lease, retry and
    -- completion columns, the state and the CAS pair move (the job id is bound
    -- once).
    if (pg_catalog.to_jsonb(new)
          - 'state' - 'version' - 'updated_at' - 'job_id' - 'attempt_count'
          - 'next_attempt_at' - 'lease_id' - 'lease_until' - 'reason_code'
          - 'actual_at_utc' - 'deviation_seconds')
       is distinct from
       (pg_catalog.to_jsonb(old)
          - 'state' - 'version' - 'updated_at' - 'job_id' - 'attempt_count'
          - 'next_attempt_at' - 'lease_id' - 'lease_until' - 'reason_code'
          - 'actual_at_utc' - 'deviation_seconds')
       or (old.job_id is not null and new.job_id is distinct from old.job_id) then
      raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
    end if;
    if new.version <> old.version + 1 or new.updated_at < old.updated_at then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    if not (
         (old.state in ('pending', 'failed_retryable')
            and new.state in ('executing', 'cancelled'))
      or (old.state = 'executing'
            and new.state in ('completed', 'failed_retryable', 'blocked'))
    ) then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    -- A retryable failure counts exactly one attempt; every other transition leaves
    -- the count alone, so a schedule can neither retry forever nor exhaust early.
    if new.attempt_count is distinct from old.attempt_count
         + (case when new.state = 'failed_retryable' then 1 else 0 end) then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if new.state <> 'pending' or new.version <> 1 or new.attempt_count <> 0 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  select review_item.* into review_row
    from platform_private.cms_editorial_reviews review_item
   where review_item.id = new.review_id;
  if not found then
    -- The foreign key reports the absent review.
    return new;
  end if;
  if review_row.state <> 'approved'
     or review_row.version <> new.expected_version
     or review_row.dependency_hash <> new.dependency_hash then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if new.action = 'publish' then
    select revision_item.author_person_id into revision_author
      from platform_private.cms_entry_revisions revision_item
     where revision_item.id = new.revision_id;
    if new.created_by = revision_author then
      raise exception 'separation_of_duties' using errcode = 'P0001';
    end if;
  end if;
  select entry_item.lifecycle into entry_lifecycle
    from platform_private.cms_content_entries entry_item
   where entry_item.id = new.entry_id;
  if found and entry_lifecycle <> 'active' then
    raise exception 'entry_unavailable' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;

-- Fires after cms_publication_schedules_write_guard (alphabetical order).
create trigger cms_publication_schedules_z_state_guard
before insert or update or delete on platform_private.cms_publication_schedules
for each row execute function platform_private.cms_schedule_state_guard();

revoke all on function platform_private.cms_schedule_state_guard()
  from public, anon, authenticated, service_role;

-- SEC-2: a function whose body names a forced-RLS CMS table is owned by the
-- NOLOGIN, non-BYPASSRLS definer role (the catalog guard in
-- supabase/tests/phase_02_slice_09_sec2_definer_rls.sql derives the set from the
-- live bodies), exactly as the Slice 09 schema-review guards are.  ALTER FUNCTION
-- ... OWNER TO needs CREATE on the function's schema for the new owner, held for
-- this transaction only.  The guard stays SECURITY INVOKER: it runs with the
-- privileges of the calling role, so the definer functions that write the table
-- (Slice 11 command migrations) are the ones that hold the table verbs.
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_schedule_state_guard() owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;

commit;
