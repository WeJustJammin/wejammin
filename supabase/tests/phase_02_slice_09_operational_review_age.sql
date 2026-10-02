commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 G2b (P2-S09-AC-693): the protected operational snapshot carries the age
-- of the oldest OPEN schema review so the Worker can raise review_open_past_window.
-- Every review is produced through the real submit command; the only shortcut is
-- shifting the stored submission instant of a real row.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc

create or replace function pg_temp.s09o_snapshot(p_at timestamptz default null) returns jsonb language sql as $body$
  select platform_api.cms_get_operational_state_snapshot(
    jsonb_build_object('observedAt', coalesce(p_at, clock_timestamp()))) $body$;

select ok(not (pg_temp.s09o_snapshot() ? 'reviewOpenAgeMs'),
  'with no review the snapshot carries no reviewOpenAgeMs [P2-S09-AC-693]');

select pg_temp.s09d_create_type('a', 'opage');
select pg_temp.s09d_to_review('a');
select is(pg_temp.s09d_outcome('a:submit'), 'OK', 'fixture: a real review is open through CMS-03A-11');
select ok((pg_temp.s09o_snapshot()->>'reviewOpenAgeMs')::numeric between 0 and 60000
    and jsonb_typeof(pg_temp.s09o_snapshot()->'reviewOpenAgeMs') = 'number',
  'a freshly submitted open review is a small non-negative age in milliseconds [P2-S09-AC-693]');

select pg_temp.s09d_timewarp('cms_schema_reviews', format($q$update platform_private.cms_schema_reviews
   set submitted_at = submitted_at - interval '8 days' where id = %L$q$, pg_temp.s09d_id('a:review')));
select ok((pg_temp.s09o_snapshot()->>'reviewOpenAgeMs')::numeric between 8 * 86400000 and 8 * 86400000 + 60000,
  'an open review submitted eight days ago is about 691,200,000 ms old [P2-S09-AC-693]');

select pg_temp.s09d_create_type('b', 'opagenew');
select pg_temp.s09d_to_review('b');
select ok((pg_temp.s09o_snapshot()->>'reviewOpenAgeMs')::numeric between 8 * 86400000 and 8 * 86400000 + 60000,
  'with two open reviews the snapshot reports the oldest [P2-S09-AC-693]');

select pg_temp.s09d_assign('a', 'rev1');
select pg_temp.s09d_decide('a', 'rev1');
select is(pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('a:review')), 'approved',
  'fixture: the old review is decided through CMS-03A-12');
select ok((pg_temp.s09o_snapshot()->>'reviewOpenAgeMs')::numeric between 0 and 60000,
  'a decided review no longer counts: the remaining open review is the young one [P2-S09-AC-693]');
select ok(not (pg_temp.s09o_snapshot(clock_timestamp() - interval '1 hour') ? 'reviewOpenAgeMs'),
  'a review submitted after the observation instant is not counted [P2-S09-AC-693]');
select ok((select (select array_agg(k order by k) from jsonb_object_keys(pg_temp.s09o_snapshot()) k)
      <@ array['activationBlockedMs', 'outboxAgeMs', 'reviewOpenAgeMs']),
  'the snapshot adds only reviewOpenAgeMs: no actor, person or review identifier is serialized [P2-S09-AC-693]');
select ok(position(pg_temp.s09d_id('a:review')::text in pg_temp.s09o_snapshot()::text) = 0
    and position(pg_temp.s09d_actor_id('owner', 'person')::text in pg_temp.s09o_snapshot()::text) = 0,
  'the snapshot carries no review or person identifier [P2-S09-AC-693]');

select * from finish();
rollback;
