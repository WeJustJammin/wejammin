-- Slice 12 gap lane claude_s12_gaps_db2: P2-S12-AC-276 (BE03c "Slice 12 lock order"): the Slice 12 writers take their locks in the Slice 12
-- order and never acquire an earlier position after a later one.  A single session cannot observe the acquisition order of two
-- transactions, so this is a STATIC check of the stored function sources, the precedent of phase_02_slice_12_pattern_updates/080-lock-order
-- and phase_02_slice_12_gaps_lock_order.sql (CMS-03C-07 and -08): comments are stripped, whitespace collapsed, and the FIRST occurrence of
-- each anchor must appear in increasing order.  Writers covered here (those with no earlier source-order proof): CMS-03C-01 define,
-- -06 submit, -09 activate, -19 execute, -12 pattern create, -16 taxonomy create and -03 term action (the merge command, whose per-party
-- enqueue mutex sits after position 1 and before position 3).  Each check has a reversed-anchor control proving the detector discriminates.
-- It proves the SOURCE order only; two simultaneous transactions are a race module of the root.
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

create or replace function pg_temp.g2_src(p_proc text) returns text language sql stable as $body$
  select pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.regexp_replace(prosrc, '--[^\n]*', '', 'g'), '\s+', ' ', 'g'))
    from pg_catalog.pg_proc where oid = pg_catalog.to_regprocedure(p_proc)
$body$;
-- true when every anchor occurs and the first occurrences are strictly increasing
create or replace function pg_temp.g2_ordered(p_src text, p_anchors text[]) returns boolean language plpgsql immutable as $body$
declare previous integer := 0; anchor text; at_pos integer;
begin
  if p_src is null then return false; end if;
  foreach anchor in array p_anchors loop
    at_pos := pg_catalog.strpos(p_src, pg_catalog.lower(anchor));
    if at_pos = 0 or at_pos <= previous then return false; end if;
    previous := at_pos;
  end loop;
  return true;
end;
$body$;
-- true when the LAST occurrence of p_before lies before the first occurrence of p_after
create or replace function pg_temp.g2_last_before(p_src text, p_before text, p_after text) returns boolean language sql immutable as $body$
  select pg_catalog.strpos(p_src, pg_catalog.lower(p_after)) > 0
     and pg_catalog.strpos(p_src, pg_catalog.lower(p_before)) > 0
     and (pg_catalog.length(p_src) - pg_catalog.strpos(pg_catalog.reverse(p_src), pg_catalog.reverse(pg_catalog.lower(p_before))) + 1 - pg_catalog.length(p_before) + 1)
         < pg_catalog.strpos(p_src, pg_catalog.lower(p_after))
$body$;

-- ---- CMS-03C-01: position 1 (designer grant rows FOR SHARE) precedes position 3 (the parent version row FOR UPDATE)
select ok(pg_temp.g2_ordered(pg_temp.g2_src('platform_private.cms_define_template(jsonb)'),
    array['cms_lock_governed_authority(', 'limit 1 for update']),
  'CMS-03C-01 takes the caller''s designer grant rows FOR SHARE (position 1) before the parent version row FOR UPDATE (position 3) [P2-S12-AC-276]');
select ok(pg_temp.g2_ordered(pg_temp.g2_src('platform_private.cms_define_template(jsonb)'),
    array['cms_lock_governed_authority(', 'cms_template_designer_authorized(']),
  'CMS-03C-01 re-proves the designer capability AFTER taking the position 1 lock [P2-S12-AC-276]');
select ok(not pg_temp.g2_ordered(pg_temp.g2_src('platform_private.cms_define_template(jsonb)'),
    array['limit 1 for update', 'cms_lock_governed_authority(']),
  'control: the reversed order is rejected by the detector [P2-S12-AC-276]');

-- ---- CMS-03C-06 submit: 1 authority, 3 subject row, then the dependency graph and bound type versions
select ok(pg_temp.g2_ordered(pg_temp.g2_src('platform_private.cms_submit_governed_review(jsonb)'),
    array['cms_lock_governed_authority(', 'cms_governed_subject_resolve(v_subject_kind, v_subject_id, true)', 'cms_governed_lock_graph(']),
  'CMS-03C-06 locks authority (1), the subject row (3), then the dependency graph and content-type versions (3-4) [P2-S12-AC-276]');
select ok(not pg_temp.g2_ordered(pg_temp.g2_src('platform_private.cms_submit_governed_review(jsonb)'),
    array['cms_governed_lock_graph(', 'cms_governed_subject_resolve(v_subject_kind, v_subject_id, true)', 'cms_lock_governed_authority(']),
  'control: the reversed submit order is rejected by the detector [P2-S12-AC-276]');

