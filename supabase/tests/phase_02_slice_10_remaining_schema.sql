commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;

select no_plan();

-- Slice 10 remaining support-table RED->GREEN suite for the second forward
-- migration (20260927090000_cms_editorial_support_authority.sql). These
-- assertions mirror the BE03b canonical records for EditPresence,
-- EditorialReview, EditorialDecision, PublicationSchedule,
-- PublicationVersion and PreviewToken.
--
-- The suite is written before the migration so an absent migration produces
-- evidence-backed RED rather than a silent pass. This file is the single
-- Supabase discovery entrypoint; the fragments below are includes in numeric
-- order and are not independently discovered tests. Helpers resolve
-- identifiers by OID so a missing object yields false instead of raising.

\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/001-presence-and-reviews.sqlinc
\ir phase_02_slice_10_remaining_schema/002-decisions-schedules-publications.sqlinc
\ir phase_02_slice_10_remaining_schema/003-tokens-security-indexes.sqlinc

select finish();

rollback;
