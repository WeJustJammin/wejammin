-- Slice 11 lane S11-3b: cms_execute_publication_schedule blocked and retried outcomes (CMS-03B-20; DEC-120,
-- DEC-150, DEC-157, DEC-158(c)(d); tracker P2-S11-AC-080 .. AC-084).  Executing, in order: the approved
-- review must be exactly what the schedule relied on with every frozen identity current (else `blocked`
-- approval_invalidated, the stale-manifest case also invalidating the review), the creator's publisher grant
-- must cover the fire instant without any MFA recheck (else `blocked` publisher_authority_ended), then the
-- execute-phase preflight: a failed category blocks (preflight_failed), an unavailable one or a stale /
-- mis-bound / absent accessibility proof makes the schedule failed_retryable on the 15 s / 60 s / 300 s
-- ladder, and the fourth consecutive failure blocks it with retries_exhausted.  A blocked outcome keeps the
-- prior publication intact and appends no lineage row.  DEC-158(c): a STALE or MIS-BOUND proof is never a retry:
-- the typed conflict (preflight_evidence_stale) propagates and the schedule, its lease, version, attempts and
-- audit stay exactly as the claim left them.  AC-080: the approved review must equal what the schedule relied on
-- (version, dependency hash, activation evidence hash, frozen hash), each mismatch blocking on its own.  BE03b
-- (Schedule execution 3): a failed preflight keeps an EXISTING active publication head byte-for-byte intact.
-- RED before 20261005017740.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(35);

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
  ('xr-null'), ('xr-stale'), ('xr-bound'), ('xr-prov'), ('xr-failed'), ('xr-blocked'), ('xr-ladder'),
  ('xr-m-ver'), ('xr-m-dep'), ('xr-m-act'), ('xr-m-frz'), ('xr-head')) as t(tag);
select pg_temp.h11r_member('rvX', array['cms.reviewer', 'cms.publisher']);
-- BE03b (Schedule execution 3): an EXISTING active head (v1, published by the real command) that a failed preflight must not touch.
select pg_temp.p11_call('seed-head', 'pub', 'cms_publish_revision', pg_temp.p11_preq('xr-head'));
select pg_temp.h11w_value(pg_temp.h11w_uuid('xr-head:revision'), 'hero', jsonb_build_object('assetId', 'a9200000-0000-4000-8000-0000000000a1', 'assetVersion', '1'));
select pg_temp.p11_schedule_row('s-' || tag, tag)
  from (values ('xr-inval'), ('xr-dep'), ('xr-pre'), ('xr-arch'), ('xr-lapsed'), ('xr-null'), ('xr-stale'), ('xr-bound'), ('xr-prov'),
               ('xr-failed'), ('xr-blocked'), ('xr-ladder'), ('xr-m-ver'), ('xr-m-dep'), ('xr-m-act'), ('xr-m-frz'), ('xr-head')) as t(tag);
-- The schedule creator whose publisher grant lapses is rvX, not the shared publisher.
select pg_temp.p11_schedule_row('s-xr-auth', 'xr-auth', jsonb_build_object('created_by', pg_temp.s11_id('rvX')));
select pg_temp.p11_claim('claim', '100'::jsonb);
select is((select count(*)::integer from jsonb_array_elements(pg_temp.r11_resp('claim'))), 18,
  'control: eighteen due schedules are claimed and executing');

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
    and (select count(*) = 0 from platform_private.outbox_events
          where event_type = 'cms.publication.changed.v1'
            and payload->>'entryId' in (pg_temp.h11w_uuid('xr-inval:entry')::text, pg_temp.h11w_uuid('xr-dep:entry')::text,
                                        pg_temp.h11w_uuid('xr-arch:entry')::text)),
  'a blocked outcome appends no lineage row and emits no publication event: the prior publication stays intact [P2-S11-AC-083]');

-- ---------------------------------------------------------------------------
-- AC-080: the approved review must be exactly what the schedule relied on.  Each comparison is driven alone: the
-- review of one tag is forged (raw update, triggers off, CHECKs on) so ONLY its version, dependency hash, activation
-- evidence or frozen hash differs; every one blocks approval_invalidated and appends nothing.
-- ---------------------------------------------------------------------------
select pg_temp.h11_raw_exec('platform_private.cms_editorial_reviews', format(
  $$update platform_private.cms_editorial_reviews set version = version + 1 where id = %L$$, pg_temp.s11_id('rv-xr-m-ver')));
select pg_temp.h11_raw_exec('platform_private.cms_editorial_reviews', format(
  $$update platform_private.cms_editorial_reviews set dependency_hash = repeat('e', 64) where id = %L$$, pg_temp.s11_id('rv-xr-m-dep')));
