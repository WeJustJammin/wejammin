-- Slice 11 criteria: P2-S11-AC-121, "Persistence `cms_editorial_decisions`: rows are append-only (UPDATE and DELETE
-- rejected, `updated_at = created_at`) ..."  The older suites cite the UPDATE and DELETE refusals; the
-- `updated_at = created_at` clause is only implied by the dependency table's suite.  This suite proves it for
-- decisions at three levels:
--   * the CHECK `cms_editorial_decisions_snapshot_time_check` in isolation: a row whose `updated_at` is later or
--     earlier than its `created_at` is refused, an equal pair accepted;
--   * the append-only guard: an UPDATE that would make the two differ is refused IMMUTABLE_RECORD and DELETE too;
--   * the command: a decision recorded by `cms_record_review_decision` has `updated_at = created_at`.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(18);

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

-- Every USER trigger of the decisions table disabled, a success rolled back: '23514:<constraint>' or '00000'.
create or replace function pg_temp.c11_bare(p_sql text)
returns text
language plpgsql
as $body$
declare
  outcome text;
  violated text;
begin
  execute 'alter table platform_private.cms_editorial_decisions disable trigger user';
  begin
    execute p_sql;
    raise exception 'C11_BARE_ACCEPTED';
  exception
    when others then
      get stacked diagnostics violated = constraint_name;
      outcome := case when sqlerrm = 'C11_BARE_ACCEPTED' then '00000'
                      else sqlstate || ':' || coalesce(nullif(violated, ''), sqlerrm) end;
  end;
  execute 'alter table platform_private.cms_editorial_decisions enable trigger user';
  return outcome;
end;
$body$;

-- A decision image by rvA on review dr under its assignment (the real review, assignment and reviewer).
create or replace function pg_temp.c11_decision_sql(p_overrides jsonb)
returns text
language sql
as $body$
  select pg_temp.s11_insert_sql('platform_private.cms_editorial_decisions', pg_temp.s11_decision_row(jsonb_build_object(
    'review_id', pg_temp.s11_id('dr'), 'reviewer_person_id', pg_temp.s11_id('rvA'),
    'assignment_id', pg_temp.s11_id('dr-rvA'),
    'reviewed_hash', (select frozen_hash from platform_private.cms_editorial_reviews where id = pg_temp.s11_id('dr')))
    || p_overrides))
$body$;

select pg_temp.r11_frozen_review('dr', 'dr-1');
select pg_temp.r11_assign_now('dr-rvA', 'dr', 'rvA');

-- ---------------------------------------------------------------------------
-- The CHECK in isolation.
-- ---------------------------------------------------------------------------
select is(pg_temp.c11_bare(pg_temp.c11_decision_sql('{}'::jsonb)), '00000',
  'control: the canonical decision image (created_at = updated_at) is accepted [P2-S11-AC-121]');
select is(pg_temp.c11_bare(pg_temp.c11_decision_sql('{"updated_at":"2026-10-01T14:00:01Z"}'::jsonb)),
  '23514:cms_editorial_decisions_snapshot_time_check',
  'a decision whose updated_at is later than its created_at is refused by the snapshot-time CHECK [P2-S11-AC-121]');
select is(pg_temp.c11_bare(pg_temp.c11_decision_sql('{"updated_at":"2026-10-01T13:59:59Z"}'::jsonb)),
  '23514:cms_editorial_decisions_snapshot_time_check',
  'and one whose updated_at is earlier than its created_at [P2-S11-AC-121]');
select is(pg_temp.c11_bare(pg_temp.c11_decision_sql('{"created_at":"2026-10-01T14:00:00.000001Z"}'::jsonb)),
  '23514:cms_editorial_decisions_snapshot_time_check',
  'a single microsecond of difference is already refused [P2-S11-AC-121]');

-- ---------------------------------------------------------------------------
-- The append-only guard, through the real insert path.
-- ---------------------------------------------------------------------------
insert into s11_ids(key, value) values ('guard-decision', extensions.gen_random_uuid()::text);
create or replace function pg_temp.c11_now_image(p_id uuid)
returns jsonb
language sql
as $body$
  select jsonb_build_object('id', p_id, 'decided_at', stamp.value, 'created_at', stamp.value, 'updated_at', stamp.value,
                            'step_up_at', stamp.value - interval '60 seconds')
    from (select clock_timestamp() as value) stamp
$body$;
select is(pg_temp.s11_outcome(pg_temp.c11_decision_sql(pg_temp.c11_now_image(pg_temp.s11_id('guard-decision')))), '00000',
  'control: a decision whose created_at and updated_at agree is inserted through the guard [P2-S11-AC-121]');
select is(pg_temp.s11_outcome(format(
    'update platform_private.cms_editorial_decisions set updated_at = clock_timestamp() where id = %L', pg_temp.s11_id('guard-decision'))),
  'P0001:IMMUTABLE_RECORD',
  'an UPDATE that would make updated_at differ from created_at is refused IMMUTABLE_RECORD [P2-S11-AC-121]');
select is(pg_temp.s11_outcome(format(
    'delete from platform_private.cms_editorial_decisions where id = %L', pg_temp.s11_id('guard-decision'))),
  'P0001:IMMUTABLE_RECORD',
  'and a DELETE is refused IMMUTABLE_RECORD [P2-S11-AC-121]');

-- ---------------------------------------------------------------------------
-- The command.
-- ---------------------------------------------------------------------------
select pg_temp.r11_frozen_review('dc', 'dc-1');
select pg_temp.r11_assign_now('dc-rvA', 'dc', 'rvA');
select pg_temp.r11_dcall('dec', 'rvA', pg_temp.r11_dreq('dc', 'approve'));
select is(pg_temp.r11_out('dec') || '|' || (pg_temp.r11_resp('dec')->>'state'), '00000:|approved',
  'control: rvA''s approve through cms_record_review_decision approves the review [P2-S11-AC-121]');
select ok(
  (select decision.updated_at = decision.created_at and decision.version = 1 and decision.state = 'recorded'
          and decision.decided_at is not null and decision.step_up_at is not null
     from platform_private.cms_editorial_decisions decision where decision.review_id = pg_temp.s11_id('dc')),
  'the recorded decision has updated_at = created_at, version 1, state recorded, a decided_at and the verified step-up instant [P2-S11-AC-121]');

select * from finish();
rollback;
