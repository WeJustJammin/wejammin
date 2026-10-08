-- Slice 10 gap resolution (P2-S10-AC-031/AC-073/AC-074, audit WP-A1): relation
-- values are authored through cms_create_entry (CMS-03B-10), cms_create_revision
-- (CMS-03B-01) and cms_resolve_conflict (CMS-03B-02), and a conflict over a
-- relation field is detected, shown (CMS-03B-12) and resolved like any field.
--
-- BE03b "Value encodings by field kind": relation is
-- `{ targets: [{ targetId, expectedTargetVersion | null }] }`, ordered, with
-- `position` = index; targetKind, projectionKey and onUnavailable come only from
-- the immutable 03a RelationDefinition; the count is bounded by the definition
-- min/max and by 512; content targets resolve now; a domain-kind target with no
-- registered projection fails closed with the typed 422 reason
-- `relation_target_unavailable`.  Relations are normalized EntryRelation rows
-- outside the revision payload hash: no relation value is ever stored as an
-- EntryFieldValue and a relation never enters contentHash.
--
-- Target resolution mirrors the draft read: the target must be an active entry of
-- the owning party whose content type is the declared active target type and over
-- which the caller holds cms.author/cms.editor authority; anything else (absent,
-- hidden, unassigned, archived, wrong type, stale pin) is the same uniform
-- VALIDATION_FAILED, so a write is never an existence oracle.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_10_relation_authoring/000-relation-fixture.sqlinc

create temp table s10r_t(key text primary key, id text not null) on commit drop;
insert into s10r_t(key, id) values
  ('t1', 'a9100000-0000-4000-8000-000000000301'),
  ('t2', 'a9100000-0000-4000-8000-000000000321'),
  ('t3', 'a9100000-0000-4000-8000-000000000331'),
  ('t4', 'a9100000-0000-4000-8000-000000000341'),
  ('missing', 'a9100000-0000-4000-8000-000000000399');
create or replace function pg_temp.s10r_t(p_key text)
returns text language sql stable as $body$
  select id from s10r_t where key = p_key
$body$;

-- ---------------------------------------------------------------------------
-- A. cms_create_entry refusals.  Every refusal commits no entry, revision, value,
-- relation, idempotency, outbox or audit row.
-- ---------------------------------------------------------------------------
create temp table s10r_before_create on commit drop as select pg_temp.s10r_counts() as counts;

select pg_temp.s10_rpc_probe_persist(
  'c_' || c.label, null,
  pg_temp.s10r_create_sql(
    jsonb_build_object('title', 'R') || c.by_key,
    's10-rel-create-' || lpad(c.n::text, 4, '0')))
from (values
  (1, 'duplicate', jsonb_build_object('related', pg_temp.s10r_rel(pg_temp.s10r_t('t1'), pg_temp.s10r_t('t1')))),
  (2, 'over_max', jsonb_build_object('related', pg_temp.s10r_rel(
     pg_temp.s10r_t('t1'), pg_temp.s10r_t('t2'), pg_temp.s10r_t('t3'), pg_temp.s10r_t('t4')))),
  (3, 'one_with_two', jsonb_build_object('primary', pg_temp.s10r_rel(pg_temp.s10r_t('t1'), pg_temp.s10r_t('t2')))),
  (4, 'absent_target', jsonb_build_object('related', pg_temp.s10r_rel(pg_temp.s10r_t('missing')))),
  (5, 'unassigned_target', jsonb_build_object('related', pg_temp.s10r_rel(pg_temp.s10r_t('t3')))),
  (6, 'archived_target', jsonb_build_object('related', pg_temp.s10r_rel(pg_temp.s10r_t('t4')))),
  (7, 'stale_pin', jsonb_build_object('related', pg_temp.s10r_rel_pinned(pg_temp.s10r_t('t1'), '2'))),
  (8, 'domain_target', jsonb_build_object('people', pg_temp.s10r_rel(pg_temp.s10r_t('t1')))),
  (9, 'json_null', jsonb_build_object('related', 'null'::jsonb)),
  (10, 'extra_key', jsonb_build_object('related', '{"targets":[],"extra":1}'::jsonb)),
  (11, 'bad_uuid', jsonb_build_object('related', '{"targets":[{"targetId":"nope"}]}'::jsonb)),
  (12, 'targets_not_array', jsonb_build_object('related', '{"targets":"x"}'::jsonb)),
  (13, 'array_value', jsonb_build_object('related', '[]'::jsonb)),
  (14, 'string_value', jsonb_build_object('related', '"x"'::jsonb)),
  (15, 'pin_not_version', jsonb_build_object('related', '{"targets":[{"targetId":"a9100000-0000-4000-8000-000000000301","expectedTargetVersion":3}]}'::jsonb)),
  (16, 'pin_overflow', jsonb_build_object('related', pg_temp.s10r_rel_pinned(pg_temp.s10r_t('t1'), '99999999999999999999')))
) c(n, label, by_key);

