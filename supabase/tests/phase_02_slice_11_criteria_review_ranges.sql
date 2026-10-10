-- Slice 11 criteria: P2-S11-AC-120, "Persistence `cms_editorial_reviews`: the frozen revision, dependency, activation and
-- workflow-policy evidence is immutable ... and the CHECKs tie ... `recorded_decision_count` to at most
-- `required_decision_count` (1 to 8), and a `protected` review to at least 2 decisions and a non-empty
-- `required_capabilities` ..."  The older suite proves a single protected-review refusal (the row builder always supplies
-- `["cms.reviewer"]`, so the capability rules never fire there).  This suite probes every CHECK in isolation, naming the
-- constraint that refuses the row:
--   required_decision_count  0, 9 and -1 refused; 1 and 8 accepted
--   recorded_decision_count  above the required count, or above 8, refused
--   required_capabilities    empty, not an array, or over 16 entries refused (ordinary and protected review)
--   protected review         count 1 with a non-empty list refused; count 2 with a non-empty list accepted
-- and that EVERY frozen evidence column (not only the three the older suite changes) is immutable under the update guard.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(22);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc

-- Like s11_bare_outcome (every USER trigger of the table disabled, a success rolled back) but names the refusing
-- constraint: '23514:<constraint>' for a CHECK, '00000' for an accepted row.
create or replace function pg_temp.c11_bare(p_sql text)
returns text
language plpgsql
as $body$
declare
  outcome text;
  violated text;
begin
  execute 'alter table platform_private.cms_editorial_reviews disable trigger user';
  begin
    execute p_sql;
    raise exception 'C11_BARE_ACCEPTED';
  exception
    when others then
      get stacked diagnostics violated = constraint_name;
      outcome := case when sqlerrm = 'C11_BARE_ACCEPTED' then '00000'
                      else sqlstate || ':' || coalesce(nullif(violated, ''), sqlerrm) end;
  end;
  execute 'alter table platform_private.cms_editorial_reviews enable trigger user';
  return outcome;
end;
$body$;

create or replace function pg_temp.c11_review_sql(p_overrides jsonb)
returns text
language sql
as $body$
  select pg_temp.s11_insert_sql('platform_private.cms_editorial_reviews', pg_temp.s11_review_row(p_overrides))
$body$;

-- ---------------------------------------------------------------------------
-- required_decision_count is 1 to 8.
-- ---------------------------------------------------------------------------
select is(pg_temp.c11_bare(pg_temp.c11_review_sql('{"required_decision_count":1}')), '00000',
  'control: the canonical ordinary review image is accepted [P2-S11-AC-120]');
select is(
  (select string_agg(n || '=' || pg_temp.c11_bare(pg_temp.c11_review_sql(jsonb_build_object('required_decision_count', n))), ',' order by n)
     from unnest(array[0, 9]) as n),
  '0=23514:cms_editorial_reviews_required_decision_count_check,9=23514:cms_editorial_reviews_required_decision_count_check',
  'a required decision count of 0 or 9 is refused by the 1-to-8 CHECK [P2-S11-AC-120]');
select is(left(pg_temp.c11_bare(pg_temp.c11_review_sql('{"required_decision_count":-1}')), 6), '23514:',
  'a negative required decision count is refused by a CHECK (it also leaves the recorded count above the required one) [P2-S11-AC-120]');
select is(pg_temp.c11_bare(pg_temp.c11_review_sql('{"required_decision_count":8}')), '00000',
  'the upper bound 8 is accepted [P2-S11-AC-120]');

-- ---------------------------------------------------------------------------
-- recorded_decision_count never exceeds required_decision_count (and 8).
-- ---------------------------------------------------------------------------
select is(pg_temp.c11_bare(pg_temp.c11_review_sql('{"required_decision_count":1,"recorded_decision_count":2}')),
  '23514:cms_editorial_reviews_recorded_decision_count_check',
  'a recorded count above the required count is refused [P2-S11-AC-120]');
select is(pg_temp.c11_bare(pg_temp.c11_review_sql('{"required_decision_count":8,"recorded_decision_count":9}')),
  '23514:cms_editorial_reviews_recorded_decision_count_check',
  'a recorded count above 8 is refused even at the largest required count [P2-S11-AC-120]');
select is(pg_temp.c11_bare(pg_temp.c11_review_sql('{"required_decision_count":8,"recorded_decision_count":8}')), '00000',
  'a recorded count equal to the required count of 8 is accepted [P2-S11-AC-120]');

-- ---------------------------------------------------------------------------
-- required_capabilities is a non-empty array (1 to 16), for ordinary and protected reviews alike.
-- ---------------------------------------------------------------------------
select is(pg_temp.c11_bare(pg_temp.c11_review_sql('{"required_capabilities":[]}')),
  '23514:cms_editorial_reviews_required_capabilities_check',
  'an ordinary review with an empty required_capabilities is refused [P2-S11-AC-120]');
