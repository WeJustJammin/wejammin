-- Slice 11 lane S11-3b: cms_execute_publication_schedule blocked and retried outcomes (CMS-03B-20; DEC-120,
-- DEC-150, DEC-157, DEC-158(c)(d); tracker P2-S11-AC-080 .. AC-084).  Executing, in order: the approved
-- review must be exactly what the schedule relied on with every frozen identity current (else `blocked`
-- approval_invalidated, the stale-manifest case also invalidating the review), the creator's publisher grant
-- must cover the fire instant without any MFA recheck (else `blocked` publisher_authority_ended), then the
-- execute-phase preflight: a failed category blocks (preflight_failed), an unavailable one or a stale /
-- mis-bound / absent accessibility proof makes the schedule failed_retryable on the 15 s / 60 s / 300 s
-- ladder, and the fourth consecutive failure blocks it with retries_exhausted.  A blocked outcome keeps the
-- prior publication intact and appends no lineage row.
-- RED before 20261005017740.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(25);

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

create temp table r11_snap(label text primary key, effects text not null) on commit drop;

create or replace function pg_temp.p11_drift(p_tag text, p_target_tag text)
returns void
language plpgsql
as $body$
declare
  target_revision uuid := pg_temp.h11w_revision(p_target_tag);
begin
  perform set_config('app.cms_rpc', 'true', true);
  perform pg_temp.h11w_relation(pg_temp.h11w_uuid(p_tag || ':revision'), 'rel_omit',
    (select revision_item.entry_id from platform_private.cms_entry_revisions revision_item where revision_item.id = target_revision), 1);
end;
$body$;

select pg_temp.p11_approved(tag) from (values ('xr-inval'), ('xr-dep'), ('xr-auth'), ('xr-pre'), ('xr-arch'), ('xr-lapsed'),
  ('xr-null'), ('xr-stale'), ('xr-bound'), ('xr-failed'), ('xr-blocked'), ('xr-ladder')) as t(tag);
select pg_temp.h11r_member('rvX', array['cms.reviewer', 'cms.publisher']);
select pg_temp.p11_schedule_row('s-' || tag, tag)
  from (values ('xr-inval'), ('xr-dep'), ('xr-pre'), ('xr-arch'), ('xr-lapsed'), ('xr-null'), ('xr-stale'), ('xr-bound'),
               ('xr-failed'), ('xr-blocked'), ('xr-ladder')) as t(tag);
-- The schedule creator whose publisher grant lapses is rvX, not the shared publisher.
select pg_temp.p11_schedule_row('s-xr-auth', 'xr-auth', jsonb_build_object('created_by', pg_temp.s11_id('rvX')));
select pg_temp.p11_claim('claim', '100'::jsonb);
select is((select count(*)::integer from jsonb_array_elements(pg_temp.r11_resp('claim'))), 12,
  'control: twelve due schedules are claimed and executing');

-- The world changes between the claim and the execution.
select platform_private.cms_invalidate_editorial_review(jsonb_build_object(
  'reviewId', pg_temp.s11_id('rv-xr-inval'), 'reasonCode', 'revision_superseded', 'correlationId', extensions.gen_random_uuid()));
select pg_temp.p11_drift('xr-dep', 'xr-dep-target');
select pg_temp.h11_raw_exec('identity_private.organization_actor_grant', format(
  $$update identity_private.organization_actor_grant set active = false where person_id = %L and capability_code = 'cms.publisher'$$,
  pg_temp.s11_id('rvX')));
select pg_temp.h11w_value(pg_temp.h11w_uuid('xr-pre:revision'), 'hero', jsonb_build_object('assetId', 'a9200000-0000-4000-8000-0000000000a1', 'assetVersion', '1'));
update platform_private.cms_content_entries set lifecycle = 'archived' where id = pg_temp.h11w_uuid('xr-arch:entry');
-- A counted approver whose grant lapsed does NOT stop a scheduled execution (DEC-120: only the creator is rechecked).
select pg_temp.h11_raw_exec('identity_private.organization_actor_grant', format(
  $$update identity_private.organization_actor_grant set active = false where person_id = %L and capability_code = 'cms.reviewer'$$,
  pg_temp.s11_id('rvA')));