select is(pg_temp.s10_probe_message('c_' || label), 'VALIDATION_FAILED',
  'cms_create_entry: relation ' || label || ' is the uniform VALIDATION_FAILED refusal [BE03b, AC-031]')
from unnest(array['duplicate', 'over_max', 'one_with_two', 'absent_target', 'unassigned_target',
  'archived_target', 'stale_pin', 'json_null', 'extra_key', 'bad_uuid', 'targets_not_array',
  'array_value', 'string_value', 'pin_not_version', 'pin_overflow']) label;
select is(pg_temp.s10_probe_message('c_domain_target'), 'relation_target_unavailable',
  'cms_create_entry: a non-empty domain relation fails closed with relation_target_unavailable [BE03b:1049]');
select is(pg_temp.s10r_counts(), (select counts from s10r_before_create),
  'cms_create_entry: every refused relation committed no entry, revision, value, relation, reservation, outbox or audit row [BE03b]');

-- ---------------------------------------------------------------------------
-- B. cms_create_entry success: ordered relation rows, no field value, hash excludes it.
-- ---------------------------------------------------------------------------
create temp table s10r_e1 on commit drop as
select pg_temp.s10_rpc_exec(pg_temp.s10r_create_sql(
  jsonb_build_object(
    'title', 'First',
    'related', pg_temp.s10r_rel(pg_temp.s10r_t('t1'), pg_temp.s10r_t('t2')),
    'people', pg_temp.s10r_rel()),
  's10-rel-create-1001')) as response;
select is(pg_temp.s10_last_error_message(), null::text,
  'cms_create_entry stores a title, an ordered content relation and an EMPTY domain relation [BE03b, AC-031]');

select is(
  pg_temp.s10r_targets((select (response->'revision'->>'id')::uuid from s10r_e1), 'related'),
  array[pg_temp.s10r_t('t1'), pg_temp.s10r_t('t2')],
  'the relation rows carry the request targets in request order');
select is(
  pg_temp.s10r_positions((select (response->'revision'->>'id')::uuid from s10r_e1), 'related'),
  array[0, 1], 'position equals the index in the request');
select ok(
  (select bool_and(relation.target_kind = 'content'
                   and relation.on_unavailable = 'omit'
                   and relation.expected_target_version is null
                   and relation.state = 'active' and relation.version = 1
                   and relation.owner_id = (select value::uuid from s10_ids where key = 'organization')
                   and relation.field_definition_id = (
                     select definition.id from platform_private.cms_field_definition_versions definition
                     where definition.stable_field_id = pg_temp.s10r_fid('related')::uuid
                       and definition.content_type_version_id =
                         (select value::uuid from s10r_ids where key = 'versionId')))
   from platform_private.cms_entry_relations relation
   where relation.revision_id = (select (response->'revision'->>'id')::uuid from s10r_e1)),
  'targetKind, onUnavailable and the field definition come from the immutable RelationDefinition, never the request [BE03b:1049]');
