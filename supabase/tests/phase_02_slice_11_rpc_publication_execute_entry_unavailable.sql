-- Slice 11 finisher lane, P2-S11-AC-083 (BE03b "Schedule execution (CMS-03B-20)": "A schedule whose entry is not
-- `active` at execution is `cancelled` with `entry_unavailable`"; orchestrator ruling 2026-10-11, which supersedes
-- DEC-158(d)'s "ScheduleExecutionResult omits cancelled" for this one case; review A-M7).
--
-- The race this closes: a sweeper CLAIMS a due schedule (state executing, lease held), and only then the entry leaves
-- `active`.  The review invalidation that the lifecycle change fires cancels only `pending` / `failed_retryable`
-- schedules, so the claimed schedule is left to the executor.  Before this change the executor found the review
-- invalidated and BLOCKED the schedule `approval_invalidated`, which is the wrong closed reason and the wrong state for
-- an entry that is no longer there (BE03b:1898).  Now the executor, holding the entry row FOR SHARE (so the lifecycle
-- cannot change under it), reads the lifecycle FIRST and CANCELS the schedule `entry_unavailable` in its own
-- transaction: version CAS + 1, lease released, attempt count unchanged, one audit record, no publication event, no
-- lineage row, no accessibility summary (no proof was verified).  An entry that is still `active` keeps every earlier
-- outcome (a superseded revision still blocks `approval_invalidated`).
--
-- Driven through the real claim and the real execute RPC, with the entry made unavailable AFTER the claim.
-- RED before the forward migration 20261010170100 (the executor blocks, the state guard refuses executing -> cancelled).

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(32);

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

-- eu-arch   archived through the real lifecycle update (the trigger invalidates the review entry_unavailable)
-- eu-held   held through the real lifecycle update
-- eu-unpub  an unpublish schedule of an archived entry (the action does not matter)
-- eu-bare   archived with the invalidation trigger OFF: the review is still approved, so ONLY the executor's own
--           entry check can produce the cancellation (it precedes the review re-read)
-- eu-noproof  archived, executed with NO accessibility proof: still cancelled, never the retry ladder
-- eu-fence  archived, but executed with a stale lease: refused, nothing changes
-- eu-sup    revision superseded, entry still active: stays blocked approval_invalidated
-- eu-live   nothing changed: completes
-- eu-direct  claimed, then cancelled through the helper directly (closed reasons and the version CAS)
-- eu-pending a schedule that is not yet due: not claimed, so not the executor's to cancel
select pg_temp.p11_approved(tag) from (values ('eu-arch'), ('eu-held'), ('eu-unpub'), ('eu-bare'), ('eu-noproof'),
  ('eu-fence'), ('eu-sup'), ('eu-live'), ('eu-direct'), ('eu-pending')) as t(tag);
select pg_temp.p11_schedule_row('s-' || tag, tag)
  from (values ('eu-arch'), ('eu-held'), ('eu-bare'), ('eu-noproof'), ('eu-fence'), ('eu-sup'), ('eu-live'), ('eu-direct')) as t(tag);
select pg_temp.p11_schedule_row('s-eu-unpub', 'eu-unpub', jsonb_build_object('action', 'unpublish'));
select pg_temp.p11_schedule_row('s-eu-pending', 'eu-pending', jsonb_build_object(
  'local_datetime', (date_trunc('second', clock_timestamp()) + interval '1 day') at time zone 'UTC',
  'resolved_at_utc', date_trunc('second', clock_timestamp()) + interval '1 day'));
select pg_temp.p11_claim('claim', '100'::jsonb);
select is((select count(*)::integer from jsonb_array_elements(pg_temp.r11_resp('claim'))), 9,
  'control: the nine due schedules are claimed and executing; the one due tomorrow is not [P2-S11-AC-083]');

-- The world changes AFTER the claim.
update platform_private.cms_content_entries set lifecycle = 'archived' where id = pg_temp.h11w_uuid('eu-arch:entry');
update platform_private.cms_content_entries set lifecycle = 'held' where id = pg_temp.h11w_uuid('eu-held:entry');
update platform_private.cms_content_entries set lifecycle = 'archived' where id = pg_temp.h11w_uuid('eu-unpub:entry');
update platform_private.cms_content_entries set lifecycle = 'archived' where id = pg_temp.h11w_uuid('eu-noproof:entry');
update platform_private.cms_content_entries set lifecycle = 'archived' where id = pg_temp.h11w_uuid('eu-fence:entry');
select pg_temp.h11_raw_exec('platform_private.cms_content_entries', format(
  $$update platform_private.cms_content_entries set lifecycle = 'archived' where id = %L$$, pg_temp.h11w_uuid('eu-bare:entry')));
select platform_private.cms_invalidate_editorial_review(jsonb_build_object(
  'reviewId', pg_temp.s11_id('rv-eu-sup'), 'reasonCode', 'revision_superseded', 'correlationId', extensions.gen_random_uuid()));

select is(
  (select string_agg(tag || '=' || (pg_temp.p11_review(tag)).state, ';' order by tag)
     from (values ('eu-arch'), ('eu-held'), ('eu-unpub'), ('eu-bare'), ('eu-noproof'), ('eu-fence'), ('eu-sup'), ('eu-live')) as t(tag)),
  'eu-arch=invalidated;eu-bare=approved;eu-fence=invalidated;eu-held=invalidated;eu-live=approved;eu-noproof=invalidated;eu-sup=invalidated;eu-unpub=invalidated',
  'control: the lifecycle change invalidated the reviews entry_unavailable (not the bare one) and the superseding append the other [P2-S11-AC-083]');
select is(
  (select string_agg(key || '=' || pg_temp.p11_sched(key), ';' order by key)
     from (values ('s-eu-arch'), ('s-eu-held'), ('s-eu-unpub'), ('s-eu-bare'), ('s-eu-noproof'), ('s-eu-fence'), ('s-eu-sup'), ('s-eu-live'), ('s-eu-direct'), ('s-eu-pending')) as t(key)),
  's-eu-arch=executing/2/0/-/lease;s-eu-bare=executing/2/0/-/lease;s-eu-direct=executing/2/0/-/lease;s-eu-fence=executing/2/0/-/lease;s-eu-held=executing/2/0/-/lease;s-eu-live=executing/2/0/-/lease;s-eu-noproof=executing/2/0/-/lease;s-eu-pending=pending/1/0/-/-;s-eu-sup=executing/2/0/-/lease;s-eu-unpub=executing/2/0/-/lease',
  'control: the invalidation cancelled none of the claimed (executing) schedules, and the future one is still pending [P2-S11-AC-083]');
insert into r11_snap(label, effects) values ('before', pg_temp.p11_effects());
create temp table eu_counts(label text primary key, outbox bigint not null, audit_cancel bigint not null, audit_block bigint not null) on commit drop;
create or replace function pg_temp.eu_count(p_label text) returns void language sql as $body$
  insert into eu_counts select p_label,
    (select count(*) from platform_private.outbox_events where event_type like 'cms.%'),
    (select count(*) from audit_private.audit_events where action = 'cms.publication.schedule.cancel'),
    (select count(*) from audit_private.audit_events where action = 'cms.publication.schedule.block')
$body$;
select pg_temp.eu_count('before');

-- ---------------------------------------------------------------------------
-- The fence still comes first: a stale lease is refused and nothing changes, even for an unavailable entry.
-- ---------------------------------------------------------------------------
select pg_temp.p11_exec('fence', pg_temp.p11_xreq('s-eu-fence', jsonb_build_object('leaseId', extensions.gen_random_uuid())));
select ok(pg_temp.r11_out('fence') = 'P0001:CONFLICT' and pg_temp.p11_sched('s-eu-fence') = 'executing/2/0/-/lease'
    and pg_temp.p11_effects() = (select effects from r11_snap where label = 'before'),
  'a stale lease is refused CONFLICT with no effect even when the entry is unavailable: the fence precedes the cancellation [P2-S11-AC-083]');

-- ---------------------------------------------------------------------------
-- The cancellation.
-- ---------------------------------------------------------------------------
select pg_temp.p11_exec('arch', pg_temp.p11_xreq('s-eu-arch'));
select is(
  pg_temp.r11_out('arch') || '|' || coalesce(pg_temp.r11_resp('arch')->>'outcome', '-') || '|' || coalesce(pg_temp.r11_resp('arch')->>'reasonCode', '-')
    || '|' || coalesce(pg_temp.r11_keys(pg_temp.r11_resp('arch')), '-')
    || '|' || (pg_temp.r11_resp('arch')->>'scheduleId' = pg_temp.s11_id('s-eu-arch')::text)::text
    || '|' || (pg_temp.r11_resp('arch')->'publicationVersionId' = 'null'::jsonb and pg_temp.r11_resp('arch')->'actualUtc' = 'null'::jsonb
               and pg_temp.r11_resp('arch')->'deviationSeconds' = 'null'::jsonb)::text,
  '00000:|cancelled|entry_unavailable|actualUtc,deviationSeconds,outcome,publicationVersionId,reasonCode,scheduleId|true|true',
  'an executing schedule whose entry was archived after the claim is answered cancelled entry_unavailable with no publication evidence (BE03b CMS-03B-20) [P2-S11-AC-083]');
select is(pg_temp.p11_sched('s-eu-arch'), 'cancelled/3/0/entry_unavailable/-',
  'the schedule is cancelled in the executor''s own transaction: reason entry_unavailable, version + 1 (CAS), attempt count unchanged, lease released [P2-S11-AC-083]');
select ok(
  (select count(*) = 1 from audit_private.audit_events audit
    where audit.action = 'cms.publication.schedule.cancel' and audit.reason_code = 'CMS_PUBLICATION_SCHEDULE_CANCELLED'
      and audit.target_type = 'cms_publication_schedule' and audit.target_id = pg_temp.s11_id('s-eu-arch') and audit.actor_id is null)
    and (select count(*) = 0 from audit_private.audit_events audit
          where audit.action = 'cms.publication.schedule.block' and audit.target_id = pg_temp.s11_id('s-eu-arch')),
  'the cancellation writes exactly one audit record (no actor, no block record) [P2-S11-AC-083]');
select ok(
  (select effects from r11_snap where label = 'before') <> pg_temp.p11_effects()
    and not exists (select 1 from platform_private.cms_publication_versions where entry_id = pg_temp.h11w_uuid('eu-arch:entry'))
    and (select count(*) = 0 from platform_private.outbox_events
          where event_type = 'cms.publication.changed.v1' and payload->>'entryId' = pg_temp.h11w_uuid('eu-arch:entry')::text)
    and (select count(*) = 0 from platform_private.cms_command_accessibility_evidence
          where subject_id = pg_temp.s11_id('s-eu-arch')),
  'a cancelled execution appends no lineage row, emits no publication event and records no accessibility summary (no proof was verified) [P2-S11-AC-083]');
select pg_temp.eu_count('after-arch');
select ok(
  (select outbox from eu_counts where label = 'after-arch') = (select outbox from eu_counts where label = 'before')
    and (select audit_cancel from eu_counts where label = 'after-arch') = (select audit_cancel from eu_counts where label = 'before') + 1
    and (select audit_block from eu_counts where label = 'after-arch') = (select audit_block from eu_counts where label = 'before')
    and (pg_temp.p11_review('eu-arch')).state = 'invalidated' and (pg_temp.p11_review('eu-arch')).version = 3,
  'the cancellation emits no outbox event of its own (the invalidation already emitted the review event), writes one cancel and no block audit record, and leaves the review as the lifecycle invalidation left it [P2-S11-AC-083]');
insert into r11_snap(label, effects) values ('after-arch', pg_temp.p11_effects());

-- A cancelled schedule is terminal: a repeated execution is refused, and a later claim never takes it again.
select pg_temp.p11_exec('arch-again', pg_temp.p11_xreq('s-eu-arch', jsonb_build_object(
  'leaseId', pg_temp.p11_claimed('claim', 's-eu-arch')->>'leaseId', 'expectedVersion', pg_temp.p11_claimed('claim', 's-eu-arch')->>'scheduleVersion')));
select ok(pg_temp.r11_out('arch-again') = 'P0001:CONFLICT' and pg_temp.p11_sched('s-eu-arch') = 'cancelled/3/0/entry_unavailable/-'
    and pg_temp.p11_effects() = (select effects from r11_snap where label = 'after-arch'),
  'a cancelled schedule is terminal: a repeated execution is refused CONFLICT with no effect [P2-S11-AC-083]');

-- held, unpublish
select pg_temp.p11_exec('held', pg_temp.p11_xreq('s-eu-held'));
select ok(pg_temp.r11_resp('held')->>'outcome' = 'cancelled' and pg_temp.r11_resp('held')->>'reasonCode' = 'entry_unavailable'
    and pg_temp.p11_sched('s-eu-held') = 'cancelled/3/0/entry_unavailable/-',
  'an entry that is held (not active) cancels the claimed schedule entry_unavailable [P2-S11-AC-083]');
select pg_temp.p11_exec('unpub', pg_temp.p11_xreq('s-eu-unpub'));
select ok(pg_temp.r11_resp('unpub')->>'outcome' = 'cancelled' and pg_temp.r11_resp('unpub')->>'reasonCode' = 'entry_unavailable'
    and pg_temp.p11_sched('s-eu-unpub') = 'cancelled/3/0/entry_unavailable/-',
  'an unpublish schedule of an unavailable entry is cancelled entry_unavailable too: the action does not matter [P2-S11-AC-083]');

-- The entry check precedes the review re-read: the review is still approved here, so nothing else could cancel.
select pg_temp.p11_exec('bare', pg_temp.p11_xreq('s-eu-bare'));
select ok(pg_temp.r11_resp('bare')->>'outcome' = 'cancelled' and pg_temp.r11_resp('bare')->>'reasonCode' = 'entry_unavailable'
    and pg_temp.p11_sched('s-eu-bare') = 'cancelled/3/0/entry_unavailable/-'
    and (pg_temp.p11_review('eu-bare')).state = 'approved' and (pg_temp.p11_review('eu-bare')).version = 2,
  'the executor''s own entry check cancels the schedule even though the review is still approved, and it leaves the review untouched [P2-S11-AC-083]');

-- And it precedes the accessibility retry ladder: no proof at all still cancels.
select pg_temp.p11_exec('noproof', pg_temp.p11_xreq('s-eu-noproof', jsonb_build_object('evidence', null)));
select ok(pg_temp.r11_resp('noproof')->>'outcome' = 'cancelled' and pg_temp.p11_sched('s-eu-noproof') = 'cancelled/3/0/entry_unavailable/-',
  'an unavailable entry is cancelled before the preflight: absent proof is never the retry ladder for an entry that is gone [P2-S11-AC-083]');

-- ---------------------------------------------------------------------------
-- Controls: an entry that is still active keeps every earlier outcome.
-- ---------------------------------------------------------------------------
select pg_temp.p11_exec('sup', pg_temp.p11_xreq('s-eu-sup'));
select ok(pg_temp.r11_resp('sup')->>'outcome' = 'blocked' and pg_temp.r11_resp('sup')->>'reasonCode' = 'approval_invalidated'
    and pg_temp.p11_sched('s-eu-sup') = 'blocked/3/0/approval_invalidated/-',
  'an invalidated approval of an ACTIVE entry (a superseded revision) is still blocked approval_invalidated, not cancelled [P2-S11-AC-083]');
select pg_temp.p11_exec('live', pg_temp.p11_xreq('s-eu-live'));
select ok(pg_temp.r11_resp('live')->>'outcome' = 'completed' and pg_temp.p11_sched('s-eu-live') = 'completed/3/0/-/-'
    and pg_temp.p11_head('eu-live') <> '-',
  'a schedule of an active entry still completes and appends its lineage row [P2-S11-AC-083]');

select pg_temp.p11_claim('claim-2', '100'::jsonb);
select ok(not exists (
    select 1 from jsonb_array_elements(pg_temp.r11_resp('claim-2')) item
     where item->>'scheduleId' in (pg_temp.s11_id('s-eu-arch')::text, pg_temp.s11_id('s-eu-held')::text,
                                   pg_temp.s11_id('s-eu-unpub')::text, pg_temp.s11_id('s-eu-bare')::text,
                                   pg_temp.s11_id('s-eu-noproof')::text)),
  'a cancelled schedule is never claimed again [P2-S11-AC-083]');

-- ---------------------------------------------------------------------------
-- The cancel helper itself: the same closed reasons and the same fence as the block helper.
-- ---------------------------------------------------------------------------
select is(
  pg_temp.s11_outcome(format(
    $q$select platform_private.cms_schedule_cancel(%L::uuid, 2, 'preflight_failed', %L::uuid, null::uuid)$q$,
    pg_temp.s11_id('s-eu-direct'), extensions.gen_random_uuid())),
  'P0001:INVALID_REQUEST',
  'the cancel helper accepts only the closed cancellation reasons: a block reason is INVALID_REQUEST and nothing changes [P2-S11-AC-083]');
select is(
  pg_temp.s11_outcome(format(
    $q$select platform_private.cms_schedule_cancel(%L::uuid, 7, 'entry_unavailable', %L::uuid, null::uuid)$q$,
    pg_temp.s11_id('s-eu-direct'), extensions.gen_random_uuid())),
  'P0001:CONFLICT',
  'the cancel helper is a version CAS: a stale expected version is CONFLICT and nothing changes [P2-S11-AC-083]');
select is(pg_temp.p11_sched('s-eu-direct'), 'executing/2/0/-/lease',
  'the refused cancellations left the schedule executing at the claim''s version and lease [P2-S11-AC-083]');
select is(
  pg_temp.s11_outcome(format(
    $q$select platform_private.cms_schedule_cancel(%L::uuid, 1, 'entry_unavailable', %L::uuid, null::uuid)$q$,
    pg_temp.s11_id('s-eu-pending'), extensions.gen_random_uuid())),
  'P0001:CONFLICT', 'the cancel helper cancels only an executing schedule: a pending one is CONFLICT [P2-S11-AC-083]');
select is(
  pg_temp.s11_outcome(format(
    $q$select platform_private.cms_schedule_cancel(%L::uuid, 2, 'entry_unavailable', %L::uuid, null::uuid)$q$,
    pg_temp.s11_id('s-eu-direct'), extensions.gen_random_uuid())),
  '00000', 'the cancel helper cancels an executing schedule at its version [P2-S11-AC-083]');
select is(pg_temp.p11_sched('s-eu-direct'), 'cancelled/3/0/entry_unavailable/-',
  'the helper released the lease and set the closed reason [P2-S11-AC-083]');

select * from finish();
rollback;
