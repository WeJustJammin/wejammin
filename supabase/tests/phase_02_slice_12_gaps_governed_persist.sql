-- Slice 12 gap lane claude_s12_gaps_db2: behavioural proofs of the governed persistence clauses (P2-S12-AC-251 .. AC-255, the
-- AC-252 separation trigger) and of the rejection audit (AC-197).  World: S09 owner, real type chains, real CMS-03C-01/-06/-07/-08/-09
-- producers under the real service_role; the probes are direct statements rolled back by g2_try plus real SET ROLE denials.
\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc
select pg_temp.s09d_session('owner', 'authenticated');
\ir phase_02_slice_12_governed_submit/000-fixtures.sqlinc
\ir phase_02_slice_12_governed_submit/005-real-type-chains.sqlinc
\ir phase_02_slice_12_governed_assignment/000-world.sqlinc
\ir phase_02_slice_12_governed_recheck/002-lapse-helpers.sqlinc
\ir phase_02_slice_12_governed_activation/000-world.sqlinc
\ir phase_02_slice_12_gaps_governed/005-helpers.sqlinc
\ir phase_02_slice_12_gaps_governed/010-setup.sqlinc
\ir phase_02_slice_12_gaps_governed/020-persistence-probes.sqlinc
\ir phase_02_slice_12_gaps_governed/030-reject-audit.sqlinc

select * from finish();
rollback;
