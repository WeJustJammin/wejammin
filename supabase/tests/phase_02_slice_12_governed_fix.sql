-- Slice 12 lane governed-fix: forward fixes to applied governed SQL (BE03c 389, 1259, 1304, 1313-1314, 1375).
--   1. cms_governed_current_digest pattern branch raised 42P10 (SELECT DISTINCT with an ORDER BY expression that is not in
--      the select list), so no pattern subject could be digested, submitted or rechecked.  Driven directly with real
--      registered blocks; the template and taxonomy branches are proven unchanged.
--   2-4. The submit refusal tokens are asserted behaviorally in phase_02_slice_12_governed_submit/030-refusals.sqlinc
--      (stored-hash mismatch).  Nested-pattern-inactive and canonical-source DETAIL need pattern and taxonomy
--      producers that are not promoted yet, so here they are CATALOG-SOURCE oracles over the live function body only;
--      their behavioral proof is the combined staged run named in the lane report (taxonomy-def suite 060 and the
--      pattern-def nested-retire case).  A source oracle is weaker than behavior and is labelled as such.
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;
begin;
select no_plan();

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_p240/01-block.sqlinc
\ir phase_02_slice_12_governed_fix/000-blocks.sqlinc
\ir phase_02_slice_12_governed_fix/005-submit-source.sqlinc
\ir phase_02_slice_12_governed_fix/010-digest.sqlinc
\ir phase_02_slice_12_governed_fix/020-deprecated-digest.sqlinc
\ir phase_02_slice_12_governed_fix/030-replay.sqlinc

select finish();
rollback;
