-- Slice 12 gap lane claude_s12_gaps_db2: P2-S12-AC-216 clause 1 (BE03c CMS-03C-02): `patternId` is a lineage id of the CALLER'S owner
-- scope.  pattern_placement/050 proves an ABSENT patternId answers NOT_FOUND; here a patternId that exists but belongs to ANOTHER
-- owner answers the identical complete NOT_FOUND (no pattern_version_not_active, no cross-owner existence signal) and writes nothing.
-- World: the placement world (real governed active patterns, a real draft entry revision r1) plus the second real owner B of
-- phase_02_slice_12_gaps_pattern/020-cross-owner.sqlinc, who holds a pattern of his own (the labelled fixtures are described there).
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;
begin;
select no_plan();
select set_config('s12pd.type_count', '2', true);
\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_p240/01-block.sqlinc
\ir phase_02_slice_12_pattern_definition/000-fixtures.sqlinc
\ir phase_02_slice_12_pattern_definition/010-oracles.sqlinc
\ir phase_02_slice_12_pattern_placement/000-fixtures.sqlinc
\ir phase_02_slice_12_pattern_placement/010-oracles.sqlinc
\ir phase_02_slice_12_pattern_placement/020-schema.sqlinc
\ir phase_02_slice_12_pattern_placement/030-patterns.sqlinc
select pg_temp.s12pl_tentry('r1');
\ir phase_02_slice_12_gaps_pattern/005-helpers.sqlinc
\ir phase_02_slice_12_gaps_pattern/020-cross-owner.sqlinc

select * from pg_temp.s12pl_refused('foreign-pattern', pg_temp.s12pl_request('r1', 'pa', '/main', '{}'::jsonb, 's12pl-xo-0001')
  || jsonb_build_object('patternId', pg_temp.s12pd_body('b-shared')->>'patternId'), 'NOT_FOUND');
select * from pg_temp.s12pl_refused('absent-pattern', pg_temp.s12pl_request('r1', 'pa', '/main', '{}'::jsonb, 's12pl-xo-0002')
  || jsonb_build_object('patternId', 'a9120000-0000-4000-8000-0000000000fd'), 'NOT_FOUND');
select is((select (state, message, detail) from s12pl_out where label = 'foreign-pattern'),
  (select (state, message, detail) from s12pl_out where label = 'absent-pattern'),
  'a patternId held by another owner answers byte-identically to an absent patternId (SQLSTATE, message, DETAIL) [P2-S12-AC-216]');
select ok(pg_temp.s12pd_body('b-shared')->>'patternId' is not null
    and (select owner_id = pg_temp.s09d_id('otherOrg') from platform_private.cms_pattern_versions
          where pattern_id = (pg_temp.s12pd_body('b-shared')->>'patternId')::uuid limit 1),
  'control: the foreign patternId really exists and belongs to the other owner [P2-S12-AC-216]');

select ok(exists (select 1 from s12pl_out where requested_role = 'service_role')
  and not exists (select 1 from s12pl_out where call_role is distinct from requested_role),
  'every placement command ran under its recorded effective database role [P2-S12-AC-216]');
select * from finish();
rollback;
