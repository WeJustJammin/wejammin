commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;

select no_plan();

-- Slice 10 QA-RED.  These assertions mirror BE03b's canonical editorial
-- records (ContentEntry, EntryRevision, EntryFieldValue, EntryRelation), the
-- BE03b mutability table, and DEC-106's initial-entry assignment requirement.
-- The suite is deliberately written before the authority migration so an
-- absent migration produces evidence-backed RED rather than a silent pass.
-- This file is the single Supabase discovery entrypoint; the fragments below
-- are includes in numeric order and are not independently discovered tests.

\ir phase_02_slice_10_schema/000-helpers.sqlinc
\ir phase_02_slice_10_schema/001-entries-and-revisions.sqlinc
\ir phase_02_slice_10_schema/002-values-relations-and-seam.sqlinc
\ir phase_02_slice_10_schema/003-security-and-indexes.sqlinc

select finish();

rollback;
