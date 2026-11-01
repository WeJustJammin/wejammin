-- DEC-197 new-table ACL and forced-RLS proof; existing consumer posture retained.
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;
begin;
select no_plan();
\ir phase_02_slice_11_delivery_receiving/010-helpers.sqlinc
\ir phase_02_slice_11_delivery_receiving/000-world.sqlinc
\ir phase_02_slice_11_delivery_receiving/050-security.sqlinc
select * from finish();
rollback;
