-- Slice 11 lane S11-3b: platform_api.cms_schedule_publication / platform_private (CMS-03B-07, E6 step-up,
-- E8 time authority, E9 lineage target, E11 separation of duties, DEC-156..159; tracker P2-S11-AC-017 ..
-- AC-022, AC-038, AC-047, AC-103 .. AC-107, AC-122).  An owner-party publisher schedules ONE action
-- (publish, unpublish, expire or archive) of a revision whose review is approved, under step-up, the
-- approved review's version as the CAS operand, the Worker-verified time fields, the schedule-phase
-- preflight and the lock order of DEC-157.  202 means scheduled, never published: the schedule row,
-- one audit record and the idempotency record commit; NO publication event exists until execution.
-- This file covers the contract, the committed effects, the actions, the duplicate identity and replay;
-- the refusals are in phase_02_slice_11_rpc_publication_schedule_refusals.sql.
-- RED before 20261005017710.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(33);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/001-world.sqlinc
\ir phase_02_slice_11_helpers/002-reviews.sqlinc
\ir phase_02_slice_11_rpc_review/000-world.sqlinc
\ir phase_02_slice_11_rpc_review/020-decision.sqlinc
\ir phase_02_slice_11_rpc_review/030-submit.sqlinc
\ir phase_02_slice_11_rpc_publication/000-world.sqlinc

create temp table r11_req(label text primary key, request jsonb not null) on commit drop;
create temp table r11_snap(label text primary key, effects text not null) on commit drop;

select pg_temp.p11_approved(tag) from (values ('sa-main'), ('sa-actions'), ('sa-dup'), ('sa-step')) as t(tag);
-- The revision author is the publisher: separation of duties binds only a `publish`.
select pg_temp.p11_approved('sa-author', 'pub');

select is(
  (select string_agg(tag || '=' || platform_private.cms_revision_effective_state(pg_temp.h11w_uuid(tag || ':revision'))
                      || '/' || (pg_temp.p11_review(tag)).state || '/' || (pg_temp.p11_review(tag)).version, ';' order by tag)
     from (values ('sa-main'), ('sa-actions'), ('sa-author')) as t(tag)),
  'sa-actions=approved/approved/2;sa-author=approved/approved/2;sa-main=approved/approved/2',
  'control: every fixture revision is approved under an approved review at version 2');

-- ---------------------------------------------------------------------------
-- Shape and privileges.
-- ---------------------------------------------------------------------------
select ok(pg_temp.r11_posture('platform_private', 'cms_schedule_publication(jsonb)'),
  'cms_schedule_publication is a private SECURITY DEFINER of the CMS definer (empty search_path) that no API role, service_role included, can execute [P2-S11-AC-022]');
select ok(pg_temp.r11_posture('platform_api', 'cms_schedule_publication(jsonb)'),
  'the platform_api wrapper is a SECURITY DEFINER of the CMS definer, executable by service_role only, not by PUBLIC, anon or authenticated [P2-S11-AC-022]');

-- ---------------------------------------------------------------------------
-- A publish schedule: the committed result.
-- ---------------------------------------------------------------------------
insert into r11_req(label, request) values ('s1', pg_temp.p11_sreq('sa-main'));
insert into r11_snap(label, effects) values ('before-s1', pg_temp.p11_effects());
select pg_temp.p11_call('s1', 'pub', 'cms_schedule_publication', (select request from r11_req where label = 's1'));
select is(pg_temp.r11_out('s1'), '00000:', 'the owner-party publisher schedules a publish of an approved revision [P2-S11-AC-017]');
select is(pg_temp.r11_keys(pg_temp.r11_resp('s1')),
  'action,actualUtc,attemptCount,audience,createdAt,deviationSeconds,disambiguation,entryId,id,jobId,localDateTime,reasonCode,resolvedUtc,revisionId,state,timezone,tzdbVersion,updatedAt,version',
  'the response is exactly PublicationScheduleResource (19 members) [P2-S11-AC-017]');
