-- Slice 11 lane S11-3a: the accessibility audit summary of a command (DEC-159 (5), BE03b "Accessibility
-- provider (DEC-134, D25)": "the audit record of the command stores only { checkerKey, checkerVersion,
-- outcome, blockingCount, inputHash }").  audit_private.audit_events has no payload column and is never
-- altered, so the summary is a CMS-owned append-only side table,
-- platform_private.cms_command_accessibility_evidence, written in the command transaction whenever the
-- command received non-null PreflightEvidence (cms_submit_review here; S11-3b reuses the recorder
-- platform_private.cms_record_command_accessibility_evidence for schedule, publish and execute).  DEC-159 (5): the
-- summary is KEYED TO THE EXACT AUDIT EVENT of its command (audit_event_id: a unique foreign key to
-- audit_private.audit_events, written by the audit-returning helpers cms_record_audit_event / cms_emit_event_ids),
-- never joined by a correlation id that two commands can share; the outbox event is a separate, optional id.
-- RED before 20261005017635 / 20261005017640.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(40);

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
  'id,owner_id,state,version,operation_id,subject_id,revision_id,audit_event_id,outbox_event_id,correlation_id,checker_key,checker_version,outcome,blocking_count,input_hash,created_at,updated_at',
  'the columns are the envelope, the command reference (the exact audit event, the optional outbox event) and exactly the five summary members (no finding text, no binding hash) [P2-S11-AC-101]');
select ok(
  exists (select 1 from pg_constraint c
           where c.conrelid = 'platform_private.cms_command_accessibility_evidence'::regclass and c.contype = 'u'
             and c.conkey = array[(select attnum from pg_attribute where attrelid = 'platform_private.cms_command_accessibility_evidence'::regclass and attname = 'audit_event_id')])
    and exists (select 1 from pg_constraint c
                 where c.conrelid = 'platform_private.cms_command_accessibility_evidence'::regclass and c.contype = 'f'
                   and c.confrelid = 'audit_private.audit_events'::regclass
                   and c.conkey = array[(select attnum from pg_attribute where attrelid = 'platform_private.cms_command_accessibility_evidence'::regclass and attname = 'audit_event_id')])
    and exists (select 1 from pg_attribute where attrelid = 'platform_private.cms_command_accessibility_evidence'::regclass
                   and attname = 'audit_event_id' and attnotnull)
    and exists (select 1 from pg_attribute where attrelid = 'platform_private.cms_command_accessibility_evidence'::regclass
                   and attname = 'outbox_event_id' and not attnotnull),
  'the audit event id is NOT NULL, UNIQUE and a foreign key to audit_private.audit_events; the outbox event id is a separate nullable column [P2-S11-AC-101]');
select ok(pg_temp.s10r_closed_check_labels('platform_private.cms_command_accessibility_evidence', 'outcome') = array['blocked', 'failed', 'healthy']
    and pg_temp.s10r_closed_check_labels('platform_private.cms_command_accessibility_evidence', 'operation_id')
          = array['CMS-03B-05', 'CMS-03B-07', 'CMS-03B-09', 'CMS-03B-20'],
  'the outcome is the BE05c run state (healthy, blocked, failed) and the operation is one of the four evidence-carrying commands [P2-S11-AC-101]');
select ok(pg_temp.h11_private_definer('cms_record_command_accessibility_evidence(text,uuid,uuid,uuid,uuid,uuid,jsonb)')
    and pg_temp.h11_private_definer('cms_record_audit_event(text,uuid,uuid,text,uuid,text,uuid,uuid)')
    and pg_temp.h11_private_definer('cms_emit_event_ids(text,uuid,uuid,text,uuid,text,text,text,uuid,bigint,jsonb,uuid,uuid,uuid)'),
  'the recorder and the two audit-writing helpers are private SECURITY DEFINERs of the CMS definer with no API-role execute [P2-S11-AC-101]');