select is(pg_temp.c11_bare(pg_temp.c11_review_sql('{"risk_class":"protected","required_decision_count":2,"required_capabilities":[]}')),
  '23514:cms_editorial_reviews_protected_capabilities_check',
  'a protected review with an empty required_capabilities is refused by the protected-capabilities CHECK [P2-S11-AC-120]');
select is(pg_temp.c11_bare(pg_temp.c11_review_sql('{"required_capabilities":{"cms.reviewer":true}}')),
  '23514:cms_editorial_reviews_required_capabilities_check',
  'required_capabilities that is not an array is refused [P2-S11-AC-120]');
select is(
  (select pg_temp.c11_bare(pg_temp.c11_review_sql(jsonb_build_object('required_capabilities',
            (select jsonb_agg('cms.cap' || n) from generate_series(1, 17) n))))),
  '23514:cms_editorial_reviews_required_capabilities_check',
  'a required_capabilities list of 17 entries is refused [P2-S11-AC-120]');
select is(pg_temp.c11_bare(pg_temp.c11_review_sql(jsonb_build_object('required_capabilities',
            (select jsonb_agg('cms.cap' || n) from generate_series(1, 16) n)))), '00000',
  'a list of 16 entries is accepted [P2-S11-AC-120]');

-- ---------------------------------------------------------------------------
-- A protected review needs at least two decisions and a non-empty capability list.
-- ---------------------------------------------------------------------------
select is(pg_temp.c11_bare(pg_temp.c11_review_sql('{"risk_class":"protected","required_decision_count":1}')),
  '23514:cms_editorial_reviews_protected_decisions_check',
  'a protected review with one required decision and a non-empty capability list is refused [P2-S11-AC-120]');
select is(pg_temp.c11_bare(pg_temp.c11_review_sql('{"risk_class":"protected","required_decision_count":2,"required_capabilities":["cms.reviewer","cms.reviewer.policy"]}')),
  '00000',
  'a protected review with two decisions and a non-empty capability list is accepted [P2-S11-AC-120]');

-- ---------------------------------------------------------------------------
-- Every frozen evidence column is immutable.
-- ---------------------------------------------------------------------------
insert into s11_ids(key, value) values ('review1', 'a9110000-0000-4000-8000-000000000301');
select pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_editorial_reviews',
  pg_temp.s11_review_row(jsonb_build_object('id', pg_temp.s11_id('review1')))));
select is((select state || '/v' || version from platform_private.cms_editorial_reviews where id = pg_temp.s11_id('review1')), 'open/v1',
  'control: the review under the update probes is open at version 1 [P2-S11-AC-120]');
select is(
  (select coalesce(string_agg(col, ',' order by col) filter (where outcome <> 'P0001:IMMUTABLE_RECORD'), 'all-immutable')
     from (
       select v.col, pg_temp.s11_outcome(format(
                'update platform_private.cms_editorial_reviews set %I = %s, version = 2, updated_at = clock_timestamp() where id = %L',
                v.col, v.expr, pg_temp.s11_id('review1'))) as outcome
         from (values
           ('activation_evidence', $$'{"changed":true}'::jsonb$$),
           ('dependency_manifest', $$'{"changed":true}'::jsonb$$),
           ('dependency_hash', $$repeat('c', 64)$$),
           ('frozen_hash', $$repeat('c', 64)$$),
           ('workflow_policy_key', $$'other'$$),
           ('workflow_policy_version', $$7$$),
           ('workflow_policy_hash', $$repeat('c', 64)$$),
           ('approval_evidence_hash', $$repeat('c', 64)$$),
           ('risk_class', $$'protected'$$),
           ('required_capabilities', $$'["cms.reviewer","cms.reviewer.policy"]'::jsonb$$),
           ('required_decision_count', $$2$$),
           ('submitted_at', $$clock_timestamp()$$),
           ('submitted_by', format($$%L::uuid$$, pg_temp.s11_id('reviewer03'))),
           ('entry_id', format($$%L::uuid$$, pg_temp.s11_id('entryB'))),
           ('revision_id', format($$%L::uuid$$, pg_temp.s11_id('revB1')))
         ) as v(col, expr)) probes),
  'all-immutable',
  'the revision, entry, dependency, activation, workflow-policy and approval evidence, the risk class, the capability list, the required count and the submitter are all immutable: IMMUTABLE_RECORD [P2-S11-AC-120]');
select is((select state || '/v' || version from platform_private.cms_editorial_reviews where id = pg_temp.s11_id('review1')), 'open/v1',
  'and the review is unchanged by the refused updates [P2-S11-AC-120]');

select * from finish();
rollback;