select is(
  (select count(*)::integer from platform_private.cms_entry_relations relation
   where relation.revision_id = (select (response->'revision'->>'id')::uuid from s10r_e1)
     and relation.field_id = pg_temp.s10r_fid('people')::uuid),
  0, 'an empty domain relation stores no row');
select is(
  (select count(*)::integer from platform_private.cms_entry_field_values value_row
   where value_row.revision_id = (select (response->'revision'->>'id')::uuid from s10r_e1)
     and value_row.field_id in (pg_temp.s10r_fid('related')::uuid, pg_temp.s10r_fid('people')::uuid)),
  0, 'a relation value is never stored as an EntryFieldValue');
select is(
  (select revision.payload_hash::text from platform_private.cms_entry_revisions revision
   where revision.id = (select (response->'revision'->>'id')::uuid from s10r_e1)),
  platform_private.cms_jcs_sha256(jsonb_build_object(pg_temp.s10r_fid('title'), 'First')),
  'the revision payload hash covers the field values only: a relation never enters contentHash');
select is(
  (select response->>'contentHash' from s10r_e1),
  platform_private.cms_jcs_sha256(jsonb_build_object(pg_temp.s10r_fid('title'), 'First')),
  'the create response contentHash excludes the relation');

create temp table s10r_ids2 on commit drop as
select 'e1' as key, response->'entry'->>'id' as value from s10r_e1;

-- Replay: the same key and body return the exact first response and add no row.
create temp table s10r_before_replay on commit drop as select pg_temp.s10r_counts() as counts;
select is(
  pg_temp.s10_rpc_exec(pg_temp.s10r_create_sql(
    jsonb_build_object(
      'title', 'First',
      'related', pg_temp.s10r_rel(pg_temp.s10r_t('t1'), pg_temp.s10r_t('t2')),
      'people', pg_temp.s10r_rel()),
    's10-rel-create-1001')),
  (select response from s10r_e1),
  'a replay of the create returns the stored first response [BE03b idempotency]');
select is(pg_temp.s10r_counts(), (select counts from s10r_before_replay),
  'the replay writes no entry, revision, value, relation, outbox or audit row');

-- ---------------------------------------------------------------------------
-- C. cms_create_revision on E1 (revision 1, entry version 1).
-- ---------------------------------------------------------------------------
create temp table s10r_before_append on commit drop as select pg_temp.s10r_counts() as counts;
select pg_temp.s10_rpc_probe_persist(
  'a_' || c.label, null,
  pg_temp.s10r_revision_sql((select value from s10r_ids2 where key = 'e1'), c.by_key, '1', '1',
    's10-rel-append-' || lpad(c.n::text, 4, '0')))
from (values
  (1, 'duplicate', jsonb_build_object('related', pg_temp.s10r_rel(pg_temp.s10r_t('t2'), pg_temp.s10r_t('t2')))),
  (2, 'over_max', jsonb_build_object('related', pg_temp.s10r_rel(
     pg_temp.s10r_t('t1'), pg_temp.s10r_t('t2'), pg_temp.s10r_t('t3'), pg_temp.s10r_t('t4')))),
  (3, 'one_with_two', jsonb_build_object('primary', pg_temp.s10r_rel(pg_temp.s10r_t('t1'), pg_temp.s10r_t('t2')))),
  (4, 'absent_target', jsonb_build_object('related', pg_temp.s10r_rel(pg_temp.s10r_t('missing')))),
  (5, 'unassigned_target', jsonb_build_object('related', pg_temp.s10r_rel(pg_temp.s10r_t('t3')))),
  (6, 'archived_target', jsonb_build_object('related', pg_temp.s10r_rel(pg_temp.s10r_t('t4')))),
  (7, 'stale_pin', jsonb_build_object('related', pg_temp.s10r_rel_pinned(pg_temp.s10r_t('t1'), '2'))),
  (8, 'domain_target', jsonb_build_object('people', pg_temp.s10r_rel(pg_temp.s10r_t('t1')))),
  (9, 'json_null', jsonb_build_object('related', 'null'::jsonb)),
  (10, 'extra_key', jsonb_build_object('related', '{"targets":[],"extra":1}'::jsonb)),
  (11, 'array_value', jsonb_build_object('related', '[]'::jsonb)),
  (12, 'wrong_type_target', jsonb_build_object('related',
     jsonb_build_object('targets', jsonb_build_array(jsonb_build_object(
       'targetId', (select value from s10r_ids2 where key = 'e1'))))))
) c(n, label, by_key);

