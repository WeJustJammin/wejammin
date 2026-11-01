-- Slice 12 cmsCompositionInstancesRead, the protected read of an entry's current draft revision's composition instances (DEC-206; BE03c route
-- registry, validation row `cmsCompositionInstancesRead | entryId/cursor`, schemas CompositionInstancesQuery / CompositionInstancePage, error
-- matrix, catalog and authority rows; tracker P2-S12-AC-269).  RED before the 20261022050xxx dec206 migrations, GREEN after.
-- Needs the unpromoted pattern-updates and dec193 migrations (pending_diff, the effective-composition adapter and the render plan): stage
-- lanes `pattern-updates,dec193,dec206`.  The Web page (replacing the session-only boundary) belongs to the same lane's Web layer.
--
-- World: the DEC-108 actors, the pattern-definition and placement fixtures; every pattern and placement through the real producers
-- (001-world.sqlinc lists the labelled fixture writes).

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

select set_config('s12pd.type_count', '1', true);
\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_p240/01-block.sqlinc
\ir phase_02_slice_12_pattern_definition/000-fixtures.sqlinc
\ir phase_02_slice_12_pattern_definition/010-oracles.sqlinc
\ir phase_02_slice_12_pattern_placement/000-fixtures.sqlinc
\ir phase_02_slice_12_pattern_placement/010-oracles.sqlinc
\ir phase_02_slice_12_pattern_updates_common/000-helpers.sqlinc
\ir phase_02_slice_12_composition_instances_read/000-helpers.sqlinc
\ir phase_02_slice_12_composition_instances_read/001-world.sqlinc
\ir phase_02_slice_12_composition_instances_read/002-shape-and-grants.sqlinc
\ir phase_02_slice_12_composition_instances_read/003-order-and-heads.sqlinc
\ir phase_02_slice_12_composition_instances_read/004-paging.sqlinc
\ir phase_02_slice_12_composition_instances_read/005-authority-and-grammar.sqlinc

select finish();
rollback;
