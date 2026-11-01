-- Slice 12 race8: a RELATED TARGET UNPUBLISHED while its pin is written (lane claude_s12_db8; BE03c concurrency tests 1817 "related target unpublish", CMS-03C-05
-- 1700 and Public projection 1571 "recomputed at every projection ... a target that becomes unpublished or private disappears from the output while its
-- editorial explanation and history stay private"; tracker P2-S12-AC-277).  The curation is the real platform_api.cms_curate_related_content, the unpublish is
-- the real lineage producer (platform_private.cms_append_publication_lineage appends the `unpublish` tombstone; 03b has no other unpublish writer), the
-- projection is the real platform_private.cms_related_content_public_targets, read from the main session.
--   U1  an unpublish is IN FLIGHT (uncommitted) on the pinned target: the curation does not wait for it (the pin check is lifecycle / readability, not publication),
--       commits the pin; the projection still lists the published target; the unpublish commits and the projection drops it while the pin stays stored
--   U3  the unpublishing writer owns the target's ENTRY row (the writers of 03b hold the entry row) and has appended the tombstone: the curation waits for it at
--       position 2 (the target entry row, FOR SHARE) while it already owns the source entry row (position 0); the writer commits; the curation then commits the
--       pin and the projection excludes the target: whichever order, a target unpublished at any time is never projected
\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
commit;
\ir phase_02_slice_12_race7/000-harness.sqlinc
\ir phase_02_slice_12_race7/020-sys.sqlinc
\ir phase_02_slice_12_race8/030-create-helpers.sqlinc
\ir phase_02_slice_12_race8/090-related-helpers.sqlinc

do $snap$ begin perform pg_temp.r7_note('snapshot_rows', pg_temp.r7_snapshot()::text); end $snap$;

-- ------------------------------------------------------------------------------------------------ the committed world (real producers)
begin;
select no_plan();
\o /dev/null
\ir phase_02_slice_12_race8/080-related-world.sqlinc
\o
select pg_temp.r7_note('world_failed', num_failed()::text);
commit;

-- ------------------------------------------------------------------------------------------------ the scenarios
set statement_timeout = 0;
do $scenario$
declare
  c text; s1 uuid; s3 uuid; t1 uuid; t3 uuid;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', false);
  s1 := pg_temp.r7_get('src_u1')::uuid; s3 := pg_temp.r7_get('src_u3')::uuid; t1 := pg_temp.r7_get('target_u1')::uuid; t3 := pg_temp.r7_get('target_u3')::uuid;
  for c in select unnest(array['b', 'h', 'p']) loop perform pg_temp.r8_conn_plain(c); end loop;
  perform pg_temp.r7_note('lineage_before', pg_temp.r8_lineage(t1) || '/' || pg_temp.r8_lineage(t3));

  -- ---- U1: an unpublish in flight, the curation does not wait for it
  perform pg_temp.r7_note('u1_h', pg_temp.r7_hold_raw('h', format('perform platform_private.cms_append_publication_lineage(%L::jsonb)', pg_temp.r7_get('unpublish_u1'))));
  perform pg_temp.r7_send('b', 'curate:u1');
  perform pg_temp.r7_note('u1_b', pg_temp.r7_collect('b', 15));
  perform pg_temp.r7_note('u1_pins', pg_temp.r8_pins(s1));
  perform pg_temp.r7_note('u1_projection_during', pg_temp.r8_projection(s1));
  perform pg_temp.r7_note('u1_lineage_during', pg_temp.r8_lineage(t1));
  perform pg_temp.r7_note('u1_h_end', pg_temp.r7_end('h'));
  perform pg_temp.r7_note('u1_lineage_after', pg_temp.r8_lineage(t1));
  perform pg_temp.r7_note('u1_projection_after', pg_temp.r8_projection(s1));
  perform pg_temp.r7_note('u1_pins_after', pg_temp.r8_pins(s1));

  -- ---- U3: the unpublishing writer owns the target entry row; the curation waits for it at position 2
  perform pg_temp.r7_note('u3_h', pg_temp.r7_hold_raw('h', format(
    'perform 1 from platform_private.cms_content_entries where id = %L::uuid for update; perform platform_private.cms_append_publication_lineage(%L::jsonb)',
    t3, pg_temp.r7_get('unpublish_u3'))));
  perform pg_temp.r7_send('b', 'curate:u3');
  perform pg_temp.r7_note('u3_blocked_by_h', pg_temp.r7_blocked_by('b', 'h')::text);
  perform pg_temp.r7_note('u3_source_held', pg_temp.r7_row_locked('p', 'platform_private.cms_content_entries', format('id = %L::uuid', s3)));
  perform pg_temp.r7_note('u3_pins_during', pg_temp.r8_pins(s3));
  perform pg_temp.r7_note('u3_projection_during', pg_temp.r8_projection(s3));
  perform pg_temp.r7_note('u3_h_end', pg_temp.r7_end('h'));
  perform pg_temp.r7_note('u3_b', pg_temp.r7_collect('b'));
  perform pg_temp.r7_note('u3_lineage_after', pg_temp.r8_lineage(t3));
  perform pg_temp.r7_note('u3_pins_after', pg_temp.r8_pins(s3));
  perform pg_temp.r7_note('u3_projection_after', pg_temp.r8_projection(s3));

  perform pg_temp.r7_cleanup(array['b', 'h', 'p']);
exception when others then
  perform pg_temp.r7_note('harness_error', sqlstate || ':' || sqlerrm);
  perform pg_temp.r7_cleanup(array['b', 'h', 'p']);
end;
$scenario$;
\ir phase_02_slice_12_race7/090-restore.sqlinc

-- ------------------------------------------------------------------------------------------------ assertions
select pg_temp.r7_diag('restore=' || coalesce(pg_temp.r7_get('restore'), '?') || ' restore2=' || coalesce(pg_temp.r7_get('restore2'), '?') || ' off=' || coalesce(pg_temp.r7_get('restore_off'), '?') || ' on=' || coalesce(pg_temp.r7_get('restore_on'), '?') || ' missing_where=' || coalesce(pg_temp.r7_get('missing_where'), '?') || ' added_where=' || coalesce(pg_temp.r7_get('added_where'), '?') || ' restore_error=' || coalesce(pg_temp.r7_get('restore_error'), '-'));
select pg_temp.r7_diag('rel_world_errors=' || coalesce(pg_temp.r7_get('rel_world_errors_text'), 'none') || ' | u1_h=' || left(coalesce(pg_temp.r7_get('u1_h'), '?'), 200) || ' | u1_b=' || left(coalesce(pg_temp.r7_get('u1_b'), '?'), 300) || ' | u3_h=' || left(coalesce(pg_temp.r7_get('u3_h'), '?'), 200) || ' | u3_b=' || left(coalesce(pg_temp.r7_get('u3_b'), '?'), 300));
select pg_temp.r7_is(pg_temp.r7_get('harness_error'), null, 'the committed-world harness ran both related-target scenarios without an error of its own [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('world_failed') || '/' || pg_temp.r7_get('rel_world_errors'), '0/0', 'the committed related-content world built with no failed fixture assertion and no world error [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('lineage_before'), 'publish:active/publish:active', 'fixture: both pinned targets are published (active publish head) before the race [P2-S12-AC-277]');

-- U1
select pg_temp.r7_ok(pg_temp.r7_get('u1_h') = '00000' and pg_temp.r7_get('u1_lineage_during') = 'publish:active',
  'fixture: the unpublish tombstone of the first target is appended in an open transaction: the committed lineage head is still the active publish [P2-S12-AC-277]');
select pg_temp.r7_ok(pg_temp.r7_get('u1_b') like 'ok:%' and (substr(pg_temp.r7_get('u1_b'), 4)::jsonb)->>'eligibleCount' = '1',
  'the curation pinning the target does not wait for the unpublish in flight and commits (eligibleCount is the one pin) [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('u1_pins'), pg_temp.r7_get('target_u1'), 'the pin of the target is stored although its unpublish is in flight [P2-S12-AC-277]');
select pg_temp.r7_ok(position(pg_temp.r7_get('target_u1') in pg_temp.r7_get('u1_projection_during')) = 1,
  'while the unpublish is uncommitted the public projection still lists the published target, pinned first (the projection reads committed lineage heads) [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('u1_lineage_after'), 'publish:active,unpublish:revoked', 'the unpublish commits as a revoked tombstone after the active publish [P2-S12-AC-277]');
select pg_temp.r7_ok(position(pg_temp.r7_get('target_u1') in pg_temp.r7_get('u1_projection_after')) = 0 and pg_temp.r7_get('u1_projection_after') <> '', 'once the unpublish has committed the public projection no longer lists the target [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('u1_pins_after'), pg_temp.r7_get('target_u1'), 'the unpublished target stays pinned in the stored rule set (history is private, not removed) [P2-S12-AC-277]');

-- U3
select pg_temp.r7_is(pg_temp.r7_get('u3_h'), '00000', 'fixture: the unpublishing writer owns the target entry row and has appended the tombstone, uncommitted [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('u3_blocked_by_h'), 'true', 'the curation pinning the target is observed blocked BY the unpublishing writer on the target entry row (position 2) [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('u3_source_held'), '55P03', 'while it waits at the target the curation already owns the source entry row (position 0) [P2-S12-AC-277]');
select pg_temp.r7_ok(pg_temp.r7_get('u3_pins_during') = '' and pg_temp.r7_get('u3_projection_during') = '',
  'while it waits the curation has stored no pin and the source projects no target [P2-S12-AC-277]');
select pg_temp.r7_ok(pg_temp.r7_get('u3_b') like 'ok:%' and (substr(pg_temp.r7_get('u3_b'), 4)::jsonb)->>'eligibleCount' = '1',
  'once the writer commits the curation proceeds and commits the pin: a target unpublished before the curation finishes is still a valid pin (eligibleCount is the one pin) [P2-S12-AC-277]');
select pg_temp.r7_ok(pg_temp.r7_get('u3_lineage_after') = 'publish:active,unpublish:revoked' and pg_temp.r7_get('u3_pins_after') = pg_temp.r7_get('target_u3'),
  'the unpublish committed as a revoked tombstone and the pin is stored [P2-S12-AC-277]');
select pg_temp.r7_ok(position(pg_temp.r7_get('target_u3') in pg_temp.r7_get('u3_projection_after')) = 0 and pg_temp.r7_get('u3_projection_after') <> '',
  'whichever command committed last, the public projection does not list the unpublished target (it still projects the source''s other eligible targets) [P2-S12-AC-277]');

select pg_temp.r7_is(pg_temp.r7_get('added_after_restore'), '0', 'cleanup: the harness removed every row the committed world and the scenarios added (' || coalesce(pg_temp.r7_get('added_where'), '') || ') [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('missing_after_restore'), '0', 'cleanup: no pre-existing row was changed or removed [P2-S12-AC-277]');
select * from pg_temp.r7_finish();
