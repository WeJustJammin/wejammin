-- Slice 11 criteria: the safe-read guarantee of CMS-03B-15, CMS-03B-16 and CMS-03B-17 (BE03b lines 2070 and 2134,
-- DEC "safe reads"; tracker P2-S11-AC-053, AC-058, AC-064; SQL review finding 14).  The older read suites bracket their
-- reads with `r11r_effects()`: row counts and version sums of a handful of tables, with the audit, outbox and
-- idempotency tables filtered by operation / event / action name and the settings snapshots, accessibility evidence
-- and revision tables absent.  A read that inserted a snapshot, rewrote a row at an unchanged count, or wrote a
-- differently named audit event or outbox event escapes it.  This suite brackets the same reads with the complete
-- fourteen-table whole-row digest (`c11_snapshot`, the SQL twin of the real-stack `snapshotDigest`) and proves that
-- oracle sees exactly what the old one cannot.
--   * the entry workflow read (draft, open, approved and scheduled entries; owner and publisher readers; a hidden
--     reader and a malformed request) leaves every durable-effect table byte-identical;
--   * the review detail read (owner and assigned reviewer; a hidden reader) and the review queue read (a page, its
--     continuation by the signed cursor; a hidden reader) likewise;
--   * sensitivity controls: a snapshot insertion, an in-place rewrite of an idempotency record at an unchanged
--     count and a renamed audit event each move the new digest while the old counters stay equal.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(18);

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
\ir phase_02_slice_11_rpc_reads/000-world.sqlinc
\ir phase_02_slice_11_criteria/000-effect-digest.sqlinc

create temp table r11_snap(label text primary key, effects text not null) on commit drop;

select vault.create_secret(repeat('a1', 32), 'cms_editorial_history_cursor_active', 'pgTAP transaction-only CMS-03B-17 test key');

-- Entries: se-draft (no review), se-open (open review, rvA assigned), se-appr (approved by rvA),
-- se-sched (approved by rvA, one pending publish schedule).
select pg_temp.r11_entry(tag) from (values ('se-draft'), ('se-open'), ('se-appr'), ('se-sched')) as t(tag);
select pg_temp.r11r_review('seo', 'se-open', 'editor');
select pg_temp.r11_assign_now('seo-rvA', 'seo', 'rvA');
select pg_temp.r11r_review('sea', 'se-appr', 'editor');
select pg_temp.r11_assign_now('sea-rvA', 'sea', 'rvA');
select pg_temp.r11_decide_now('sea-dec', 'sea', 'rvA', 'sea-rvA', 'approve');
select pg_temp.r11r_review('ses', 'se-sched', 'editor');
select pg_temp.r11_assign_now('ses-rvA', 'ses', 'rvA');
select pg_temp.r11_decide_now('ses-dec', 'ses', 'rvA', 'ses-rvA', 'approve');
select pg_temp.h11r_raw_insert('platform_private.cms_publication_schedules', pg_temp.s11_schedule_row(jsonb_build_object(
  'entry_id', pg_temp.h11w_uuid('se-sched:entry'), 'revision_id', pg_temp.h11w_uuid('se-sched:revision'), 'review_id', pg_temp.s11_id('ses'),
  'dependency_hash', (select dependency_hash from platform_private.cms_editorial_reviews where id = pg_temp.s11_id('ses')),
  'audience', 'public', 'state', 'pending', 'version', 1)));

create or replace function pg_temp.c11_wrq(p_tag text, p_extra jsonb default '{}'::jsonb)
returns jsonb language sql as $body$
  select jsonb_build_object('entryId', pg_temp.h11w_uuid(p_tag || ':entry'), 'context', pg_temp.r11_ctx(),
                            'evidence', pg_temp.r11_evidence(pg_temp.h11w_uuid(p_tag || ':revision'))) || p_extra
$body$;

create or replace function pg_temp.c11_statuses(p_prefix text)
returns text language sql stable as $body$
  select string_agg(label || '=' || pg_temp.r11_out(label), ' ' order by label) from r11_probe where label like p_prefix || '%'
