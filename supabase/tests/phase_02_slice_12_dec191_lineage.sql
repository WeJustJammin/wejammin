-- Slice 12 lane dec191 fix pass 1, DEC-191 / CMS-03C-09 supersededVersion: the superseded version is the lineage's previously ACTIVE version
-- (its definition `version`), not "the previous definition number" and not "some earlier version".  Two lineages the main file cannot cover
-- (every lineage there activates v1, v2, v3 in order, so version N-1 is always the active one):
--   sa  v1 active, v2 submitted but never activated (left in review), v3 activated  -> supersededVersion 1 (not 2)
--   sb  v1 active then RETIRED, v2 activated (nothing active to supersede -> null), v3 activated (-> 2, not the retired 1)
-- Real fixtures only (same as phase_02_slice_12_dec191.sql): real grants, real approved governed reviews, real CMS-03C-09 activate and retire.
-- No governed row is inserted by hand and no trigger is disabled.  Run separately from the main file (no real wait).

\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(18);

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc
select pg_temp.s09d_session('owner', 'authenticated');
\ir phase_02_slice_12_governed_submit/000-fixtures.sqlinc
\ir phase_02_slice_12_governed_submit/005-real-type-chains.sqlinc
\ir phase_02_slice_12_governed_assignment/000-world.sqlinc
\ir phase_02_slice_12_governed_activation/000-world.sqlinc
\ir phase_02_slice_12_dec191/000-helpers.sqlinc
\ir phase_02_slice_12_dec191/080-lineage.sqlinc

select * from finish();
rollback;
