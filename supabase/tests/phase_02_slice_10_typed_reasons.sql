-- Slice 10 gap resolution (P2-S10-AC-005/AC-078/AC-080, audit WP-A2): the write
-- commands emit the Worker-readable typed 422 reasons instead of a bare
-- VALIDATION_FAILED.
--
-- BE03b "Value encodings by field kind" and "rich_text.v1 value grammar":
--   * a rich_text value that is not a canonical rich_text.v1 document (a raw
--     string, another format literal, unsafe link, non-canonical spans, any
--     other JSON shape) is refused with typed reason `rich_text_not_canonical`
--     rather than canonicalized server-side (BE03b:1154);
--   * an object value that does not satisfy the declared DEC-133 structure
--     (not an object, unknown key, missing required key, kind mismatch, a
--     constraint violation) is refused with `object_property_invalid`, and a
--     field declared `object` with no structure at all with
--     `object_kind_unspecified` (BE03b:1053);
--   * every other value failure stays the bare VALIDATION_FAILED, and a refusal
--     commits nothing.
-- The reason token is the whole P0001 message, like the lane B/D/F reasons
-- (comparison_too_large, migration_chain_mismatch, taxonomy_source_unavailable).
-- The taxonomy/media producer reasons are pinned in
-- phase_02_slice_10_value_source_refusal.sql.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_10_value_source/000-gallery-fixture.sqlinc

create temp table s10t_cases on commit drop as
select n, label, by_key, expected
from (values
  (1, 'richtext_raw_string', '{"body":"plain"}'::jsonb, 'rich_text_not_canonical'),
  (2, 'richtext_other_format', '{"body":{"format":"html","blocks":[]}}'::jsonb, 'rich_text_not_canonical'),
  (3, 'richtext_unmerged_spans', '{"body":{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"a","marks":[]},{"text":"b","marks":[]}]}]}}'::jsonb, 'rich_text_not_canonical'),
  (4, 'richtext_unsafe_link', '{"body":{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"a","marks":[],"link":{"kind":"https","href":"javascript:alert(1)"}}]}]}}'::jsonb, 'rich_text_not_canonical'),
  (5, 'richtext_backslash_route', '{"body":{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"a","marks":[],"link":{"kind":"internal","route":"/\\evil.example"}}]}]}}'::jsonb, 'rich_text_not_canonical'),
  (6, 'richtext_number', '{"body":5}'::jsonb, 'rich_text_not_canonical'),
  (7, 'richtext_array', '{"body":[]}'::jsonb, 'rich_text_not_canonical'),
  (8, 'richtext_unknown_key', '{"body":{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"a","marks":[]}],"extra":1}]}}'::jsonb, 'rich_text_not_canonical'),
  (9, 'object_string', '{"meta":"x"}'::jsonb, 'object_property_invalid'),
  (10, 'object_array', '{"meta":[]}'::jsonb, 'object_property_invalid'),
  (11, 'object_unknown_key', '{"meta":{"label":"x","other":1}}'::jsonb, 'object_property_invalid'),
  (12, 'object_missing_required', '{"meta":{}}'::jsonb, 'object_property_invalid'),
  (13, 'object_null_scalar', '{"meta":{"label":null}}'::jsonb, 'object_property_invalid'),
  (14, 'object_nested_scalar', '{"meta":{"label":{"nested":true}}}'::jsonb, 'object_property_invalid'),
  (15, 'short_text_number', '{"title":5}'::jsonb, 'VALIDATION_FAILED'),
  (16, 'list_wrong_item', '{"keywords":[1]}'::jsonb, 'VALIDATION_FAILED'),
  (17, 'taxonomy_string', '{"tags":"term-one"}'::jsonb, 'VALIDATION_FAILED'),
  (18, 'media_string', '{"hero":"asset"}'::jsonb, 'VALIDATION_FAILED'),
  -- A JSON null is an authored null on create (no provenance admits it) but the
  -- explicit_null disposition on append, so these two are create-only cases.
  (19, 'richtext_json_null', '{"body":null}'::jsonb, 'VALIDATION_FAILED'),
  (20, 'object_json_null', '{"meta":null}'::jsonb, 'VALIDATION_FAILED')
) c(n, label, by_key, expected);

-- ---------------------------------------------------------------------------
-- cms_create_entry (CMS-03B-10).
-- ---------------------------------------------------------------------------
create temp table s10t_before_create on commit drop as select pg_temp.s10g_counts() as counts;
select pg_temp.s10_rpc_probe_persist(
  'create_' || c.label, null,
  'select platform_api.cms_create_entry('
    || quote_literal(pg_temp.s10g_create_request(
         jsonb_build_object('title', 'Typed') || c.by_key,
         's10-typed-create-' || lpad(c.n::text, 4, '0'))::text)
    || '::jsonb)')
