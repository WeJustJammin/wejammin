-- Slice 12 perf lane (claude_s12_gaps_perf), static lock-order oracles for the two governed writers whose ledger clauses are
-- uncited: P2-S12-AC-073 clause 1 (CMS-03C-07 "takes its locks in the Slice 12 lock order (the subject, dependency and
-- content-type positions before the review row, DEC-157)") and P2-S12-AC-079 clause 1 (CMS-03C-08 "locks the review row").
-- Normative: BE03c "Slice 12 lock order (DEC-157, DEC-180)" table rows 1494-1496 (lines of the 2026-10-24 spec), Governed review
-- machinery 1461 ("those steps are not an order of locks").
--
-- Method (the precedent is phase_02_slice_12_pattern_updates/080-lock-order.sqlinc): a single session cannot observe the
-- acquisition order of two transactions, so this is a STATIC check on the stored function sources: each anchor is the FULL
-- lock clause, occurs a fixed number of times, and the anchors appear in the order the writer acquires the locks.  The
-- helpers the writers call (subject resolver with p_lock, the graph locker, the authority locker) are checked the same way,
-- so a lock clause deleted from a helper fails here and not only a reordering of the callers.  A mutated copy of each source
-- (the review-row lock moved to the front) proves the order check detects exactly the order DEC-157 rejected.  It proves the
-- SOURCE order only: serialization of two simultaneous decisions or assignments is a race (root-run, see the report).
-- Stage lane `none`: promoted migrations only.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

create or replace function pg_temp.g12l_src(p_proc text) returns text language sql stable as $body$
  select pg_catalog.regexp_replace(prosrc, '\s+', ' ', 'g') from pg_proc where oid = to_regprocedure(p_proc) $body$;
-- Occurrences of an anchor in a source.
create or replace function pg_temp.g12l_count(p_src text, p_anchor text) returns integer language sql immutable as $body$
  select ((pg_catalog.length(p_src) - pg_catalog.length(pg_catalog.replace(p_src, p_anchor, ''))) / pg_catalog.length(p_anchor))::integer $body$;
-- The anchor numbers ordered by the position of their FIRST occurrence ('0' when an anchor is absent): '1 2 3 4'.
create or replace function pg_temp.g12l_order(p_src text, p_anchors text[]) returns text language sql immutable as $body$
  select coalesce(string_agg(case when pos = 0 then '0' else idx::text end, ' ' order by pos, idx), '')
    from (select idx, pg_catalog.strpos(p_src, p_anchors[idx]) as pos from generate_series(1, cardinality(p_anchors)) idx) t $body$;
-- The counts of every anchor as '1,1,1,2'.
create or replace function pg_temp.g12l_counts(p_src text, p_anchors text[]) returns text language sql immutable as $body$
  select string_agg(pg_temp.g12l_count(p_src, p_anchors[idx])::text, ',' order by idx) from generate_series(1, cardinality(p_anchors)) idx $body$;

-- ------------------------------------------------------------------------------------------------------ CMS-03C-07 decision --
create temp table g12l_decision(src text not null, anchors text[] not null) on commit drop;
insert into g12l_decision values (
  pg_temp.g12l_src('platform_private.cms_record_governed_decision(jsonb)'),
  array[
    'perform platform_private.cms_lock_person_authority(',
    'v_subject := platform_private.cms_governed_subject_resolve(v_review.subject_kind, v_review.subject_id, true);',
    'perform platform_private.cms_governed_lock_graph(v_review.subject_kind, v_review.owner_id, v_subject);',
    'from platform_private.cms_governed_reviews review_item where review_item.id = v_review_id for update;']);

select is((select count(*)::integer from g12l_decision where src is not null), 1,
  'the CMS-03C-07 private implementation source is read once [P2-S12-AC-073]');
select is((select pg_temp.g12l_counts(src, anchors) from g12l_decision), '1,1,1,2',
  'CMS-03C-07 names each full lock clause: the authority locker once, the subject lock once, the graph locker once and the review-row FOR UPDATE on its two paths [P2-S12-AC-073]');
select is((select pg_temp.g12l_order(src, anchors) from g12l_decision), '1 2 3 4',
  'CMS-03C-07 takes position 1 (reviewer authority rows), then the subject row (position 3), then its dependency graph and bound content-type versions (positions 3 and 4), then the review row (position 5) [BE03c lock order, DEC-157] [P2-S12-AC-073]');
select ok((select pg_catalog.strpos(src, 'for update') > pg_catalog.strpos(src, 'perform platform_private.cms_governed_lock_graph(')
             from g12l_decision),
  'CMS-03C-07 contains no FOR UPDATE of its own before the graph lock: the first row lock it names is the review row, after the dependency positions [P2-S12-AC-073]');
