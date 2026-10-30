-- Slice 12 race7: template activation versus block withdrawal under REAL concurrency (lane claude_s12_race7; BE03c "Authorization, persistence, and concurrency tests"
-- 1816-1820 "Template activation versus block withdrawal ... covered", the activation steps 1490 (4) "the subject hash, the policy basis and every dependency are rechecked
-- -- a difference commits the invalidation ... dependency_changed" and (5) "every input the template ... preflight reads (bound content types, block digest, nested
-- pattern states) is part of the frozen status of step (4)" (DEC-227); tracker P2-S12-AC-277).
-- A REAL approved template review freezes a REAL signed-registered block as a `block` dependency.  The activation (real platform_api.cms_activate_governed_subject, real
-- service_role) is held at the review row by a holder session; while it waits, the REAL signed CMS-03A-08 lifecycle commands (supported -> deprecated -> withdrawn) run from
-- other sessions and commit; when the holder releases, the activation resumes and its step (4) recheck sees the withdrawn block:
--   the outcome is deterministic: the committed refusal envelope { kind: 'refusal', reasonCode: 'dependency_changed' }, the review `invalidated`, the subject back to `draft`,
--   NO activation event and NO active version; the activation never succeeds on the stale block digest.
\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
commit;
\ir phase_02_slice_12_race7/000-harness.sqlinc
\ir phase_02_slice_12_race7/020-sys.sqlinc

create or replace function pg_temp.r7_review(p_review uuid) returns text language sql stable as $b$
  select state::text || ':' || version::text from platform_private.cms_governed_reviews where id = p_review $b$;
create or replace function pg_temp.r7_subject(p_subject uuid) returns text language sql stable as $b$
  select state::text from platform_private.cms_template_versions where id = p_subject $b$;
create or replace function pg_temp.r7_events(p_subject uuid) returns bigint language sql stable as $b$
  select count(*) from platform_private.outbox_events where aggregate_id = p_subject $b$;

do $snap$ begin perform pg_temp.r7_note('snapshot_rows', pg_temp.r7_snapshot()::text); end $snap$;

-- ------------------------------------------------------------------------------------------------ the committed world (real producers)
begin;
select no_plan();
\o /dev/null
\ir phase_02_slice_12_race7/010-governed-world.sqlinc
\ir phase_02_slice_09_p240/01-block.sqlinc
select pg_temp.p_register('gr:blk', pg_temp.p_block_request('gr.blk', 1, jsonb_build_object('compatibility',
  jsonb_build_object('minSchemaCompiler', '1', 'maxSchemaCompiler', '1'))));
select pg_temp.r7_note('block_registered', pg_temp.s09d_outcome('gr:blk'));
select pg_temp.s12ga_rpc('mint:bk1', 'platform_api.cms_define_template', 'owner', jsonb_build_object(
  'templateKey', 's12ga-bk1',
  'compatibleTypeIds', jsonb_build_array((select value::uuid from s12gov_ids where key = 'typeA')),
  'slots', jsonb_build_array(jsonb_build_object('key', 'primary', 'required', true,
    'allowedBlocks', jsonb_build_array(jsonb_build_object('blockKey', 'gr.blk', 'blockVersion', 1)), 'maxCount', 1)),
  'reservedRegions', jsonb_build_array('header', 'now', 'record', 'detail', 'provenance'),
  'bindings', '{}'::jsonb, 'locale', 'en-US', 'audience', 'public', 'expectedVersion', null,
  'idempotencyKey', 's12ga-mint-bk1'));
insert into s12gov_ids(key, value) values ('bk1:subject', pg_temp.s12ga_body('mint:bk1')->>'id') on conflict (key) do update set value = excluded.value;
select pg_temp.s12ga_submit('bk1', 'owner');
select pg_temp.s12ga_assign('as-bk1', 'owner', pg_temp.s12ga_review('bk1'), 'rev1', interval '20 hours');
select pg_temp.s12ga_decide('ap-bk1', 'rev1', pg_temp.s12ga_review('bk1'), 'approve');
select pg_temp.r7_note('bk1_review_state', (select state from platform_private.cms_governed_reviews where id = pg_temp.s12ga_review('bk1')));
select pg_temp.r7_note('bk1_block_deps', (select count(*)::text from platform_private.cms_governed_review_dependencies d
  where d.review_id = pg_temp.s12ga_review('bk1') and d.kind = 'block' and d.ref_id = (pg_temp.s09d_resp('gr:blk')->>'id')::uuid));
select pg_temp.r7_stash_act('bk1');
select pg_temp.r7_stash_sys('lc1', 'platform_api.cms_advance_block_lifecycle',
  pg_temp.p_lifecycle_request((pg_temp.s09d_resp('gr:blk')->>'id')::uuid, 'supported', 'deprecated'),
  jsonb_build_object('request.jwt.claims', '{"role":"service_role"}'));
select pg_temp.r7_stash_sys('lc2', 'platform_api.cms_advance_block_lifecycle',
  pg_temp.p_lifecycle_request((pg_temp.s09d_resp('gr:blk')->>'id')::uuid, 'deprecated', 'withdrawn'),
  jsonb_build_object('request.jwt.claims', '{"role":"service_role"}'));
\o
select pg_temp.r7_note('world_failed', num_failed()::text);
commit;

-- ------------------------------------------------------------------------------------------------ the scenario
set statement_timeout = 0;
do $scenario$
declare c text; review_id uuid; subject_id uuid;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', false);
  review_id := pg_temp.r7_get('review:bk1')::uuid; subject_id := pg_temp.r7_get('subject:bk1')::uuid;
  for c in select unnest(array['b', 'h', 'w']) loop perform pg_temp.r7_conn(c); end loop;
  perform pg_temp.r7_note('before', pg_temp.r7_review(review_id) || ' ' || pg_temp.r7_subject(subject_id) || ' events=' || pg_temp.r7_events(subject_id));
  perform pg_temp.r7_note('h', pg_temp.r7_hold_raw('h', format('perform 1 from platform_private.cms_governed_reviews where id = %L::uuid for update', review_id)));
  perform pg_temp.r7_send('b', 'act:bk1');
  perform pg_temp.r7_note('b_blocked_by_h', pg_temp.r7_blocked_by('b', 'h')::text);
  -- the block is deprecated and then withdrawn while the activation waits
  perform pg_temp.r7_send('w', 'lc1');
  perform pg_temp.r7_note('lc1', pg_temp.r7_collect('w', 15));
  perform pg_temp.r7_note('lc1_blocked_by_b', (pg_temp.r7_pid('b') = any(pg_catalog.pg_blocking_pids(pg_temp.r7_pid('w'))))::text);
  perform pg_temp.r7_send('w', 'lc2');
  perform pg_temp.r7_note('lc2', pg_temp.r7_collect('w', 15));
  perform pg_temp.r7_note('h_end', pg_temp.r7_end('h', 'rollback'));
  perform pg_temp.r7_note('b', pg_temp.r7_collect('b'));
  perform pg_temp.r7_note('after', pg_temp.r7_review(review_id) || ' ' || pg_temp.r7_subject(subject_id) || ' events=' || pg_temp.r7_events(subject_id));
  perform pg_temp.r7_note('active_versions', (select count(*)::text from platform_private.cms_template_versions
    where template_id = (select template_id from platform_private.cms_template_versions where id = subject_id) and state = 'active'));
  perform pg_temp.r7_cleanup(array['b', 'h', 'w']);
exception when others then
  perform pg_temp.r7_note('harness_error', sqlstate || ':' || sqlerrm);
  perform pg_temp.r7_cleanup(array['b', 'h', 'w']);
end;
$scenario$;
\ir phase_02_slice_12_race7/090-restore.sqlinc

-- ------------------------------------------------------------------------------------------------ assertions
select pg_temp.r7_diag('restore=' || coalesce(pg_temp.r7_get('restore'), '?') || ' off=' || coalesce(pg_temp.r7_get('restore_off'), '?') || ' on=' || coalesce(pg_temp.r7_get('restore_on'), '?') || ' missing_before=' || coalesce(pg_temp.r7_get('missing_before'), '?') || ' missing_where=' || coalesce(pg_temp.r7_get('missing_where'), '?') || ' added_where=' || coalesce(pg_temp.r7_get('added_where'), '?'));
select pg_temp.r7_is(pg_temp.r7_get('harness_error'), null, 'the committed-world harness ran the block withdrawal scenario without an error of its own [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('world_failed'), '0', 'the committed governed world built with no failed fixture assertion [P2-S12-AC-277]');
select pg_temp.r7_ok(pg_temp.r7_get('block_registered') = 'OK' and pg_temp.r7_get('bk1_review_state') = 'approved' and pg_temp.r7_get('bk1_block_deps') = '1',
  'fixture: the signed block is registered and the APPROVED template review froze it as exactly one block dependency [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('b_blocked_by_h'), 'true', 'the template activation is held at the review row by the holder session [P2-S12-AC-277]');
select pg_temp.r7_ok(pg_temp.r7_get('lc1') like 'ok:%' and pg_temp.r7_get('lc2') like 'ok:%' and pg_temp.r7_get('lc1_blocked_by_b') = 'false',
  'the signed CMS-03A-08 commands deprecate and then withdraw the block and commit while the activation waits (the activation holds no lock on the block) [P2-S12-AC-277]');
select pg_temp.r7_ok(pg_temp.r7_get('b') like 'ok:%' and (substr(pg_temp.r7_get('b'), 4)::jsonb)->>'kind' = 'refusal'
    and (substr(pg_temp.r7_get('b'), 4)::jsonb)->>'reasonCode' = 'dependency_changed',
  'the activation that resumes after the withdrawal answers the committed refusal envelope with reasonCode dependency_changed (409 GOVERNED_REVIEW_VERSION_CONFLICT at the Worker) [P2-S12-AC-277]');
select pg_temp.r7_ok(pg_temp.r7_get('before') = 'approved:2 approved events=0' and pg_temp.r7_get('after') like 'invalidated:3 draft events=0',
  'the review is invalidated (version + 1), the subject returns to draft and no activation event was emitted [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('active_versions'), '0', 'the template is never activated on the stale block digest: no version of the lineage is active [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('added_after_restore'), '0', 'cleanup: the harness removed every row the committed world and the scenario added (' || coalesce(pg_temp.r7_get('added_where'), '') || ') [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('missing_after_restore'), '0', 'cleanup: no pre-existing row was changed or removed [P2-S12-AC-277]');
select * from pg_temp.r7_finish();