select pg_temp.h11_raw_exec('platform_private.cms_editorial_reviews', format(
  $$update platform_private.cms_editorial_reviews set activation_evidence = activation_evidence || '{"forged": true}'::jsonb where id = %L$$,
  pg_temp.s11_id('rv-xr-m-act')));
select pg_temp.h11_raw_exec('platform_private.cms_editorial_reviews', format(
  $$update platform_private.cms_editorial_reviews set frozen_hash = repeat('d', 64) where id = %L$$, pg_temp.s11_id('rv-xr-m-frz')));
select pg_temp.p11_exec('m-ver', pg_temp.p11_xreq('s-xr-m-ver'));
select pg_temp.p11_exec('m-dep', pg_temp.p11_xreq('s-xr-m-dep'));
select pg_temp.p11_exec('m-act', pg_temp.p11_xreq('s-xr-m-act'));
select pg_temp.p11_exec('m-frz', pg_temp.p11_xreq('s-xr-m-frz'));
select ok(pg_temp.r11_resp('m-ver')->>'outcome' = 'blocked' and pg_temp.r11_resp('m-ver')->>'reasonCode' = 'approval_invalidated'
    and pg_temp.p11_sched('s-xr-m-ver') = 'blocked/3/0/approval_invalidated/-' and (pg_temp.p11_review('xr-m-ver')).version = 3,
  'a review whose version is not the schedule''s expected_version blocks the schedule approval_invalidated [P2-S11-AC-080]');
select ok(pg_temp.r11_resp('m-dep')->>'outcome' = 'blocked' and pg_temp.r11_resp('m-dep')->>'reasonCode' = 'approval_invalidated'
    and pg_temp.p11_sched('s-xr-m-dep') = 'blocked/3/0/approval_invalidated/-' and (pg_temp.p11_review('xr-m-dep')).dependency_hash = repeat('e', 64),
  'a review whose dependency hash differs from the schedule''s blocks the schedule approval_invalidated [P2-S11-AC-080]');
select ok(pg_temp.r11_resp('m-act')->>'outcome' = 'blocked' and pg_temp.r11_resp('m-act')->>'reasonCode' = 'approval_invalidated'
    and pg_temp.p11_sched('s-xr-m-act') = 'blocked/3/0/approval_invalidated/-'
    and platform_private.cms_activation_evidence_hash(pg_temp.s11_id('rv-xr-m-act')) <> (select activation_evidence_hash
          from platform_private.cms_publication_schedules where id = pg_temp.s11_id('s-xr-m-act')),
  'a review whose activation evidence hash differs from the schedule''s blocks the schedule approval_invalidated [P2-S11-AC-080]');
select ok(pg_temp.r11_resp('m-frz')->>'outcome' = 'blocked' and pg_temp.r11_resp('m-frz')->>'reasonCode' = 'approval_invalidated'
    and pg_temp.p11_sched('s-xr-m-frz') = 'blocked/3/0/approval_invalidated/-' and (pg_temp.p11_review('xr-m-frz')).frozen_hash = repeat('d', 64),
  'a review whose frozen hash is no longer the revision''s payload hash blocks the schedule approval_invalidated [P2-S11-AC-080]');
