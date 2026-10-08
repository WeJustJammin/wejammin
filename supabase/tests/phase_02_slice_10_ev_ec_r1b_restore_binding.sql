-- Slice 10 evidence lane EC, remediation R1b (P2-S10-AC-079): conflict resolution and restore bind
-- the same SchemaArtifact / definition-hash bytes as the other consumers.  The stored artifact
-- hash of the gallery type (rich_text + DEC-133 object field) is drifted away from the version
-- definition hash (row triggers skipped: no command can produce that state); every probe runs in
-- its own rolled-back savepoint and asserts the typed refusal AND an unchanged durable fingerprint.
-- Each control runs against the untouched artifact.  New file.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_10_value_source/000-gallery-fixture.sqlinc

select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization'));

create temp table ecb_created on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_create_entry('
    || quote_literal(pg_temp.s10g_create_request(jsonb_build_object(
         'title', 'Bind', 'meta', '{"label":"x"}'::jsonb), 'ecb-create-0001')::text)
    || '::jsonb)') as response;
select is(pg_temp.s10_last_error_message(), null::text,
  'EC-079 control: an entry of the gallery type is created over the untouched artifact');
insert into s10g_ids(key, value) select 'entryId', response->'entry'->>'id' from ecb_created;
insert into s10g_ids(key, value) select 'firstRevisionId', response->'revision'->>'id' from ecb_created;

create temp table ecb_rev2 on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_create_revision('
    || quote_literal(pg_temp.s10g_revision_request(
         (select value from s10g_ids where key = 'entryId'),
         jsonb_build_object('meta', '{"label":"two"}'::jsonb), '1', '1', 'ecb-append-0001')::text)
    || '::jsonb)') as response;
create temp table ecb_conflict on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_create_revision('
    || quote_literal(pg_temp.s10g_revision_request(
         (select value from s10g_ids where key = 'entryId'),
         jsonb_build_object('meta', '{"label":"yours"}'::jsonb), '1', '2', 'ecb-append-0002')::text)
    || '::jsonb)') as response;
select is((select response->>'kind' from ecb_conflict), 'conflict',
  'EC-079 setup: a stale edit of the object field records one durable conflict');

create or replace function pg_temp.ecb_resolve_sql(p_key text)
returns text language sql stable as $body$
  select 'select platform_api.cms_resolve_conflict('
    || quote_literal(jsonb_build_object(
         'entryId', conflict.entry_id, 'conflictId', conflict.id, 'baseRevision', '1',
         'choices', jsonb_build_array(jsonb_build_object(
           'path', '/fields/' || pg_temp.s10g_fid('meta'), 'choice', 'theirs')),
         'expectedVersion', '2', 'ifMatch', '2', 'idempotencyKey', p_key,
         'context', jsonb_build_object(
           'actingPartyId', (select value from s10_ids where key = 'organization'),
           'actingContextId', 'a9100000-0000-4000-8000-0000000000b4',
           'correlationId', 'a9100000-0000-4000-8000-0000000000b5'))::text)
    || '::jsonb)'
  from platform_private.cms_conflict_records conflict
  where conflict.entry_id = (select value::uuid from s10g_ids where key = 'entryId')
  order by conflict.created_at desc
  limit 1
$body$;

create or replace function pg_temp.ecb_restore_sql(p_key text)
returns text language sql stable as $body$
  select 'select platform_api.cms_restore_revision(jsonb_build_object('
    || '''entryId'', ' || quote_literal((select value from s10g_ids where key = 'entryId')) || ','
    || '''revisionId'', ' || quote_literal((select value from s10g_ids where key = 'firstRevisionId')) || ','
    || '''migrationChainId'', platform_private.cms_restore_chain_manifest_id('
    ||   'platform_private.cms_restore_chain_derive('
    ||     quote_literal((select value from s10g_ids where key = 'typeId')) || '::uuid,'
    ||     quote_literal((select value from s10g_ids where key = 'versionId')) || '::uuid,'
    ||     quote_literal((select value from s10g_ids where key = 'versionId')) || '::uuid'
    ||   ')->>''hash'')::text,'
    || '''expectedVersion'', ' || quote_literal((select entry_row.version::text
         from platform_private.cms_content_entries entry_row
         where entry_row.id = (select value::uuid from s10g_ids where key = 'entryId'))) || ','
    || '''idempotencyKey'', ' || quote_literal(p_key) || '))'
$body$;

create temp table ecb_fingerprint on commit drop as select pg_temp.s10g_counts() as counts;

-- ---- drift: the stored artifact hash no longer equals the version definition hash -----------------
savepoint ecb_resolve_drift;
set local session_replication_role = replica;
update platform_private.cms_schema_artifacts
set artifact_hash = repeat('e', 64)
where content_type_version_id = (select value::uuid from s10g_ids where key = 'versionId');
set local session_replication_role = origin;
select pg_temp.s10_rpc_call(pg_temp.ecb_resolve_sql('ecb-resolve-drift'));
select is(pg_temp.s10_last_error_message(), 'DEPENDENCY_UNAVAILABLE',
  'EC-079 conflict resolution refuses an artifact whose hash differs from the version definition hash');
select is(pg_temp.s10g_counts(), (select counts from ecb_fingerprint),
  'EC-079 the refused conflict resolution committed no entry, revision, value, conflict, reservation, outbox or audit row');
rollback to savepoint ecb_resolve_drift;
release savepoint ecb_resolve_drift;

savepoint ecb_restore_drift;
set local session_replication_role = replica;
update platform_private.cms_schema_artifacts
set artifact_hash = repeat('e', 64)
where content_type_version_id = (select value::uuid from s10g_ids where key = 'versionId');
set local session_replication_role = origin;
select pg_temp.s10_rpc_call(pg_temp.ecb_restore_sql('ecb-restore-drift'));
select is(pg_temp.s10_last_error_message(), 'DEPENDENCY_UNAVAILABLE',
  'EC-079 restore refuses an artifact whose hash differs from the version definition hash');
select is(pg_temp.s10g_counts(), (select counts from ecb_fingerprint),
  'EC-079 the refused restore committed no entry, revision, value, conflict, reservation, outbox or audit row');
rollback to savepoint ecb_restore_drift;
release savepoint ecb_restore_drift;

-- ---- controls: the same commands over the untouched artifact ----------------------------------------
select pg_temp.s10_rpc_call(pg_temp.ecb_resolve_sql('ecb-resolve-ok'));
select is(pg_temp.s10_last_error_message(), null::text,
  'EC-079 control: conflict resolution proceeds over the untouched artifact');
select pg_temp.s10_rpc_call(pg_temp.ecb_restore_sql('ecb-restore-ok'));
select is(pg_temp.s10_last_error_message(), null::text,
  'EC-079 control: restore proceeds over the untouched artifact');

select * from finish();
rollback;
