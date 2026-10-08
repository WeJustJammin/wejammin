-- Slice 10 evidence lane EC (P2-S10-AC-092): CMS-03B-12 omits values the caller can no
-- longer read.  New file; nothing here edits or weakens an existing suite.
--
-- A relation conflict carries base / theirs / yours as relation values.  A relation
-- target the caller cannot read (here: an entry archived after the conflict was
-- recorded) must be OMITTED from every side, never placeholdered and never named,
-- while each side's valueHash stays the JCS digest of the FULL canonical value so
-- equal sides keep equal hashes.  The control read, taken while the target is still
-- readable, proves the omission is caused by readability and by nothing else.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_10_relation_authoring/000-relation-fixture.sqlinc

-- T1 is the 001 fixture entry, T2 a seeded article the creator is assigned to.
create or replace function pg_temp.ec_t(p_key text)
returns text language sql immutable as $body$
  select case p_key
    when 't1' then 'a9100000-0000-4000-8000-000000000301'
    when 't2' then 'a9100000-0000-4000-8000-000000000321'
  end
$body$;

create or replace function pg_temp.ec_detail_sql(p_entry text)
returns text
language sql
stable
as $body$
  select 'select platform_api.cms_get_conflict_detail('
    || quote_literal(jsonb_build_object(
         'entryId', conflict.entry_id, 'conflictId', conflict.id,
         'context', jsonb_build_object(
           'actingPartyId', (select value from s10_ids where key = 'organization'),
           'actingContextId', 'a9100000-0000-4000-8000-000000000094',
           'correlationId', 'a9100000-0000-4000-8000-000000000095'))::text)
    || '::jsonb)'
  from platform_private.cms_conflict_records conflict
  where conflict.entry_id = p_entry::uuid and conflict.state = 'open'
$body$;

-- E: related = [T1]; a first editor moves it to [T2] (revision 2); a stale second edit
-- from revision 1 proposes [T1, T2] -> one durable open conflict over the relation.
create temp table ec_ids(key text primary key, value text not null) on commit drop;
create temp table ec_created on commit drop as
select pg_temp.s10_rpc_exec(pg_temp.s10r_create_sql(
  jsonb_build_object('title', 'Sides', 'related', pg_temp.s10r_rel(pg_temp.ec_t('t1'))),
  'ec-sides-create-0001')) as response;
insert into ec_ids(key, value) select 'entry', response->'entry'->>'id' from ec_created;
create temp table ec_moved on commit drop as
select pg_temp.s10_rpc_exec(pg_temp.s10r_revision_sql(
  (select value from ec_ids where key = 'entry'),
  jsonb_build_object('related', pg_temp.s10r_rel(pg_temp.ec_t('t2'))),
  '1', '1', 'ec-sides-append-0001')) as response;
select is(pg_temp.s10_last_error_message(), null::text,
  'EC-092 fixture: the first editor moves the relation to [T2]');
create temp table ec_conflict on commit drop as
select pg_temp.s10_rpc_exec(pg_temp.s10r_revision_sql(
  (select value from ec_ids where key = 'entry'),
  jsonb_build_object('related', pg_temp.s10r_rel(pg_temp.ec_t('t1'), pg_temp.ec_t('t2'))),
  '1', '2', 'ec-sides-append-0002')) as response;
select is((select response->>'kind' from ec_conflict), 'conflict',
  'EC-092 fixture: the stale edit records one durable open conflict over the relation');

-- Reads one conflict-detail response inside a probe that is rolled back with its setup.
create temp table ec_reads(label text primary key, state text, response jsonb) on commit drop;
create or replace function pg_temp.ec_read(p_label text, p_setup text)
returns void
language plpgsql
as $body$
declare
  observed_state text := '00000';
  observed_response jsonb;
