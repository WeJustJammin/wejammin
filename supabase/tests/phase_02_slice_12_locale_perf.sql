-- Slice 12 locale performance (BE03c Security, performance, and recovery tests 1633; tracker P2-S12-AC-279,
-- locale part): 128 locale fields meet the RPC < 300 ms target.  A separate suite from
-- phase_02_slice_12_locale_resolution.sql on purpose: these are wall-clock assertions, so they belong with
-- the other host-sensitive gates (run on a quiet host, like the Slice 11 plan-stability bench), and a loaded
-- machine must not fail the functional resolver suite.  RED before the 20261014050xxx locale migrations.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(10);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_12_locale_variant/000-helpers.sqlinc
\ir phase_02_slice_12_locale_perf/001-bench.sqlinc

select * from finish();
rollback;