-- A relation to another s10relation entry is the wrong target type (the field
-- targets articles); the self-relation test further below is also wrong-typed.
select is(pg_temp.s10_probe_message('a_' || label), 'VALIDATION_FAILED',
  'cms_create_revision: relation ' || label || ' is the uniform VALIDATION_FAILED refusal [BE03b, AC-073]')
from unnest(array['duplicate', 'over_max', 'one_with_two', 'absent_target', 'unassigned_target',
  'archived_target', 'stale_pin', 'json_null', 'extra_key', 'array_value', 'wrong_type_target']) label;
select is(pg_temp.s10_probe_message('a_domain_target'), 'relation_target_unavailable',
  'cms_create_revision: a non-empty domain relation fails closed with relation_target_unavailable [BE03b:1049]');
select is(pg_temp.s10r_counts(), (select counts from s10r_before_append),
  'cms_create_revision: every refused relation appended no revision, value, relation, conflict, reservation, outbox or audit row [BE03b]');

-- Revision 2: a title-only edit carries the relation forward unchanged.
create temp table s10r_rev2 on commit drop as
select pg_temp.s10_rpc_exec(pg_temp.s10r_revision_sql(
  (select value from s10r_ids2 where key = 'e1'),
  jsonb_build_object('title', 'Second'), '1', '1', 's10-rel-append-2001')) as response;
select is(pg_temp.s10_last_error_message(), null::text, 'a title-only append succeeds');
select is(
  pg_temp.s10r_targets((select (response->>'id')::uuid from s10r_rev2), 'related'),
  array[pg_temp.s10r_t('t1'), pg_temp.s10r_t('t2')],
  'an unchanged relation is carried onto the new revision in order');

-- Revision 3: replace the relation with [T2] pinned to its current version.
create temp table s10r_rev3 on commit drop as
select pg_temp.s10_rpc_exec(pg_temp.s10r_revision_sql(
  (select value from s10r_ids2 where key = 'e1'),
  jsonb_build_object('related', pg_temp.s10r_rel_pinned(pg_temp.s10r_t('t2'), '1')),
  '2', '2', 's10-rel-append-3001')) as response;
select is(pg_temp.s10_last_error_message(), null::text,
  'cms_create_revision replaces an ordered relation with a pinned target [BE03b, AC-073]');
select is(
  pg_temp.s10r_targets((select (response->>'id')::uuid from s10r_rev3), 'related'),
  array[pg_temp.s10r_t('t2')], 'the patched relation holds exactly the requested targets');
select is(
  (select relation.expected_target_version
   from platform_private.cms_entry_relations relation
   where relation.revision_id = (select (response->>'id')::uuid from s10r_rev3)
     and relation.field_id = pg_temp.s10r_fid('related')::uuid),
  1::bigint, 'an external target keeps its exact pinned version');
select is(
  pg_temp.s10r_targets((select (response->>'id')::uuid from s10r_rev2), 'related'),
  array[pg_temp.s10r_t('t1'), pg_temp.s10r_t('t2')],
  'the previous immutable revision keeps its own relation rows');
select is(
  (select value from platform_private.cms_entry_field_values value_row
   where value_row.revision_id = (select (response->>'id')::uuid from s10r_rev3)
     and value_row.field_id = pg_temp.s10r_fid('title')::uuid),
  to_jsonb('Second'::text), 'the untouched title value is carried onto the relation revision');
