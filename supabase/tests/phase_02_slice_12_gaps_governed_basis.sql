-- Slice 12 gap lane claude_s12_gaps_db2: governed policy basis (P2-S12-AC-198), taxonomy submit gates (AC-201), the canonical_domain
-- recheck (AC-202 clause 1) and the lifecycle immutability of the three version tables (AC-195).  Real producers throughout; extra
-- content types are created BEFORE rev1/rev2 move into the owner party (010-setup), exactly as governed_submit/005 orders its chains.
\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc
select pg_temp.s09d_session('owner', 'authenticated');
\ir phase_02_slice_12_governed_submit/000-fixtures.sqlinc
\ir phase_02_slice_12_governed_submit/005-real-type-chains.sqlinc
select pg_temp.s09g_grant('gapb:legal', 'owner', 'designer2', 'cms.reviewer.legal', pg_temp.s09g_day(1));
select pg_temp.s09g_grant('gapb:security', 'owner', 'designer2', 'cms.reviewer.security', pg_temp.s09g_day(1));
select pg_temp.s09d_create_type('gapb2', 'gapb2');
select pg_temp.s09d_to_active('gapb2', array['rev1']);
select pg_temp.s09d_create_type('gapb3', 'gapb3');
select pg_temp.s09d_to_active('gapb3', array['rev1']);
select pg_temp.s09d_create_type('gapbl', 'gapbl', 'cms.disclosure.legal');
select pg_temp.s09d_to_active('gapbl', array['rev1', 'designer2']);
select pg_temp.s09d_create_type('gapbs', 'gapbs', 'cms.disclosure.security');
select pg_temp.s09d_to_active('gapbs', array['rev1', 'designer2']);
insert into s12gov_ids(key, value) values
  ('gapb2', pg_temp.s09d_id('gapb2:type')::text), ('gapb3', pg_temp.s09d_id('gapb3:type')::text),
  ('gapbl', pg_temp.s09d_id('gapbl:type')::text), ('gapbs', pg_temp.s09d_id('gapbs:type')::text);
select ok((select count(*) = 4 and bool_and(probe.state = '00000') from s09d_probe probe
    where probe.label in ('gapb2:activate', 'gapb3:activate', 'gapbl:activate', 'gapbs:activate')),
  'fixture: the two ordinary, the legal and the security content types are really activated through the 03a chain [P2-S12-AC-198]');
\ir phase_02_slice_12_governed_assignment/000-world.sqlinc
\ir phase_02_slice_12_governed_recheck/002-lapse-helpers.sqlinc
\ir phase_02_slice_12_governed_activation/000-world.sqlinc
\ir phase_02_slice_12_governed_recheck/005-helpers.sqlinc
\ir phase_02_slice_12_gaps_governed/005-helpers.sqlinc
\ir phase_02_slice_12_gaps_governed/010-setup.sqlinc
\ir phase_02_slice_12_gaps_governed/015-taxonomy-helpers.sqlinc
\ir phase_02_slice_12_gaps_governed/050-policy-basis.sqlinc
\ir phase_02_slice_12_gaps_governed/060-taxonomy-gates.sqlinc
\ir phase_02_slice_12_gaps_governed/070-canonical-recheck.sqlinc
\ir phase_02_slice_12_gaps_governed/040-lifecycle.sqlinc

select * from finish();
rollback;
