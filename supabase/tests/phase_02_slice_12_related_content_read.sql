-- Slice 12 cmsRelatedContentRead, the protected read of the saved related-content rule (DEC-195; BE03c route
-- registry, validation row `cmsRelatedContentRead | entryId`, error matrix, catalog, authority row).  RED before
-- the 20261014200xxx dec195 migrations, GREEN after.  The Web page (replacing SG-S12-03 and SG-S12-04) belongs
-- to the same lane's Web layer.
--
-- World: the CMS-03C-05 suite world (phase_02_slice_12_related_content/001-world.sqlinc): entries through the
-- real producers, caller assignments, a foreign owner party.  Writes go through the real CMS-03C-05 command.

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
\ir phase_02_slice_12_related_content_read/000-helpers.sqlinc
\ir phase_02_slice_12_related_content_read/001-shape-and-grants.sqlinc
\ir phase_02_slice_12_related_content_read/002-read.sqlinc
\ir phase_02_slice_12_related_content_read/003-authority.sqlinc

select * from finish();
rollback;