$body$;

-- ---------------------------------------------------------------------------
-- CMS-03B-15: the entry workflow read.
-- ---------------------------------------------------------------------------
select pg_temp.c11_take('w');
insert into r11_snap(label, effects) values ('w', pg_temp.r11r_effects());
select pg_temp.r11r_call('w-draft', 'cms_get_entry_workflow', 'owner', pg_temp.c11_wrq('se-draft'));
select pg_temp.r11r_call('w-open', 'cms_get_entry_workflow', 'owner', pg_temp.c11_wrq('se-open'));
select pg_temp.r11r_call('w-appr', 'cms_get_entry_workflow', 'owner', pg_temp.c11_wrq('se-appr'));
select pg_temp.r11r_call('w-appr-pub', 'cms_get_entry_workflow', 'pub', pg_temp.c11_wrq('se-appr'));
select pg_temp.r11r_call('w-sched', 'cms_get_entry_workflow', 'owner', pg_temp.c11_wrq('se-sched'));
select pg_temp.r11r_call('w-open-rvA', 'cms_get_entry_workflow', 'rvA', pg_temp.c11_wrq('se-open'));
select pg_temp.r11r_call('w-hidden', 'cms_get_entry_workflow', 'stranger', pg_temp.c11_wrq('se-open'));
select pg_temp.r11r_call('w-bad', 'cms_get_entry_workflow', 'owner', pg_temp.c11_wrq('se-open', '{"limit":2}'));
select is(pg_temp.c11_statuses('w-'),
  'w-appr=00000: w-appr-pub=00000: w-bad=P0001:INVALID_REQUEST w-draft=00000: w-hidden=P0001:NOT_FOUND w-open=00000: w-open-rvA=00000: w-sched=00000:',
  'control: the workflow reads of the draft, open, approved and scheduled entries succeed, the hidden reader is NOT_FOUND and the malformed request INVALID_REQUEST [P2-S11-AC-053]');
select is(pg_temp.c11_delta('w'), '',
  'CMS-03B-15 left every one of the fourteen durable-effect tables byte-identical (no row, snapshot, evidence summary, audit, outbox or idempotency write, no value changed at an unchanged count) [P2-S11-AC-053]');

-- ---------------------------------------------------------------------------
-- CMS-03B-16: the review detail read.
-- ---------------------------------------------------------------------------
select pg_temp.c11_take('g');
select pg_temp.r11r_call('g-owner', 'cms_get_editorial_review', 'owner', jsonb_build_object('reviewId', pg_temp.s11_id('seo'), 'context', pg_temp.r11_ctx()));
select pg_temp.r11r_call('g-rvA', 'cms_get_editorial_review', 'rvA', jsonb_build_object('reviewId', pg_temp.s11_id('seo'), 'context', pg_temp.r11_ctx()));
select pg_temp.r11r_call('g-appr', 'cms_get_editorial_review', 'rvA', jsonb_build_object('reviewId', pg_temp.s11_id('sea'), 'context', pg_temp.r11_ctx()));
select pg_temp.r11r_call('g-hidden', 'cms_get_editorial_review', 'stranger', jsonb_build_object('reviewId', pg_temp.s11_id('seo'), 'context', pg_temp.r11_ctx()));
select is(pg_temp.c11_statuses('g-'), 'g-appr=00000: g-hidden=P0001:NOT_FOUND g-owner=00000: g-rvA=00000:',
  'control: the owner and the assigned reviewer read the review, the hidden reader is NOT_FOUND [P2-S11-AC-058]');
select is(pg_temp.c11_delta('g'), '',
  'CMS-03B-16 left every durable-effect table byte-identical [P2-S11-AC-058]');

-- ---------------------------------------------------------------------------
-- CMS-03B-17: the review queue read, a page and its continuation.
-- ---------------------------------------------------------------------------
select pg_temp.c11_take('l');
select pg_temp.r11r_call('l-1', 'cms_list_editorial_reviews', 'rvA', jsonb_build_object('context', pg_temp.r11_ctx(), 'limit', 1));
select pg_temp.r11r_call('l-2', 'cms_list_editorial_reviews', 'rvA',
  jsonb_build_object('context', pg_temp.r11_ctx(), 'limit', 1, 'cursor', pg_temp.r11_resp('l-1')->>'nextCursor'));