select is(
  (select count(*)::integer from platform_private.cms_entry_field_values value_row
   where value_row.revision_id = (select (response->>'id')::uuid from s10r_rev3)
     and value_row.field_id = pg_temp.s10r_fid('related')::uuid),
  0, 'the appended relation is not an EntryFieldValue');
select is(
  (select revision.payload_hash::text from platform_private.cms_entry_revisions revision
   where revision.id = (select (response->>'id')::uuid from s10r_rev3)),
  platform_private.cms_jcs_sha256(jsonb_build_object(pg_temp.s10r_fid('title'), 'Second')),
  'the appended revision payload hash excludes the relation');

-- Revision 4: reordering is a change (position follows the new order).
create temp table s10r_rev4 on commit drop as
select pg_temp.s10_rpc_exec(pg_temp.s10r_revision_sql(
  (select value from s10r_ids2 where key = 'e1'),
  jsonb_build_object('related', pg_temp.s10r_rel(pg_temp.s10r_t('t2'), pg_temp.s10r_t('t1'))),
  '3', '3', 's10-rel-append-4001')) as response;
select is(
  pg_temp.s10r_targets((select (response->>'id')::uuid from s10r_rev4), 'related'),
  array[pg_temp.s10r_t('t2'), pg_temp.s10r_t('t1')],
  'a reordered relation stores the new order');
select is(
  pg_temp.s10r_positions((select (response->>'id')::uuid from s10r_rev4), 'related'),
  array[0, 1], 'positions follow the new index');

-- Revision 5: an empty targets array clears the relation.
create temp table s10r_rev5 on commit drop as
select pg_temp.s10_rpc_exec(pg_temp.s10r_revision_sql(
  (select value from s10r_ids2 where key = 'e1'),
  jsonb_build_object('related', pg_temp.s10r_rel()), '4', '4', 's10-rel-append-5001')) as response;
select is(
  pg_temp.s10r_targets((select (response->>'id')::uuid from s10r_rev5), 'related'),
  array[]::text[], 'an empty targets array clears the relation on the new revision');

-- Replay of revision 3: the same key and body return the stored first response.
create temp table s10r_before_append_replay on commit drop as select pg_temp.s10r_counts() as counts;
select is(
  pg_temp.s10_rpc_exec(pg_temp.s10r_revision_sql(
    (select value from s10r_ids2 where key = 'e1'),
    jsonb_build_object('related', pg_temp.s10r_rel_pinned(pg_temp.s10r_t('t2'), '1')),
    '2', '2', 's10-rel-append-3001')),
  (select response from s10r_rev3),
  'a replay of the relation append returns the stored first response');
select is(pg_temp.s10r_counts(), (select counts from s10r_before_append_replay),
  'the append replay writes nothing');

-- ---------------------------------------------------------------------------
-- D. Conflict flow over a relation field.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.s10r_resolve_request(
  p_entry text, p_choices jsonb, p_base text, p_expected text, p_key text
)
returns jsonb
language sql
stable
as $body$
  select jsonb_build_object(
    'entryId', conflict.entry_id,
    'conflictId', conflict.id,
    'baseRevision', p_base,
    'choices', p_choices,
    'expectedVersion', p_expected,
    'ifMatch', p_expected,
    'idempotencyKey', p_key,
    'context', jsonb_build_object(
      'actingPartyId', (select value from s10_ids where key = 'organization'),
      'actingContextId', 'a9100000-0000-4000-8000-000000000094',
      'correlationId', 'a9100000-0000-4000-8000-000000000095'))
  from platform_private.cms_conflict_records conflict
  where conflict.entry_id = p_entry::uuid and conflict.state = 'open'
$body$;

create or replace function pg_temp.s10r_resolve_sql(
  p_entry text, p_choices jsonb, p_base text, p_expected text, p_key text
)
returns text
language sql
stable
as $body$
  select 'select platform_api.cms_resolve_conflict('
    || quote_literal(pg_temp.s10r_resolve_request(
         p_entry, p_choices, p_base, p_expected, p_key)::text) || '::jsonb)'
$body$;