from s10t_cases c;
select is(pg_temp.s10_probe_message('create_' || c.label), c.expected,
  'cms_create_entry: ' || c.label || ' is ' || c.expected || ' [BE03b, AC-005]')
from s10t_cases c order by c.n;
select is(pg_temp.s10g_counts(), (select counts from s10t_before_create),
  'cms_create_entry: every typed refusal committed no entry, revision, value, conflict, reservation, outbox or audit row');

-- A rich_text document that IS canonical, and an object that satisfies its structure, are stored.
create temp table s10t_created on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_create_entry('
    || quote_literal(pg_temp.s10g_create_request(jsonb_build_object(
         'title', 'Typed',
         'body', '{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"Hi","marks":[]}]}]}'::jsonb,
         'meta', '{"label":"x"}'::jsonb), 's10-typed-create-1001')::text)
    || '::jsonb)') as response;
select is(pg_temp.s10_last_error_message(), null::text,
  'a canonical rich_text.v1 value and a structure-valid object value are stored');
insert into s10g_ids(key, value) select 'entryId', response->'entry'->>'id' from s10t_created;

-- ---------------------------------------------------------------------------
-- cms_create_revision (CMS-03B-01).
-- ---------------------------------------------------------------------------
create temp table s10t_before_append on commit drop as select pg_temp.s10g_counts() as counts;
select pg_temp.s10_rpc_probe_persist(
  'append_' || c.label, null,
  'select platform_api.cms_create_revision('
    || quote_literal(pg_temp.s10g_revision_request(
         (select value from s10g_ids where key = 'entryId'), c.by_key, '1', '1',
         's10-typed-append-' || lpad(c.n::text, 4, '0'))::text)
    || '::jsonb)')
from s10t_cases c where c.n < 19;
select is(pg_temp.s10_probe_message('append_' || c.label), c.expected,
  'cms_create_revision: ' || c.label || ' is ' || c.expected || ' [BE03b, AC-005]')
from s10t_cases c where c.n < 19 order by c.n;
select is(pg_temp.s10g_counts(), (select counts from s10t_before_append),
  'cms_create_revision: every typed refusal appended no revision, value, conflict, reservation, outbox or audit row');

-- ---------------------------------------------------------------------------
-- cms_resolve_conflict (CMS-03B-02): an explicit choice carries the same reasons.
-- ---------------------------------------------------------------------------
create temp table s10t_rev2 on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_create_revision('
    || quote_literal(pg_temp.s10g_revision_request(
         (select value from s10g_ids where key = 'entryId'),
         jsonb_build_object(
           'body', '{"format":"rich_text.v1","blocks":[{"type":"heading","level":2,"spans":[{"text":"Two","marks":[]}]}]}'::jsonb,
           'meta', '{"label":"two"}'::jsonb),
         '1', '1', 's10-typed-append-2001')::text)
    || '::jsonb)') as response;
create temp table s10t_conflict on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_create_revision('
    || quote_literal(pg_temp.s10g_revision_request(
         (select value from s10g_ids where key = 'entryId'),
         jsonb_build_object(
           'body', '{"format":"rich_text.v1","blocks":[{"type":"quote","spans":[{"text":"Yours","marks":[]}]}]}'::jsonb,
           'meta', '{"label":"yours"}'::jsonb),
         '1', '2', 's10-typed-append-2002')::text)
    || '::jsonb)') as response;
select is((select response->>'kind' from s10t_conflict), 'conflict',
  'a stale edit of the rich_text and object fields records one durable conflict');

create or replace function pg_temp.s10t_resolve_sql(p_choices jsonb, p_key text)
returns text
language sql
stable
as $body$
  select 'select platform_api.cms_resolve_conflict('
    || quote_literal(jsonb_build_object(
         'entryId', conflict.entry_id, 'conflictId', conflict.id,
         'baseRevision', '1', 'choices', p_choices,
         'expectedVersion', '2', 'ifMatch', '2', 'idempotencyKey', p_key,
         'context', jsonb_build_object(
           'actingPartyId', (select value from s10_ids where key = 'organization'),
           'actingContextId', 'a9100000-0000-4000-8000-000000000094',
           'correlationId', 'a9100000-0000-4000-8000-000000000095'))::text)
    || '::jsonb)'
  from platform_private.cms_conflict_records conflict
  where conflict.entry_id = (select value::uuid from s10g_ids where key = 'entryId')
    and conflict.state = 'open'