-- The helpers answer the EXACT ids of the rows they wrote (a caller may also choose the ids).
create temp table r11_helper_ids(label text primary key, ids jsonb not null) on commit drop;
select set_config('app.cms_rpc', 'true', true);
insert into r11_helper_ids(label, ids) values
  ('audit', jsonb_build_object('auditEventId', platform_private.cms_record_audit_event(
     'cms.test.audit', null, pg_temp.s11_id('org'), 'cms_test', extensions.gen_random_uuid(), 'CMS_TEST', extensions.gen_random_uuid()))),
  ('emit', platform_private.cms_emit_event_ids(
     'cms.test.emit', null, pg_temp.s11_id('org'), 'cms_test', extensions.gen_random_uuid(), 'CMS_TEST',
     'cms.entry.review-changed.v1', 'cms_editorial_review', extensions.gen_random_uuid(), 1,
     jsonb_build_object('reviewId', extensions.gen_random_uuid(), 'revisionId', extensions.gen_random_uuid()), extensions.gen_random_uuid()));
select ok(
  exists (select 1 from audit_private.audit_events audit
           where audit.id = (select (ids->>'auditEventId')::uuid from r11_helper_ids where label = 'audit') and audit.action = 'cms.test.audit'
             and audit.acting_party_id = pg_temp.s11_id('org') and audit.reason_code = 'CMS_TEST')
    and exists (select 1 from audit_private.audit_events audit
                 where audit.id = (select (ids->>'auditEventId')::uuid from r11_helper_ids where label = 'emit') and audit.action = 'cms.test.emit')
    and exists (select 1 from platform_private.outbox_events event
                 where event.id = (select (ids->>'outboxEventId')::uuid from r11_helper_ids where label = 'emit')
                   and event.event_type = 'cms.entry.review-changed.v1'),
  'cms_record_audit_event answers the exact id of the audit row it wrote; cms_emit_event_ids answers the exact audit and outbox ids of the pair it wrote [P2-S11-AC-101]');

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
  (select summary.outbox_event_id from platform_private.cms_command_accessibility_evidence summary)
     = (select event.id from platform_private.outbox_events event
         where event.event_type = 'cms.entry.review-changed.v1'
           and event.aggregate_id = (pg_temp.r11_resp('e1')->>'id')::uuid),
  'the row references the command''s outbox event in its own optional column [P2-S11-AC-101]');
select ok(
  (select summary.audit_event_id from platform_private.cms_command_accessibility_evidence summary)
     = (select audit.id from audit_private.audit_events audit
         where audit.action = 'cms.editorial.review.submit'
           and audit.target_id = (pg_temp.r11_resp('e1')->>'id')::uuid)
    and (select summary.correlation_id from platform_private.cms_command_accessibility_evidence summary)
     = (select audit.correlation_id from audit_private.audit_events audit
         where audit.action = 'cms.editorial.review.submit'
           and audit.target_id = (pg_temp.r11_resp('e1')->>'id')::uuid),
  'the row is keyed to the exact audit event of the command (audit_event_id), not by a shared correlation id [P2-S11-AC-101]');
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

-- A fresh audit event for a hand-built summary row (the foreign key needs a real one).
create or replace function pg_temp.r11_new_audit()
returns uuid language sql as $body$
  select platform_private.cms_record_audit_event(
    'cms.test.summary', null, pg_temp.s11_id('org'), 'cms_test', extensions.gen_random_uuid(), 'CMS_TEST', extensions.gen_random_uuid())
