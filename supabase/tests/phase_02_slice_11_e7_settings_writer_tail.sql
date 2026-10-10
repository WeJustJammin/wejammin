-- E7 / DEC-163 ordinary writer tails. Local SQL composition, not API/activation acceptance.
-- Imports emit four assertions (S10 fixture); no S11 world/reviewer world import.
-- Observations inside savepoints are captured with gset; TAP runs AFTER rollback.
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;
begin;
select plan(68);
\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_e7_settings/000-writer-helpers.sqlinc
\ir phase_02_slice_11_e7_settings/001-writer-requests.sqlinc
\ir phase_02_slice_11_e7_settings/002-review-atomicity.sqlinc
select * from finish();
rollback;