create or replace function pg_temp.s10r_detail_sql(p_entry text)
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

-- E2: related = [T1]; a first editor moves it to [T2] (revision 2); a stale
-- second edit from revision 1 proposes [T1, T2] -> one durable conflict.
create temp table s10r_e2 on commit drop as
select pg_temp.s10_rpc_exec(pg_temp.s10r_create_sql(
  jsonb_build_object('title', 'Two', 'related', pg_temp.s10r_rel(pg_temp.s10r_t('t1'))),
  's10-rel-create-2001')) as response;
insert into s10r_ids2(key, value) select 'e2', response->'entry'->>'id' from s10r_e2;
create temp table s10r_e2_rev2 on commit drop as
select pg_temp.s10_rpc_exec(pg_temp.s10r_revision_sql(
  (select value from s10r_ids2 where key = 'e2'),
  jsonb_build_object('related', pg_temp.s10r_rel(pg_temp.s10r_t('t2'))),
  '1', '1', 's10-rel-append-6001')) as response;
select is(pg_temp.s10_last_error_message(), null::text, 'the first editor moves the relation to [T2]');

create temp table s10r_e2_conflict on commit drop as
select pg_temp.s10_rpc_exec(pg_temp.s10r_revision_sql(
  (select value from s10r_ids2 where key = 'e2'),
  jsonb_build_object('related', pg_temp.s10r_rel(pg_temp.s10r_t('t1'), pg_temp.s10r_t('t2'))),
  '1', '2', 's10-rel-append-6002')) as response;
select is((select response->>'kind' from s10r_e2_conflict), 'conflict',
  'a stale edit of a relation another editor moved records one durable conflict [AC-074]');
select is(
  (select conflict.changed_paths from platform_private.cms_conflict_records conflict
   where conflict.entry_id = (select value::uuid from s10r_ids2 where key = 'e2') and conflict.state = 'open'),
  jsonb_build_array('/fields/' || pg_temp.s10r_fid('related')),
  'the conflict records the relation field path');

-- CMS-03B-12: the relation path shows base / theirs / yours as relation values.
create temp table s10r_e2_detail on commit drop as
select pg_temp.s10_rpc_exec(pg_temp.s10r_detail_sql((select value from s10r_ids2 where key = 'e2'))) as response;
select is(pg_temp.s10_last_error_message(), null::text, 'CMS-03B-12 reads the open relation conflict');
select is(
  (select response->'paths'->0->'base'->'value' from s10r_e2_detail),
  pg_temp.s10r_rel_pinned(pg_temp.s10r_t('t1'), null),
  'the base side is the relation value of the base revision');
select is(
  (select response->'paths'->0->'theirs'->'value' from s10r_e2_detail),
  pg_temp.s10r_rel_pinned(pg_temp.s10r_t('t2'), null),
  'the theirs side is the relation value of the current draft');
select is(
  (select response->'paths'->0->'yours'->'value' from s10r_e2_detail),
  jsonb_build_object('targets', jsonb_build_array(
    jsonb_build_object('targetId', pg_temp.s10r_t('t1'), 'expectedTargetVersion', null),
    jsonb_build_object('targetId', pg_temp.s10r_t('t2'), 'expectedTargetVersion', null))),
  'the yours side is the proposed relation value');
select ok(
  (select response->'paths'->0->'base'->>'provenance' = 'authored'
      and response->'paths'->0->'base'->>'valueHash' ~ '^[0-9a-f]{64}$'
      and response->'paths'->0->'base'->>'valueHash' <> response->'paths'->0->'theirs'->>'valueHash'
   from s10r_e2_detail),
  'relation sides carry the authored provenance and distinct JCS value hashes');

-- Refused resolutions leave the conflict open and commit nothing.
create temp table s10r_before_resolve on commit drop as select pg_temp.s10r_counts() as counts;
select pg_temp.s10_rpc_probe_persist(
  'r_' || c.label, null,
  pg_temp.s10r_resolve_sql((select value from s10r_ids2 where key = 'e2'),
    jsonb_build_array(jsonb_build_object('path', '/fields/' || pg_temp.s10r_fid('related'),
      'choice', 'explicit', 'value', c.value)),
    '1', '2', 's10-rel-resolve-' || lpad(c.n::text, 4, '0')))
