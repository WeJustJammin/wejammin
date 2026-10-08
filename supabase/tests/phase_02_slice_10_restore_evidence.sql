-- Slice 10 CMS-03B-04 restore: typed stale CAS and the chain evidence of its audit and
-- outbox effects (Codex adversarial review / write-path audit P2-S10-AC-025,
-- P2-S10-AC-027, P2-S10-AC-037).
--
--   * A stale entry-version CAS is the platform's typed VERSION_MISMATCH path (the
--     same P0001 whole-message token the append and the conflict resolution raise, a
--     409), not a bare SQLSTATE 40001.
--   * AC027: "Audit/outbox evidence records only chain identity/hash and safe counts,
--     never migrated values."  The restore already emitted the locked
--     `cms.entry.revision-created.v1` event ({ entryId, revisionId }); that event
--     schema is unchanged.  A restore now ALSO commits, in the same transaction, one
--     evidence pair: an audit row whose target is the immutable chain manifest
--     (`cms_restore_chain_manifest` / the chain identity) and the outbox event
--     `cms.entry.revision-restored.v1` with exactly { entryId, revisionId,
--     sourceRevisionId, migrationChainId, chainHash, edgeCount, valueCount,
--     relationCount } -- identifiers, the chain hash and counts; no migrated value.
--     Neither a refused restore nor a replay commits another pair.

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

-- Machine-readable capture of one command call: SQLSTATE, message, DETAIL, response.
create temp table s10x_calls(label text primary key, state text, message text, detail text, response jsonb)
  on commit drop;
create or replace function pg_temp.s10x_call(p_label text, p_sql text)
returns void
language plpgsql
as $body$
declare
  result jsonb;
  error_detail text;
begin
  begin
    execute p_sql into result;
    insert into s10x_calls values (p_label, '00000', null, null, result)
    on conflict (label) do update set state = excluded.state, message = null, detail = null, response = excluded.response;
  exception when others then
    get stacked diagnostics error_detail = pg_exception_detail;
    insert into s10x_calls values (p_label, sqlstate, sqlerrm, error_detail, null)
    on conflict (label) do update set state = excluded.state, message = excluded.message, detail = excluded.detail, response = null;
  end;
end;
$body$;

create or replace function pg_temp.s10x_restore_request(p_entry text, p_revision text, p_expected text, p_key text)
returns jsonb
language sql
stable
as $body$
  select jsonb_build_object(
    'entryId', p_entry, 'revisionId', p_revision,
    'migrationChainId', platform_private.cms_restore_chain_manifest_id(
      platform_private.cms_restore_chain_derive(
        (select value::uuid from s10r_ids where key = 'typeId'),
        (select value::uuid from s10r_ids where key = 'versionId'),
        (select value::uuid from s10r_ids where key = 'versionId'))->>'hash'),
    'expectedVersion', p_expected, 'idempotencyKey', p_key,
    'context', jsonb_build_object(
      'actingPartyId', (select value from s10_ids where key = 'organization'),
      'actingContextId', 'a9100000-0000-4000-8000-000000000094',
      'correlationId', 'a9100000-0000-4000-8000-000000000095'))
$body$;
create or replace function pg_temp.s10x_restore_sql(p_entry text, p_revision text, p_expected text, p_key text)
returns text
language sql
stable
as $body$
  select 'select platform_api.cms_restore_revision(' || quote_literal(
    pg_temp.s10x_restore_request(p_entry, p_revision, p_expected, p_key)::text) || '::jsonb)'
$body$;

-- An entry with two revisions (a title and a relation in the first, a new title in the
-- second) so the restore has values and a relation to carry.
select pg_temp.s10x_call('create', pg_temp.s10r_create_sql(
  jsonb_build_object('title', 'Restore secret title', 'related', pg_temp.s10r_rel('a9100000-0000-4000-8000-000000000321')),
  's10-restore-evidence-create-0001'));
create temp table s10x_entry on commit drop as
select response->'entry'->>'id' as entry_id, response->'revision'->>'id' as first_revision_id
from s10x_calls where label = 'create';
select pg_temp.s10x_call('append', pg_temp.s10r_revision_sql(
  (select entry_id from s10x_entry), jsonb_build_object('title', 'Second secret title'), '1', '1', 's10-restore-evidence-append-0001'));
select is((select message from s10x_calls where label = 'append'), null, 'fixture: the second revision is appended');

-- ------------------------------------------------------- stale CAS (6b) ----
create temp table s10x_before on commit drop as
select (select count(*) from platform_private.outbox_events) as outbox_total,
       (select count(*) from audit_private.audit_events) as audit_total,
       (select count(*) from platform_private.cms_entry_revisions) as revisions;
select pg_temp.s10x_call('stale', pg_temp.s10x_restore_sql(
  (select entry_id from s10x_entry), (select first_revision_id from s10x_entry), '1', 's10-restore-evidence-stale-0001'));
select is(
  (select state || ':' || coalesce(message, '') from s10x_calls where label = 'stale'),
  'P0001:VERSION_MISMATCH',
  'a stale entry version is the typed VERSION_MISMATCH path (P0001, the append/resolve token), not a bare SQLSTATE 40001 [P2-S10-AC-025]');
select is(
  (select count(*) from platform_private.outbox_events) + (select count(*) from audit_private.audit_events)
    + (select count(*) from platform_private.cms_entry_revisions),
  (select outbox_total + audit_total + revisions from s10x_before),
  'the refused restore committed no revision, audit row or outbox event');

