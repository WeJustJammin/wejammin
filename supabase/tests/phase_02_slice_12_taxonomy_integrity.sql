-- Slice 12 DEC-141 receiving obligations 1, 3 and 5 (BE03c Receiving obligations from Slice 10): taxonomy-version resolution
-- (P2-S12-AC-242), the 03b taxonomy value encoder with the authority registered (AC-246, AC-221, AC-224), comparison and lineage by
-- identity, restore translation of term assignments (AC-244).  RED before the 2026102410xxxx taxonomy-integrity migrations.
-- Fixture: the Slice 10 RPC world and its `s10gallery` type (a real taxonomy field `tags`), all rows written by the real commands.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_10_value_source/000-gallery-fixture.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_12_taxonomy_integrity/000-world.sqlinc
\ir phase_02_slice_12_taxonomy_integrity/005-gallery-vocab.sqlinc
\ir phase_02_slice_12_taxonomy_integrity/010-resolver.sqlinc
\ir phase_02_slice_12_taxonomy_integrity/020-encoder.sqlinc
\ir phase_02_slice_12_taxonomy_integrity/025-resolve.sqlinc
\ir phase_02_slice_12_taxonomy_integrity/027-successor.sqlinc
\ir phase_02_slice_12_taxonomy_integrity/030-compare.sqlinc
\ir phase_02_slice_12_taxonomy_integrity/050-restore.sqlinc
\ir phase_02_slice_12_taxonomy_integrity/028-active-ids.sqlinc
\ir phase_02_slice_12_taxonomy_integrity/029-scope-and-stale-plan.sqlinc
\ir phase_02_slice_12_taxonomy_integrity/060-resolver-context.sqlinc

select * from finish();
rollback;
