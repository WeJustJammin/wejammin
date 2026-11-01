-- DEC-197 receiving foundation: catalog, references and sealed manifest lifecycle.
-- Authoring checkpoint only; root observes RED before releasing production DDL.
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;
begin;
select no_plan();
\ir phase_02_slice_11_delivery_receiving/010-helpers.sqlinc
\ir phase_02_slice_11_delivery_receiving/000-world.sqlinc
\ir phase_02_slice_11_delivery_receiving/020-catalog.sqlinc
\ir phase_02_slice_11_delivery_receiving/030-references.sqlinc
\ir phase_02_slice_11_delivery_receiving/040-lifecycle.sqlinc
select * from finish();
rollback;