-- --------------------------------------------------------- evidence (6d) ----
select pg_temp.s10x_call('restore', pg_temp.s10x_restore_sql(
  (select entry_id from s10x_entry), (select first_revision_id from s10x_entry), '2', 's10-restore-evidence-0001'));
select is((select message from s10x_calls where label = 'restore'), null, 'the restore succeeds');
create temp table s10x_restored on commit drop as
select response->'resource'->>'id' as revision_id,
       response->'restoreVerification'->'registry'->>'migrationChainId' as chain_id
from s10x_calls where label = 'restore';
create temp table s10x_manifest on commit drop as
select manifest.id as manifest_id, manifest.manifest_hash::text as manifest_hash, manifest.edge_count
from platform_private.cms_restore_chain_manifests manifest
where platform_private.cms_restore_chain_manifest_id(manifest.manifest_hash::text)::text = (select chain_id from s10x_restored);

select is(
  pg_temp.s10_outbox_payload('cms.entry.revision-created.v1', (select entry_id::uuid from s10x_entry)) ->> 'revisionId'
    is not null
  and (select count(*) from platform_private.outbox_events o
        where o.event_type = 'cms.entry.revision-created.v1' and o.aggregate_id = (select entry_id::uuid from s10x_entry)
          and o.payload = jsonb_build_object('entryId', (select entry_id from s10x_entry), 'revisionId', (select revision_id from s10x_restored))) = 1,
  true,
  'the locked cms.entry.revision-created.v1 event of the restore is unchanged: exactly { entryId, revisionId }');
select is(
  (select count(*)::integer from platform_private.outbox_events o
    where o.event_type = 'cms.entry.revision-restored.v1' and o.aggregate_id = (select entry_id::uuid from s10x_entry)),
  1, 'the restore commits exactly one chain-evidence outbox event [P2-S10-AC-027]');
select is(
  (select o.payload from platform_private.outbox_events o
    where o.event_type = 'cms.entry.revision-restored.v1' and o.aggregate_id = (select entry_id::uuid from s10x_entry)),
  jsonb_build_object(
    'entryId', (select entry_id from s10x_entry),
    'revisionId', (select revision_id from s10x_restored),
    'sourceRevisionId', (select first_revision_id from s10x_entry),
    'migrationChainId', (select chain_id from s10x_restored),
    'chainHash', (select manifest_hash from s10x_manifest),
    'edgeCount', 0,
    'valueCount', (select count(*) from platform_private.cms_entry_field_values v where v.revision_id = (select revision_id::uuid from s10x_restored)),
    'relationCount', (select count(*) from platform_private.cms_entry_relations r where r.revision_id = (select revision_id::uuid from s10x_restored))),
  'the evidence payload is exactly entry/revision/source ids, the chain id, the chain hash and the edge, value and relation counts');
select is(
  (select (o.payload->>'valueCount')::integer || '/' || (o.payload->>'relationCount')::integer
     from platform_private.outbox_events o
    where o.event_type = 'cms.entry.revision-restored.v1' and o.aggregate_id = (select entry_id::uuid from s10x_entry)),
  '1/1', 'the safe counts are the restored value and relation counts (one title, one relation)');
select is(
  (select count(*)::integer from audit_private.audit_events a
    where a.action = 'cms.entry.revision.restore.chain'
      and a.target_type = 'cms_restore_chain_manifest'
      and a.target_id = (select manifest_id from s10x_manifest)),
  1, 'the audit evidence names the chain manifest (the chain identity) as its target');
select is(
  (select count(*)::integer from audit_private.audit_events a
    where a.action = 'cms.entry.revision.restore' and a.target_id = (select entry_id::uuid from s10x_entry)),
  1, 'the entry-level restore audit row is unchanged (exactly one)');
select is(
  (select count(*)::integer
     from platform_private.outbox_events o
    where o.aggregate_id = (select entry_id::uuid from s10x_entry)
      and (o.payload::text like '%secret%' or o.payload::text like '%Restore%')),
  0, 'no outbox payload of the entry carries a migrated value');
select is(
  (select count(*)::integer from audit_private.audit_events a
    where a.target_id in ((select entry_id::uuid from s10x_entry), (select manifest_id from s10x_manifest))
      and a::text like '%secret%'),
  0, 'no audit row of the entry or its chain carries a migrated value');

-- ---------------------------------------------------------- replay (6d) ----
create temp table s10x_after on commit drop as
select (select count(*) from platform_private.outbox_events) as outbox_total,
       (select count(*) from audit_private.audit_events) as audit_total,
       (select count(*) from platform_private.cms_entry_revisions) as revisions;
select pg_temp.s10x_call('replay', pg_temp.s10x_restore_sql(
  (select entry_id from s10x_entry), (select first_revision_id from s10x_entry), '2', 's10-restore-evidence-0001'));
select is(
  (select response->'resource'->>'id' from s10x_calls where label = 'replay'),
  (select revision_id from s10x_restored), 'a lost-response replay returns the first restore');
select is(
  (select count(*) from platform_private.outbox_events) + (select count(*) from audit_private.audit_events)
    + (select count(*) from platform_private.cms_entry_revisions),
  (select outbox_total + audit_total + revisions from s10x_after),
  'the replay emits no second evidence pair, audit row or revision');

select * from finish();
rollback;
