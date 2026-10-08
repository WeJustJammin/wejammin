-- Slice 10 round 3 (lane H, evidence gaps EA-AC029 and EA-AC028): CMS-03B-01 refusals for a
-- baseRevision that cannot be read and for an entry that is not active.
--
-- BE03b "Route field validation matrix":
--   * baseRevision: "positive bigint decimal string; revision must be readable" -> 422 or
--     409 VERSION_MISMATCH.  A well-formed baseRevision that names no revision of the entry in
--     the request locale is a body-field validation failure, so it is the 422
--     VALIDATION_FAILED pointing at /baseRevision (it was a 404, which says the ENTRY is
--     unavailable, a different and false statement).  409 VERSION_MISMATCH stays what it is:
--     the entry-version compare-and-swap (expectedVersion / If-Match).
--   * entryId: "must resolve to active ContentEntry after structural validation" -> 400 or
--     policy-safe 404.  A malformed id is the 400 (D-11 / DEC-145); an entry that exists but
--     is not active does not resolve to an active ContentEntry, so it is the policy-safe 404
--     NOT_FOUND, indistinguishable from an absent entry (it was a 409 INVALID_TRANSITION).
--
-- Every refusal writes nothing and caches nothing: the same command retried is refused again.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_10_relation_authoring/000-relation-fixture.sqlinc

create temp table s10w_calls(label text primary key, state text, message text, detail text, response jsonb)
  on commit drop;
create or replace function pg_temp.s10w_call(p_label text, p_sql text)
returns void
language plpgsql
as $body$
declare result jsonb; d text;
begin
  begin
    execute p_sql into result;
    insert into s10w_calls values (p_label, '00000', null, null, result)
    on conflict (label) do update set state = excluded.state, message = null, detail = null, response = excluded.response;
  exception when others then
    get stacked diagnostics d = pg_exception_detail;
    insert into s10w_calls values (p_label, sqlstate, sqlerrm, d, null)
    on conflict (label) do update set state = excluded.state, message = excluded.message, detail = excluded.detail, response = null;
  end;
end;
$body$;
create or replace function pg_temp.s10w_outcome(p_label text)
returns text
language sql
stable
as $body$
  select coalesce((select case when state = '00000' then 'OK' else state || ':' || message end
                   from s10w_calls where label = p_label), 'MISSING')
$body$;

select pg_temp.s10w_call('create', pg_temp.s10r_create_sql(jsonb_build_object('title', 'A'), 's10-h3-refusal-create-0001'));
create temp table s10w_entry on commit drop as
select response->'entry'->>'id' as entry_id from s10w_calls where label = 'create';
select pg_temp.s10w_call('second', pg_temp.s10r_revision_sql(
  (select entry_id from s10w_entry), jsonb_build_object('title', 'B'), '1', '1', 's10-h3-refusal-second-0001'));
select ok(pg_temp.s10w_outcome('create') = 'OK' and pg_temp.s10w_outcome('second') = 'OK',
  'fixture: an entry with revisions 1 and 2 at entry version 2');

-- ---- AC-029: a well-formed baseRevision that names no readable revision -----------------------------
create temp table s10w_before_base on commit drop as select pg_temp.s10r_counts() as counts;
select pg_temp.s10w_call('unknown-base', pg_temp.s10r_revision_sql(
  (select entry_id from s10w_entry), jsonb_build_object('title', 'C'), '99', '2', 's10-h3-refusal-base-0001'));
select is(pg_temp.s10w_outcome('unknown-base'), 'P0001:VALIDATION_FAILED',
  'AC-029: a baseRevision that names no revision of the entry is the 422 VALIDATION_FAILED, not a 404');
select is((select detail from s10w_calls where label = 'unknown-base'), '["/baseRevision"]',
  'AC-029: and it points at /baseRevision (the DETAIL is the JSON array of safe pointers the Worker maps)');
select is(pg_temp.s10r_counts(), (select counts from s10w_before_base),
  'AC-029: the refused command wrote no entry, revision, value, relation, conflict, reservation, outbox or audit row');
select pg_temp.s10w_call('unknown-base-retry', pg_temp.s10r_revision_sql(
  (select entry_id from s10w_entry), jsonb_build_object('title', 'C'), '99', '2', 's10-h3-refusal-base-0001'));
select is(pg_temp.s10w_outcome('unknown-base-retry'), 'P0001:VALIDATION_FAILED',
  'AC-029: retrying the same refused command with the same key is refused again (a refusal is never cached)');