begin
  begin
    if p_setup is not null then execute p_setup; end if;
    begin
      execute pg_temp.ec_detail_sql((select value from ec_ids where key = 'entry'))
        into observed_response;
    exception when others then
      observed_state := sqlstate;
      observed_response := null;
    end;
    raise exception 'EC_PROBE_SENTINEL_92c1' using errcode = 'P0001';
  exception when others then
    if sqlerrm <> 'EC_PROBE_SENTINEL_92c1' then raise; end if;
  end;
  insert into ec_reads values (p_label, observed_state, observed_response);
end;
$body$;

select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization'));

-- The relation field's path element of one read, as a row.
create or replace function pg_temp.ec_path(p_label text)
returns jsonb
language sql
stable
as $body$
  select path
  from ec_reads read_row,
       jsonb_array_elements(read_row.response->'paths') as path
  where read_row.label = p_label
    and path->>'path' = '/fields/' || pg_temp.s10r_fid('related')
$body$;

create or replace function pg_temp.ec_target_ids(p_label text, p_side text)
returns text[]
language sql
stable
as $body$
  select coalesce(array_agg(target->>'targetId' order by ordinality), array[]::text[])
  from jsonb_array_elements(pg_temp.ec_path(p_label)->p_side->'value'->'targets')
       with ordinality as target_row(target, ordinality)
$body$;

-- Control: while T2 is readable every side shows the targets it holds.
select pg_temp.ec_read('control', null);
select is((select state from ec_reads where label = 'control'), '00000',
  'EC-092 control: the open relation conflict detail is served');
select is(pg_temp.ec_target_ids('control', 'base'), array[pg_temp.ec_t('t1')],
  'EC-092 control: the base side shows [T1]');
select is(pg_temp.ec_target_ids('control', 'theirs'), array[pg_temp.ec_t('t2')],
  'EC-092 control: the theirs side shows [T2] while T2 is readable');
select is(pg_temp.ec_target_ids('control', 'yours'), array[pg_temp.ec_t('t1'), pg_temp.ec_t('t2')],
  'EC-092 control: the yours side shows [T1, T2] while T2 is readable');

-- T2 is archived after the conflict was recorded: the caller can no longer read it.
select pg_temp.ec_read('hidden',
  format($sql$set local session_replication_role = replica;
    update platform_private.cms_content_entries set lifecycle = 'archived' where id = %L;
    set local session_replication_role = origin;$sql$, pg_temp.ec_t('t2')));
select is((select state from ec_reads where label = 'hidden'), '00000',
  'EC-092 an unreadable relation target never fails the conflict read');
select is(pg_temp.ec_target_ids('hidden', 'theirs'), array[]::text[],
  'EC-092 the theirs side omits the target the caller can no longer read');
select is(pg_temp.ec_target_ids('hidden', 'yours'), array[pg_temp.ec_t('t1')],
  'EC-092 the yours side keeps only the readable target [T1]');
select is(pg_temp.ec_target_ids('hidden', 'base'), array[pg_temp.ec_t('t1')],
  'EC-092 the base side is unchanged: it never held the unreadable target');
select is(position(pg_temp.ec_t('t2') in (select response::text from ec_reads where label = 'hidden')), 0,
  'EC-092 the unreadable target identity appears nowhere in the response');
select is(pg_temp.ec_path('hidden')->'theirs'->>'provenance', 'authored',
  'EC-092 an omitted target is not a placeholder: the side keeps its authored provenance');
select is(pg_temp.ec_path('hidden')->'theirs'->>'valueHash', pg_temp.ec_path('control')->'theirs'->>'valueHash',
  'EC-092 the theirs valueHash is still the digest of the full canonical value, so equal sides keep equal hashes');
select isnt(pg_temp.ec_path('hidden')->'theirs'->>'valueHash',
  platform_private.cms_jcs_sha256('{"targets":[]}'::jsonb),
  'EC-092 the omitted side does not collapse to the hash of an empty relation');
select is(pg_temp.ec_path('hidden')->'yours'->>'valueHash', pg_temp.ec_path('control')->'yours'->>'valueHash',
  'EC-092 the yours valueHash is likewise unchanged by what the caller can read');

select * from finish();
rollback;