-- ---- CMS-03C-09 activate: 1, 3 (+ graph), 5 review row, the lineage advisory lock LAST
select ok(pg_temp.g2_ordered(pg_temp.g2_src('platform_private.cms_activate_governed_subject(jsonb)'),
    array['cms_lock_governed_authority(', 'cms_governed_subject_resolve(v_review.subject_kind, v_review.subject_id, true)',
          'cms_governed_lock_graph(', 'cms_governed_take_lineage_advisory']),
  'CMS-03C-09 locks authority (1), the subject row (3), the graph and bound versions, then the lineage advisory lock last [P2-S12-AC-276]');
select ok(pg_temp.g2_last_before(pg_temp.g2_src('platform_private.cms_activate_governed_subject(jsonb)'), 'for update', 'cms_governed_take_lineage_advisory'),
  'CMS-03C-09 takes every row lock (the last FOR UPDATE) before the lineage advisory lock [P2-S12-AC-276]');
select ok(not pg_temp.g2_last_before(pg_temp.g2_src('platform_private.cms_activate_governed_subject(jsonb)'), 'cms_governed_take_lineage_advisory', 'for update'),
  'control: the advisory lock is not before the last row lock, so the detector discriminates [P2-S12-AC-276]');

-- ---- CMS-03C-19 execute: schedule creator authority (1), subject (3), graph, row locks, lineage advisory last
select ok(pg_temp.g2_ordered(pg_temp.g2_src('platform_private.cms_execute_governed_activation(jsonb)'),
    array['cms_lock_person_authority(', 'cms_governed_subject_resolve(v_schedule.subject_kind, v_schedule.subject_id, true)',
          'cms_governed_lock_graph(', 'cms_governed_take_lineage_advisory']),
  'CMS-03C-19 locks the schedule creator''s authority (1), the subject (3), the graph, then the lineage advisory lock last [P2-S12-AC-276]');
select ok(pg_temp.g2_last_before(pg_temp.g2_src('platform_private.cms_execute_governed_activation(jsonb)'), 'for update', 'cms_governed_take_lineage_advisory'),
  'CMS-03C-19 takes the review and schedule row locks before the lineage advisory lock [P2-S12-AC-276]');

-- ---- CMS-03C-12: 1 authority, 3 parent row FOR UPDATE then nested rows FOR SHARE, 4 type versions FOR SHARE
select ok(pg_temp.g2_ordered(pg_temp.g2_src('platform_private.cms_create_pattern_version(jsonb)'),
    array['cms_lock_governed_authority(', 'limit 1 for update', 'for share of version_row']),
  'CMS-03C-12 locks authority (1), the parent version row (3), then the content-type version rows (4) [P2-S12-AC-276]');
select ok(not pg_temp.g2_ordered(pg_temp.g2_src('platform_private.cms_create_pattern_version(jsonb)'),
    array['for share of version_row', 'limit 1 for update', 'cms_lock_governed_authority(']),
  'control: the reversed pattern order is rejected by the detector [P2-S12-AC-276]');

-- ---- CMS-03C-16: 1 curator authority, 3 parent version row FOR UPDATE
select ok(pg_temp.g2_ordered(pg_temp.g2_src('platform_private.cms_create_taxonomy_version(jsonb)'),
    array['cms_lock_governed_authority(', 'for update']),
  'CMS-03C-16 locks the curator authority (1) before the parent version row (3) [P2-S12-AC-276]');

-- ---- CMS-03C-03 term action and merge: 1 authority, the merge-enqueue mutex, 3 vocabulary FOR SHARE, 6 term rows FOR UPDATE
select ok(pg_temp.g2_ordered(pg_temp.g2_src('platform_private.cms_act_taxonomy_term(jsonb)'),
    array['cms_lock_governed_authority(', 'cms_taxonomy_merge_enqueue_lock(', 'for share', 'for update']),
  'CMS-03C-03 locks the curator authority (1), the per-party merge-enqueue mutex, the vocabulary version (3), then the term rows (6) [P2-S12-AC-276]');
select ok(not pg_temp.g2_ordered(pg_temp.g2_src('platform_private.cms_act_taxonomy_term(jsonb)'),
    array['for update', 'for share', 'cms_taxonomy_merge_enqueue_lock(', 'cms_lock_governed_authority(']),
  'control: the reversed term-action order is rejected by the detector [P2-S12-AC-276]');
select ok(pg_temp.g2_ordered(pg_temp.g2_src('platform_private.cms_request_taxonomy_merge_converge(uuid,uuid,uuid,uuid)'),
    array['cms_taxonomy_merge_enqueue_lock(']),
  'the merge continuation request takes the per-party merge-enqueue mutex [P2-S12-AC-276]');

select * from finish();
rollback;
