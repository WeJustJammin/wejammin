-- DEC-193 receiving RED: real public revision commands, composition only.
-- Author execution UNRUN. Stage Slice 12 pattern/update + DEC-193 writers first.
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
\ir phase_02_slice_12_dec193_carry/000-fixture.sqlinc
\ir phase_02_slice_12_dec193_carry/010-append-conflict.sqlinc
\ir phase_02_slice_12_dec193_carry/015-boundary-fixtures.sqlinc
\ir phase_02_slice_12_dec193_carry/016-append-carry-boundaries.sqlinc
\ir phase_02_slice_12_dec193_carry/017-pending-carry.sqlinc
\ir phase_02_slice_12_dec193_carry/018-parent-path-carry.sqlinc
\ir phase_02_slice_12_dec193_carry/019-provenance-after-update.sqlinc
\ir phase_02_slice_12_dec193_carry/020-restore.sqlinc
\ir phase_02_slice_12_dec193_carry/021-restore-boundary-fixture.sqlinc
\ir phase_02_slice_12_dec193_carry/022-restore-boundaries.sqlinc
\ir phase_02_slice_12_dec193_carry/023-restore-parent-path.sqlinc
\ir phase_02_slice_12_dec193_carry/024-restore-atomic-replay.sqlinc
select finish();
rollback;
