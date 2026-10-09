-- Slice 11 lane S11-3b: platform_api.cms_execute_publication_schedule / platform_private (CMS-03B-20 execute,
-- DEC-120, DEC-157, DEC-158(c)(d); tracker P2-S11-AC-079 .. AC-084).  The Worker scheduled sweep executes a
-- CLAIMED schedule (its version and lease are the fence): the approved review is re-read, the creator's
-- publisher grant is rechecked without MFA, the execute-phase preflight runs with the verified proof, the
-- action is applied under the lineage rules (publish appends the `active` head, unpublish / expire / archive
-- append a `revoked` tombstone) and the schedule completes with its actual instant and deviation, together
-- with the audit record and the one cms.publication.changed.v1.  A late run executes and records its
-- deviation; a repeated execution answers already_completed with no effect.  This file covers completion,
-- the four actions, replay and the fence; blocked / retried outcomes are in
-- phase_02_slice_11_rpc_publication_execute_refusals.sql.
-- RED before 20261005017740.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(28);

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

select pg_temp.p11_approved(tag) from (values ('ex-pub'), ('ex-unpub'), ('ex-expire'), ('ex-archive'), ('ex-late'), ('ex-none'), ('ex-fence')) as t(tag);
-- The three tombstone actions need an active head: published through the real command first.
select pg_temp.p11_call('pre-' || tag, 'pub', 'cms_publish_revision', pg_temp.p11_preq(tag))
  from (values ('ex-unpub'), ('ex-expire'), ('ex-archive')) as t(tag);
select is((select count(*)::integer from platform_private.cms_publication_versions where state = 'active'), 3,
  'control: three revisions are published (active lineage heads) before their tombstone schedules fall due');
select pg_temp.p11_schedule_row('s-pub', 'ex-pub');
select pg_temp.p11_schedule_row('s-unpub', 'ex-unpub', jsonb_build_object('action', 'unpublish'));
select pg_temp.p11_schedule_row('s-expire', 'ex-expire', jsonb_build_object('action', 'expire'));
select pg_temp.p11_schedule_row('s-archive', 'ex-archive', jsonb_build_object('action', 'archive'));
select pg_temp.p11_schedule_row('s-late', 'ex-late', jsonb_build_object(
  'resolved_at_utc', date_trunc('second', clock_timestamp()) - interval '2 hours',
  'local_datetime', (date_trunc('second', clock_timestamp()) - interval '2 hours') at time zone 'UTC'));
select pg_temp.p11_schedule_row('s-none', 'ex-none', jsonb_build_object('action', 'unpublish'));
select pg_temp.p11_schedule_row('s-fence', 'ex-fence');
select pg_temp.p11_schedule_row('s-pending', 'ex-fence', jsonb_build_object('audience', 'partners'));
select pg_temp.h11_raw_exec('platform_private.cms_publication_schedules', format(
  $$update platform_private.cms_publication_schedules set resolved_at_utc = clock_timestamp() + interval '1 hour',
      local_datetime = (date_trunc('second', clock_timestamp()) + interval '1 hour') at time zone 'UTC' where id = %L$$,
  pg_temp.s11_id('s-pending')));
select pg_temp.p11_claim('claim', '100'::jsonb);
select is((select count(*)::integer from jsonb_array_elements(pg_temp.r11_resp('claim'))), 7,
  'control: seven due schedules are claimed (the eighth is in the future and stays pending)');

-- ---------------------------------------------------------------------------
-- Shape, privileges and structure.
-- ---------------------------------------------------------------------------
select ok(pg_temp.r11_posture('platform_private', 'cms_execute_publication_schedule(jsonb)'),
  'cms_execute_publication_schedule is a private SECURITY DEFINER of the CMS definer (empty search_path) that no API role, service_role included, can execute [P2-S11-AC-081]');
select ok(pg_temp.r11_posture('platform_api', 'cms_execute_publication_schedule(jsonb)'),
  'the platform_api wrapper is executable by service_role only, not by PUBLIC, anon or authenticated [P2-S11-AC-081]');
