-- Slice 10 follow-up (lane F, task 4): the producer refusal through the write
-- commands cms_create_entry (CMS-03B-10) and cms_create_revision (CMS-03B-01).
--
-- BE03b "Value encodings by field kind": "A field whose kind has no available
-- producer refuses at write with a typed reason instead of storing an
-- unvalidated value."  A non-empty taxonomy value fails closed with
-- `taxonomy_source_unavailable` and a non-empty media value with
-- `media_source_unavailable`; a malformed encoding is the typed VALIDATION_FAILED
-- refusal; a refused write commits nothing; and an EMPTY taxonomy/media value and
-- every kind whose validator exists (rich_text.v1, the DEC-133 object, list) is
-- still stored, including by the append command over an entry that already
-- carries them (P2-S10-AC-074, AC-080).  The encodings and the predicate are in
-- phase_02_slice_10_value_source_encoding.sql; conflict resolution is in
-- phase_02_slice_10_value_source_resolve.sql.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_10_value_source/000-gallery-fixture.sqlinc

-- ---------------------------------------------------------------------------
-- B1: cms_create_entry.
-- ---------------------------------------------------------------------------
create temp table s10g_before_create on commit drop as select pg_temp.s10g_counts() as counts;

select pg_temp.s10_rpc_probe_persist(
  'create_' || c.label, null,
  'select platform_api.cms_create_entry('
    || quote_literal(pg_temp.s10g_create_request(
         jsonb_build_object('title', 'Gallery') || c.by_key,
         's10-gallery-create-' || lpad(c.n::text, 4, '0'))::text)
    || '::jsonb)')
from (values
  (1, 'tax_nonempty', '{"tags":{"termIds":["a9100000-0000-4000-8000-0000000000f1"]}}'::jsonb),
  (2, 'media_object', '{"hero":{"assetId":"a9100000-0000-4000-8000-0000000000a1","assetVersion":"3"}}'::jsonb),
  (3, 'media_array', '{"hero":[{"assetId":"a9100000-0000-4000-8000-0000000000a1","assetVersion":"3"}]}'::jsonb),
  (4, 'tax_string', '{"tags":"term-one"}'::jsonb),
  (5, 'tax_bad_uuid', '{"tags":{"termIds":["nope"]}}'::jsonb),
  (6, 'media_string', '{"hero":"asset"}'::jsonb),
  (7, 'media_bad_version', '{"hero":{"assetId":"a9100000-0000-4000-8000-0000000000a1","assetVersion":3}}'::jsonb),
  (8, 'object_unknown_key', '{"meta":{"label":"x","other":1}}'::jsonb),
  (9, 'richtext_raw', '{"body":"plain"}'::jsonb),
  (10, 'list_wrong_item', '{"keywords":[1]}'::jsonb)
) c(n, label, by_key);

select is(pg_temp.s10_probe_message('create_' || label), 'taxonomy_source_unavailable',
  'cms_create_entry: ' || label || ' fails closed with the typed taxonomy_source_unavailable reason [BE03b]')
from unnest(array['tax_nonempty']) label;
select is(pg_temp.s10_probe_message('create_' || label), 'media_source_unavailable',
  'cms_create_entry: ' || label || ' fails closed with the typed media_source_unavailable reason [BE03b]')
from unnest(array['media_object', 'media_array']) label;
select is(pg_temp.s10_probe_message('create_' || label), 'VALIDATION_FAILED',
  'cms_create_entry: ' || label || ' is a malformed encoding, the typed VALIDATION_FAILED refusal [BE03b]')
from unnest(array['tax_string', 'tax_bad_uuid', 'media_string', 'media_bad_version',
  'list_wrong_item']) label;
-- Typed 422 reasons (P2-S10-AC-005, BE03b:1053/1154): a non-canonical rich_text.v1 value
-- and an object value that violates its declared structure are named, not bare.
select is(pg_temp.s10_probe_message('create_richtext_raw'), 'rich_text_not_canonical',
  'cms_create_entry: a raw string for a rich_text field is the typed rich_text_not_canonical reason [BE03b:1154, AC-005]');
select is(pg_temp.s10_probe_message('create_object_unknown_key'), 'object_property_invalid',
  'cms_create_entry: an object value with an undeclared key is the typed object_property_invalid reason [BE03b:1053, AC-078]');
select is(pg_temp.s10g_counts(), (select counts from s10g_before_create),
  'cms_create_entry: every refused value committed no entry, revision, value, conflict, idempotency reservation, outbox or audit row [BE03b]');

create temp table s10g_created on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_create_entry('
    || quote_literal(pg_temp.s10g_create_request(jsonb_build_object(
         'title', 'Gallery',
         'body', '{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"Hi","marks":[]}]}]}'::jsonb,
         'meta', '{"label":"x"}'::jsonb,
         'keywords', '["a","b"]'::jsonb), 's10-gallery-create-1001')::text)
    || '::jsonb)') as response;
select is(pg_temp.s10_last_error_message(), null::text,
  'cms_create_entry stores a title with rich_text, object and list values whose validators exist [BE03b]');

create temp table s10g_created_empty on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_create_entry('
    || quote_literal(pg_temp.s10g_create_request(jsonb_build_object(
         'title', 'Gallery two',
         'tags', '{"termIds":[]}'::jsonb,
         'hero', '[]'::jsonb), 's10-gallery-create-1002')::text)
    || '::jsonb)') as response;
