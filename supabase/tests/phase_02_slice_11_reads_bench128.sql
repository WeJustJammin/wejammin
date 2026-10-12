\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 11 acceptance evidence (review A, A-M9; P2-S11-AC-052 / AC-058 / AC-064): the BE03b latency
-- targets measured on the three safe-read RPCs themselves, at their declared bounds, the way
-- phase_02_slice_09_evidence_bench128.sql measures Slice 09.
--
--   CMS-03B-15 cms_get_entry_workflow        Tier 2, p95 < 1,200 ms  (128-field revision, preparation, 17-result
--                                            preflight; and the same read of an entry at 16 schedules, 64
--                                            publications and an open review).  The 2,000 ms accessibility checker
--                                            budget that BE03b folds into the Tier 2 figure runs in the Worker and
--                                            is bounded by its own budget test; this file measures the database
--                                            share the Worker waits for.
--   CMS-03B-16 cms_get_editorial_review      Tier 1, p95 < 750 ms    (7 of 8 decisions, 36 assignment rows
--                                            summarized to the 32 cap, a 128-field frozen manifest)
--   CMS-03B-17 cms_list_editorial_reviews    Tier 1, p95 < 750 ms    (limit 50, the maximum page, from 200 assigned
--                                            reviews among 500 and 300 of other people's; first page and cursor page)
--
-- Each call's wall time is recorded in the database; the p95 per operation is asserted against the declared tier
-- target and against the 8,000 ms application read deadline for the worst sample.  Run it on a quiet host:
-- the numbers below are the database share of the declared tier figures, so a loaded host lengthens them.

\ir phase_02_slice_11_reads_bench128/010-fixtures.sqlinc

-- A regression that gives one of the reads a pathological plan must FAIL this file, not hang the gate: the first such
-- plan ran for 63 minutes before it was terminated.  Every legitimate statement below takes seconds; the fixtures above
-- are built before the limit applies.
set local statement_timeout = '120s';

select is(
  (select count(*)::integer from platform_private.cms_field_definition_versions field
     where field.content_type_version_id = pg_temp.b11_version()), 128,
  'fixture: the benchmark content type has exactly 128 fields [P2-S11-AC-052]');
select is(
  (select count(*)::integer from platform_private.cms_entry_field_values value
     where value.revision_id = pg_temp.h11w_uuid('bw-draft:revision')), 128,
  'fixture: the benchmark revision carries 128 field values [P2-S11-AC-052]');
select is(
  (select count(*)::integer from platform_private.cms_editorial_review_assignments where review_id = pg_temp.s11_id('bd'))
    || '/' || (select count(*)::integer from platform_private.cms_editorial_decisions where review_id = pg_temp.s11_id('bd')),
  '36/7', 'fixture: the detail review has 36 assignment rows (16 active, 20 revoked) and 7 recorded decisions [P2-S11-AC-058]');
select is(
  (select count(*) >= 503 from platform_private.cms_editorial_reviews)::text
    || '/' || (select count(*)::integer from platform_private.cms_editorial_review_assignments
                 where reviewer_person_id = pg_temp.s11_id('rvA') and review_id <> pg_temp.s11_id('bwr')),
  'true/200', 'fixture: at least 503 reviews exist and 200 reviews besides the open one are assigned to the benchmark reviewer [P2-S11-AC-064]');

-- ---------------------------------------------------------------------------
-- The responses are the bounded documents the targets are about.
-- ---------------------------------------------------------------------------
select pg_temp.r11r_call('shape-draft', 'cms_get_entry_workflow', 'owner', pg_temp.b11_workflow_rq('bw-draft'));
select pg_temp.r11r_call('shape-bounds', 'cms_get_entry_workflow', 'owner', pg_temp.b11_workflow_rq('bw-bounds'));
select pg_temp.r11r_call('shape-detail', 'cms_get_editorial_review', 'owner', pg_temp.b11_detail_rq('bd'));
select pg_temp.r11r_call('shape-queue', 'cms_list_editorial_reviews', 'rvA', pg_temp.b11_queue_rq(null));
select ok(pg_temp.r11_out('shape-draft') = '00000:'
    and jsonb_array_length(pg_temp.r11_resp('shape-draft')#>'{preparation,preflight,results}') = 17
    and pg_temp.r11_resp('shape-draft')#>>'{revision,state}' = 'draft',
  'the draft read returns the preparation with the 17-result submit-phase preflight [P2-S11-AC-052]');
select ok(pg_temp.r11_out('shape-bounds') = '00000:'
    and jsonb_array_length(pg_temp.r11_resp('shape-bounds')->'schedules') = 16
    and jsonb_array_length(pg_temp.r11_resp('shape-bounds')->'publications') = 64
    and pg_temp.r11_resp('shape-bounds')->'review' <> 'null'::jsonb,
  'the bounds read returns the latest review, 16 schedules and 64 publications [P2-S11-AC-052]');
select ok(pg_temp.r11_out('shape-detail') = '00000:'
    and jsonb_array_length(pg_temp.r11_resp('shape-detail')->'assignments') = 32
    and jsonb_array_length(pg_temp.r11_resp('shape-detail')->'decisions') = 7,
  'the detail read returns 32 assignment summaries and 7 decisions [P2-S11-AC-058]');
select ok(pg_temp.r11_out('shape-queue') = '00000:'
    and jsonb_array_length(pg_temp.r11_resp('shape-queue')->'items') = 50
    and pg_temp.r11_resp('shape-queue')->>'nextCursor' is not null,
  'the queue returns the maximum page of 50 items and a next cursor [P2-S11-AC-064]');

-- ---------------------------------------------------------------------------
-- Measure.
-- ---------------------------------------------------------------------------
select pg_temp.r11_session('owner');
select pg_temp.b11_bench('workflow_draft128', 'cms_get_entry_workflow', pg_temp.b11_workflow_rq('bw-draft'), 30);
select pg_temp.b11_bench('workflow_bounds', 'cms_get_entry_workflow', pg_temp.b11_workflow_rq('bw-bounds'), 30);
select pg_temp.b11_bench('review_detail', 'cms_get_editorial_review', pg_temp.b11_detail_rq('bd'), 30);
select pg_temp.r11_session('rvA');
select pg_temp.b11_bench('queue_page1_limit50', 'cms_list_editorial_reviews', pg_temp.b11_queue_rq(null), 30);
select pg_temp.b11_bench('queue_page2_cursor', 'cms_list_editorial_reviews',
  pg_temp.b11_queue_rq(pg_temp.r11_resp('shape-queue')->>'nextCursor'), 30);

select diag(op || ' p50=' || round(percentile_cont(0.5) within group (order by ms)::numeric, 1) || 'ms p95=' || round(percentile_cont(0.95) within group (order by ms)::numeric, 1) || 'ms max=' || round(max(ms), 1) || 'ms n=' || count(*))
  from b11_timing group by op order by op;

select is((select string_agg(op || '=' || n, ',' order by op) from (select op, count(*) as n from b11_timing group by op) counts),
  'queue_page1_limit50=30,queue_page2_cursor=30,review_detail=30,workflow_bounds=30,workflow_draft128=30',
  'every operation is measured over thirty samples, so each p95 is taken over at least twenty [P2-S11-AC-052]');
select ok(pg_temp.b11_p95('workflow_draft128') < 1200,
  'CMS-03B-15 on a 128-field draft with the full preparation and 17-result preflight: p95 under the Tier 2 target of 1,200 ms [P2-S11-AC-052]');
select ok(pg_temp.b11_p95('workflow_bounds') < 1200,
  'CMS-03B-15 on an entry at 16 schedules, 64 publications and an open review: p95 under the Tier 2 target of 1,200 ms [P2-S11-AC-052]');
select ok(pg_temp.b11_p95('review_detail') < 750,
  'CMS-03B-16 at 7 of 8 decisions, 32 assignment summaries and a 128-field frozen manifest: p95 under the Tier 1 target of 750 ms [P2-S11-AC-058]');
select ok(pg_temp.b11_p95('queue_page1_limit50') < 750,
  'CMS-03B-17 first page at the maximum limit of 50 from 200 assigned reviews among 500: p95 under the Tier 1 target of 750 ms [P2-S11-AC-064]');
select ok(pg_temp.b11_p95('queue_page2_cursor') < 750,
  'CMS-03B-17 cursor page at the maximum limit of 50: p95 under the Tier 1 target of 750 ms [P2-S11-AC-064]');
select ok((select max(ms) from b11_timing) < 8000,
  'the worst sample of every read is under the exact 8,000 ms read deadline [P2-S11-AC-052]');

select * from finish();
rollback;
