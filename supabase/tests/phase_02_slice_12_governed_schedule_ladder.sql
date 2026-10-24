-- Slice 12 lane governed-b, CMS-03C-19 retry ladder and lease expiry (BE03c Scheduled activation (OD-6): 15 s / 60 s / 300 s, three
-- attempts, then blocked retries_exhausted; the five-minute lease).  Real waits (about 12 minutes), real schedules, no clock forgery.
-- The routine claim / execute behaviour is in phase_02_slice_12_governed_schedule.sql; run this file separately.

\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(24);

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc
select pg_temp.s09d_session('owner', 'authenticated');
\ir phase_02_slice_12_governed_submit/000-fixtures.sqlinc
\ir phase_02_slice_12_governed_submit/005-real-type-chains.sqlinc
\ir phase_02_slice_12_governed_assignment/000-world.sqlinc
\ir phase_02_slice_12_governed_activation/000-world.sqlinc
\ir phase_02_slice_12_governed_schedule_ladder/010-ladder.sqlinc

select finish();
rollback;