select pg_temp.r11r_call('l-all', 'cms_list_editorial_reviews', 'rvA', jsonb_build_object('context', pg_temp.r11_ctx()));
select pg_temp.r11r_call('l-hidden', 'cms_list_editorial_reviews', 'stranger', jsonb_build_object('context', pg_temp.r11_ctx()));
select is(pg_temp.c11_statuses('l-') || '|' || jsonb_array_length(pg_temp.r11_resp('l-1')->'items')::text || jsonb_array_length(pg_temp.r11_resp('l-2')->'items')::text
    || jsonb_array_length(pg_temp.r11_resp('l-all')->'items')::text || '|' || (pg_temp.r11_resp('l-1')->>'nextCursor' is not null),
  'l-1=00000: l-2=00000: l-all=00000: l-hidden=00000:|113|true',
  'control: the first page holds one of rvA''s three reviews and a cursor, the continuation one more, the unbounded page all three [P2-S11-AC-064]');
select is(pg_temp.c11_delta('l'), '',
  'CMS-03B-17 (a page, its signed-cursor continuation and a hidden reader) left every durable-effect table byte-identical [P2-S11-AC-064]');

-- ---------------------------------------------------------------------------
-- Oracle sensitivity: what the old r11r_effects() counters cannot see, the digest sees.
-- ---------------------------------------------------------------------------
select pg_temp.c11_take('e1');
insert into r11_snap(label, effects) values ('e1', pg_temp.r11r_effects());
select pg_temp.h11r_raw_insert('platform_private.cms_publication_settings_snapshots', jsonb_build_object(
  'id', extensions.gen_random_uuid(), 'owner_id', pg_temp.s11_id('org'), 'state', 'active', 'version', 1, 'ordinal', 2,
  'registry_version', 1, 'snapshot_hash', platform_private.cms_jcs_sha256('[{"k":1}]'::jsonb), 'effective_values', '[{"k":1}]'::jsonb,
  'created_at', timestamptz '2026-10-10T12:00:00Z', 'updated_at', timestamptz '2026-10-10T12:00:00Z'));
select is(pg_temp.c11_delta('e1') || '|' || (pg_temp.r11r_effects() = (select effects from r11_snap where label = 'e1'))::text,
  'cms_publication_settings_snapshots|true',
  'a settings snapshot insertion moves the digest of the snapshot table while the old counters stay equal [finding 14]');

select pg_temp.c11_take('e2');
insert into r11_snap(label, effects) values ('e2', pg_temp.r11r_effects());
select pg_temp.h11_raw_exec('platform_private.idempotency_records', $$
  update platform_private.idempotency_records set expires_at = expires_at + interval '1 second'
   where key_hash = (select key_hash from platform_private.idempotency_records where operation not like 'CMS-03B-%' limit 1)$$);
select is(pg_temp.c11_delta('e2') || '|' || (pg_temp.r11r_effects() = (select effects from r11_snap where label = 'e2'))::text,
  'idempotency_records|true',
  'an idempotency record rewritten in place (same count, an operation the old filter ignores: its expiry moved) moves the digest while the old counters stay equal [finding 14]');

select pg_temp.c11_take('e3');
insert into r11_snap(label, effects) values ('e3', pg_temp.r11r_effects());
select pg_temp.h11_raw_exec('audit_private.audit_events', $$
  update audit_private.audit_events set action = 'cms.zz.renamed'
   where id = (select id from audit_private.audit_events where action not like 'cms.editorial.review.%' limit 1)$$);
select is(pg_temp.c11_delta('e3') || '|' || (pg_temp.r11r_effects() = (select effects from r11_snap where label = 'e3'))::text,
  'audit_events|true',
  'an audit event renamed to something the old action filter ignores moves the digest while the old counters stay equal [finding 14]');

select * from finish();
rollback;
