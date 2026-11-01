-- Slice 12 registered preflight provider cms.locale.no_fallback_gate (BE03c 1391, 1397;
-- BE03b Publication preflight registry 1811-1818).  Criteria: P2-S12-AC-240, AC-241 (locale),
-- receiving AC-051 and AC-052, AC-152.  RED before the 20261014050xxx locale migrations, GREEN after.
--
-- Fixture: the Slice 10 RPC world and the Slice 11 helper world (the h11doc type, its entry saved by
-- the real cms_create_entry, the review builders).  Variants are authored by the real
-- cms_author_locale_variant; source revisions are appended as phase_02_slice_12_locale_source_stale.sql
-- appends them; reviews are written through the Slice 11 review builders.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(60);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/001-world.sqlinc
\ir phase_02_slice_11_helpers/002-reviews.sqlinc
\ir phase_02_slice_12_locale_variant/000-helpers.sqlinc
\ir phase_02_slice_12_locale_gate/001-gate.sqlinc

select * from finish();
rollback;