from (values
  (1, 'unassigned_target', pg_temp.s10r_rel(pg_temp.s10r_t('t3'))),
  (2, 'archived_target', pg_temp.s10r_rel(pg_temp.s10r_t('t4'))),
  (3, 'duplicate', pg_temp.s10r_rel(pg_temp.s10r_t('t1'), pg_temp.s10r_t('t1'))),
  (4, 'over_max', pg_temp.s10r_rel(pg_temp.s10r_t('t1'), pg_temp.s10r_t('t2'), pg_temp.s10r_t('t3'), pg_temp.s10r_t('t4'))),
  (5, 'stale_pin', pg_temp.s10r_rel_pinned(pg_temp.s10r_t('t1'), '2')),
  (6, 'malformed', '{"targets":"x"}'::jsonb),
  (7, 'json_null', 'null'::jsonb)
) c(n, label, value);
select is(pg_temp.s10_probe_message('r_' || label), 'VALIDATION_FAILED',
  'cms_resolve_conflict: explicit relation ' || label || ' is the uniform VALIDATION_FAILED refusal [AC-074]')
from unnest(array['unassigned_target', 'archived_target', 'duplicate', 'over_max', 'stale_pin',
  'malformed', 'json_null']) label;
select is(pg_temp.s10r_counts(), (select counts from s10r_before_resolve),
  'cms_resolve_conflict: every refused relation choice committed nothing and left the conflict open');

-- Resolve to the competing editor's relation.
create temp table s10r_e2_resolved on commit drop as
select pg_temp.s10_rpc_exec(pg_temp.s10r_resolve_sql((select value from s10r_ids2 where key = 'e2'),
  jsonb_build_array(jsonb_build_object('path', '/fields/' || pg_temp.s10r_fid('related'), 'choice', 'theirs')),
  '1', '2', 's10-rel-resolve-1001')) as response;
select is(pg_temp.s10_last_error_message(), null::text, 'cms_resolve_conflict resolves a relation conflict to theirs [AC-074]');
select is(
  pg_temp.s10r_targets((select (response->>'id')::uuid from s10r_e2_resolved), 'related'),
  array[pg_temp.s10r_t('t2')], 'the resolved revision carries the chosen relation rows');
select is(
  (select count(*)::integer from platform_private.cms_entry_field_values value_row
   where value_row.revision_id = (select (response->>'id')::uuid from s10r_e2_resolved)
     and value_row.field_id = pg_temp.s10r_fid('related')::uuid),
  0, 'a resolved relation is not an EntryFieldValue');
select is(
  (select conflict.state from platform_private.cms_conflict_records conflict
   where conflict.entry_id = (select value::uuid from s10r_ids2 where key = 'e2')
   order by conflict.created_at desc limit 1),
  'resolved', 'the relation conflict is closed by the resolution');
select is(
  (select revision.payload_hash::text from platform_private.cms_entry_revisions revision
   where revision.id = (select (response->>'id')::uuid from s10r_e2_resolved)),
  platform_private.cms_jcs_sha256(jsonb_build_object(pg_temp.s10r_fid('title'), 'Two')),
  'the resolved revision payload hash excludes the relation');

-- E3: an explicit relation resolution (two ordered targets).
create temp table s10r_e3 on commit drop as
select pg_temp.s10_rpc_exec(pg_temp.s10r_create_sql(
  jsonb_build_object('title', 'Three', 'related', pg_temp.s10r_rel(pg_temp.s10r_t('t1'))),
  's10-rel-create-3001')) as response;
