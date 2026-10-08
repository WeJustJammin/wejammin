-- Slice 10 QA (WP-S10-3 fix): CMS-03B-04 restore transform/revalidation and the
-- database-side idempotency disposition.
--
-- Two obligations this entrypoint owns beyond the original WP-S10-2a restore
-- chain suite (phase_02_slice_10_restore_chain.sql):
--
-- 1. Transform/revalidation: the restore command types every source value
--    against the TARGET active schema (the rich_text.v1 grammar, the DEC-133
--    object structure, relation targets re-resolved against the target
--    RelationDefinition), rebinds each value to the target field definition,
--    recomputes every value hash and the payload hash server-side, and refuses
--    unreadable, unprovable or unsafe data with the typed
--    migration_chain_incomplete / template_incompatible refusals, never a blind
--    copy.  Each tamper probe forges its source inside a rolled-back
--    subtransaction so the shared fixture stays pristine.
--
-- 2. Idempotency disposition: the command may never write without a database
--    reservation, a completed reservation replays only its stored response
--    envelope (response_ref->'safeHeaders'->'response', exactly as CMS-03B-01/
--    02/10), a reserved or failed_retryable reservation re-enters once, and the
--    business hash binds the selected migration chain.  Every reservation
--    fixture is built through the real cms_reserve / cms_complete helpers.
--
-- This file is the single Supabase discovery entrypoint; the fragments under
-- phase_02_slice_10_restore_transform/ are includes, not discovered tests.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(53);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_10_restore_transform/000-restore-fixtures.sqlinc
\ir phase_02_slice_10_rpc/009-restore-policy-binding.sqlinc
\ir phase_02_slice_10_restore_transform/001-seams-and-validators.sqlinc
\ir phase_02_slice_10_restore_transform/002-typed-refusals.sqlinc
\ir phase_02_slice_10_restore_transform/003-translation-and-idempotency.sqlinc

select finish();
rollback;