select ok(
  not exists (select 1 from platform_private.cms_publication_versions
               where entry_id in (pg_temp.h11w_uuid('xr-m-ver:entry'), pg_temp.h11w_uuid('xr-m-dep:entry'), pg_temp.h11w_uuid('xr-m-act:entry'),
                                  pg_temp.h11w_uuid('xr-m-frz:entry')))
    and (select count(*) = 0 from platform_private.outbox_events
          where event_type = 'cms.publication.changed.v1'
            and payload->>'entryId' in (pg_temp.h11w_uuid('xr-m-ver:entry')::text, pg_temp.h11w_uuid('xr-m-dep:entry')::text,
                                        pg_temp.h11w_uuid('xr-m-act:entry')::text, pg_temp.h11w_uuid('xr-m-frz:entry')::text))
    and (select bool_and((pg_temp.p11_review(tag)).state = 'approved')
           from (values ('xr-m-ver'), ('xr-m-dep'), ('xr-m-act'), ('xr-m-frz')) as t(tag)),
  'none of the four mismatches appended a lineage row or an event, and the blocked outcome left the forged reviews approved (the executor blocks the schedule, it does not rewrite the review) [P2-S11-AC-080]');

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
-- BE03b (Schedule execution 3): "a failed result blocks the schedule with the prior publication intact".  The entry xr-head
-- holds a real active v1 head (published through cms_publish_revision before the claim); its scheduled publish then fails the
-- preflight (a media reference).  The whole lineage (rows), its events, its audit records and its evidence summaries must be
-- byte-for-byte what they were: a mutant that tombstones or supersedes the head on a blocked execution is caught here.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.p11_lineage_fingerprint(p_entry uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $body$
  select md5(
    coalesce((select string_agg(to_jsonb(row_item)::text, '|' order by row_item.version)
                from platform_private.cms_publication_versions row_item where row_item.entry_id = p_entry), '')
    || '#' || coalesce((select string_agg(to_jsonb(event)::text, '|' order by event.id)
                from platform_private.outbox_events event
               where event.event_type = 'cms.publication.changed.v1' and event.payload->>'entryId' = p_entry::text), '')
    || '#' || coalesce((select string_agg(to_jsonb(audit)::text, '|' order by audit.id)
                from audit_private.audit_events audit
               where audit.target_id in (select row_item.id from platform_private.cms_publication_versions row_item
                                          where row_item.entry_id = p_entry)), '')
    || '#' || coalesce((select string_agg(to_jsonb(summary)::text, '|' order by summary.id)
                from platform_private.cms_command_accessibility_evidence summary
               where summary.subject_id in (select row_item.id from platform_private.cms_publication_versions row_item
                                             where row_item.entry_id = p_entry)), ''))
$body$;
select ok(pg_temp.p11_head('xr-head') = 'publish/active/1'
    and (select count(*) = 1 from platform_private.outbox_events
          where event_type = 'cms.publication.changed.v1' and payload->>'entryId' = pg_temp.h11w_uuid('xr-head:entry')::text)
    and pg_temp.p11_lineage_fingerprint(pg_temp.h11w_uuid('xr-head:entry')) <> md5(''),
  'control: the entry holds one active v1 head with its event, audit record and evidence summary before the scheduled execution');
insert into r11_snap(label, effects) values ('head-before', pg_temp.p11_lineage_fingerprint(pg_temp.h11w_uuid('xr-head:entry')));
select pg_temp.p11_exec('h-failed', pg_temp.p11_xreq('s-xr-head'));
select ok(pg_temp.r11_resp('h-failed')->>'outcome' = 'blocked' and pg_temp.r11_resp('h-failed')->>'reasonCode' = 'preflight_failed'
    and pg_temp.p11_sched('s-xr-head') = 'blocked/3/0/preflight_failed/-',
  'the scheduled publish over an existing head fails the preflight and the schedule is blocked preflight_failed [P2-S11-AC-083]');
select ok(
  pg_temp.p11_lineage_fingerprint(pg_temp.h11w_uuid('xr-head:entry')) = (select effects from r11_snap where label = 'head-before')
    and pg_temp.p11_head('xr-head') = 'publish/active/1'
    and (select count(*) = 1 from platform_private.cms_publication_versions where entry_id = pg_temp.h11w_uuid('xr-head:entry')),
  'the blocked execution left the existing active v1 head, the lineage rows, their events, audit records and evidence summaries exactly as they were: no tombstone, no successor row [P2-S11-AC-083]');

-- ---------------------------------------------------------------------------
-- failed_retryable: an UNAVAILABLE checker outcome (absent proof, a failed run); the ladder.  A stale or
-- mis-bound proof is NOT on the ladder: DEC-158(c) makes it the typed conflict, with nothing consumed.
-- ---------------------------------------------------------------------------
select pg_temp.p11_exec('r-null', pg_temp.p11_xreq('s-xr-null', jsonb_build_object('evidence', null)));
select pg_temp.p11_exec('r-failed', pg_temp.p11_xreq('s-xr-failed', '{}'::jsonb, '{}'::text[],
  pg_temp.r11_evidence(pg_temp.h11w_uuid('xr-failed:revision'), 'failed')));
select ok(
  (select bool_and(pg_temp.r11_out(label) = '00000:' and pg_temp.r11_resp(label)->>'outcome' = 'failed_retryable'
                   and pg_temp.r11_resp(label)->'reasonCode' = 'null'::jsonb
                   and pg_temp.r11_resp(label)->'publicationVersionId' = 'null'::jsonb)
     from (values ('r-null'), ('r-failed')) as t(label))
    and (select bool_and(pg_temp.p11_sched(key) = 'failed_retryable/3/1/-/-')
           from (values ('s-xr-null'), ('s-xr-failed')) as t(key)),
  'absent proof and a failed checker run (unavailable accessibility) each make the schedule failed_retryable with attempt_count 1 and no reason, never a pass [P2-S11-AC-083]');
select ok(
  (select bool_and(next_attempt_at between clock_timestamp() + interval '13 seconds' and clock_timestamp() + interval '16 seconds'
                   and lease_id is null and lease_until is null)
     from platform_private.cms_publication_schedules
    where id in (pg_temp.s11_id('s-xr-null'), pg_temp.s11_id('s-xr-failed'))),
  'the first retry waits 15 s and the lease is released [P2-S11-AC-082]');
select ok(
  (select count(*) = 2 from audit_private.audit_events audit
    where audit.action = 'cms.publication.schedule.retry' and audit.actor_id is null
      and audit.target_id in (pg_temp.s11_id('s-xr-null'), pg_temp.s11_id('s-xr-failed')))
    and (select count(*) = 0 from platform_private.cms_publication_versions
          where entry_id in (pg_temp.h11w_uuid('xr-null:entry'), pg_temp.h11w_uuid('xr-failed:entry'))),
  'each retry is audited without an actor and appends nothing [P2-S11-AC-082]');

-- DEC-158(c) / BE03b "Accessibility provider": evidence older than 60 s, from another provider version or bound to other
-- rows is 409 preflight_evidence_stale.  The conflict PROPAGATES: the schedule keeps its claim state (executing, the same
-- lease and version, attempts 0), no retry is audited and the whole row and effect fingerprint is unchanged.
create temp table r11_claim_row(key text primary key, fingerprint text not null) on commit drop;
create or replace function pg_temp.p11_schedule_fingerprint(p_key text)
returns text
language sql
stable
security definer
set search_path = ''
as $body$
  select coalesce((select md5(to_jsonb(schedule)::text) from platform_private.cms_publication_schedules schedule
                    where schedule.id = pg_temp.s11_id(p_key)), '-')
$body$;
insert into r11_claim_row(key, fingerprint)
  select key, pg_temp.p11_schedule_fingerprint(key) from (values ('s-xr-stale'), ('s-xr-bound'), ('s-xr-prov')) as t(key);
insert into r11_snap(label, effects) values ('before-stale', pg_temp.p11_effects());
select pg_temp.p11_exec('c-stale', pg_temp.p11_xreq('s-xr-stale', '{}'::jsonb, '{}'::text[],
  pg_temp.r11_evidence(pg_temp.h11w_uuid('xr-stale:revision'), 'healthy', interval '90 seconds')));
select pg_temp.p11_exec('c-bound', pg_temp.p11_xreq('s-xr-bound', '{}'::jsonb, '{}'::text[],
  pg_temp.r11_evidence(pg_temp.h11w_uuid('xr-bound:revision'), 'healthy', interval '0 seconds', jsonb_build_object('bindingHash', repeat('2', 64)))));
select pg_temp.p11_exec('c-prov', pg_temp.p11_xreq('s-xr-prov', '{}'::jsonb, '{}'::text[],
  pg_temp.r11_evidence(pg_temp.h11w_uuid('xr-prov:revision'), 'healthy', interval '0 seconds', jsonb_build_object('providerVersion', '9'))));
select is(pg_temp.r11_out('c-stale') || '|' || pg_temp.r11_out('c-bound') || '|' || pg_temp.r11_out('c-prov'),
  'P0001:preflight_evidence_stale|P0001:preflight_evidence_stale|P0001:preflight_evidence_stale',
  'stale proof (over 60 s), proof bound to other rows and proof from another provider version each refuse the execution with the typed conflict preflight_evidence_stale (DEC-158(c)) [P2-S11-AC-083]');
select ok(
  (select bool_and(pg_temp.p11_sched(key) = 'executing/2/0/-/lease'
                   and pg_temp.p11_schedule_fingerprint(key) = (select fingerprint from r11_claim_row claim where claim.key = t.key))
     from (values ('s-xr-stale'), ('s-xr-bound'), ('s-xr-prov')) as t(key))
    and pg_temp.p11_effects() = (select effects from r11_snap where label = 'before-stale')
    and not exists (select 1 from audit_private.audit_events audit
                     where audit.target_id in (pg_temp.s11_id('s-xr-stale'), pg_temp.s11_id('s-xr-bound'), pg_temp.s11_id('s-xr-prov'))
                       and audit.action like 'cms.publication.schedule.%'),
  'a stale or mis-bound proof consumes no retry state: each schedule is still executing at the claim''s version and lease with attempt_count 0 and an unchanged row, and no schedule audit record or other effect exists [P2-S11-AC-083]');

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
