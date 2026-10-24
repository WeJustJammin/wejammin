-- Slice 12 lane linked-scan (claude_s12_linked_scan), P2-S12-AC-212 / AC-213 (BE03c "Linked update (diff, accept, detach)", "Job transport
-- (DEC-166, DEC-180 G9)", "Slice 12 lock order" row `cms.pattern.linked_update_scan`, "Event schemas" cms.pattern.activated.v1).  The database
-- half of the typed platform-queue job: platform_api.cms_scan_linked_pattern_updates and the event resolver cms_linked_scan_resolve_event.
-- Real fixtures only (see phase_02_slice_12_linked_scan/README.md).  Stage lane `linked-scan`.

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
\ir phase_02_slice_12_pattern_placement/000-fixtures.sqlinc
\ir phase_02_slice_12_pattern_placement/010-oracles.sqlinc
\ir phase_02_slice_12_pattern_updates_common/000-helpers.sqlinc
\ir phase_02_slice_12_linked_scan/000-helpers.sqlinc
\ir phase_02_slice_12_linked_scan/010-world.sqlinc
\ir phase_02_slice_12_linked_scan/020-contract.sqlinc
\ir phase_02_slice_12_linked_scan/030-scan.sqlinc
\ir phase_02_slice_12_linked_scan/040-bounds.sqlinc
\ir phase_02_slice_12_linked_scan/050-resolver.sqlinc
\ir phase_02_slice_12_linked_scan/060-helper.sqlinc

select finish();
rollback;