select is(pg_temp.s10_last_error_message(), null::text,
  'cms_create_entry still stores an EMPTY taxonomy and an EMPTY media value (no producer is needed) [BE03b]');
select is(
  (select value from platform_private.cms_entry_field_values
   where revision_id = (select (response->'revision'->>'id')::uuid from s10g_created_empty)
     and field_id = pg_temp.s10g_fid('tags')::uuid),
  '{"termIds":[]}'::jsonb,
  'the empty taxonomy value is stored exactly [BE03b]');
select is(
  (select value from platform_private.cms_entry_field_values
   where revision_id = (select (response->'revision'->>'id')::uuid from s10g_created_empty)
     and field_id = pg_temp.s10g_fid('hero')::uuid),
  '[]'::jsonb,
  'the empty media value is stored exactly [BE03b]');

insert into s10g_ids(key, value)
select 'entryId', response->'entry'->>'id' from s10g_created;

-- ---------------------------------------------------------------------------
-- B2: cms_create_revision (append) on the first entry (revision 1, version 1).
-- ---------------------------------------------------------------------------
create temp table s10g_before_append on commit drop as select pg_temp.s10g_counts() as counts;

select pg_temp.s10_rpc_probe_persist(
  'append_' || c.label, null,
  'select platform_api.cms_create_revision('
    || quote_literal(pg_temp.s10g_revision_request(
         (select value from s10g_ids where key = 'entryId'), c.by_key, '1', '1',
         's10-gallery-append-' || lpad(c.n::text, 4, '0'))::text)
    || '::jsonb)')
from (values
  (1, 'tax_nonempty', '{"tags":{"termIds":["a9100000-0000-4000-8000-0000000000f1"]}}'::jsonb),
  (2, 'media_object', '{"hero":{"assetId":"a9100000-0000-4000-8000-0000000000a1","assetVersion":"3"}}'::jsonb),
  (3, 'media_array', '{"hero":[{"assetId":"a9100000-0000-4000-8000-0000000000a1","assetVersion":"3"}]}'::jsonb),
  (4, 'tax_string', '{"tags":"term-one"}'::jsonb),
  (5, 'media_string', '{"hero":"asset"}'::jsonb),
  (6, 'object_null_scalar', '{"meta":{"label":null}}'::jsonb),
  (7, 'object_missing_required', '{"meta":{}}'::jsonb),
  (8, 'richtext_raw', '{"body":"plain"}'::jsonb),
  (9, 'list_wrong_item', '{"keywords":[1]}'::jsonb)
) c(n, label, by_key);

select is(pg_temp.s10_probe_message('append_' || label), 'taxonomy_source_unavailable',
  'cms_create_revision: ' || label || ' fails closed with the typed taxonomy_source_unavailable reason [BE03b]')
from unnest(array['tax_nonempty']) label;
select is(pg_temp.s10_probe_message('append_' || label), 'media_source_unavailable',
  'cms_create_revision: ' || label || ' fails closed with the typed media_source_unavailable reason [BE03b]')
from unnest(array['media_object', 'media_array']) label;
select is(pg_temp.s10_probe_message('append_' || label), 'VALIDATION_FAILED',
  'cms_create_revision: ' || label || ' is the typed VALIDATION_FAILED refusal [BE03b]')
from unnest(array['tax_string', 'media_string', 'list_wrong_item']) label;
select is(pg_temp.s10_probe_message('append_' || label), 'object_property_invalid',
  'cms_create_revision: ' || label || ' is the typed object_property_invalid reason [BE03b:1053, AC-078]')
from unnest(array['object_null_scalar', 'object_missing_required']) label;
select is(pg_temp.s10_probe_message('append_richtext_raw'), 'rich_text_not_canonical',
  'cms_create_revision: a raw string for a rich_text field is the typed rich_text_not_canonical reason [BE03b:1154, AC-005]');
select is(pg_temp.s10g_counts(), (select counts from s10g_before_append),
  'cms_create_revision: every refused value appended no revision, value, conflict, idempotency reservation, outbox or audit row [BE03b]');

-- Revision 2: empty taxonomy and media plus replaced rich_text/object/list values.
create temp table s10g_rev2 on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_create_revision('
    || quote_literal(pg_temp.s10g_revision_request(
         (select value from s10g_ids where key = 'entryId'),
         jsonb_build_object(
           'tags', '{"termIds":[]}'::jsonb,
           'hero', '[]'::jsonb,
           'body', '{"format":"rich_text.v1","blocks":[{"type":"heading","level":2,"spans":[{"text":"Two","marks":[]}]}]}'::jsonb,
           'meta', '{"label":"two"}'::jsonb,
           'keywords', '["c"]'::jsonb),
         '1', '1', 's10-gallery-append-1001')::text)
    || '::jsonb)') as response;
select is(pg_temp.s10_last_error_message(), null::text,
  'cms_create_revision appends empty taxonomy/media and rich_text, object and list values over an entry that already carries them [BE03b, AC-080]');
select is(
  (select value from platform_private.cms_entry_field_values
   where revision_id = (select (response->>'id')::uuid from s10g_rev2)
     and field_id = pg_temp.s10g_fid('meta')::uuid),
  '{"label":"two"}'::jsonb,
  'the appended object value is stored exactly [AC-080]');

select * from finish();
rollback;