insert into r11_snap(label, effects) values ('start', pg_temp.p11_effects());
select pg_temp.p11_exec('b-extra', pg_temp.p11_xreq('s-fence', jsonb_build_object('context', '{}'::jsonb)), false);
select pg_temp.p11_exec('b-missing', pg_temp.p11_xreq('s-fence', '{}'::jsonb, array['leaseId']), false);
select pg_temp.p11_exec('b-uuid', pg_temp.p11_xreq('s-fence', jsonb_build_object('scheduleId', 'nope')), false);
select pg_temp.p11_exec('b-version', pg_temp.p11_xreq('s-fence', jsonb_build_object('expectedVersion', '0')), false);
select pg_temp.p11_exec('b-evidence', pg_temp.p11_xreq('s-fence', jsonb_build_object('evidence', 'healthy')), false);
select pg_temp.p11_exec('b-absent', pg_temp.p11_xreq('s-fence', jsonb_build_object('scheduleId', extensions.gen_random_uuid())), false);
select ok(
  (select bool_and(pg_temp.r11_out(label) = 'P0001:INVALID_REQUEST') from (values ('b-extra'), ('b-missing'), ('b-uuid'), ('b-version'), ('b-evidence')) as t(label))
    and pg_temp.r11_out('b-absent') = 'P0001:NOT_FOUND'
    and pg_temp.p11_effects() = (select effects from r11_snap where label = 'start'),
  'an unknown key, a missing member, a malformed id or version and a non-object proof are INVALID_REQUEST, an absent schedule is NOT_FOUND, and nothing changes [P2-S11-AC-079]');

-- ---------------------------------------------------------------------------
-- The fence: only the claim's version and lease execute; a refused call has no effect.
-- ---------------------------------------------------------------------------
select pg_temp.p11_exec('f-lease', pg_temp.p11_xreq('s-fence', jsonb_build_object('leaseId', extensions.gen_random_uuid())), false);
select pg_temp.p11_exec('f-version', pg_temp.p11_xreq('s-fence', jsonb_build_object('expectedVersion', '1')), false);
select pg_temp.p11_exec('f-pending', pg_temp.p11_xreq('s-pending', jsonb_build_object('leaseId', extensions.gen_random_uuid(), 'expectedVersion', '1')), false);
select ok(
  pg_temp.r11_out('f-lease') = 'P0001:CONFLICT' and pg_temp.r11_out('f-pending') = 'P0001:CONFLICT'
    and pg_temp.r11_out('f-version') = 'P0001:VERSION_MISMATCH'
    and pg_temp.r11_detail('f-version')::jsonb = '{"expectedVersion":"1","currentVersion":"2"}'::jsonb
    and pg_temp.p11_effects() = (select effects from r11_snap where label = 'start'),
  'a stale lease, a stale version and a schedule that was never claimed are refused (CONFLICT / VERSION_MISMATCH) with no effect [P2-S11-AC-080]');

-- ---------------------------------------------------------------------------
-- A publish: completes with the appended head.
-- ---------------------------------------------------------------------------
create temp table r11_req(label text primary key, request jsonb not null) on commit drop;
insert into r11_req(label, request) values ('x1', pg_temp.p11_xreq('s-pub'));
select pg_temp.p11_exec('x1', (select request from r11_req where label = 'x1'));
select is(pg_temp.r11_out('x1'), '00000:', 'a claimed, due publish schedule executes [P2-S11-AC-080]');
select is(pg_temp.r11_keys(pg_temp.r11_resp('x1')), 'actualUtc,deviationSeconds,outcome,publicationVersionId,reasonCode,scheduleId',
  'the answer is exactly the six-member ScheduleExecutionResult [P2-S11-AC-079]');
select ok(
  pg_temp.r11_resp('x1')->>'outcome' = 'completed' and pg_temp.r11_resp('x1')->'reasonCode' = 'null'::jsonb
    and pg_temp.r11_resp('x1')->>'scheduleId' = pg_temp.s11_id('s-pub')::text
    and pg_temp.r11_resp('x1')->>'publicationVersionId' = (select id::text from platform_private.cms_publication_versions
                                                            where entry_id = pg_temp.h11w_uuid('ex-pub:entry') and version = 1)
    and (pg_temp.r11_resp('x1')->>'actualUtc')::timestamptz between clock_timestamp() - interval '1 minute' and clock_timestamp()
    and (pg_temp.r11_resp('x1')->>'deviationSeconds')::integer between 55 and 90,
  'the result names the appended lineage row, the actual instant and the deviation from the resolved instant (about a minute late here) [P2-S11-AC-083]');
select ok(
  pg_temp.p11_sched('s-pub') = 'completed/3/0/-/-'
    and (select actual_at_utc is not null and deviation_seconds = (pg_temp.r11_resp('x1')->>'deviationSeconds')::bigint
                and round(extract(epoch from (actual_at_utc - resolved_at_utc))) = deviation_seconds
                and next_attempt_at is null
           from platform_private.cms_publication_schedules where id = pg_temp.s11_id('s-pub')),
  'the schedule is completed at version 3 with actual_at_utc and deviation_seconds = round(actual - resolved), its lease released [P2-S11-AC-084]');