select ok(
  pg_temp.r11_resp('s1')->>'state' = 'pending' and pg_temp.r11_resp('s1')->>'version' = '1'
    and pg_temp.r11_resp('s1')->>'action' = 'publish' and pg_temp.r11_resp('s1')->>'audience' = 'public'
    and (pg_temp.r11_resp('s1')->>'attemptCount')::integer = 0
    and pg_temp.r11_resp('s1')->'jobId' = 'null'::jsonb and pg_temp.r11_resp('s1')->'actualUtc' = 'null'::jsonb
    and pg_temp.r11_resp('s1')->'deviationSeconds' = 'null'::jsonb and pg_temp.r11_resp('s1')->'reasonCode' = 'null'::jsonb
    and pg_temp.r11_resp('s1')->>'createdAt' = pg_temp.r11_resp('s1')->>'updatedAt'
    and pg_temp.r11_resp('s1')->>'entryId' = pg_temp.h11w_uuid('sa-main:entry')::text
    and pg_temp.r11_resp('s1')->>'revisionId' = pg_temp.h11w_uuid('sa-main:revision')::text,
  'a new schedule is pending at version 1 with no job, no actual instant, no deviation, no reason and no attempt [P2-S11-AC-122]');
select ok(
  pg_temp.r11_resp('s1')->>'localDateTime' = (select request->>'localDateTime' from r11_req where label = 's1')
    and pg_temp.r11_resp('s1')->>'resolvedUtc' = (select request->>'resolvedUtc' from r11_req where label = 's1')
    and pg_temp.r11_resp('s1')->>'timezone' = 'UTC' and pg_temp.r11_resp('s1')->>'disambiguation' = 'none'
    and pg_temp.r11_resp('s1')->>'tzdbVersion' = platform_private.cms_tzdb_version(),
  'the resource echoes the accepted time fields exactly as submitted (the Worker compares them verbatim) [P2-S11-AC-103]');
select ok(
  not pg_temp.r11_leaks(pg_temp.r11_resp('s1'), array[
    pg_temp.s11_id('pub')::text, pg_temp.s11_id('creator')::text, pg_temp.s11_id('editor')::text, pg_temp.s11_id('rvA')::text,
    pg_temp.s11_id('org')::text, (select auth_user_id::text from r11_actor where key = 'pub'),
    (pg_temp.p11_review('sa-main')).id::text]),
  'the response carries no publisher, author, submitter, reviewer, party, account or review identifier [P2-S11-AC-019]');
select ok(
  exists (
    select 1 from platform_private.cms_publication_schedules schedule
     where schedule.id = (pg_temp.r11_resp('s1')->>'id')::uuid
       and schedule.owner_id = pg_temp.s11_id('org') and schedule.entry_id = pg_temp.h11w_uuid('sa-main:entry')
       and schedule.revision_id = pg_temp.h11w_uuid('sa-main:revision')
       and schedule.review_id = pg_temp.s11_id('rv-sa-main') and schedule.expected_version = 2
       and schedule.dependency_hash = (pg_temp.p11_review('sa-main')).dependency_hash
       and schedule.activation_evidence_hash = platform_private.cms_jcs_sha256((pg_temp.p11_review('sa-main')).activation_evidence)
       and schedule.created_by = pg_temp.s11_id('pub') and schedule.state = 'pending' and schedule.version = 1
       and schedule.action = 'publish' and schedule.audience = 'public' and schedule.timezone = 'UTC'
       and schedule.local_datetime = ((select request->>'localDateTime' from r11_req where label = 's1'))::timestamp
       and schedule.resolved_at_utc = ((select request->>'resolvedUtc' from r11_req where label = 's1'))::timestamptz
       and schedule.tzdb_version = platform_private.cms_tzdb_version() and schedule.disambiguation = 'none'
       and schedule.attempt_count = 0 and schedule.next_attempt_at is null and schedule.lease_id is null
       and schedule.lease_until is null and schedule.reason_code is null and schedule.job_id is null
       and schedule.actual_at_utc is null and schedule.deviation_seconds is null),
  'the schedule row stores the server-derived owner, publisher, review and its version, dependency and activation hashes and the verified time fields [P2-S11-AC-122]');
select ok(
  (select count(*) = 1 from audit_private.audit_events audit
    where audit.action = 'cms.publication.schedule' and audit.target_type = 'cms_publication_schedule'
      and audit.target_id = (pg_temp.r11_resp('s1')->>'id')::uuid
      and audit.actor_id = (select auth_user_id from r11_actor where key = 'pub')
      and audit.reason_code = 'CMS_PUBLICATION_SCHEDULED'),
  'exactly one audit record commits with the schedule [P2-S11-AC-022]');