select ok((select pg_catalog.strpos(src, 'for update') = pg_catalog.strpos(src, anchors[4]) + pg_catalog.length(anchors[4]) - pg_catalog.length('for update;')
             from g12l_decision),
  'the first FOR UPDATE in the CMS-03C-07 source is the review-row lock itself [P2-S12-AC-073]');
select isnt((select pg_temp.g12l_order(anchors[4] || ' ' || pg_catalog.replace(src, anchors[4], ''), anchors) from g12l_decision), '1 2 3 4',
  'control: the order check detects the review row locked before the subject and dependency positions (the order DEC-157 rejected) [P2-S12-AC-073]');

-- ----------------------------------------------------------------------------------------------------------- the helpers --
select is(pg_temp.g12l_counts(pg_temp.g12l_src('platform_private.cms_governed_subject_resolve(text,uuid,boolean)'),
    array['from platform_private.cms_template_versions item where item.id = p_id for update;',
          'from platform_private.cms_pattern_versions item where item.id = p_id for update;',
          'from platform_private.cms_taxonomy_versions item where item.id = p_id for update;']),
  '1,1,1', 'the subject resolver locks the template, pattern and taxonomy version row FOR UPDATE when p_lock is true [P2-S12-AC-073]');
select is(pg_temp.g12l_order(pg_temp.g12l_src('platform_private.cms_governed_lock_graph(text,uuid,jsonb)'),
    array['order by nested_item.id for share;', 'order by version_item.id for share;']),
  '1 2', 'the graph locker takes the nested pattern versions FOR SHARE (ascending id) before the bound content-type versions FOR SHARE (ascending id) [P2-S12-AC-073]');
select is(pg_temp.g12l_counts(pg_temp.g12l_src('platform_private.cms_governed_lock_graph(text,uuid,jsonb)'),
    array['order by nested_item.id for share;', 'order by version_item.id for share;']),
  '1,1', 'each graph lock clause occurs once [P2-S12-AC-073]');
select is(pg_temp.g12l_order(pg_temp.g12l_src('platform_private.cms_lock_person_authority(uuid,uuid[],text[])'),
    array['order by person_item.party_id for share;',
          'order by tenure_item.person_id, tenure_item.id for share;',
          'order by grant_item.person_id, grant_item.capability_code for share;']),
  '1 2 3', 'the authority locker takes person, tenure and grant rows FOR SHARE in that order, people ascending (position 1) [P2-S12-AC-073]');

-- ------------------------------------------------------------------------------------------------------ CMS-03C-08 assignment --
create temp table g12l_assign(src text not null, anchors text[] not null) on commit drop;
insert into g12l_assign values (
  pg_temp.g12l_src('platform_private.cms_assign_governed_reviewer(jsonb)'),
  array[
    'perform platform_private.cms_lock_person_authority(',
    'v_subject := platform_private.cms_governed_subject_resolve(v_review.subject_kind, v_review.subject_id, true);',
    'from platform_private.cms_governed_reviews review_item where review_item.id = v_review_id for update;',
    'from platform_private.cms_governed_review_assignments assignment_item where assignment_item.id = v_assignment_req and assignment_item.review_id = v_review.id for update;',
    'insert into platform_private.cms_governed_review_assignments(']);

select is((select count(*)::integer from g12l_assign where src is not null), 1,
  'the CMS-03C-08 private implementation source is read once [P2-S12-AC-079]');
select is((select pg_temp.g12l_counts(src, anchors) from g12l_assign), '1,1,1,1,1',
  'CMS-03C-08 names each full lock clause exactly once: authority rows, the revoke-path subject lock, the review-row FOR UPDATE and the assignment-row FOR UPDATE [P2-S12-AC-079]');
select is((select pg_temp.g12l_order(src, anchors) from g12l_assign), '1 2 3 5 4',
  'CMS-03C-08 locks the review row FOR UPDATE (position 5) after the authority rows (position 1) and the revoke-path subject row (position 3) and before it inserts an assignment or locks the assignment row that carries the 16-active limit check [P2-S12-AC-079]');
select ok((select pg_catalog.strpos(src, 'if v_active >= 16 then') > pg_catalog.strpos(src, anchors[3]) from g12l_assign),
  'the limit of 16 active assignments is checked under the review-row lock, never before it [P2-S12-AC-079]');
select isnt((select pg_temp.g12l_order(anchors[3] || ' ' || pg_catalog.replace(src, anchors[3], ''), anchors) from g12l_assign), '1 2 3 5 4',
  'control: the order check detects the review row locked before the authority rows [P2-S12-AC-079]');

select * from finish();
rollback;