select is(
  (select string_agg(tag || '=' || (pg_temp.p11_review(tag)).state, ';' order by tag)
     from (values ('xr-inval'), ('xr-dep'), ('xr-arch'), ('xr-lapsed')) as t(tag)),
  'xr-arch=invalidated;xr-dep=approved;xr-inval=invalidated;xr-lapsed=approved',
  'control: the review invalidation (superseded revision, archived entry) left the claimed schedules executing; the drifted dependency is found by the executor');
insert into r11_snap(label, effects) values ('before', pg_temp.p11_effects());

-- ---------------------------------------------------------------------------
-- approval_invalidated: the review is no longer what the schedule relied on.
-- ---------------------------------------------------------------------------
select pg_temp.p11_exec('i-inval', pg_temp.p11_xreq('s-xr-inval'));
select pg_temp.p11_exec('i-arch', pg_temp.p11_xreq('s-xr-arch'));
select ok(
  pg_temp.r11_out('i-inval') = '00000:' and pg_temp.r11_resp('i-inval')->>'outcome' = 'blocked'
    and pg_temp.r11_resp('i-inval')->>'reasonCode' = 'approval_invalidated'
    and pg_temp.r11_keys(pg_temp.r11_resp('i-inval')) = 'actualUtc,deviationSeconds,outcome,publicationVersionId,reasonCode,scheduleId'
    and pg_temp.r11_resp('i-inval')->'publicationVersionId' = 'null'::jsonb
    and pg_temp.p11_sched('s-xr-inval') = 'blocked/3/0/approval_invalidated/-'
    and pg_temp.r11_resp('i-arch')->>'reasonCode' = 'approval_invalidated' and pg_temp.p11_sched('s-xr-arch') = 'blocked/3/0/approval_invalidated/-',
  'an executing schedule whose review was invalidated (a superseded revision, an unavailable entry) is blocked approval_invalidated, never cancelled by the executor (DEC-158(d)) [P2-S11-AC-083]');
select pg_temp.p11_exec('i-dep', pg_temp.p11_xreq('s-xr-dep'));
select ok(
  pg_temp.r11_resp('i-dep')->>'outcome' = 'blocked' and pg_temp.r11_resp('i-dep')->>'reasonCode' = 'approval_invalidated'
    and pg_temp.p11_sched('s-xr-dep') = 'blocked/3/0/approval_invalidated/-'
    and (pg_temp.p11_review('xr-dep')).state = 'invalidated' and (pg_temp.p11_review('xr-dep')).invalidated_reason = 'dependency_changed'
    and (pg_temp.p11_review('xr-dep')).version = 3,
  'a frozen manifest that is no longer current invalidates the review (dependency_changed) and blocks the schedule approval_invalidated [P2-S11-AC-083]');
select ok(
  not exists (select 1 from platform_private.cms_publication_versions
               where entry_id in (pg_temp.h11w_uuid('xr-inval:entry'), pg_temp.h11w_uuid('xr-dep:entry'), pg_temp.h11w_uuid('xr-arch:entry')))
    and (select count(*) = 0 from platform_private.outbox_events where event_type = 'cms.publication.changed.v1'),
  'a blocked outcome appends no lineage row and emits no publication event: the prior publication stays intact [P2-S11-AC-083]');

-- ---------------------------------------------------------------------------
-- publisher_authority_ended (DEC-120): only the creator's grant, no MFA recheck.
-- ---------------------------------------------------------------------------
select pg_temp.p11_exec('a-auth', pg_temp.p11_xreq('s-xr-auth'));
select ok(
  pg_temp.r11_resp('a-auth')->>'outcome' = 'blocked' and pg_temp.r11_resp('a-auth')->>'reasonCode' = 'publisher_authority_ended'
    and pg_temp.p11_sched('s-xr-auth') = 'blocked/3/0/publisher_authority_ended/-',
  'a schedule whose creator no longer holds an unrevoked cms.publisher grant is blocked publisher_authority_ended [P2-S11-AC-081]');
select pg_temp.p11_exec('a-lapsed', pg_temp.p11_xreq('s-xr-lapsed'));
select ok(
  pg_temp.r11_resp('a-lapsed')->>'outcome' = 'completed' and pg_temp.p11_sched('s-xr-lapsed') = 'completed/3/0/-/-'
    and exists (select 1 from platform_private.cms_publication_versions where entry_id = pg_temp.h11w_uuid('xr-lapsed:entry') and version = 1),
  'the execute-phase revocation rechecks only the creator''s grant and the entry: a counted approver''s lapsed grant does not stop a scheduled publication, and MFA is not rechecked (DEC-120) [P2-S11-AC-081]');

