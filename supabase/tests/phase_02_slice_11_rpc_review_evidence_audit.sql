-- Slice 11 lane S11-3a: the accessibility audit summary of a command (DEC-159 (5), BE03b "Accessibility
-- provider (DEC-134, D25)": "the audit record of the command stores only { checkerKey, checkerVersion,
-- outcome, blockingCount, inputHash }").  audit_private.audit_events has no payload column and is never
-- altered, so the summary is a CMS-owned append-only side table,
-- platform_private.cms_command_accessibility_evidence, written in the command transaction whenever the
-- command received non-null PreflightEvidence (cms_submit_review here; S11-3b reuses the recorder
-- platform_private.cms_record_command_accessibility_evidence for schedule, publish and execute).
-- RED before 20261005017635 / 20261005017640.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(34);

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

create temp table r11_req(label text primary key, request jsonb not null) on commit drop;

select pg_temp.r11_entry(tag) from (values ('ev-1'), ('ev-block'), ('ev-null'), ('ev-failed')) as t(tag);

-- ---------------------------------------------------------------------------
-- The table: private, forced RLS, append-only, closed.
-- ---------------------------------------------------------------------------
select ok(to_regclass('platform_private.cms_command_accessibility_evidence') is not null,
  'the accessibility audit summary table exists in the private schema [P2-S11-AC-101]');
select ok(pg_temp.s11_rls_forced('platform_private.cms_command_accessibility_evidence')
    and pg_temp.s11_api_privileges('platform_private.cms_command_accessibility_evidence') = ''
    and pg_temp.s11_policies('platform_private.cms_command_accessibility_evidence') = 'cms_command_accessibility_evidence_rpc_policy',
  'RLS is enabled and forced, anon / authenticated / service_role hold no privilege and the only policy is the CMS RPC-context gate [P2-S11-AC-101]');
select is(pg_temp.s11_triggers('platform_private.cms_command_accessibility_evidence'),
  'cms_command_accessibility_evidence_immutable_guard:cms_immutable_guard:27,cms_command_accessibility_evidence_write_guard:cms_write_guard:7',
  'the table carries exactly the write guard and the append-only guard [P2-S11-AC-101]');
select is(
  (select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns
    where table_schema = 'platform_private' and table_name = 'cms_command_accessibility_evidence'),
  'id,owner_id,state,version,operation_id,subject_id,revision_id,event_id,correlation_id,checker_key,checker_version,outcome,blocking_count,input_hash,created_at,updated_at',
  'the columns are the envelope, the command reference and exactly the five summary members (no finding text, no binding hash) [P2-S11-AC-101]');
select ok(pg_temp.s10r_closed_check_labels('platform_private.cms_command_accessibility_evidence', 'outcome') = array['blocked', 'failed', 'healthy']
    and pg_temp.s10r_closed_check_labels('platform_private.cms_command_accessibility_evidence', 'operation_id')
          = array['CMS-03B-05', 'CMS-03B-07', 'CMS-03B-09', 'CMS-03B-20'],
  'the outcome is the BE05c run state (healthy, blocked, failed) and the operation is one of the four evidence-carrying commands [P2-S11-AC-101]');
select ok(pg_temp.h11_private_definer('cms_record_command_accessibility_evidence(text,uuid,uuid,uuid,uuid,jsonb)'),
  'the recorder is a private SECURITY DEFINER of the CMS definer with no API-role execute [P2-S11-AC-101]');

-- ---------------------------------------------------------------------------
-- Written by cms_submit_review whenever evidence is non-null.
-- ---------------------------------------------------------------------------
insert into r11_req(label, request) values ('e1', pg_temp.r11_sreq('ev-1'));
select pg_temp.r11_scall('e1', 'owner', (select request from r11_req where label = 'e1'));
select is(pg_temp.r11_out('e1'), '00000:', 'control: the submission with healthy evidence commits');
select is((select count(*)::integer from platform_private.cms_command_accessibility_evidence), 1,
  'exactly one summary row is written for the submission [P2-S11-AC-101]');
select ok(
  exists (
    select 1 from platform_private.cms_command_accessibility_evidence summary
     where summary.operation_id = 'CMS-03B-05'
       and summary.subject_id = (pg_temp.r11_resp('e1')->>'id')::uuid
       and summary.revision_id = pg_temp.h11w_uuid('ev-1:revision')
       and summary.owner_id = pg_temp.s11_id('org')
       and summary.state = 'recorded' and summary.version = 1 and summary.updated_at = summary.created_at
       and summary.checker_key = 'cms.a11y.structural' and summary.checker_version = 1
       and summary.outcome = 'healthy' and summary.blocking_count = 0
       and summary.input_hash = (select request->'evidence'->>'inputHash' from r11_req where label = 'e1')),
  'the row stores the command, the review, the revision, the owner and exactly {checkerKey, checkerVersion, outcome, blockingCount, inputHash} [P2-S11-AC-101]');
select ok(
  (select summary.event_id from platform_private.cms_command_accessibility_evidence summary)
     = (select event.id from platform_private.outbox_events event
         where event.event_type = 'cms.entry.review-changed.v1'
           and event.aggregate_id = (pg_temp.r11_resp('e1')->>'id')::uuid),
  'the row references the command''s outbox event [P2-S11-AC-101]');
select ok(
  (select summary.correlation_id from platform_private.cms_command_accessibility_evidence summary)
     = (select audit.correlation_id from audit_private.audit_events audit
         where audit.action = 'cms.editorial.review.submit'
           and audit.target_id = (pg_temp.r11_resp('e1')->>'id')::uuid),
  'the row carries the correlation id of the command''s audit record, which is how the summary is joined to it [P2-S11-AC-101]');
select ok(not pg_temp.r11_leaks(pg_temp.r11_resp('e1'), array[
    (select request->'evidence'->>'inputHash' from r11_req where label = 'e1'),
    (select request->'evidence'->>'bindingHash' from r11_req where label = 'e1')]),
  'the review response does not echo the evidence hashes [P2-S11-AC-101]');
select pg_temp.r11_scall('e1-replay', 'owner', (select request from r11_req where label = 'e1'));
select ok(pg_temp.r11_out('e1-replay') = '00000:'
    and (select count(*)::integer from platform_private.cms_command_accessibility_evidence) = 1,
  'an exact replay writes no second summary row [P2-S11-AC-101]');

-- A refused command leaves no summary row; a command with no evidence cannot succeed, so none is written.
select pg_temp.r11_scall('e-blocked', 'owner', pg_temp.r11_sreq('ev-block', jsonb_build_object('evidence',
  pg_temp.r11_evidence(pg_temp.h11w_uuid('ev-block:revision'), 'blocked'))));
select pg_temp.r11_scall('e-failed', 'owner', pg_temp.r11_sreq('ev-failed', jsonb_build_object('evidence',
  pg_temp.r11_evidence(pg_temp.h11w_uuid('ev-failed:revision'), 'failed'))));
select pg_temp.r11_scall('e-null', 'owner', pg_temp.r11_sreq('ev-null', jsonb_build_object('evidence', null)));
select is(pg_temp.r11_out('e-blocked') || '|' || pg_temp.r11_out('e-failed') || '|' || pg_temp.r11_out('e-null'),
  'P0001:preflight_failed|P0001:DEPENDENCY_UNAVAILABLE|P0001:DEPENDENCY_UNAVAILABLE',
  'control: blocked evidence fails the preflight, a failed run and absent evidence are unavailable [P2-S11-AC-101]');
select is((select count(*)::integer from platform_private.cms_command_accessibility_evidence), 1,
  'the refused commands (blocked, failed run, no evidence) wrote no summary row [P2-S11-AC-101]');

-- ---------------------------------------------------------------------------
-- Append-only and closed.
-- ---------------------------------------------------------------------------
select set_config('app.cms_rpc', 'true', true);
select is(pg_temp.s11_outcome('update platform_private.cms_command_accessibility_evidence set outcome = ''blocked'''),
  'P0001:IMMUTABLE_RECORD', 'a summary row is never updated [P2-S11-AC-101]');
select is(pg_temp.s11_outcome('delete from platform_private.cms_command_accessibility_evidence'),
  'P0001:IMMUTABLE_RECORD', 'a summary row is never deleted [P2-S11-AC-101]');
select set_config('app.cms_rpc', '', true);
select is(pg_temp.s11_outcome('insert into platform_private.cms_command_accessibility_evidence default values'),
  'P0001:DIRECT_CMS_TABLE_WRITE', 'a write outside the CMS RPC context is refused before any constraint [P2-S11-AC-101]');
select set_config('app.cms_rpc', 'true', true);

create or replace function pg_temp.r11_summary_row(p_overrides jsonb default '{}'::jsonb)
returns jsonb language sql as $body$
  select jsonb_build_object(
    'id', extensions.gen_random_uuid(), 'owner_id', pg_temp.s11_id('org'), 'state', 'recorded', 'version', 1,
    'operation_id', 'CMS-03B-05', 'subject_id', extensions.gen_random_uuid(),
    'revision_id', pg_temp.h11w_uuid('ev-1:revision'), 'event_id', extensions.gen_random_uuid(),
    'correlation_id', extensions.gen_random_uuid(), 'checker_key', 'cms.a11y.structural', 'checker_version', 1,
    'outcome', 'healthy', 'blocking_count', 0, 'input_hash', repeat('a', 64),
    'created_at', timestamptz '2026-10-08T12:00:00Z', 'updated_at', timestamptz '2026-10-08T12:00:00Z') || p_overrides
$body$;
select is(pg_temp.s11_bare_outcome('platform_private.cms_command_accessibility_evidence',
  pg_temp.s11_insert_sql('platform_private.cms_command_accessibility_evidence', pg_temp.r11_summary_row())), '00000',
  'control: a well-formed summary row is accepted (so the refusals below are about the member under test)');
select is(
  (select string_agg(label || '=' || pg_temp.s11_bare_outcome('platform_private.cms_command_accessibility_evidence',
      pg_temp.s11_insert_sql('platform_private.cms_command_accessibility_evidence', pg_temp.r11_summary_row(overrides))), ';' order by label)
     from (values
       ('outcome', '{"outcome":"stale"}'::jsonb), ('operation', '{"operation_id":"CMS-03B-06"}'::jsonb),
       ('blocking', '{"blocking_count":1001}'::jsonb), ('negative', '{"blocking_count":-1}'::jsonb),
       ('hash', '{"input_hash":"ABC"}'::jsonb), ('checker', '{"checker_key":"Bad Key"}'::jsonb),
       ('version', '{"checker_version":0}'::jsonb), ('state', '{"state":"active"}'::jsonb),
       ('time', '{"updated_at":"2026-10-08T12:00:01Z"}'::jsonb)) as v(label, overrides)
    where pg_temp.s11_bare_outcome('platform_private.cms_command_accessibility_evidence',
      pg_temp.s11_insert_sql('platform_private.cms_command_accessibility_evidence', pg_temp.r11_summary_row(overrides))) = '00000'),
  null,
  'an unknown outcome or operation, an out-of-range count, a malformed hash or checker key, a zero version, another state and an updated_at that differs from created_at are each refused by a CHECK [P2-S11-AC-101]');
create temp table r11_known_event on commit drop as
select event_id from platform_private.cms_command_accessibility_evidence limit 1;
select is(pg_temp.s11_bare_outcome('platform_private.cms_command_accessibility_evidence',
  pg_temp.s11_insert_sql('platform_private.cms_command_accessibility_evidence',
    pg_temp.r11_summary_row(jsonb_build_object('event_id', (select event_id from r11_known_event))))), '23505',
  'one summary per command event: the event id is unique [P2-S11-AC-101]');
select is(pg_temp.s11_bare_outcome('platform_private.cms_command_accessibility_evidence',
  pg_temp.s11_insert_sql('platform_private.cms_command_accessibility_evidence',
    pg_temp.r11_summary_row(jsonb_build_object('revision_id', extensions.gen_random_uuid())))), '23503',
  'the summary names an existing revision (foreign key) [P2-S11-AC-101]');

-- The recorder: a null evidence is a no-op, a malformed one is refused.
select is(pg_temp.h11_text(format('select platform_private.cms_record_command_accessibility_evidence(%L, %L::uuid, %L::uuid, %L::uuid, %L::uuid, null)',
  'CMS-03B-05', extensions.gen_random_uuid(), pg_temp.h11w_uuid('ev-1:revision'), extensions.gen_random_uuid(), extensions.gen_random_uuid())),
  null, 'the recorder with no evidence writes nothing and answers null [P2-S11-AC-101]');
select is(pg_temp.h11_outcome(format('select platform_private.cms_record_command_accessibility_evidence(%L, %L::uuid, %L::uuid, %L::uuid, %L::uuid, %L::jsonb)',
  'CMS-03B-05', extensions.gen_random_uuid(), pg_temp.h11w_uuid('ev-1:revision'), extensions.gen_random_uuid(), extensions.gen_random_uuid(),
  '{"outcome":"healthy"}')), 'P0001:INVALID_REQUEST', 'the recorder refuses evidence that lacks a summary member [P2-S11-AC-101]');
select is((select count(*)::integer from platform_private.cms_command_accessibility_evidence), 1,
  'the refused recorder calls wrote nothing [P2-S11-AC-101]');

select * from finish();
rollback;