$body$;

create temp table s10t_before_resolve on commit drop as select pg_temp.s10g_counts() as counts;
select pg_temp.s10_rpc_probe_persist(
  'resolve_' || c.label, null,
  pg_temp.s10t_resolve_sql(jsonb_build_array(
    jsonb_build_object('path', '/fields/' || pg_temp.s10g_fid('body'), 'choice', 'explicit', 'value', c.body),
    jsonb_build_object('path', '/fields/' || pg_temp.s10g_fid('meta'), 'choice', 'explicit', 'value', c.meta)),
    's10-typed-resolve-' || lpad(c.n::text, 4, '0')))
from (values
  (1, 'richtext_raw', '"plain"'::jsonb, '{"label":"ok"}'::jsonb),
  (2, 'object_unknown_key', '{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"ok","marks":[]}]}]}'::jsonb, '{"label":"x","other":1}'::jsonb)
) c(n, label, body, meta);
select is(pg_temp.s10_probe_message('resolve_richtext_raw'), 'rich_text_not_canonical',
  'cms_resolve_conflict: a raw string for a rich_text choice is rich_text_not_canonical [BE03b:1154]');
select is(pg_temp.s10_probe_message('resolve_object_unknown_key'), 'object_property_invalid',
  'cms_resolve_conflict: an object choice with an undeclared key is object_property_invalid [BE03b:1053]');
select is(pg_temp.s10g_counts(), (select counts from s10t_before_resolve),
  'cms_resolve_conflict: every typed refusal committed nothing and left the conflict open');

-- ---------------------------------------------------------------------------
-- object_kind_unspecified: a field declared `object` with no structure at all.
-- A complete type definition cannot declare one (the definition gate refuses
-- it), so the legacy shape is produced by removing the structure from the stored
-- field row inside this rolled-back transaction, with trigger enforcement off.
-- ---------------------------------------------------------------------------
select is(
  platform_private.cms_draft_value_refusal(
    (select value::uuid from s10g_ids where key = 'versionId'),
    pg_temp.s10g_fid('meta')::uuid, '{"label":"x"}'::jsonb, 'authored'),
  null::text,
  'with its structure present an object value that satisfies it has no refusal');

set local session_replication_role = replica;
update platform_private.cms_field_definition_versions
set constraints = '{}'::jsonb
where stable_field_id = pg_temp.s10g_fid('meta')::uuid
  and content_type_version_id = (select value::uuid from s10g_ids where key = 'versionId');
set local session_replication_role = origin;

select is(
  platform_private.cms_draft_value_refusal(
    (select value::uuid from s10g_ids where key = 'versionId'),
    pg_temp.s10g_fid('meta')::uuid, '{"label":"x"}'::jsonb, 'authored'),
  'object_kind_unspecified',
  'an object field with no typed structure refuses every value with object_kind_unspecified [BE03b:1053]');
select pg_temp.s10_rpc_probe_persist(
  'create_no_structure', null,
  'select platform_api.cms_create_entry('
    || quote_literal(pg_temp.s10g_create_request(
         '{"title":"Typed","meta":{"label":"x"}}'::jsonb, 's10-typed-create-3001')::text)
    || '::jsonb)');
select is(pg_temp.s10_probe_message('create_no_structure'), 'object_kind_unspecified',
  'cms_create_entry refuses an object value with object_kind_unspecified when the field has no structure');

-- The classifier is a private, definer-only predicate.
select ok(
  pg_temp.s10_fn_exists('platform_private', 'cms_draft_value_refusal', 'uuid, uuid, jsonb, text')
    and pg_temp.s10_no_execute_for('platform_private', 'cms_draft_value_refusal', 'authenticated')
    and pg_temp.s10_no_execute_for('platform_private', 'cms_draft_value_refusal', 'anon')
    and pg_temp.s10_no_execute_for('platform_private', 'cms_draft_value_refusal', 'service_role'),
  'cms_draft_value_refusal is private: no API role may execute it');
select ok(
  pg_temp.s10_fn_exists('platform_private', 'cms_require_draft_value_valid', 'uuid, uuid, jsonb, text')
    and pg_temp.s10_no_execute_for('platform_private', 'cms_require_draft_value_valid', 'authenticated')
    and pg_temp.s10_no_execute_for('platform_private', 'cms_require_draft_value_valid', 'anon')
    and pg_temp.s10_no_execute_for('platform_private', 'cms_require_draft_value_valid', 'service_role'),
  'cms_require_draft_value_valid is private: no API role may execute it');

select * from finish();
rollback;
