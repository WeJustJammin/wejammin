-- Slice 11 data model, lane S11-2: the PublicationSchedule record (BE03b
-- Database Schema "PublicationSchedule", Schedule execution CMS-03B-20, Time
-- authority E8, Separation of duties E11; tracker P2-S11-AC-122).  RED before
-- 20261005017070, GREEN after.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(84);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc

insert into s11_ids(key, value) values
  ('approvedReview', 'a9110000-0000-4000-8000-000000000301'),
  ('openReview', 'a9110000-0000-4000-8000-000000000302'),
  ('approvedB', 'a9110000-0000-4000-8000-000000000303'),
  ('schedule1', 'a9110000-0000-4000-8000-000000000701'),
  ('schedule2', 'a9110000-0000-4000-8000-000000000702'),
  ('schedule3', 'a9110000-0000-4000-8000-000000000703'),
  ('schedule4', 'a9110000-0000-4000-8000-000000000704');

-- approvedReview (revision A1) and approvedB (revision B1) are approved at
-- version 2; openReview (revision A2) stays open.
select pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_editorial_reviews',
  pg_temp.s11_review_row(jsonb_build_object('id', pg_temp.s11_id('approvedReview')))));
select pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_editorial_reviews',
  pg_temp.s11_review_row(jsonb_build_object('id', pg_temp.s11_id('openReview'),
    'revision_id', pg_temp.s11_id('revA2')))));
select pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_editorial_reviews',
  pg_temp.s11_review_row(jsonb_build_object('id', pg_temp.s11_id('approvedB'),
    'revision_id', pg_temp.s11_id('revB1'), 'entry_id', pg_temp.s11_id('entryB')))));
select pg_temp.s11_seed_review_update(format(
  'update platform_private.cms_editorial_reviews set state = ''approved'', recorded_decision_count = 1, decided_at = clock_timestamp(), version = 2, updated_at = clock_timestamp() where id in (%L, %L)',
  pg_temp.s11_id('approvedReview'), pg_temp.s11_id('approvedB')));

select is(
  (select string_agg(state || ':' || version, ',' order by id::text) from platform_private.cms_editorial_reviews),
  'approved:2,open:1,approved:2',
  'S11 schedule fixture: two approved reviews at version 2 and one open review'
);

create or replace function pg_temp.s11_upd(p_id uuid, p_set text)
returns text
language sql
as $body$
  select format(
    'update platform_private.cms_publication_schedules set %s, updated_at = clock_timestamp() where id = %L',
    p_set, p_id)
$body$;

-- ---------------------------------------------------------------------------
-- Shape.
-- ---------------------------------------------------------------------------
select ok(
  pg_temp.s10r_column_type('platform_private.cms_publication_schedules', 'review_id') = 'uuid'
    and pg_temp.s10r_col_notnull('platform_private.cms_publication_schedules', 'review_id')
    and pg_temp.s10r_col_notnull('platform_private.cms_publication_schedules', 'audience')
    and pg_temp.s10r_column_type('platform_private.cms_publication_schedules', 'attempt_count') = 'int2'
    and pg_temp.s10r_col_notnull('platform_private.cms_publication_schedules', 'attempt_count')
    and pg_temp.s10r_has_default('platform_private.cms_publication_schedules', 'attempt_count')
    and pg_temp.s10r_column_type('platform_private.cms_publication_schedules', 'next_attempt_at') = 'timestamptz'
    and pg_temp.s10r_column_type('platform_private.cms_publication_schedules', 'lease_id') = 'uuid'
    and pg_temp.s10r_column_type('platform_private.cms_publication_schedules', 'lease_until') = 'timestamptz'
    and pg_temp.s10r_column_type('platform_private.cms_publication_schedules', 'reason_code') = 'text'
    and not pg_temp.s10r_col_notnull('platform_private.cms_publication_schedules', 'reason_code'),
  'schedule: the review, audience, attempt, retry, lease and reason columns exist [P2-S11-AC-122]'
);

select ok(
  pg_temp.s11_constraint_has('platform_private.cms_publication_schedules', 'cms_publication_schedules_reason_code_check',
    array['approval_invalidated', 'preflight_failed', 'publisher_authority_ended',
          'publication_not_active', 'retries_exhausted', 'entry_unavailable'])
    and pg_temp.s11_constraint_has('platform_private.cms_publication_schedules', 'cms_publication_schedules_reason_state_check',
      array['blocked', 'cancelled', 'reason_code IS NOT NULL']),
  'schedule: reason_code is the closed six-token catalog and is stored exactly when blocked or cancelled [P2-S11-AC-122]'
);