select ok(
  exists (
    select 1 from platform_private.cms_publication_versions row_item
     where row_item.id = (pg_temp.r11_resp('x1')->>'publicationVersionId')::uuid
       and row_item.publication_id = row_item.id and row_item.version = 1 and row_item.state = 'active' and row_item.action = 'publish'
       and row_item.schedule_id = pg_temp.s11_id('s-pub') and row_item.publisher_person_id = pg_temp.s11_id('pub')
       and row_item.entry_id = pg_temp.h11w_uuid('ex-pub:entry') and row_item.revision_id = pg_temp.h11w_uuid('ex-pub:revision')
       and row_item.locale = 'en-US' and row_item.audience = 'public'
       and row_item.dependency_hash = (pg_temp.p11_review('ex-pub')).dependency_hash
       and row_item.activation_evidence_hash = platform_private.cms_jcs_sha256((pg_temp.p11_review('ex-pub')).activation_evidence)
       and row_item.version_set = platform_private.cms_revision_version_set(
             pg_temp.h11w_uuid('ex-pub:revision'), (pg_temp.p11_review('ex-pub')).dependency_manifest)),
  'the lineage head carries the schedule id, the schedule creator as publisher and the frozen evidence and version set [P2-S11-AC-084]');
select ok(
  (select count(*) = 1 from platform_private.outbox_events event
    where event.event_type = 'cms.publication.changed.v1' and event.aggregate_type = 'cms_publication'
      and event.payload = jsonb_build_object('entryId', pg_temp.h11w_uuid('ex-pub:entry'),
            'publicationVersionId', (pg_temp.r11_resp('x1')->>'publicationVersionId')::uuid))
    and (select count(*) = 1 from audit_private.audit_events audit
          where audit.action = 'cms.publication.publish' and audit.target_id = (pg_temp.r11_resp('x1')->>'publicationVersionId')::uuid
            and audit.actor_id is null and audit.correlation_id = platform_private.cms_schedule_correlation(
              pg_temp.s11_id('s-pub'), (select (request->>'leaseId')::uuid from r11_req where label = 'x1')))
    and platform_private.cms_revision_effective_state(pg_temp.h11w_uuid('ex-pub:revision')) = 'published',
  'exactly one identifier-only cms.publication.changed.v1 and one system audit record (the claim''s correlation, no actor) commit with the schedule; the revision is published [P2-S11-AC-084]');
select ok(
  not pg_temp.r11_leaks(pg_temp.r11_resp('x1'), array[
    pg_temp.s11_id('pub')::text, pg_temp.s11_id('creator')::text, pg_temp.s11_id('org')::text, (pg_temp.p11_review('ex-pub')).id::text]),
  'the result carries no publisher, author, party or review identifier [P2-S11-AC-081]');

-- Replay: a completed schedule answers already_completed with no effect, whatever the version or lease.
insert into r11_snap(label, effects) values ('after-x1', pg_temp.p11_effects());
select pg_temp.p11_exec('x1-replay', (select request from r11_req where label = 'x1'));
select pg_temp.p11_exec('x1-stale-lease', (select request from r11_req where label = 'x1') || jsonb_build_object('leaseId', extensions.gen_random_uuid()));
select ok(
  pg_temp.r11_out('x1-replay') = '00000:' and pg_temp.r11_resp('x1-replay')->>'outcome' = 'already_completed'
    and pg_temp.r11_resp('x1-replay')->>'publicationVersionId' = pg_temp.r11_resp('x1')->>'publicationVersionId'
    and pg_temp.r11_resp('x1-replay')->>'actualUtc' = pg_temp.r11_resp('x1')->>'actualUtc'
    and pg_temp.r11_resp('x1-replay')->>'deviationSeconds' = pg_temp.r11_resp('x1')->>'deviationSeconds'
    and pg_temp.r11_resp('x1-replay')->'reasonCode' = 'null'::jsonb
    and pg_temp.r11_resp('x1-stale-lease') = pg_temp.r11_resp('x1-replay')
    and pg_temp.p11_effects() = (select effects from r11_snap where label = 'after-x1'),
  'a repeated execution of a completed schedule answers already_completed with the original lineage row, instant and deviation and adds no lineage row, event or audit record [P2-S11-AC-083]');

