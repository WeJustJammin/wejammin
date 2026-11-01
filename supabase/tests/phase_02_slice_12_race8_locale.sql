-- Slice 12 race8: CMS-03C-04 locale translation versus a SOURCE-LOCALE EDIT, both orders (lane claude_s12_db8; BE03c concurrency tests 1817 "locale source edit
-- versus translation", CMS-03C-04 route row 166 "CAS source/entry", transaction 1698 and the source-change fan-out 1393/1579; tracker P2-S12-AC-277).
-- Both commands are real (platform_api.cms_author_locale_variant, platform_api.cms_create_revision) under service_role on dblink sessions, the first one held
-- open as the lock holder; both lock the entry row first and both advance the entry aggregate version, so exactly one commits and the other is the typed
-- 409 VERSION_MISMATCH; the loser retried against the state the winner left then commits and the fan-out leaves the honest stale row.
--   E1  the source edit holds the entry; the translation (fr-FR of the first revision, entry version 1) waits, then is VERSION_MISMATCH and writes nothing;
--       the retry on the new source revision and hash commits a draft variant pinned to the NEW source revision
--   E2  the translation holds the entry; the source edit (version 1) waits, then is VERSION_MISMATCH and writes nothing; the head still points at the
--       first revision and the variant is a draft; the retry at the new version commits, moves the head and appends the STALE variant row
--       (stale field ids = the translated field) with its own localization event
\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
commit;
\ir phase_02_slice_12_race7/000-harness.sqlinc
\ir phase_02_slice_12_race8/030-create-helpers.sqlinc
\ir phase_02_slice_12_race8/060-locale-helpers.sqlinc

do $snap$ begin perform pg_temp.r7_note('snapshot_rows', pg_temp.r7_snapshot()::text); end $snap$;

-- ------------------------------------------------------------------------------------------------ the committed world (real producers)
begin;
select no_plan();
\o /dev/null
\ir phase_02_slice_12_race8/020-edtl-world.sqlinc
\ir phase_02_slice_12_race8/050-locale-world.sqlinc
\o
select pg_temp.r7_note('world_failed', num_failed()::text);
commit;

-- ------------------------------------------------------------------------------------------------ the scenarios
set statement_timeout = 0;
do $scenario$
declare
  c text; l1 uuid; l2 uuid;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', false);
  l1 := pg_temp.r7_get('l1')::uuid; l2 := pg_temp.r7_get('l2')::uuid;
  for c in select unnest(array['b', 'h']) loop perform pg_temp.r7_conn(c); end loop;

  -- ---- E1: the source edit commits first, the translation of the old source waits and loses
  perform pg_temp.r7_note('e1_h', pg_temp.r7_hold('h', 'edit:l1'));
  perform pg_temp.r7_send('b', 'trans:l1');
  perform pg_temp.r7_note('e1_blocked_by_h', pg_temp.r7_blocked_by('b', 'h')::text);
  perform pg_temp.r7_note('e1_version_during', pg_temp.r8_entry_version(l1));
  perform pg_temp.r7_note('e1_h_end', pg_temp.r7_end('h'));
  perform pg_temp.r7_note('e1_b', pg_temp.r7_collect('b'));
  perform pg_temp.r7_note('e1_version_after', pg_temp.r8_entry_version(l1));
  perform pg_temp.r7_note('e1_head_moved', (pg_temp.r8_head_rev(l1) is distinct from pg_temp.r7_get('l1_rev1')::uuid)::text);
  perform pg_temp.r7_note('e1_variants_after', pg_temp.r8_variants(l1));
  perform pg_temp.r7_note('e1_reserved', pg_temp.r8_reserved('r8-trans-l1'));
  perform pg_temp.r8_patch_cmd('trans:l1:retry', 'trans:l1', jsonb_build_object(
    'sourceRevisionId', pg_temp.r8_src_rev(l1), 'sourceHash', (select btrim(payload_hash::text) from platform_private.cms_entry_revisions where id = pg_temp.r8_src_rev(l1)),
    'expectedVersion', pg_temp.r8_entry_version(l1), 'ifMatch', pg_temp.r8_entry_version(l1), 'idempotencyKey', 'r8-trans-l1-retry'));
  perform pg_temp.r7_note('e1_retry', pg_temp.r7_sql('b', pg_temp.r7_call_sql('trans:l1:retry')));
  perform pg_temp.r7_note('e1_variants_retry', pg_temp.r8_variants(l1));
  perform pg_temp.r7_note('e1_variant_source_is_new', (pg_temp.r8_variant_source(l1) = pg_temp.r8_src_rev(l1))::text);

  -- ---- E2: the translation commits first, the source edit of the old entry version waits and loses
  perform pg_temp.r7_note('e2_h', pg_temp.r7_hold('h', 'trans:l2'));
  perform pg_temp.r7_send('b', 'edit:l2');
  perform pg_temp.r7_note('e2_blocked_by_h', pg_temp.r7_blocked_by('b', 'h')::text);
  perform pg_temp.r7_note('e2_h_end', pg_temp.r7_end('h'));
  perform pg_temp.r7_note('e2_b', pg_temp.r7_collect('b'));
  perform pg_temp.r7_note('e2_version_after', pg_temp.r8_entry_version(l2));
  perform pg_temp.r7_note('e2_head_unmoved', (pg_temp.r8_head_rev(l2) = pg_temp.r7_get('l2_rev1')::uuid)::text);
  perform pg_temp.r7_note('e2_variants_after', pg_temp.r8_variants(l2));
  perform pg_temp.r7_note('e2_events_after', pg_temp.r8_loc_events(l2));
  perform pg_temp.r7_note('e2_reserved', pg_temp.r8_reserved('r8-edit-l2'));
  perform pg_temp.r8_patch_cmd('edit:l2:retry', 'edit:l2', jsonb_build_object(
    'expectedVersion', pg_temp.r8_entry_version(l2), 'ifMatch', pg_temp.r8_entry_version(l2), 'idempotencyKey', 'r8-edit-l2-retry'));
  perform pg_temp.r7_note('e2_retry', pg_temp.r7_sql('b', pg_temp.r7_call_sql('edit:l2:retry')));
  perform pg_temp.r7_note('e2_head_moved', (pg_temp.r8_head_rev(l2) is distinct from pg_temp.r7_get('l2_rev1')::uuid)::text);
  perform pg_temp.r7_note('e2_variants_retry', pg_temp.r8_variants(l2));
  perform pg_temp.r7_note('e2_stale_ids', pg_temp.r8_stale_ids(l2));
  perform pg_temp.r7_note('e2_events_retry', pg_temp.r8_loc_events(l2));

  perform pg_temp.r7_cleanup(array['b', 'h']);
exception when others then
  perform pg_temp.r7_note('harness_error', sqlstate || ':' || sqlerrm);
  perform pg_temp.r7_cleanup(array['b', 'h']);
end;
$scenario$;
\ir phase_02_slice_12_race7/090-restore.sqlinc

-- ------------------------------------------------------------------------------------------------ assertions
select pg_temp.r7_diag('restore=' || coalesce(pg_temp.r7_get('restore'), '?') || ' restore2=' || coalesce(pg_temp.r7_get('restore2'), '?') || ' off=' || coalesce(pg_temp.r7_get('restore_off'), '?') || ' on=' || coalesce(pg_temp.r7_get('restore_on'), '?') || ' missing_where=' || coalesce(pg_temp.r7_get('missing_where'), '?') || ' added_where=' || coalesce(pg_temp.r7_get('added_where'), '?') || ' restore_error=' || coalesce(pg_temp.r7_get('restore_error'), '-'));
select pg_temp.r7_diag('e1_h=' || left(coalesce(pg_temp.r7_get('e1_h'), '?'), 200) || ' | e1_b=' || left(coalesce(pg_temp.r7_get('e1_b'), '?'), 200) || ' | e1_retry=' || left(coalesce(pg_temp.r7_get('e1_retry'), '?'), 200));
select pg_temp.r7_diag('e2_h=' || left(coalesce(pg_temp.r7_get('e2_h'), '?'), 200) || ' | e2_b=' || left(coalesce(pg_temp.r7_get('e2_b'), '?'), 200) || ' | e2_retry=' || left(coalesce(pg_temp.r7_get('e2_retry'), '?'), 200));
select pg_temp.r7_is(pg_temp.r7_get('harness_error'), null, 'the committed-world harness ran both locale scenarios without an error of its own [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('world_failed') || '/' || pg_temp.r7_get('world_premises_failed') || '/' || pg_temp.r7_get('l1_create_state') || '/' || pg_temp.r7_get('l2_create_state'), '0/0/00000/00000',
  'the committed locale world built with no failed fixture assertion: two entries of an active localized content type exist [P2-S12-AC-277]');

-- E1
select pg_temp.r7_ok(pg_temp.r7_get('e1_h') like 'ok:%' and pg_temp.r7_get('e1_version_during') = '1',
  'fixture: a real source-locale revision append on the entry stays open; the committed entry version is still 1 [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('e1_blocked_by_h'), 'true', 'the translation of the old source is observed blocked BY the open source edit (the entry row) [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('e1_b'), 'P0001:VERSION_MISMATCH',
  'once the source edit commits the translation answers the typed 409 VERSION_MISMATCH (entry version and source hash are stale) [P2-S12-AC-277]');
select pg_temp.r7_ok(pg_temp.r7_get('e1_version_after') = '2' and pg_temp.r7_get('e1_head_moved') = 'true' and pg_temp.r7_get('e1_variants_after') = '' and pg_temp.r7_get('e1_reserved') = '0',
  'the losing translation wrote nothing: no variant row and no Idempotency-Key record, while the source edit moved the head and the entry to version 2 [P2-S12-AC-277]');
select pg_temp.r7_ok(pg_temp.r7_get('e1_retry') like 'ok:%' and pg_temp.r7_get('e1_variants_retry') = 'draft:1' and pg_temp.r7_get('e1_variant_source_is_new') = 'true',
  'the translation retried on the new source revision and hash commits a draft variant pinned to the NEW source revision [P2-S12-AC-277]');

-- E2
select pg_temp.r7_ok(pg_temp.r7_get('e2_h') like 'ok:%', 'fixture: a real fr-FR translation of the entry stays open as the lock holder [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('e2_blocked_by_h'), 'true', 'the source edit of the old entry version is observed blocked BY the open translation (the entry row) [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('e2_b'), 'P0001:VERSION_MISMATCH',
  'once the translation commits the source edit answers the typed 409 VERSION_MISMATCH (the entry version advanced) [P2-S12-AC-277]');
select pg_temp.r7_ok(pg_temp.r7_get('e2_version_after') = '2' and pg_temp.r7_get('e2_head_unmoved') = 'true' and pg_temp.r7_get('e2_variants_after') = 'draft:1'
    and pg_temp.r7_get('e2_events_after') = '1' and pg_temp.r7_get('e2_reserved') = '0',
  'the losing source edit wrote nothing: the head is still the first revision, the translation is a draft variant with one localization event, no Idempotency-Key record [P2-S12-AC-277]');
select pg_temp.r7_ok(pg_temp.r7_get('e2_retry') like 'ok:%' and pg_temp.r7_get('e2_head_moved') = 'true',
  'the source edit retried at the new entry version commits and moves the head [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('e2_variants_retry'), 'draft:1,stale:2',
  'the source-change fan-out appended a stale variant row (version 2) after the committed translation: the variant is honestly stale [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('e2_stale_ids'), '["' || pg_temp.r7_get('loc_title_field') || '"]',
  'the stale row lists exactly the translated source field (stale_field_ids) [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('e2_events_retry'), '2', 'the stale transition emitted its own cms.localization.changed.v1 event (two events for the locale) [P2-S12-AC-277]');

select pg_temp.r7_is(pg_temp.r7_get('added_after_restore'), '0', 'cleanup: the harness removed every row the committed world and the scenarios added (' || coalesce(pg_temp.r7_get('added_where'), '') || ') [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('missing_after_restore'), '0', 'cleanup: no pre-existing row was changed or removed [P2-S12-AC-277]');
select * from pg_temp.r7_finish();