select ok(
  pg_temp.s11_constraint_has('platform_private.cms_publication_schedules', 'cms_publication_schedules_identity_unique',
    array['UNIQUE (entry_id, revision_id, action, local_datetime, local_datetime_submicro_ns, timezone, audience)'])
    and pg_temp.s11_constraint_has('platform_private.cms_publication_schedules', 'cms_publication_schedules_entry_owner_fkey',
      array['FOREIGN KEY (entry_id, owner_id)', 'cms_content_entries(id, owner_id)'])
    and pg_temp.s11_constraint_has('platform_private.cms_publication_schedules', 'cms_publication_schedules_revision_entry_fkey',
      array['FOREIGN KEY (revision_id, entry_id)', 'cms_entry_revisions(id, entry_id)'])
    and pg_temp.s11_constraint_has('platform_private.cms_publication_schedules', 'cms_publication_schedules_review_revision_fkey',
      array['FOREIGN KEY (review_id, revision_id)', 'cms_editorial_reviews(id, revision_id)'])
    and pg_temp.s10r_fk_target('platform_private.cms_publication_schedules', 'review_id')
      = 'platform_private.cms_editorial_reviews.id',
  'schedule: duplicates are keyed by audience too, and entry owner, revision-of-entry and review-of-revision are keys [P2-S11-AC-122]'
);

select ok(
  pg_temp.s11_index_has('platform_private.cms_publication_schedules', 'cms_publication_schedules_revision_state_idx',
    array['(revision_id, state)'])
    and pg_temp.s11_index_has('platform_private.cms_publication_schedules', 'cms_publication_schedules_review_idx',
      array['(review_id)'])
    and pg_temp.s11_index_has('platform_private.cms_publication_schedules', 'cms_publication_schedules_claim_idx',
      array['(state, next_attempt_at, resolved_at_utc)', 'pending', 'failed_retryable']),
  'schedule: the revision-state, review and due-claim indexes exist [P2-S11-AC-122]'
);

-- ---------------------------------------------------------------------------
-- Constraints in isolation.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.s11_sched_bare(p_overrides jsonb)
returns text
language sql
as $body$
  select pg_temp.s11_bare_outcome('platform_private.cms_publication_schedules',
    pg_temp.s11_insert_sql('platform_private.cms_publication_schedules',
      pg_temp.s11_schedule_row(p_overrides)))
$body$;

select is(pg_temp.s11_sched_bare('{}'::jsonb), '00000',
  'schedule: control - the canonical pending publish image is accepted [P2-S11-AC-122]');
select is(pg_temp.s11_sched_bare('{"audience":"Public"}'::jsonb), '23514',
  'schedule: the audience follows ^[a-z0-9_-]{1,48}$ (no upper case) [P2-S11-AC-122]');
select is(pg_temp.s11_sched_bare(jsonb_build_object('audience', repeat('a', 49))), '23514',
  'schedule: the audience is at most 48 characters [P2-S11-AC-122]');
select is(pg_temp.s11_sched_bare(jsonb_build_object('audience', repeat('a', 48))), '00000',
  'schedule: control - a 48-character audience is accepted [P2-S11-AC-122]');
select is(pg_temp.s11_sched_bare('{"attempt_count":4}'::jsonb), '23514',
  'schedule: attempt_count is 0 to 3 [P2-S11-AC-122]');
select is(pg_temp.s11_sched_bare('{"reason_code":"stale"}'::jsonb), '23514',
  'schedule: a reason outside the closed catalog is refused [P2-S11-AC-122]');
select is(pg_temp.s11_sched_bare('{"state":"blocked"}'::jsonb), '23514',
  'schedule: a blocked schedule must carry its reason [P2-S11-AC-122]');
select is(pg_temp.s11_sched_bare('{"reason_code":"preflight_failed"}'::jsonb), '23514',
  'schedule: a pending schedule carries no reason [P2-S11-AC-122]');
