-- Slice 11 review A (A-M3): the in-call durable-effect observation is not blind.
--
-- The refusal suites probe their refusals with p_keep false, which rolls the call back whether it
-- succeeded or refused.  An end-of-file digest ("every refusal left nothing behind") is therefore
-- equal to its start value no matter what the calls did: it passes after a successful decision too.
-- pg_temp.r11_try now takes the whole-row digest of the fourteen durable tables (c11_snapshot) BEFORE
-- and AFTER each probe, inside the call's own transaction and before the sentinel, and records the
-- tables the call changed.  This file proves that observation reports a write that returns, reports
-- none for a write that is raised away, treats an unobserved probe as unclean, and that the previous
-- end-of-file digest was blind to the very same probes.
--
-- A refusal that raises is rolled back by its own savepoint, so a raised refusal can never show a
-- change; the failure the oracle exists to catch is a refusal that COMMITS effects and returns.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
-- 9 assertions of the included worlds + 14 of this file.
select plan(23);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/001-world.sqlinc
\ir phase_02_slice_11_helpers/002-reviews.sqlinc
\ir phase_02_slice_11_rpc_review/000-world.sqlinc
\ir phase_02_slice_11_rpc_review/020-decision.sqlinc
\ir phase_02_slice_11_criteria/000-effect-digest.sqlinc

create temp table r11_snap(label text primary key, effects text not null) on commit drop;

-- One open review that rvA may decide.
select pg_temp.r11_frozen_review('oBase', 'ref-oracle');
select pg_temp.r11_assign_now('oBase-rvA', 'oBase', 'rvA');

-- A "refusal path" that wrote and then RETURNED: the real command commits a decision, and the wrapper hands
-- back its envelope as though it had refused.
create or replace function pg_temp.o11_write_then_return(p_request jsonb)
returns jsonb
language plpgsql
as $body$
begin
  return platform_api.cms_record_review_decision(p_request);
end;
$body$;

-- A refusal path that wrote and then RAISED: the write is undone with the call's own savepoint.
create or replace function pg_temp.o11_write_then_raise(p_request jsonb)
returns jsonb
language plpgsql
as $body$
begin
  perform platform_api.cms_record_review_decision(p_request);
  raise exception 'STEP_UP_REQUIRED' using errcode = 'P0001';
end;
$body$;

-- The previous oracle: counters taken before the probes and compared after them.
insert into r11_snap(label, effects) values ('start', pg_temp.r11_effects());

-- Calls made before the watch is armed are recorded but unobserved.
select pg_temp.r11_session('rvA');
select pg_temp.r11_try('o-early', $q$select '{}'::jsonb$q$, false);
select pg_temp.r11_watch('pg_temp.c11_snapshot()');

select pg_temp.r11_try('o-silent', $q$select '{}'::jsonb$q$, false);
select pg_temp.r11_try('o-write-returns',
  format('select pg_temp.o11_write_then_return(%L::jsonb)', pg_temp.r11_dreq('oBase', 'approve')::text), false);
select pg_temp.r11_try('o-write-raises',
  format('select pg_temp.o11_write_then_raise(%L::jsonb)', pg_temp.r11_dreq('oBase', 'approve')::text), false);
select pg_temp.r11_dcall('o-real-refusal', 'rvA',
  pg_temp.r11_dreq('oBase', 'approve', jsonb_build_object('context', pg_temp.r11_ctx(interval '700 seconds'))), false);
select pg_temp.r11_dcall('o-real-success', 'rvA', pg_temp.r11_dreq('oBase', 'approve'), false);

select is(pg_temp.r11_effect_report(array['o-silent', 'o-write-returns', 'o-write-raises', 'o-real-refusal', 'o-real-success']),
  'raised=2;raised_writers=;returned_writers=o-real-success,o-write-returns;returned_silent=o-silent;unobserved=0',
  'the observation reports a call that returned and wrote (the wrapper and the real command) and none for a silent call or for the two calls that raised, including a write that was raised away [P2-S11-AC-015]');
select is(pg_temp.r11_changed('o-write-returns'),
  'audit_events,cms_editorial_decisions,cms_editorial_reviews,idempotency_records,outbox_events',
  'a decision that returned names exactly the tables it wrote: audit, decision, review, reservation and outbox [P2-S11-AC-015]');
select is(pg_temp.r11_changed('o-write-raises') || '|' || pg_temp.r11_state('o-write-raises'), '|P0001',
  'a write that is raised away in the same call shows no change and the call state is P0001 [P2-S11-AC-015]');
select ok(not pg_temp.r11_no_effect(array['o-write-returns']) and not pg_temp.r11_no_effect(array['o-silent', 'o-write-returns']),
  'the no-effect check is false for a call that wrote and returned, even when it is listed with a silent one [P2-S11-AC-015]');
select ok(pg_temp.r11_no_effect(array['o-silent', 'o-write-raises', 'o-real-refusal']),
  'the no-effect check is true for a silent call, a write raised away and a real STEP_UP_REQUIRED refusal [P2-S11-AC-015]');
select ok(not pg_temp.r11_no_effect(array['o-early']) and not pg_temp.r11_no_effect(array['o-never-called'])
    and (pg_temp.r11_effect_report(array['o-early']) like '%unobserved=1'),
  'a probe made before the watch was armed, or never made, is unclean for the no-effect check and is counted unobserved [P2-S11-AC-015]');
select ok(pg_temp.r11_effects() = (select effects from r11_snap where label = 'start'),
  'control: the previous end-of-file digest equals its start value after the same rolled-back probes - it could not see the committed decision [P2-S11-AC-015]');
select throws_ok(
  $q$select pg_temp.r11_watch('''{}''::jsonb')$q$, 'P0001', 'r11_watch: the digest ''{}''::jsonb is empty',
  'arming a watch with an empty digest is refused [P2-S11-AC-015]');
select ok(pg_temp.r11_changed('o-real-success') like '%cms_editorial_decisions%'
    and pg_temp.r11_out('o-real-success') = '00000:',
  'control: the real command succeeded, so the watch observed the same write the wrapper produced [P2-S11-AC-015]');

-- The verdict of a whole battery: the assertion each refusal suite ends with.
select isnt(pg_temp.r11_effect_verdict(array['o-write-returns', 'o-real-success']), 'clean',
  'a battery holding a probe made before the watch was armed is not clean, however its writers are declared [P2-S11-AC-015]');
delete from r11_probe where label = 'o-early';
select is(pg_temp.r11_effect_verdict(array['o-real-success', 'o-write-returns']), 'clean',
  'when every probe was observed and the probes that returned and wrote are exactly the declared controls, the battery is clean, in whatever order they are declared [P2-S11-AC-015]');
select is(pg_temp.r11_effect_verdict(array['o-real-success']),
  'raised=2;raised_writers=;returned_writers=o-real-success,o-write-returns;returned_silent=o-silent;unobserved=0',
  'a refusal that wrote and returned (the wrapper) and was not declared makes the battery unclean, and the verdict names it [P2-S11-AC-015]');
select isnt(pg_temp.r11_effect_verdict(array['o-real-success', 'o-write-returns', 'o-silent']), 'clean',
  'declaring a control that did not write (the silent call) also fails: the declared set must be exact [P2-S11-AC-015]');
delete from r11_probe;
select isnt(pg_temp.r11_effect_verdict(), 'clean',
  'a battery with no probe at all is not clean [P2-S11-AC-015]');

select * from finish();
rollback;
