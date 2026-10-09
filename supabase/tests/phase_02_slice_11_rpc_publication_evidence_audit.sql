-- Slice 11 lane S11-3b: the accessibility audit summary of the schedule, publication and execution commands
-- (DEC-159 (5), BE03b "Accessibility provider (DEC-134, D25)": the audit record of the command stores only
-- { checkerKey, checkerVersion, outcome, blockingCount, inputHash }; tracker P2-S11-AC-101).  The summary is
-- the CMS-owned append-only side table platform_private.cms_command_accessibility_evidence, written through
-- S11-3a's recorder in the command transaction whenever a VERIFIED non-null proof was received:
--   CMS-03B-07 (no event exists until execution: a fresh effect id),
--   CMS-03B-09 (the publication event it accompanied),
--   CMS-03B-20 (the publication event when completed, a fresh effect id when blocked or retried).
-- A refused command rolls back with its summary; stale, mis-bound or absent proof is never summarized.
-- RED before the recorder calls of 20261005017710 / 017720 / 017740.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(23);

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

-- One summary row of a subject as 'operation/outcome/blockingCount/checker@version' ('-' when none).
create or replace function pg_temp.p11_summary(p_subject uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $body$
  select coalesce((
    select string_agg(summary.operation_id || '/' || summary.outcome || '/' || summary.blocking_count || '/'
                       || summary.checker_key || '@' || summary.checker_version, ',' order by summary.created_at, summary.id)
      from platform_private.cms_command_accessibility_evidence summary where summary.subject_id = p_subject), '-')
$body$;

select pg_temp.p11_approved(tag) from (values ('ea-sched'), ('ea-pub'), ('ea-done'), ('ea-block'), ('ea-retry'), ('ea-null'),
  ('ea-stale'), ('ea-refused'), ('ea-media')) as t(tag);
select pg_temp.h11w_value(pg_temp.h11w_uuid('ea-media:revision'), 'hero',
  jsonb_build_object('assetId', 'a9200000-0000-4000-8000-0000000000a1', 'assetVersion', '1'));

-- ---------------------------------------------------------------------------
-- CMS-03B-07: one summary row against the schedule, no event.
-- ---------------------------------------------------------------------------
insert into r11_req(label, request) values ('s1', pg_temp.p11_sreq('ea-sched'));
select pg_temp.p11_call('s1', 'pub', 'cms_schedule_publication', (select request from r11_req where label = 's1'));
select is(pg_temp.r11_out('s1'), '00000:', 'control: the schedule commits with healthy proof');
select is(pg_temp.p11_summary((pg_temp.r11_resp('s1')->>'id')::uuid), 'CMS-03B-07/healthy/0/cms.a11y.structural@1',
  'the schedule wrote exactly one summary row: operation, outcome, blocking count, checker key and version [P2-S11-AC-101]');
select ok(
  exists (
    select 1 from platform_private.cms_command_accessibility_evidence summary
     where summary.subject_id = (pg_temp.r11_resp('s1')->>'id')::uuid
       and summary.revision_id = pg_temp.h11w_uuid('ea-sched:revision') and summary.owner_id = pg_temp.s11_id('org')
       and summary.input_hash = (select request->'evidence'->>'inputHash' from r11_req where label = 's1')
       and summary.state = 'recorded' and summary.version = 1 and summary.updated_at = summary.created_at
       and summary.correlation_id = (select audit.correlation_id from audit_private.audit_events audit
                                      where audit.action = 'cms.publication.schedule'
                                        and audit.target_id = (pg_temp.r11_resp('s1')->>'id')::uuid)),
  'the row is owner-scoped, carries the proof''s input hash and joins the command''s audit record by correlation id [P2-S11-AC-101]');
select ok(
  not pg_temp.r11_leaks(pg_temp.r11_resp('s1'), array[
    (select request->'evidence'->>'inputHash' from r11_req where label = 's1'),
    (select request->'evidence'->>'bindingHash' from r11_req where label = 's1')]),
  'the schedule resource does not echo the proof''s hashes [P2-S11-AC-101]');
select pg_temp.p11_call('s1-replay', 'pub', 'cms_schedule_publication', (select request from r11_req where label = 's1'));
select is((select count(*)::integer from platform_private.cms_command_accessibility_evidence), 1,
  'an exact replay writes no second summary row [P2-S11-AC-101]');

-- A refused command leaves no summary row (a stale / mis-bound / absent proof is not verified, so never summarized).
select pg_temp.p11_call('r-null', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('ea-refused', jsonb_build_object('evidence', null)), false);
select pg_temp.p11_call('r-stale', 'pub', 'cms_schedule_publication',
  pg_temp.p11_sreq('ea-refused', '{}'::jsonb, '{}'::text[], pg_temp.r11_evidence(pg_temp.h11w_uuid('ea-refused:revision'), 'healthy', interval '90 seconds')), false);
select pg_temp.p11_call('r-bound', 'pub', 'cms_schedule_publication',
  pg_temp.p11_sreq('ea-refused', '{}'::jsonb, '{}'::text[],
    pg_temp.r11_evidence(pg_temp.h11w_uuid('ea-refused:revision'), 'healthy', interval '0 seconds', jsonb_build_object('bindingHash', repeat('2', 64)))), false);
select pg_temp.p11_call('r-blocked', 'pub', 'cms_schedule_publication',
  pg_temp.p11_sreq('ea-refused', '{}'::jsonb, '{}'::text[], pg_temp.r11_evidence(pg_temp.h11w_uuid('ea-refused:revision'), 'blocked')), false);
select pg_temp.p11_call('r-media', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('ea-media'), false);
select ok(
  pg_temp.r11_out('r-null') = 'P0001:DEPENDENCY_UNAVAILABLE' and pg_temp.r11_out('r-stale') = 'P0001:preflight_evidence_stale'
    and pg_temp.r11_out('r-bound') = 'P0001:dependency_changed' and pg_temp.r11_out('r-blocked') = 'P0001:preflight_failed'
    and pg_temp.r11_out('r-media') = 'P0001:preflight_failed'
    and (select count(*)::integer from platform_private.cms_command_accessibility_evidence) = 1,
  'refused schedules (absent, stale, mis-bound or blocked proof, another failed category) write no summary row: the rows roll back with the command [P2-S11-AC-101]');

-- ---------------------------------------------------------------------------
-- CMS-03B-09: the row names the publication event.
-- ---------------------------------------------------------------------------
insert into r11_req(label, request) values ('p1', pg_temp.p11_preq('ea-pub'));
select pg_temp.p11_call('p1', 'pub', 'cms_publish_revision', (select request from r11_req where label = 'p1'));
select is(pg_temp.p11_summary((pg_temp.r11_resp('p1')->>'publicationVersionId')::uuid), 'CMS-03B-09/healthy/0/cms.a11y.structural@1',
  'the publication wrote exactly one summary row against the lineage row [P2-S11-AC-101]');
select ok(
  (select summary.event_id from platform_private.cms_command_accessibility_evidence summary
    where summary.subject_id = (pg_temp.r11_resp('p1')->>'publicationVersionId')::uuid)
    = (select event.id from platform_private.outbox_events event
        where event.event_type = 'cms.publication.changed.v1' and event.aggregate_id = (pg_temp.r11_resp('p1')->>'id')::uuid)
  and (select summary.correlation_id from platform_private.cms_command_accessibility_evidence summary
        where summary.subject_id = (pg_temp.r11_resp('p1')->>'publicationVersionId')::uuid)
    = (select audit.correlation_id from audit_private.audit_events audit
        where audit.action = 'cms.publication.publish' and audit.target_id = (pg_temp.r11_resp('p1')->>'publicationVersionId')::uuid),
  'the row references the publication''s outbox event and joins its audit record by correlation id [P2-S11-AC-101]');
select pg_temp.p11_call('p1-replay', 'pub', 'cms_publish_revision', (select request from r11_req where label = 'p1'));
select is((select count(*)::integer from platform_private.cms_command_accessibility_evidence where operation_id = 'CMS-03B-09'), 1,
  'an exact replay of the publication writes no second summary row [P2-S11-AC-101]');

-- ---------------------------------------------------------------------------
-- CMS-03B-20: whichever way a verified proof ends the execution.
-- ---------------------------------------------------------------------------
select pg_temp.p11_schedule_row('s-done', 'ea-done');
select pg_temp.p11_schedule_row('s-block', 'ea-block', jsonb_build_object('action', 'unpublish'));
select pg_temp.p11_schedule_row('s-retry', 'ea-retry');
select pg_temp.p11_schedule_row('s-null', 'ea-null');
select pg_temp.p11_schedule_row('s-stale', 'ea-stale');
select pg_temp.p11_schedule_row('s-media', 'ea-media');
select pg_temp.p11_claim('claim', '100'::jsonb);
select pg_temp.p11_exec('x-done', pg_temp.p11_xreq('s-done'));
select pg_temp.p11_exec('x-block', pg_temp.p11_xreq('s-block'));
select pg_temp.p11_exec('x-retry', pg_temp.p11_xreq('s-retry', '{}'::jsonb, '{}'::text[], pg_temp.r11_evidence(pg_temp.h11w_uuid('ea-retry:revision'), 'failed')));
select pg_temp.p11_exec('x-null', pg_temp.p11_xreq('s-null', jsonb_build_object('evidence', null)));
select pg_temp.p11_exec('x-stale', pg_temp.p11_xreq('s-stale', '{}'::jsonb, '{}'::text[],
  pg_temp.r11_evidence(pg_temp.h11w_uuid('ea-stale:revision'), 'healthy', interval '90 seconds')));
select pg_temp.p11_exec('x-media', pg_temp.p11_xreq('s-media', '{}'::jsonb, '{}'::text[], pg_temp.r11_evidence(pg_temp.h11w_uuid('ea-media:revision'), 'blocked')));
select is(
  (pg_temp.r11_resp('x-done')->>'outcome') || '|' || (pg_temp.r11_resp('x-block')->>'outcome') || '|' || (pg_temp.r11_resp('x-retry')->>'outcome')
    || '|' || (pg_temp.r11_resp('x-null')->>'outcome') || '|' || (pg_temp.r11_resp('x-stale')->>'outcome') || '|' || (pg_temp.r11_resp('x-media')->>'outcome'),
  'completed|blocked|failed_retryable|failed_retryable|failed_retryable|blocked',
  'control: a completed, a blocked (publication_not_active), a retried (failed run), an unproven, a stale-proof and a failed-category execution');
select is(pg_temp.p11_summary(pg_temp.s11_id('s-done')) || '|' || pg_temp.p11_summary(pg_temp.s11_id('s-block')) || '|'
    || pg_temp.p11_summary(pg_temp.s11_id('s-retry')) || '|' || pg_temp.p11_summary(pg_temp.s11_id('s-media')),
  'CMS-03B-20/healthy/0/cms.a11y.structural@1|CMS-03B-20/healthy/0/cms.a11y.structural@1|CMS-03B-20/failed/0/cms.a11y.structural@1|CMS-03B-20/blocked/2/cms.a11y.structural@1',
  'a verified proof is summarized whether the execution completes, blocks or retries: healthy, healthy, failed and blocked (two findings) [P2-S11-AC-101]');
select is(pg_temp.p11_summary(pg_temp.s11_id('s-null')) || '|' || pg_temp.p11_summary(pg_temp.s11_id('s-stale')), '-|-',
  'absent proof and stale proof are never summarized (nothing was verified) [P2-S11-AC-101]');
select ok(
  (select summary.event_id from platform_private.cms_command_accessibility_evidence summary where summary.subject_id = pg_temp.s11_id('s-done'))
    = (select event.id from platform_private.outbox_events event
        where event.event_type = 'cms.publication.changed.v1' and event.aggregate_id = (
          select row_item.publication_id from platform_private.cms_publication_versions row_item where row_item.schedule_id = pg_temp.s11_id('s-done')))
  and (select count(distinct summary.event_id) = 4 from platform_private.cms_command_accessibility_evidence summary
        where summary.operation_id = 'CMS-03B-20'),
  'a completed execution''s row names the publication event; the blocked and retried outcomes (no event) carry distinct effect ids, one summary per outcome [P2-S11-AC-101]');
select pg_temp.p11_exec('x-done-again', pg_temp.p11_xreq('s-done'));
select is((select count(*)::integer from platform_private.cms_command_accessibility_evidence where operation_id = 'CMS-03B-20'), 4,
  'a repeated execution (already_completed) writes no further summary row [P2-S11-AC-101]');

select * from finish();
rollback;