select is(pg_temp.s11_sched_bare('{"state":"cancelled","reason_code":"preflight_failed"}'::jsonb), '23514',
  'schedule: a cancelled schedule is cancelled only by approval invalidation or an unavailable entry [P2-S11-AC-122]');
select is(pg_temp.s11_sched_bare('{"state":"blocked","reason_code":"entry_unavailable"}'::jsonb), '23514',
  'schedule: an unavailable entry cancels and never blocks [P2-S11-AC-122]');
select is(pg_temp.s11_sched_bare('{"state":"blocked","reason_code":"retries_exhausted","attempt_count":3}'::jsonb), '00000',
  'schedule: control - a blocked schedule with a closed reason is accepted [P2-S11-AC-122]');
select is(pg_temp.s11_sched_bare('{"state":"blocked","reason_code":"retries_exhausted","attempt_count":2}'::jsonb), '23514',
  'schedule: retries_exhausted is recorded only after three failed attempts, not two [P2-S11-AC-122]');
select is(pg_temp.s11_sched_bare('{"state":"blocked","reason_code":"retries_exhausted","attempt_count":0}'::jsonb), '23514',
  'schedule: retries_exhausted is never recorded with no failed attempt [P2-S11-AC-122]');
select is(pg_temp.s11_sched_bare('{"state":"executing"}'::jsonb), '23514',
  'schedule: an executing schedule holds a lease [P2-S11-AC-122]');
select is(pg_temp.s11_sched_bare(jsonb_build_object('lease_id', gen_random_uuid(),
    'lease_until', '2026-10-01T14:05:00Z'::timestamptz)), '23514',
  'schedule: only an executing schedule holds a lease [P2-S11-AC-122]');
select is(pg_temp.s11_sched_bare(jsonb_build_object('state', 'executing', 'lease_id', gen_random_uuid())), '23514',
  'schedule: a lease names its expiry [P2-S11-AC-122]');
select is(pg_temp.s11_sched_bare(jsonb_build_object('state', 'executing', 'lease_id', gen_random_uuid(),
    'lease_until', '2026-10-01T14:05:00Z'::timestamptz)), '00000',
  'schedule: control - an executing schedule with a five-minute lease is accepted [P2-S11-AC-122]');
select is(pg_temp.s11_sched_bare('{"state":"failed_retryable","attempt_count":1}'::jsonb), '23514',
  'schedule: a retryable failure names its next attempt [P2-S11-AC-122]');
select is(pg_temp.s11_sched_bare('{"state":"failed_retryable","next_attempt_at":"2026-10-01T14:00:15Z"}'::jsonb), '23514',
  'schedule: a retryable failure has failed at least once [P2-S11-AC-122]');
select is(pg_temp.s11_sched_bare('{"state":"failed_retryable","attempt_count":3,"next_attempt_at":"2026-10-01T14:05:00Z"}'::jsonb), '00000',
  'schedule: control - the third retryable failure is accepted [P2-S11-AC-122]');
select is(pg_temp.s11_sched_bare('{"state":"completed"}'::jsonb), '23514',
  'schedule: a completed schedule records when it ran [P2-S11-AC-122]');
select is(pg_temp.s11_sched_bare('{"actual_at_utc":"2027-01-15T08:00:02Z","deviation_seconds":2}'::jsonb), '23514',
  'schedule: only a completed schedule records its run [P2-S11-AC-122]');
select is(pg_temp.s11_sched_bare('{"state":"completed","actual_at_utc":"2027-01-15T08:00:02Z"}'::jsonb), '23514',
  'schedule: the run time and its deviation are recorded together [P2-S11-AC-122]');
select is(pg_temp.s11_sched_bare('{"state":"completed","actual_at_utc":"2027-01-15T08:00:02Z","deviation_seconds":2}'::jsonb), '00000',
  'schedule: control - a completed schedule with its deviation is accepted [P2-S11-AC-122]');
select is(pg_temp.s11_sched_bare('{"local_datetime":"2027-01-15T23:00:00"}'::jsonb), '23514',
  'schedule: a local time more than 14 hours ahead of its UTC instant is not a real offset (E8) [P2-S11-AC-122]');
select is(pg_temp.s11_sched_bare('{"local_datetime":"2027-01-14T19:00:00"}'::jsonb), '23514',
  'schedule: a local time more than 12 hours behind its UTC instant is not a real offset (E8) [P2-S11-AC-122]');