select ok(
  (select count(*) from platform_private.outbox_events where event_type like 'cms.%')
    = (select split_part(effects, '/', 7)::integer from r11_snap where label = 'before-s1')
  and not exists (select 1 from platform_private.outbox_events event where event.event_type = 'cms.publication.changed.v1'),
  'no outbox event commits: cms.publication.changed.v1 is emitted only by an executed publication [P2-S11-AC-017]');
select is(pg_temp.p11_reservation((select request->>'idempotencyKey' from r11_req where label = 's1')), 'completed/202',
  'the idempotency reservation is completed with the 202 acceptance [P2-S11-AC-020]');
select ok(
  platform_private.cms_revision_effective_state(pg_temp.h11w_uuid('sa-main:revision')) = 'scheduled'
    and (pg_temp.p11_review('sa-main')).state = 'approved' and (pg_temp.p11_review('sa-main')).version = 2,
  'a pending publish makes the revision scheduled (E2) while the review stays approved at its version (the schedule never advances it) [P2-S11-AC-038]');
select ok(
  (select count(*) = 0 from platform_private.cms_publication_versions where entry_id = pg_temp.h11w_uuid('sa-main:entry')),
  'scheduling appends no publication lineage row [P2-S11-AC-017]');

-- ---------------------------------------------------------------------------
-- Replay and idempotency.
-- ---------------------------------------------------------------------------
insert into r11_snap(label, effects) values ('after-s1', pg_temp.p11_effects());
select pg_temp.p11_call('s1-replay', 'pub', 'cms_schedule_publication', (select request from r11_req where label = 's1'));
select ok(pg_temp.r11_out('s1-replay') = '00000:' and pg_temp.r11_resp('s1-replay') = pg_temp.r11_resp('s1')
    and pg_temp.p11_effects() = (select effects from r11_snap where label = 'after-s1')
    and current_setting('response.headers', true) = '[{"x-cms-idempotent-replay": "true"}]',
  'an exact replay returns the stored resource, marks x-cms-idempotent-replay and adds no schedule, audit record, event or reservation [P2-S11-AC-020]');
select pg_temp.p11_call('s1-fresh', 'pub', 'cms_schedule_publication',
  jsonb_set((select request from r11_req where label = 's1'), '{evidence}',
    pg_temp.r11_evidence(pg_temp.h11w_uuid('sa-main:revision'), 'healthy', interval '20 seconds')));
select ok(pg_temp.r11_out('s1-fresh') = '00000:' and pg_temp.r11_resp('s1-fresh') = pg_temp.r11_resp('s1')
    and pg_temp.p11_effects() = (select effects from r11_snap where label = 'after-s1'),
  'a lost-response retry with the same key and a freshly evaluated accessibility proof is a replay, not an IDEMPOTENCY_MISMATCH (the proof is server-built, not part of the command identity) [P2-S11-AC-020]');
select pg_temp.p11_call('s1-mismatch', 'pub', 'cms_schedule_publication',
  jsonb_set((select request from r11_req where label = 's1'), '{audience}', '"partners"'));
select is(pg_temp.r11_out('s1-mismatch'), 'P0001:IDEMPOTENCY_MISMATCH',
  'the same key with a changed audience is IDEMPOTENCY_MISMATCH [P2-S11-AC-020]');
select pg_temp.p11_call('s1-stale-replay', 'pub', 'cms_schedule_publication',
  jsonb_set((select request from r11_req where label = 's1'), '{context}', pg_temp.r11_ctx(interval '2 hours')));
select is(pg_temp.r11_out('s1-stale-replay'), 'P0001:STEP_UP_REQUIRED',
  'even a replay needs a fresh step-up proof (E6: evaluated before the reservation) [P2-S11-AC-047]');

-- ---------------------------------------------------------------------------
-- The four actions; separation of duties binds only a publish.
-- ---------------------------------------------------------------------------
select pg_temp.p11_call('a-unpublish', 'pub', 'cms_schedule_publication',
  pg_temp.p11_sreq('sa-actions', jsonb_build_object('action', 'unpublish')));
select pg_temp.p11_call('a-expire', 'pub', 'cms_schedule_publication',
  pg_temp.p11_sreq('sa-actions', jsonb_build_object('action', 'expire', 'audience', 'partners')));