insert into s10r_ids2(key, value) select 'e3', response->'entry'->>'id' from s10r_e3;
select pg_temp.s10_rpc_exec(pg_temp.s10r_revision_sql(
  (select value from s10r_ids2 where key = 'e3'),
  jsonb_build_object('related', pg_temp.s10r_rel(pg_temp.s10r_t('t2'))), '1', '1', 's10-rel-append-7001'));
create temp table s10r_e3_conflict on commit drop as
select pg_temp.s10_rpc_exec(pg_temp.s10r_revision_sql(
  (select value from s10r_ids2 where key = 'e3'),
  jsonb_build_object('related', pg_temp.s10r_rel(pg_temp.s10r_t('t1'))), '1', '2', 's10-rel-append-7002')) as response;
select is((select response->>'kind' from s10r_e3_conflict), 'conflict',
  'a stale edit back to the base relation still conflicts with the moved draft');
create temp table s10r_e3_resolved on commit drop as
select pg_temp.s10_rpc_exec(pg_temp.s10r_resolve_sql((select value from s10r_ids2 where key = 'e3'),
  jsonb_build_array(jsonb_build_object('path', '/fields/' || pg_temp.s10r_fid('related'),
    'choice', 'explicit', 'value', pg_temp.s10r_rel(pg_temp.s10r_t('t2'), pg_temp.s10r_t('t1')))),
  '1', '2', 's10-rel-resolve-2001')) as response;
select is(pg_temp.s10_last_error_message(), null::text, 'an explicit relation choice resolves the conflict');
select is(
  pg_temp.s10r_targets((select (response->>'id')::uuid from s10r_e3_resolved), 'related'),
  array[pg_temp.s10r_t('t2'), pg_temp.s10r_t('t1')],
  'the explicit relation value is stored in order');

-- E4: a relation edit that does not overlap the other editor's change is
-- auto-merged while the overlapping title needs one explicit choice.
create temp table s10r_e4 on commit drop as
select pg_temp.s10_rpc_exec(pg_temp.s10r_create_sql(
  jsonb_build_object('title', 'A', 'related', pg_temp.s10r_rel(pg_temp.s10r_t('t1'))),
  's10-rel-create-4001')) as response;
insert into s10r_ids2(key, value) select 'e4', response->'entry'->>'id' from s10r_e4;
select pg_temp.s10_rpc_exec(pg_temp.s10r_revision_sql(
  (select value from s10r_ids2 where key = 'e4'),
  jsonb_build_object('title', 'B'), '1', '1', 's10-rel-append-8001'));
create temp table s10r_e4_conflict on commit drop as
select pg_temp.s10_rpc_exec(pg_temp.s10r_revision_sql(
  (select value from s10r_ids2 where key = 'e4'),
  jsonb_build_object('title', 'C', 'related', pg_temp.s10r_rel(pg_temp.s10r_t('t2'))),
  '1', '2', 's10-rel-append-8002')) as response;
select is((select response->>'kind' from s10r_e4_conflict), 'conflict',
  'a title overlap records a conflict whose paths include the relation');
create temp table s10r_e4_resolved on commit drop as
select pg_temp.s10_rpc_exec(pg_temp.s10r_resolve_sql((select value from s10r_ids2 where key = 'e4'),
  jsonb_build_array(jsonb_build_object('path', '/fields/' || pg_temp.s10r_fid('title'), 'choice', 'theirs')),
  '1', '2', 's10-rel-resolve-3001')) as response;
select is(pg_temp.s10_last_error_message(), null::text, 'resolving only the overlapping field succeeds');
select is(
  pg_temp.s10r_targets((select (response->>'id')::uuid from s10r_e4_resolved), 'related'),
  array[pg_temp.s10r_t('t2')],
  'the non-overlapping relation edit is auto-merged from yours');
select is(
  (select value from platform_private.cms_entry_field_values value_row
   where value_row.revision_id = (select (response->>'id')::uuid from s10r_e4_resolved)
     and value_row.field_id = pg_temp.s10r_fid('title')::uuid),
  to_jsonb('B'::text), 'the overlapping title takes the chosen theirs value');

select * from finish();
rollback;
