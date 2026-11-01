-- Slice 12 gap lane claude_s12_gaps_db2: template submit gates (P2-S12-AC-199) and the activation-time recheck of a template whose
-- block registry changed after approval (P2-S12-AC-208).  Real signed CMS-03A-05 / CMS-03A-08 block commands, real CMS-03C-01/-06/-07/-08/
-- -09 producers.  Where the honest producers cannot reach a state (a stored digest that differs from the recomputed one, a compatible
-- type that is not active) the draft is a labelled legacy-shaped fixture: a direct copy of a real draft template row in the RPC
-- context, the way phase_02_slice_12_fix_template_per_owner.sql builds its raw template rows; the refusal and its absence of effects
-- are still produced by the real CMS-03C-06 command.
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
\ir phase_02_slice_09_p240/01-block.sqlinc
\ir phase_02_slice_12_governed_submit/000-fixtures.sqlinc
\ir phase_02_slice_12_governed_submit/005-real-type-chains.sqlinc
select pg_temp.s09d_create_type('gapg-draft', 'gapgdraft');
\ir phase_02_slice_12_governed_assignment/000-world.sqlinc
\ir phase_02_slice_12_governed_recheck/002-lapse-helpers.sqlinc
\ir phase_02_slice_12_governed_activation/000-world.sqlinc
\ir phase_02_slice_12_governed_recheck/005-helpers.sqlinc
\ir phase_02_slice_12_gaps_governed/005-helpers.sqlinc
\ir phase_02_slice_12_gaps_governed/010-setup.sqlinc
\ir phase_02_slice_12_gaps_governed/080-template-gates.sqlinc
\ir phase_02_slice_12_gaps_governed/090-template-activation-recheck.sqlinc

select * from finish();
rollback;
