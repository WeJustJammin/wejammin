-- Slice 12 CMS-03C-21 related-content public targets (BE03c 190, 1385; tracker P2-S12-AC-153 .. AC-158,
-- AC-229 .. AC-232, AC-279).  RED before the 20261014060xxx related migrations, GREEN after.  The Shard 04
-- delivery projection and the Slice 11 related-content recheck, the registered callers, are later lanes.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/001-world.sqlinc
\ir phase_02_slice_11_helpers/002-reviews.sqlinc
\ir phase_02_slice_11_helpers/004-lineage.sqlinc
\ir phase_02_slice_12_related_content/000-helpers.sqlinc
\ir phase_02_slice_12_related_content/001-world.sqlinc
\ir phase_02_slice_12_related_public_targets/001-projection.sqlinc
\ir phase_02_slice_12_related_public_targets/002-recompute-and-ties.sqlinc
\ir phase_02_slice_12_related_public_targets/003-bound.sqlinc

select * from finish();
rollback;