$body$;
create or replace function pg_temp.r11_summary_row(p_overrides jsonb default '{}'::jsonb)
returns jsonb language sql as $body$
  select jsonb_build_object(
    'id', extensions.gen_random_uuid(), 'owner_id', pg_temp.s11_id('org'), 'state', 'recorded', 'version', 1,
    'operation_id', 'CMS-03B-05', 'subject_id', extensions.gen_random_uuid(),
    'revision_id', pg_temp.h11w_uuid('ev-1:revision'), 'audit_event_id', pg_temp.r11_new_audit(), 'outbox_event_id', null,
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
select audit_event_id, outbox_event_id from platform_private.cms_command_accessibility_evidence limit 1;
select is(pg_temp.s11_bare_outcome('platform_private.cms_command_accessibility_evidence',
  pg_temp.s11_insert_sql('platform_private.cms_command_accessibility_evidence',
    pg_temp.r11_summary_row(jsonb_build_object('audit_event_id', (select audit_event_id from r11_known_event))))), '23505',
  'one summary per audit event: the audit event id is unique [P2-S11-AC-101]');
select is(pg_temp.s11_bare_outcome('platform_private.cms_command_accessibility_evidence',
  pg_temp.s11_insert_sql('platform_private.cms_command_accessibility_evidence',
    pg_temp.r11_summary_row(jsonb_build_object('outbox_event_id', (select outbox_event_id from r11_known_event))))), '23505',
  'one summary per outbox event: a present outbox event id is unique [P2-S11-AC-101]');
select is(pg_temp.s11_bare_outcome('platform_private.cms_command_accessibility_evidence',
  pg_temp.s11_insert_sql('platform_private.cms_command_accessibility_evidence',
    pg_temp.r11_summary_row(jsonb_build_object('audit_event_id', extensions.gen_random_uuid())))), '23503',
  'the summary names an existing audit event (foreign key) [P2-S11-AC-101]');
select is(pg_temp.s11_bare_outcome('platform_private.cms_command_accessibility_evidence',
  pg_temp.s11_insert_sql('platform_private.cms_command_accessibility_evidence',
    pg_temp.r11_summary_row(jsonb_build_object('audit_event_id', null)))), '23502',
  'the audit event id is required (NOT NULL) [P2-S11-AC-101]');
select is(pg_temp.s11_bare_outcome('platform_private.cms_command_accessibility_evidence',
  pg_temp.s11_insert_sql('platform_private.cms_command_accessibility_evidence',
    pg_temp.r11_summary_row(jsonb_build_object('revision_id', extensions.gen_random_uuid())))), '23503',
  'the summary names an existing revision (foreign key) [P2-S11-AC-101]');

-- The recorder: a null evidence is a no-op, a malformed one is refused.
select is(pg_temp.h11_text(format('select platform_private.cms_record_command_accessibility_evidence(%L, %L::uuid, %L::uuid, %L::uuid, %L::uuid, %L::uuid, null)',
  'CMS-03B-05', extensions.gen_random_uuid(), pg_temp.h11w_uuid('ev-1:revision'), pg_temp.r11_new_audit(), extensions.gen_random_uuid(), extensions.gen_random_uuid())),
  null, 'the recorder with no evidence writes nothing and answers null [P2-S11-AC-101]');
select is(pg_temp.h11_outcome(format('select platform_private.cms_record_command_accessibility_evidence(%L, %L::uuid, %L::uuid, %L::uuid, %L::uuid, %L::uuid, %L::jsonb)',
  'CMS-03B-05', extensions.gen_random_uuid(), pg_temp.h11w_uuid('ev-1:revision'), pg_temp.r11_new_audit(), extensions.gen_random_uuid(), extensions.gen_random_uuid(),
  '{"outcome":"healthy"}')), 'P0001:INVALID_REQUEST', 'the recorder refuses evidence that lacks a summary member [P2-S11-AC-101]');
select is(pg_temp.h11_outcome(format('select platform_private.cms_record_command_accessibility_evidence(%L, %L::uuid, %L::uuid, null, null, %L::uuid, %L::jsonb)',
  'CMS-03B-05', extensions.gen_random_uuid(), pg_temp.h11w_uuid('ev-1:revision'), extensions.gen_random_uuid(),
  jsonb_build_object('providerKey', 'cms.a11y.structural', 'providerVersion', '1', 'outcome', 'healthy', 'blockingCount', 0, 'inputHash', repeat('a', 64)))),
  'P0001:INVALID_REQUEST', 'the recorder refuses a summary that names no audit event [P2-S11-AC-101]');
select is((select count(*)::integer from platform_private.cms_command_accessibility_evidence), 1,
  'the refused recorder calls wrote nothing [P2-S11-AC-101]');

select * from finish();
rollback;