-- ---------------------------------------------------------------------------
-- preflight_failed: a failed category blocks (the proof is healthy).
-- ---------------------------------------------------------------------------
select pg_temp.p11_exec('p-failed', pg_temp.p11_xreq('s-xr-pre'));
select ok(
  pg_temp.r11_resp('p-failed')->>'outcome' = 'blocked' and pg_temp.r11_resp('p-failed')->>'reasonCode' = 'preflight_failed'
    and pg_temp.p11_sched('s-xr-pre') = 'blocked/3/0/preflight_failed/-'
    and not exists (select 1 from platform_private.cms_publication_versions where entry_id = pg_temp.h11w_uuid('xr-pre:entry')),
  'a failed category (a media reference) blocks the schedule preflight_failed and appends nothing [P2-S11-AC-083]');
select pg_temp.p11_exec('p-blocked-run', pg_temp.p11_xreq('s-xr-blocked', '{}'::jsonb, '{}'::text[],
  pg_temp.r11_evidence(pg_temp.h11w_uuid('xr-blocked:revision'), 'blocked')));
select ok(
  pg_temp.r11_resp('p-blocked-run')->>'outcome' = 'blocked' and pg_temp.r11_resp('p-blocked-run')->>'reasonCode' = 'preflight_failed'
    and pg_temp.p11_sched('s-xr-blocked') = 'blocked/3/0/preflight_failed/-',
  'a blocked accessibility run is a failed category (blocking_finding): the schedule is blocked preflight_failed [P2-S11-AC-083]');

-- ---------------------------------------------------------------------------
-- failed_retryable: an unavailable category or an unusable proof; the ladder.
-- ---------------------------------------------------------------------------
select pg_temp.p11_exec('r-null', pg_temp.p11_xreq('s-xr-null', jsonb_build_object('evidence', null)));
select pg_temp.p11_exec('r-failed', pg_temp.p11_xreq('s-xr-failed', '{}'::jsonb, '{}'::text[],
  pg_temp.r11_evidence(pg_temp.h11w_uuid('xr-failed:revision'), 'failed')));
select pg_temp.p11_exec('r-stale', pg_temp.p11_xreq('s-xr-stale', '{}'::jsonb, '{}'::text[],
  pg_temp.r11_evidence(pg_temp.h11w_uuid('xr-stale:revision'), 'healthy', interval '90 seconds')));
select pg_temp.p11_exec('r-bound', pg_temp.p11_xreq('s-xr-bound', '{}'::jsonb, '{}'::text[],
  pg_temp.r11_evidence(pg_temp.h11w_uuid('xr-bound:revision'), 'healthy', interval '0 seconds', jsonb_build_object('bindingHash', repeat('2', 64)))));
select ok(
  (select bool_and(pg_temp.r11_out(label) = '00000:' and pg_temp.r11_resp(label)->>'outcome' = 'failed_retryable'
                   and pg_temp.r11_resp(label)->'reasonCode' = 'null'::jsonb
                   and pg_temp.r11_resp(label)->'publicationVersionId' = 'null'::jsonb)
     from (values ('r-null'), ('r-failed'), ('r-stale'), ('r-bound')) as t(label))
    and (select bool_and(pg_temp.p11_sched(key) = 'failed_retryable/3/1/-/-')
           from (values ('s-xr-null'), ('s-xr-failed'), ('s-xr-stale'), ('s-xr-bound')) as t(key)),
  'absent proof, a failed checker run, stale proof (over 60 s) and proof bound to other rows (DEC-158(c)) each make the schedule failed_retryable with attempt_count 1 and no reason, never a pass [P2-S11-AC-083]');
select ok(
  (select bool_and(next_attempt_at between clock_timestamp() + interval '13 seconds' and clock_timestamp() + interval '16 seconds'
                   and lease_id is null and lease_until is null)
     from platform_private.cms_publication_schedules
    where id in (pg_temp.s11_id('s-xr-null'), pg_temp.s11_id('s-xr-failed'), pg_temp.s11_id('s-xr-stale'), pg_temp.s11_id('s-xr-bound'))),
  'the first retry waits 15 s and the lease is released [P2-S11-AC-082]');
