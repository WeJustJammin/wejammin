-- Source-only QA: BE03b relation target visibility/assignment lock position 2.
-- Run only against the explicitly staged ALT database; this transaction rolls back.
\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;
begin;
select no_plan();
\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_10_relation_authoring/000-relation-fixture.sqlinc
\ir phase_02_slice_10_rpc/009-restore-policy-binding.sqlinc
\ir phase_02_slice_12_restore_relation_visibility/000-fixture.sqlinc
\ir phase_02_slice_12_restore_relation_visibility/010-serial.sqlinc
select * from finish();
rollback;
