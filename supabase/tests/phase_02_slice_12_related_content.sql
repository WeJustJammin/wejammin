-- Slice 12 CMS-03C-05 curate related content (BE03c 163, 385-387, 1379-1384, 1432, 1510, 1542; tracker
-- P2-S12-AC-036 .. AC-038, AC-059 .. AC-062, AC-227 .. AC-230).  RED before the 20261014060xxx related
-- migrations, GREEN after.  AC-063 (the protected Web form) belongs to the Web lane.
--
-- World: the Slice 10 RPC prelude, the Slice 11 data-model prelude and review/lineage builders; entries,
-- terms and publications through the real producers (see phase_02_slice_12_related_content/001-world.sqlinc).

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
\ir phase_02_slice_12_related_content/002-shape-and-grants.sqlinc
\ir phase_02_slice_12_related_content/003-write.sqlinc
\ir phase_02_slice_12_related_content/004-replace.sqlinc
\ir phase_02_slice_12_related_content/005-validation.sqlinc
\ir phase_02_slice_12_related_content/006-eligibility-authz.sqlinc
\ir phase_02_slice_12_related_content/007-cas-and-locks.sqlinc

select * from finish();
rollback;