select is(pg_temp.s11_sched_bare('{"local_datetime":"2027-01-15T22:00:00"}'::jsonb), '00000',
  'schedule: control - a +14 hour offset (Pacific/Kiritimati) is accepted [P2-S11-AC-122]');
select is(pg_temp.s11_sched_bare('{"local_datetime":"2027-01-14T20:00:00"}'::jsonb), '00000',
  'schedule: control - a -12 hour offset is accepted [P2-S11-AC-122]');
select is(pg_temp.s11_sched_bare(jsonb_build_object('revision_id', pg_temp.s11_id('revB1'))), '23503',
  'schedule: a revision of another entry cannot be scheduled under this entry [P2-S11-AC-122]');
select is(pg_temp.s11_sched_bare(jsonb_build_object('review_id', pg_temp.s11_id('openReview'))), '23503',
  'schedule: the review must be a review of the scheduled revision [P2-S11-AC-122]');
select is(pg_temp.s11_sched_bare(jsonb_build_object('owner_id', pg_temp.s11_id('stranger'))), '23503',
  'schedule: the owner is the entry owner, never another party [P2-S11-AC-122]');

-- ---------------------------------------------------------------------------
-- Insert guard (triggers enabled).
-- ---------------------------------------------------------------------------
create or replace function pg_temp.s11_sched_ins(p_overrides jsonb)
returns text
language sql
as $body$
  select pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_publication_schedules',
    pg_temp.s11_schedule_row(p_overrides)))
$body$;

select is(pg_temp.s11_sched_ins('{"state":"executing","lease_id":"a9110000-0000-4000-8000-000000000799","lease_until":"2026-10-01T14:05:00Z"}'::jsonb),
  'P0001:VALIDATION_FAILED', 'schedule: a schedule is created pending [P2-S11-AC-122]');
select is(pg_temp.s11_sched_ins('{"version":2}'::jsonb), 'P0001:VALIDATION_FAILED',
  'schedule: a schedule is created at version 1 [P2-S11-AC-122]');
select is(pg_temp.s11_sched_ins('{"attempt_count":1}'::jsonb), 'P0001:VALIDATION_FAILED',
  'schedule: a schedule is created with no attempt [P2-S11-AC-122]');
select is(pg_temp.s11_sched_ins(jsonb_build_object('review_id', pg_temp.s11_id('openReview'),
    'revision_id', pg_temp.s11_id('revA2'))), 'P0001:CONFLICT',
  'schedule: only an approved review can be scheduled [P2-S11-AC-122]');
select is(pg_temp.s11_sched_ins('{"expected_version":3}'::jsonb), 'P0001:CONFLICT',
  'schedule: expected_version is the approved review''s version at acceptance [P2-S11-AC-122]');
select is(pg_temp.s11_sched_ins(jsonb_build_object('dependency_hash', pg_temp.s11_hex('another dependency set'))), 'P0001:CONFLICT',
  'schedule: the dependency hash is the approved review''s frozen dependency hash [P2-S11-AC-122]');
select is(pg_temp.s11_sched_ins(jsonb_build_object('created_by', pg_temp.s11_id('creator'))), 'P0001:separation_of_duties',
  'schedule: the author of the revision never schedules its publication (E11) [P2-S11-AC-107]');

select is(pg_temp.s11_sched_ins(jsonb_build_object('id', pg_temp.s11_id('schedule1'))), '00000',
  'schedule: a second human schedules the approved revision for one audience [P2-S11-AC-122]');
select is(pg_temp.s11_sched_ins('{}'::jsonb), '23505',
  'schedule: the same revision, action, local time, zone and audience is not scheduled twice [P2-S11-AC-122]');
select is(pg_temp.s11_sched_ins(jsonb_build_object('id', pg_temp.s11_id('schedule2'), 'audience', 'members')), '00000',
  'schedule: the same local time for another audience is a different schedule [P2-S11-AC-122]');
select is(pg_temp.s11_sched_ins(jsonb_build_object('id', pg_temp.s11_id('schedule3'), 'action', 'unpublish',
    'created_by', pg_temp.s11_id('creator'))), '00000',
  'schedule: the separation rule binds a scheduled publish, not an unpublish by the author [P2-S11-AC-107]');