-- ---------------------------------------------------------------------------
-- The tombstone actions append a revoked row that copies the ended head.
-- ---------------------------------------------------------------------------
select pg_temp.p11_exec('x-unpub', pg_temp.p11_xreq('s-unpub'));
select pg_temp.p11_exec('x-expire', pg_temp.p11_xreq('s-expire'));
select pg_temp.p11_exec('x-archive', pg_temp.p11_xreq('s-archive'));
select ok(
  pg_temp.r11_out('x-unpub') = '00000:' and pg_temp.r11_out('x-expire') = '00000:' and pg_temp.r11_out('x-archive') = '00000:'
    and pg_temp.r11_resp('x-unpub')->>'outcome' = 'completed' and pg_temp.r11_resp('x-expire')->>'outcome' = 'completed'
    and pg_temp.r11_resp('x-archive')->>'outcome' = 'completed'
    and pg_temp.p11_sched('s-unpub') = 'completed/3/0/-/-' and pg_temp.p11_sched('s-expire') = 'completed/3/0/-/-'
    and pg_temp.p11_sched('s-archive') = 'completed/3/0/-/-',
  'unpublish, expire and archive schedules complete [P2-S11-AC-084]');
select is(
  (select string_agg(tag || '=' || tomb.action || '/' || tomb.state || '/' || tomb.version || '/'
                      || (tomb.supersedes_id = head.id)::text || '/' || (tomb.schedule_id = pg_temp.s11_id('s-' || split_part(tag, '-', 2)))::text
                      || '/' || (tomb.revision_id = head.revision_id and tomb.version_set = head.version_set
                                  and tomb.dependency_hash = head.dependency_hash
                                  and tomb.activation_evidence_hash = head.activation_evidence_hash)::text
                      || '/' || (tomb.revoked_at is not null and tomb.activated_at is null)::text, ';' order by tag)
     from (values ('ex-unpub'), ('ex-expire'), ('ex-archive')) as t(tag)
     join platform_private.cms_publication_versions tomb on tomb.entry_id = pg_temp.h11w_uuid(tag || ':entry') and tomb.version = 2
     join platform_private.cms_publication_versions head on head.entry_id = tomb.entry_id and head.version = 1),
  'ex-archive=archive/revoked/2/true/true/true/true;ex-expire=expire/revoked/2/true/true/true/true;ex-unpub=unpublish/revoked/2/true/true/true/true',
  'each tombstone is a revoked successor row at version 2 that names the ended head and the schedule and copies its revision and evidence, with revoked_at set and no activation [P2-S11-AC-114]');
select ok(
  (select count(*) = 3 from platform_private.outbox_events event
    where event.event_type = 'cms.publication.changed.v1'
      and event.payload->>'entryId' in (pg_temp.h11w_uuid('ex-unpub:entry')::text, pg_temp.h11w_uuid('ex-expire:entry')::text, pg_temp.h11w_uuid('ex-archive:entry')::text)
      and event.aggregate_version = 2)
    and platform_private.cms_publication_row_state((select id from platform_private.cms_publication_versions
          where entry_id = pg_temp.h11w_uuid('ex-unpub:entry') and version = 2)) = 'revoked'
    and platform_private.cms_publication_row_state((select id from platform_private.cms_publication_versions
          where entry_id = pg_temp.h11w_uuid('ex-unpub:entry') and version = 1)) = 'superseded',
  'each tombstone emitted exactly one cms.publication.changed.v1 at lineage version 2 [P2-S11-AC-116]');

-- An unpublish with no active head blocks with publication_not_active: nothing is appended.
select pg_temp.p11_exec('x-none', pg_temp.p11_xreq('s-none'));
select ok(
  pg_temp.r11_out('x-none') = '00000:' and pg_temp.r11_resp('x-none')->>'outcome' = 'blocked'
    and pg_temp.r11_resp('x-none')->>'reasonCode' = 'publication_not_active'
    and pg_temp.r11_resp('x-none')->'publicationVersionId' = 'null'::jsonb and pg_temp.r11_resp('x-none')->'actualUtc' = 'null'::jsonb
    and pg_temp.r11_resp('x-none')->'deviationSeconds' = 'null'::jsonb
    and pg_temp.p11_sched('s-none') = 'blocked/3/0/publication_not_active/-'
    and not exists (select 1 from platform_private.cms_publication_versions where entry_id = pg_temp.h11w_uuid('ex-none:entry')),
  'an unpublish without an active head blocks the schedule with publication_not_active and appends nothing [P2-S11-AC-083]');

-- A late run executes and records its deviation; it never skips the action.
select pg_temp.p11_exec('x-late', pg_temp.p11_xreq('s-late'));
select ok(
  pg_temp.r11_out('x-late') = '00000:' and pg_temp.r11_resp('x-late')->>'outcome' = 'completed'
    and (pg_temp.r11_resp('x-late')->>'deviationSeconds')::integer between 7195 and 7260
    and (select deviation_seconds = (pg_temp.r11_resp('x-late')->>'deviationSeconds')::bigint
           from platform_private.cms_publication_schedules where id = pg_temp.s11_id('s-late')),
  'a schedule that fell due two hours ago still executes and records a deviation of about 7,200 seconds [P2-S11-AC-083]');

select * from finish();
rollback;