select pg_temp.p11_call('a-archive', 'pub', 'cms_schedule_publication',
  pg_temp.p11_sreq('sa-actions', jsonb_build_object('action', 'archive', 'audience', 'staff')));
select is(pg_temp.r11_out('a-unpublish') || '|' || pg_temp.r11_out('a-expire') || '|' || pg_temp.r11_out('a-archive'),
  '00000:|00000:|00000:', 'unpublish, expire and archive are scheduled against an approved review too [P2-S11-AC-017]');
select ok(
  (select string_agg(schedule.action || '/' || schedule.audience || '/' || schedule.state, ',' order by schedule.action)
     from platform_private.cms_publication_schedules schedule where schedule.revision_id = pg_temp.h11w_uuid('sa-actions:revision'))
    = 'archive/staff/pending,expire/partners/pending,unpublish/public/pending'
  and platform_private.cms_revision_effective_state(pg_temp.h11w_uuid('sa-actions:revision')) = 'approved',
  'three pending tombstone schedules, one per audience; only a pending PUBLISH makes a revision scheduled (E2) [P2-S11-AC-038]');
select pg_temp.p11_call('a-author-expire', 'pub', 'cms_schedule_publication',
  pg_temp.p11_sreq('sa-author', jsonb_build_object('action', 'expire')));
select is(pg_temp.r11_out('a-author-expire'), '00000:',
  'the revision author may schedule an expire: separation of duties (E11) binds only a publish [P2-S11-AC-107]');

-- ---------------------------------------------------------------------------
-- The duplicate identity (entry, revision, action, local time, timezone, audience).
-- ---------------------------------------------------------------------------
insert into r11_req(label, request) values ('d1', pg_temp.p11_sreq('sa-dup'));
select pg_temp.p11_call('d1', 'pub', 'cms_schedule_publication', (select request from r11_req where label = 'd1'));
insert into r11_snap(label, effects) values ('before-dup', pg_temp.p11_effects());
select pg_temp.p11_call('d2-same', 'pub', 'cms_schedule_publication',
  (select request from r11_req where label = 'd1') || jsonb_build_object('idempotencyKey', 'p11-dup-other-key-0001'));
select ok(pg_temp.r11_out('d2-same') = 'P0001:CONFLICT'
    and pg_temp.p11_effects() = (select effects from r11_snap where label = 'before-dup'),
  'a second schedule of the same action, local time, timezone and audience under another key is a CONFLICT and changes nothing [P2-S11-AC-020]');
select pg_temp.p11_call('d3-audience', 'pub', 'cms_schedule_publication',
  (select request from r11_req where label = 'd1') || jsonb_build_object('audience', 'partners', 'idempotencyKey', 'p11-dup-other-key-0002'));
select pg_temp.p11_call('d4-time', 'pub', 'cms_schedule_publication',
  pg_temp.p11_sreq('sa-dup', '{}'::jsonb, '{}'::text[], null, interval '4 days'));
select pg_temp.p11_call('d5-action', 'pub', 'cms_schedule_publication',
  (select request from r11_req where label = 'd1') || jsonb_build_object('action', 'expire', 'idempotencyKey', 'p11-dup-other-key-0003'));
select is(pg_temp.r11_out('d3-audience') || '|' || pg_temp.r11_out('d4-time') || '|' || pg_temp.r11_out('d5-action'),
  '00000:|00000:|00000:', 'another audience, another local time or another action is a different identity (the audience is part of the key) [P2-S11-AC-020]');

-- ---------------------------------------------------------------------------
-- Step-up edges (600 s window, 30 s skew): accepted at the edges, refused beyond.
-- ---------------------------------------------------------------------------
select pg_temp.p11_call('u-edge-old', 'pub', 'cms_schedule_publication',
  pg_temp.p11_sreq('sa-step', jsonb_build_object('context', pg_temp.r11_ctx(interval '590 seconds'))));
select pg_temp.p11_call('u-edge-new', 'pub', 'cms_schedule_publication',
  pg_temp.p11_sreq('sa-step', jsonb_build_object('context', pg_temp.r11_ctx(interval '-20 seconds'), 'audience', 'partners')));
select is(pg_temp.r11_out('u-edge-old') || '|' || pg_temp.r11_out('u-edge-new'), '00000:|00000:',
  'a proof 590 s old and one 20 s in the future (skew) are accepted [P2-S11-AC-047]');

select * from finish();
rollback;