select pg_temp.s11_archive_entry(pg_temp.s11_id('entryB'));
select is(pg_temp.s11_sched_ins(jsonb_build_object('entry_id', pg_temp.s11_id('entryB'),
    'revision_id', pg_temp.s11_id('revB1'), 'review_id', pg_temp.s11_id('approvedB'))), 'P0001:entry_unavailable',
  'schedule: a publish is not scheduled for an entry that is no longer active [P2-S11-AC-111]');

-- ---------------------------------------------------------------------------
-- Update guard: frozen evidence, CAS and the transition machine.
-- ---------------------------------------------------------------------------
select is(pg_temp.s11_outcome(pg_temp.s11_upd(pg_temp.s11_id('schedule1'), 'audience = ''members'', version = 2')),
  'P0001:IMMUTABLE_RECORD', 'schedule: the audience is fixed at acceptance [P2-S11-AC-122]');
select is(pg_temp.s11_outcome(pg_temp.s11_upd(pg_temp.s11_id('schedule1'), 'resolved_at_utc = resolved_at_utc + interval ''1 hour'', version = 2')),
  'P0001:IMMUTABLE_RECORD', 'schedule: the resolved instant is verified time authority and never moves [P2-S11-AC-122]');
select is(pg_temp.s11_outcome(pg_temp.s11_upd(pg_temp.s11_id('schedule1'), format('review_id = %L, version = 2', pg_temp.s11_id('openReview')))),
  'P0001:IMMUTABLE_RECORD', 'schedule: the review is fixed at acceptance [P2-S11-AC-122]');
select is(pg_temp.s11_outcome(pg_temp.s11_upd(pg_temp.s11_id('schedule1'), 'expected_version = 3, version = 2')),
  'P0001:IMMUTABLE_RECORD', 'schedule: the approved-review version is fixed at acceptance [P2-S11-AC-122]');
select is(pg_temp.s11_outcome(pg_temp.s11_upd(pg_temp.s11_id('schedule1'), format('created_by = %L, version = 2', pg_temp.s11_id('creator')))),
  'P0001:IMMUTABLE_RECORD', 'schedule: the creator is server-derived and never changes [P2-S11-AC-122]');
select is(pg_temp.s11_outcome(pg_temp.s11_upd(pg_temp.s11_id('schedule1'),
    format('state = ''executing'', lease_id = %L, lease_until = clock_timestamp() + interval ''5 minutes'', version = 3', gen_random_uuid()))),
  'P0001:CONFLICT', 'schedule: a transition advances the CAS version by exactly one [P2-S11-AC-122]');
select is(pg_temp.s11_outcome(pg_temp.s11_upd(pg_temp.s11_id('schedule1'),
    'state = ''completed'', actual_at_utc = clock_timestamp(), deviation_seconds = 0, version = 2')),
  'P0001:CONFLICT', 'schedule: a pending schedule is claimed before it completes [P2-S11-AC-122]');
select is(pg_temp.s11_outcome(pg_temp.s11_upd(pg_temp.s11_id('schedule1'), 'state = ''blocked'', reason_code = ''preflight_failed'', version = 2')),
  'P0001:CONFLICT', 'schedule: a pending schedule is claimed before it is blocked [P2-S11-AC-122]');
select is(pg_temp.s11_outcome(pg_temp.s11_upd(pg_temp.s11_id('schedule1'),
    format('state = ''executing'', lease_id = %L, lease_until = clock_timestamp() + interval ''5 minutes'', job_id = %L, version = 2',
      gen_random_uuid(), gen_random_uuid()))),
  '00000', 'schedule: the claim moves pending to executing with a lease and version + 1 [P2-S11-AC-122]');
select is(pg_temp.s11_outcome(pg_temp.s11_upd(pg_temp.s11_id('schedule1'), 'job_id = gen_random_uuid(), version = 3')),
  'P0001:IMMUTABLE_RECORD', 'schedule: the job id is bound once [P2-S11-AC-122]');
select is(pg_temp.s11_outcome(pg_temp.s11_upd(pg_temp.s11_id('schedule1'),
    'state = ''blocked'', reason_code = ''retries_exhausted'', lease_id = null, lease_until = null, version = 3')),
  '23514', 'schedule: an executing schedule that never failed cannot be blocked as exhausted [P2-S11-AC-122]');