select ok(
  (select count(*) = 4 from audit_private.audit_events audit
    where audit.action = 'cms.publication.schedule.retry' and audit.actor_id is null
      and audit.target_id in (pg_temp.s11_id('s-xr-null'), pg_temp.s11_id('s-xr-failed'), pg_temp.s11_id('s-xr-stale'), pg_temp.s11_id('s-xr-bound')))
    and (select count(*) = 0 from platform_private.cms_publication_versions
          where entry_id in (pg_temp.h11w_uuid('xr-null:entry'), pg_temp.h11w_uuid('xr-failed:entry'), pg_temp.h11w_uuid('xr-stale:entry'), pg_temp.h11w_uuid('xr-bound:entry'))),
  'each retry is audited without an actor and appends nothing [P2-S11-AC-082]');

-- The ladder: 15 s, 60 s, 300 s, then retries_exhausted at the fourth consecutive failure.
select pg_temp.p11_exec('l1', pg_temp.p11_xreq('s-xr-ladder', jsonb_build_object('evidence', null)));
select pg_temp.h11_raw_exec('platform_private.cms_publication_schedules', format(
  $$update platform_private.cms_publication_schedules set next_attempt_at = clock_timestamp() - interval '1 second' where id = %L$$, pg_temp.s11_id('s-xr-ladder')));
select pg_temp.p11_claim('l-claim-2');
select pg_temp.p11_exec('l2', pg_temp.p11_xreq('s-xr-ladder', jsonb_build_object('evidence', null)));
select ok(pg_temp.p11_sched('s-xr-ladder') = 'failed_retryable/5/2/-/-'
    and (select next_attempt_at between clock_timestamp() + interval '58 seconds' and clock_timestamp() + interval '61 seconds'
           from platform_private.cms_publication_schedules where id = pg_temp.s11_id('s-xr-ladder')),
  'the second consecutive failure waits 60 s (attempt_count 2) [P2-S11-AC-082]');
select pg_temp.h11_raw_exec('platform_private.cms_publication_schedules', format(
  $$update platform_private.cms_publication_schedules set next_attempt_at = clock_timestamp() - interval '1 second' where id = %L$$, pg_temp.s11_id('s-xr-ladder')));
select pg_temp.p11_claim('l-claim-3');
select pg_temp.p11_exec('l3', pg_temp.p11_xreq('s-xr-ladder', jsonb_build_object('evidence', null)));
select ok(pg_temp.p11_sched('s-xr-ladder') = 'failed_retryable/7/3/-/-'
    and (select next_attempt_at between clock_timestamp() + interval '298 seconds' and clock_timestamp() + interval '301 seconds'
           from platform_private.cms_publication_schedules where id = pg_temp.s11_id('s-xr-ladder')),
  'the third consecutive failure waits 300 s (attempt_count 3) [P2-S11-AC-082]');
select pg_temp.h11_raw_exec('platform_private.cms_publication_schedules', format(
  $$update platform_private.cms_publication_schedules set next_attempt_at = clock_timestamp() - interval '1 second' where id = %L$$, pg_temp.s11_id('s-xr-ladder')));
select pg_temp.p11_claim('l-claim-4');
select pg_temp.p11_exec('l4', pg_temp.p11_xreq('s-xr-ladder', jsonb_build_object('evidence', null)));
select ok(pg_temp.r11_resp('l4')->>'outcome' = 'blocked' and pg_temp.r11_resp('l4')->>'reasonCode' = 'retries_exhausted'
    and pg_temp.p11_sched('s-xr-ladder') = 'blocked/9/3/retries_exhausted/-',
  'the fourth consecutive retryable failure blocks the schedule with retries_exhausted [P2-S11-AC-082]');
select pg_temp.p11_claim('l-claim-5');
select ok(jsonb_array_length(pg_temp.r11_resp('l-claim-5')) = 0 or not exists (
    select 1 from jsonb_array_elements(pg_temp.r11_resp('l-claim-5')) item where item->>'scheduleId' = pg_temp.s11_id('s-xr-ladder')::text),
  'a blocked schedule is never claimed again [P2-S11-AC-082]');

select * from finish();
rollback;
