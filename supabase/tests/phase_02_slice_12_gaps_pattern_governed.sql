-- Slice 12 gap lane claude_s12_gaps_db2: pattern-version clauses on the governed set, in the pattern-definition world (real signed
-- block, real CMS-03C-12 / -06 / -08 / -07 / -09 producers under the real service_role, two real active content types).
--   AC-189 c1  the table CHECK refuses context, versions and new as raw pattern keys (selector is cited in pattern_definition/070)
--   AC-190 c1,2 a second REAL owner: same key, own lineage; a key only the first owner holds is indistinguishable from an unused key
--   AC-194     a successful create never registers, updates or deletes a block (registry tables byte-identical) and the digest readers
--              touch only the safe tuple members
--   AC-198 c0  the pattern policy basis from compatibleTypeIds
--   AC-200     pattern submit gates: draft only, nested pattern active, compatible types, stored digest, frozen dependency kinds
--   AC-209     pattern activate / schedule recheck of the nested pattern state and the block digest after approval
--   AC-193 c7  a registry change after an approved pattern review makes activate and schedule answer dependency_changed
--   AC-195     lifecycle columns of a pattern version advance only through the governed RPCs
-- The labelled fixtures besides the S09 membership tenure: (a) the second owner's pattern-designer grant is the forged
-- organization_actor_grant row that phase_02_slice_12_fix/000-owners.sqlinc uses (the repository has no command that grants a CMS
-- capability of a non-initialized organization) and its one active content type is a clone of chain type 1 under the second owner
-- (the way s12pd_make_compatible_type clones); (b) draft rows copied directly in the RPC context to reach a stored state the honest
-- producers cannot (a stored digest that differs from the recomputed one, a compatible type that is not active).
\set ON_ERROR_STOP on
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
select pg_temp.s09d_create_type('gapp-draft-type', 'gappdraft');
\ir phase_02_slice_12_gaps_pattern/005-helpers.sqlinc
\ir phase_02_slice_12_gaps_pattern/010-storage-and-registry.sqlinc
\ir phase_02_slice_12_gaps_pattern/020-cross-owner.sqlinc
\ir phase_02_slice_12_gaps_pattern/030-submit-gates.sqlinc
\ir phase_02_slice_12_gaps_pattern/040-activation-recheck.sqlinc

select * from finish();
rollback;