-- a base beyond the newest revision number is the same refusal; the highest real base is not
select pg_temp.s10w_call('base-three', pg_temp.s10r_revision_sql(
  (select entry_id from s10w_entry), jsonb_build_object('title', 'C'), '3', '2', 's10-h3-refusal-base-0002'));
select is(pg_temp.s10w_outcome('base-three'), 'P0001:VALIDATION_FAILED',
  'AC-029: the next unissued revision number is unknown too');
select pg_temp.s10w_call('base-two', pg_temp.s10r_revision_sql(
  (select entry_id from s10w_entry), jsonb_build_object('title', 'C'), '2', '2', 's10-h3-refusal-base-0003'));
select is(pg_temp.s10w_outcome('base-two'), 'OK',
  'AC-029 control: the newest real revision is a readable base and the write commits');

-- the entry-version CAS is still the 409 VERSION_MISMATCH
select pg_temp.s10w_call('stale-version', pg_temp.s10r_revision_sql(
  (select entry_id from s10w_entry), jsonb_build_object('title', 'D'), '1', '1', 's10-h3-refusal-stale-0001'));
select is(pg_temp.s10w_outcome('stale-version'), 'P0001:VERSION_MISMATCH',
  'a stale expectedVersion is still the typed 409 VERSION_MISMATCH (the base-revision check did not move it)');

-- ---- AC-028: an entry that is not active -------------------------------------------------------------------
select set_config('app.cms_rpc', 'true', true);
update platform_private.cms_content_entries set lifecycle = 'archived'
 where id = (select entry_id::uuid from s10w_entry);
create temp table s10w_before_archived on commit drop as select pg_temp.s10r_counts() as counts;
select pg_temp.s10w_call('archived', pg_temp.s10r_revision_sql(
  (select entry_id from s10w_entry), jsonb_build_object('title', 'E'), '3', '3', 's10-h3-refusal-archived-0001'));
select is(pg_temp.s10w_outcome('archived'), 'P0001:NOT_FOUND',
  'AC-028: an append to an entry that is not active is the policy-safe 404 NOT_FOUND, not a 409');
select is(pg_temp.s10r_counts(), (select counts from s10w_before_archived),
  'AC-028: the refused command wrote nothing');
select pg_temp.s10w_call('absent', pg_temp.s10r_revision_sql(
  'a9100000-0000-4000-8000-0000000000ee', jsonb_build_object('title', 'E'), '3', '3', 's10-h3-refusal-absent-0001'));
select is(pg_temp.s10w_outcome('absent'), pg_temp.s10w_outcome('archived'),
  'AC-028: an archived entry is indistinguishable from an absent one (policy-safe)');

-- a person who may not write the entry learns nothing about its lifecycle
select pg_temp.s10_rpc_as('a9100000-0000-4000-8000-000000000003'::uuid,
  (select value::uuid from s10_ids where key = 'organization'));
select pg_temp.s10w_call('outsider-archived', pg_temp.s10r_revision_sql(
  (select entry_id from s10w_entry), jsonb_build_object('title', 'E'), '3', '3', 's10-h3-refusal-outsider-0001'));
select set_config('app.cms_rpc', 'true', true);
update platform_private.cms_content_entries set lifecycle = 'active'
 where id = (select entry_id::uuid from s10w_entry);
select pg_temp.s10w_call('outsider-active', pg_temp.s10r_revision_sql(
  (select entry_id from s10w_entry), jsonb_build_object('title', 'E'), '3', '3', 's10-h3-refusal-outsider-0002'));
select is(pg_temp.s10w_outcome('outsider-archived'), pg_temp.s10w_outcome('outsider-active'),
  'AC-028: a caller without authority on the entry gets the same refusal whether it is archived or active (no lifecycle disclosure)');
select pg_temp.s10_rpc_as('a9100000-0000-4000-8000-000000000001'::uuid,
  (select value::uuid from s10_ids where key = 'organization'));
select pg_temp.s10w_call('active-again', pg_temp.s10r_revision_sql(
  (select entry_id from s10w_entry), jsonb_build_object('title', 'F'), '3', '3', 's10-h3-refusal-active-0001'));
select is(pg_temp.s10w_outcome('active-again'), 'OK',
  'AC-028 control: the same entry, active again, accepts the append');

select * from finish();
rollback;