select is(pg_temp.s11_outcome(pg_temp.s11_upd(pg_temp.s11_id('schedule1'),
    'state = ''failed_retryable'', attempt_count = 0, next_attempt_at = clock_timestamp() + interval ''15 seconds'', lease_id = null, lease_until = null, version = 3')),
  'P0001:CONFLICT', 'schedule: a retryable failure counts the attempt, a retry that leaves the count unchanged is refused [P2-S11-AC-122]');
select is(pg_temp.s11_outcome(pg_temp.s11_upd(pg_temp.s11_id('schedule1'),
    'state = ''failed_retryable'', attempt_count = 2, next_attempt_at = clock_timestamp() + interval ''15 seconds'', lease_id = null, lease_until = null, version = 3')),
  'P0001:CONFLICT', 'schedule: a retryable failure counts exactly one attempt, never two [P2-S11-AC-122]');
select is(pg_temp.s11_outcome(pg_temp.s11_upd(pg_temp.s11_id('schedule1'),
    'state = ''blocked'', reason_code = ''preflight_failed'', attempt_count = 1, lease_id = null, lease_until = null, version = 3')),
  'P0001:CONFLICT', 'schedule: an attempt is counted only by a retryable failure [P2-S11-AC-122]');
select is(pg_temp.s11_outcome(pg_temp.s11_upd(pg_temp.s11_id('schedule1'),
    'state = ''failed_retryable'', attempt_count = 1, next_attempt_at = clock_timestamp() + interval ''15 seconds'', lease_id = null, lease_until = null, version = 3')),
  '00000', 'schedule: an expired or unavailable run returns to failed_retryable with attempt + 1 and a 15 s backoff [P2-S11-AC-122]');
select is(pg_temp.s11_outcome(pg_temp.s11_upd(pg_temp.s11_id('schedule1'),
    format('state = ''executing'', attempt_count = 0, lease_id = %L, lease_until = clock_timestamp() + interval ''5 minutes'', version = 4', gen_random_uuid()))),
  'P0001:CONFLICT', 'schedule: the attempt count never decreases [P2-S11-AC-122]');
select is(pg_temp.s11_outcome(pg_temp.s11_upd(pg_temp.s11_id('schedule1'),
    format('state = ''executing'', lease_id = %L, lease_until = clock_timestamp() + interval ''5 minutes'', version = 4', gen_random_uuid()))),
  '00000', 'schedule: a retryable schedule is claimed again [P2-S11-AC-122]');
select is(pg_temp.s11_outcome(pg_temp.s11_upd(pg_temp.s11_id('schedule1'),
    'state = ''failed_retryable'', attempt_count = 1, next_attempt_at = clock_timestamp() + interval ''60 seconds'', lease_id = null, lease_until = null, version = 5')),
  'P0001:CONFLICT', 'schedule: a second retryable failure that leaves the count at 1 is refused, so a schedule cannot retry forever [P2-S11-AC-122]');
select is(pg_temp.s11_outcome(pg_temp.s11_upd(pg_temp.s11_id('schedule1'),
    'state = ''completed'', actual_at_utc = clock_timestamp(), deviation_seconds = 3, lease_id = null, lease_until = null, version = 5')),
  '00000', 'schedule: execution completes the schedule with its actual instant and deviation [P2-S11-AC-122]');
select is(pg_temp.s11_outcome(pg_temp.s11_upd(pg_temp.s11_id('schedule1'),
    'state = ''pending'', actual_at_utc = null, deviation_seconds = null, version = 6')),
  'P0001:CONFLICT', 'schedule: a completed schedule is terminal [P2-S11-AC-122]');
select is(pg_temp.s11_outcome(pg_temp.s11_upd(pg_temp.s11_id('schedule2'),
    'state = ''cancelled'', reason_code = ''approval_invalidated'', version = 2')),
  '00000', 'schedule: approval invalidation cancels a pending schedule [P2-S11-AC-111]');
select is(pg_temp.s11_outcome(pg_temp.s11_upd(pg_temp.s11_id('schedule2'),
    'state = ''pending'', reason_code = null, version = 3')),
  'P0001:CONFLICT', 'schedule: a cancelled schedule is terminal [P2-S11-AC-111]');
