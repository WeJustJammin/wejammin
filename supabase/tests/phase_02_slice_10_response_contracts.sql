-- Slice 10 response contracts merged by lane G (DEC-145, NOTES "CONTRACT CHANGES
-- MERGED") that the SQL commands must honour, plus the lane I replay hook:
--
--   * EntryRevisionResource REQUIRES `entryVersion`: the committed entry aggregate version
--     (the requested expectedVersion + 1), the ONLY valid next If-Match.  `version` stays
--     the immutable revision snapshot's own version ('1').  cms_create_revision,
--     cms_resolve_conflict and cms_restore_revision (resource member) return it.
--   * EntryList items carry `entryLifecycle` (the entry's lifecycle) and `entryUpdatedAt`
--     (auth_iso_time of the entry's updated_at) beside the revision summary.
--   * An exact-key idempotent replay of cms_create_entry / cms_create_revision /
--     cms_resolve_conflict / cms_restore_revision answers the first response unchanged and
--     marks it with the PostgREST response header x-cms-idempotent-replay: true (the Worker
--     counts replays from it); a first execution never sets the header.
--   * The presence expiry sweep answers { expiredLeases, activeLeases }: activeLeases is the
--     number of leases still `active` after the sweep (0..10,000,000), the source of the
--     BE03b cms_presence_active gauge.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_10_relation_authoring/000-relation-fixture.sqlinc
\ir phase_02_slice_10_rpc/009-restore-policy-binding.sqlinc

create temp table s10k_calls(label text primary key, state text, message text, response jsonb, headers text)
  on commit drop;
create or replace function pg_temp.s10k_call(p_label text, p_sql text)
returns void
language plpgsql
as $body$
declare result jsonb;
begin
  perform set_config('response.headers', '', true);
  begin
    execute p_sql into result;
    insert into s10k_calls values (p_label, '00000', null, result, nullif(current_setting('response.headers', true), ''));
  exception when others then
    insert into s10k_calls values (p_label, sqlstate, sqlerrm, null, nullif(current_setting('response.headers', true), ''));
  end;
end;
$body$;
create or replace function pg_temp.s10k_restore_sql(p_entry text, p_revision text, p_expected text, p_key text)
returns text
language sql
stable
as $body$
  select 'select platform_api.cms_restore_revision(' || quote_literal(jsonb_build_object(
    'entryId', p_entry, 'revisionId', p_revision,
    'migrationChainId', platform_private.cms_restore_chain_manifest_id(platform_private.cms_restore_chain_derive(
      (select value::uuid from s10r_ids where key = 'typeId'), (select value::uuid from s10r_ids where key = 'versionId'),
      (select value::uuid from s10r_ids where key = 'versionId'))->>'hash'),
    'expectedVersion', p_expected, 'idempotencyKey', p_key,
    'context', jsonb_build_object('actingPartyId', (select value from s10_ids where key = 'organization'),
      'actingContextId', 'a9100000-0000-4000-8000-000000000094', 'correlationId', 'a9100000-0000-4000-8000-000000000095'))::text) || '::jsonb)'
$body$;
create or replace function pg_temp.s10k_resolve_sql(p_conflict uuid, p_entry text, p_expected text, p_key text)
returns text
language sql
stable
as $body$
  select 'select platform_api.cms_resolve_conflict(' || quote_literal(jsonb_build_object(
    'entryId', p_entry, 'conflictId', p_conflict, 'baseRevision', '1',
    'choices', jsonb_build_array(jsonb_build_object('path', '/fields/' || pg_temp.s10r_fid('title'), 'choice', 'theirs')),
    'expectedVersion', p_expected, 'ifMatch', p_expected, 'idempotencyKey', p_key,
    'context', jsonb_build_object('actingPartyId', (select value from s10_ids where key = 'organization'),
      'actingContextId', 'a9100000-0000-4000-8000-000000000094', 'correlationId', 'a9100000-0000-4000-8000-000000000095'))::text) || '::jsonb)'
$body$;

-- ----------------------------------------------------- first executions ----
select pg_temp.s10k_call('create', pg_temp.s10r_create_sql(jsonb_build_object('title', 'A'), 's10-contract-create-0001'));
create temp table s10k_entry on commit drop as
select response->'entry'->>'id' as entry_id, response->'revision'->>'id' as rev1 from s10k_calls where label = 'create';
select pg_temp.s10k_call('append', pg_temp.s10r_revision_sql((select entry_id from s10k_entry), jsonb_build_object('title', 'B'), '1', '1', 's10-contract-append-0001'));
select is((select response->>'entryVersion' from s10k_calls where label = 'append'), '2',
  'append returns entryVersion = the requested expectedVersion + 1 (the next If-Match)');
select is((select response->>'version' from s10k_calls where label = 'append'), '1',
  'append keeps `version` as the immutable revision snapshot version');
select pg_temp.s10k_call('conflict', pg_temp.s10r_revision_sql((select entry_id from s10k_entry), jsonb_build_object('title', 'C'), '1', '2', 's10-contract-yours-0001'));
select is((select response->>'kind' from s10k_calls where label = 'conflict'), 'conflict', 'fixture: a stale same-field edit records a conflict');
select pg_temp.s10k_call('resolve', pg_temp.s10k_resolve_sql(
  (select id from platform_private.cms_conflict_records where entry_id = (select entry_id::uuid from s10k_entry) and state = 'open'),
  (select entry_id from s10k_entry), '2', 's10-contract-resolve-0001'));
select is((select response->>'entryVersion' from s10k_calls where label = 'resolve'), '3',
  'resolve returns entryVersion = the requested expectedVersion + 1');
select pg_temp.s10k_call('restore', pg_temp.s10k_restore_sql((select entry_id from s10k_entry), (select rev1 from s10k_entry), '3', 's10-contract-restore-0001'));
select is((select response->'resource'->>'entryVersion' from s10k_calls where label = 'restore'), '4',
  'restore returns resource.entryVersion = the requested expectedVersion + 1');
select is((select response->'resource'->>'version' from s10k_calls where label = 'restore'), '1',
  'restore keeps resource.version as the immutable snapshot version');
select is((select response->'entry'->>'version' from s10k_calls where label = 'create'), '1',
  'control: the create response keeps its entry aggregate version');
select is(
  (select count(*)::integer from s10k_calls where label in ('create', 'append', 'resolve', 'restore') and headers is not null), 0,
  'a first execution never sets the idempotent-replay response header');
select is(
  (select count(*)::integer from platform_private.cms_entry_revisions where entry_id = (select entry_id::uuid from s10k_entry)), 4,
  'fixture: four committed revisions (create, append, resolve, restore)');

-- ------------------------------------------------------------- replays ----
select pg_temp.s10k_call('create-replay', pg_temp.s10r_create_sql(jsonb_build_object('title', 'A'), 's10-contract-create-0001'));
select pg_temp.s10k_call('append-replay', pg_temp.s10r_revision_sql((select entry_id from s10k_entry), jsonb_build_object('title', 'B'), '1', '1', 's10-contract-append-0001'));
select pg_temp.s10k_call('resolve-replay', pg_temp.s10k_resolve_sql(
  (select id from platform_private.cms_conflict_records where entry_id = (select entry_id::uuid from s10k_entry) and state = 'resolved'),
  (select entry_id from s10k_entry), '2', 's10-contract-resolve-0001'));
select pg_temp.s10k_call('restore-replay', pg_temp.s10k_restore_sql((select entry_id from s10k_entry), (select rev1 from s10k_entry), '3', 's10-contract-restore-0001'));
select is(
  (select string_agg(r.label || ':' || (r.response = f.response)::text, ',' order by r.label)
     from s10k_calls r join s10k_calls f on f.label = replace(r.label, '-replay', '') where r.label like '%-replay'),
  'append-replay:true,create-replay:true,resolve-replay:true,restore-replay:true',
  'each exact-key replay answers the first response unchanged (including entryVersion)');
select is(
  (select string_agg(label || ':' || coalesce(headers, '-'), ',' order by label) from s10k_calls where label like '%-replay'),
  'append-replay:[{"x-cms-idempotent-replay": "true"}],create-replay:[{"x-cms-idempotent-replay": "true"}],resolve-replay:[{"x-cms-idempotent-replay": "true"}],restore-replay:[{"x-cms-idempotent-replay": "true"}]',
  'each replay marks the response with the x-cms-idempotent-replay response header');
select is(
  (select count(*)::integer from platform_private.cms_entry_revisions where entry_id = (select entry_id::uuid from s10k_entry)), 4,
  'the replays committed no revision');

-- -------------------------------------------------------------- list ----
select vault.create_secret(repeat('a1', 32), 'cms_editorial_history_cursor_active', 'pgTAP transaction-only CMS-03B-13 test key');
select pg_temp.s10k_call('list', 'select platform_api.cms_list_entries(''{"limit":25}''::jsonb)');
select is(
  (select platform_private.cms_exact_keys(response->'items'->0,
     array['id', 'entryId', 'entryLifecycle', 'entryUpdatedAt', 'revisionNumber', 'locale', 'state', 'contentHash', 'createdAt', 'authorClass']::text[],
     array['id', 'entryId', 'entryLifecycle', 'entryUpdatedAt', 'revisionNumber', 'locale', 'state', 'contentHash', 'createdAt', 'authorClass']::text[])
   from s10k_calls where label = 'list'),
  true, 'every list item carries exactly the DEC-145 keys, entryLifecycle and entryUpdatedAt included');
select is(
  (select item->>'entryLifecycle' || ' ' || (item->>'entryUpdatedAt' = platform_private.auth_iso_time(entry_row.updated_at))::text
     from s10k_calls call
     cross join lateral jsonb_array_elements(call.response->'items') item
     join platform_private.cms_content_entries entry_row on entry_row.id = (item->>'entryId')::uuid
    where call.label = 'list' and item->>'entryId' = (select entry_id from s10k_entry)),
  'active true', 'entryLifecycle is the entry lifecycle and entryUpdatedAt is auth_iso_time(entry.updated_at)');
select is(
  (select count(*)::integer from s10k_calls call, jsonb_array_elements(call.response->'items') item
    where call.label = 'list' and (item ? 'ownerId' or item ? 'assigneePersonId' or item::text like '%owner%')),
  0, 'no list item carries an owner or assignee identifier');

-- ------------------------------------------------------------- sweep ----
create temp table s10k_sweep on commit drop as
select platform_api.cms_expire_edit_presence_leases(10) as result;
select is(
  (select platform_private.cms_exact_keys(result, array['expiredLeases', 'activeLeases']::text[], array['expiredLeases', 'activeLeases']::text[])
     from s10k_sweep),
  true, 'the sweep answers exactly { expiredLeases, activeLeases }');
select is(
  (select (result->>'activeLeases')::integer from s10k_sweep),
  (select count(*)::integer from platform_private.cms_edit_presence where state = 'active'),
  'activeLeases is the number of leases still active after the sweep');
select cmp_ok((select (result->>'activeLeases')::integer from s10k_sweep), '>=', 1,
  'the fixture author holds an active lease (the authorized append renewed it), so the gauge is not vacuous');
select is((select result->>'expiredLeases' from s10k_sweep), '0', 'the sweep retires no unexpired lease');

select * from finish();
rollback;
