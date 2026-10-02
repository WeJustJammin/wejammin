commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;

select no_plan();

-- Slice 10 RPC QA-RED.  These assertions mirror BE03b CMS-03B-10
-- (cms_create_entry: atomic entry + first draft revision + creator
-- assignment) and CMS-03B-11 (cms_get_entry_draft: authorized draft detail).
-- The suite is deliberately written before the authority RPC migration so an
-- absent migration produces evidence-backed RED rather than a silent pass.
-- This file is the single Supabase discovery entrypoint; the fragments below
-- are includes in numeric order and are not independently discovered tests.

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_10_rpc/002-create.sqlinc
\ir phase_02_slice_10_rpc/002b-create-owner-conceal.sqlinc
\ir phase_02_slice_10_rpc/003-detail.sqlinc
\ir phase_02_slice_10_rpc/003b-detail-owner-scope.sqlinc
\ir phase_02_slice_10_rpc/004-schema-seams.sqlinc
\ir phase_02_slice_10_rpc/004b-revision-write.sqlinc
\ir phase_02_slice_10_rpc/005-history.sqlinc
\ir phase_02_slice_10_rpc/006-field-value-calendar.sqlinc
\ir phase_02_slice_10_rpc/007-create-positive.sqlinc
\ir phase_02_slice_10_rpc/008-enum-values.sqlinc

select finish();

rollback;
