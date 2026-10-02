commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;

select no_plan();

-- Slice 10 DEC-107 RED->GREEN suite for the conflict-record forward migration
-- (20260927100000_cms_conflict_record_authority.sql). These assertions mirror
-- the frozen BE03b canonical row for ConflictRecord / cms_conflict_records.
--
-- The suite is written before the migration so an absent migration produces
-- evidence-backed RED rather than a silent pass. This file is the single
-- Supabase discovery entrypoint; the fragments below are includes in numeric
-- order and are not independently discovered tests. Helpers resolve
-- identifiers by OID so a missing object yields false instead of raising.

\ir phase_02_slice_10_conflict_schema/000-helpers.sqlinc
\ir phase_02_slice_10_conflict_schema/001-conflict-record-schema.sqlinc
\ir phase_02_slice_10_conflict_schema/002-proposed-values-bounds.sqlinc

select finish();

rollback;