select is(pg_temp.s11_outcome(pg_temp.s11_upd(pg_temp.s11_id('schedule3'),
    format('state = ''executing'', lease_id = %L, lease_until = clock_timestamp() + interval ''5 minutes'', version = 2', gen_random_uuid()))),
  '00000', 'schedule: an unpublish schedule is claimed the same way [P2-S11-AC-122]');
select is(pg_temp.s11_outcome(pg_temp.s11_upd(pg_temp.s11_id('schedule3'),
    'state = ''cancelled'', reason_code = ''approval_invalidated'', lease_id = null, lease_until = null, version = 3')),
  'P0001:CONFLICT', 'schedule: an executing schedule is never cancelled, an invalidated approval blocks it (DEC-158 d) [P2-S11-AC-122]');
select is(pg_temp.s11_outcome(pg_temp.s11_upd(pg_temp.s11_id('schedule3'),
    'state = ''blocked'', reason_code = ''publication_not_active'', lease_id = null, lease_until = null, version = 3')),
  '00000', 'schedule: an absent active head blocks the action with publication_not_active [P2-S11-AC-122]');

-- The retry ladder end to end: three counted failures, each claimed again, then the fourth failure blocks.
create or replace function pg_temp.s11_ladder(p_id uuid)
returns text
language plpgsql
as $body$
declare
  outcomes text[] := '{}';
  failure integer;
  step_version integer := 1;
begin
  for failure in 1..3 loop
    outcomes := outcomes || pg_temp.s11_outcome(pg_temp.s11_upd(p_id, format(
      'state = ''executing'', lease_id = %L, lease_until = clock_timestamp() + interval ''5 minutes'', version = %s',
      gen_random_uuid(), step_version + 1)));
    outcomes := outcomes || pg_temp.s11_outcome(pg_temp.s11_upd(p_id, format(
      'state = ''failed_retryable'', attempt_count = %s, next_attempt_at = clock_timestamp() + interval ''15 seconds'', lease_id = null, lease_until = null, version = %s',
      failure, step_version + 2)));
    step_version := step_version + 2;
  end loop;
  outcomes := outcomes || pg_temp.s11_outcome(pg_temp.s11_upd(p_id, format(
    'state = ''executing'', lease_id = %L, lease_until = clock_timestamp() + interval ''5 minutes'', version = %s',
    gen_random_uuid(), step_version + 1)));
  return pg_catalog.array_to_string(outcomes, ',');
end;
$body$;
select is(pg_temp.s11_sched_ins(jsonb_build_object('id', pg_temp.s11_id('schedule4'), 'audience', 'ladder')), '00000',
  'schedule: a fourth schedule is accepted for the retry ladder [P2-S11-AC-122]');
select is(pg_temp.s11_ladder(pg_temp.s11_id('schedule4')), '00000,00000,00000,00000,00000,00000,00000',
  'schedule: three retryable failures count attempts 1, 2 and 3 and each is claimed again [P2-S11-AC-122]');
select is(pg_temp.s11_outcome(pg_temp.s11_upd(pg_temp.s11_id('schedule4'),
    'state = ''failed_retryable'', attempt_count = 4, next_attempt_at = clock_timestamp() + interval ''300 seconds'', lease_id = null, lease_until = null, version = 9')),
  '23514', 'schedule: a fourth retryable failure is not representable (attempt_count is 0 to 3) [P2-S11-AC-122]');
select is(pg_temp.s11_outcome(pg_temp.s11_upd(pg_temp.s11_id('schedule4'),
    'state = ''blocked'', reason_code = ''retries_exhausted'', lease_id = null, lease_until = null, version = 9')),
  '00000', 'schedule: the fourth failure blocks the schedule retries_exhausted at attempt_count 3 [P2-S11-AC-122]');
select is(pg_temp.s11_outcome(pg_temp.s11_upd(pg_temp.s11_id('schedule4'),
    'state = ''pending'', reason_code = null, version = 10')),
  'P0001:CONFLICT', 'schedule: an exhausted schedule is terminal [P2-S11-AC-122]');
select is(pg_temp.s11_outcome(format('delete from platform_private.cms_publication_schedules where id = %L', pg_temp.s11_id('schedule1'))),
  'P0001:IMMUTABLE_RECORD', 'schedule: a schedule is history and is never deleted [P2-S11-AC-122]');

select * from finish();
rollback;
