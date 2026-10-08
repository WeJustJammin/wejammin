-- Slice 10 follow-up (lane F, task 4): the producer refusal through
-- cms_resolve_conflict (CMS-03B-02).
--
-- BE03b "Value encodings by field kind": a resolved snapshot may not carry a
-- well-formed NON-EMPTY taxonomy or media value either; it fails closed with
-- `taxonomy_source_unavailable` / `media_source_unavailable`, a malformed explicit
-- choice is the typed VALIDATION_FAILED refusal, a refused resolution leaves the
-- conflict open and commits nothing, and a resolution to EMPTY taxonomy/media
-- values stores them while carrying rich_text.v1, DEC-133 object and list values
-- forward (P2-S10-AC-080).  The create and append commands are in
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

-- An entry carrying rich_text, object and list values, and its second revision
-- (empty taxonomy/media plus replaced structured values).
create temp table s10g_created on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_create_entry('
    || quote_literal(pg_temp.s10g_create_request(jsonb_build_object(
         'title', 'Gallery',
         'body', '{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"Hi","marks":[]}]}]}'::jsonb,
         'meta', '{"label":"x"}'::jsonb,
         'keywords', '["a","b"]'::jsonb), 's10-gallery-create-2001')::text)
    || '::jsonb)') as response;
select is(pg_temp.s10_last_error_message(), null::text,
  'cms_create_entry stores a title with rich_text, object and list values [BE03b]');
insert into s10g_ids(key, value)
select 'entryId', response->'entry'->>'id' from s10g_created;

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
         '1', '1', 's10-gallery-append-2001')::text)
    || '::jsonb)') as response;
select is(pg_temp.s10_last_error_message(), null::text,
  'cms_create_revision appends empty taxonomy/media and replaced rich_text, object and list values [BE03b]');

-- Competing stale edits: a second author changes tags and hero from base
-- revision 1 after revision 2 moved them, so a real durable conflict is stored.
create temp table s10g_conflict_made on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_create_revision('
    || quote_literal(pg_temp.s10g_revision_request(
         (select value from s10g_ids where key = 'entryId'),
         jsonb_build_object('tags', 'null'::jsonb, 'hero', 'null'::jsonb),
         '1', '2', 's10-gallery-append-2002')::text)
    || '::jsonb)') as response;
select is((select response->>'kind' from s10g_conflict_made), 'conflict',
  'a stale edit of the taxonomy and media fields records one durable conflict [BE03b]');

-- ---------------------------------------------------------------------------
-- B3: cms_resolve_conflict.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.s10g_resolve_request(p_choices jsonb, p_key text)
returns jsonb
language sql
stable
as $body$
  select jsonb_build_object(
    'entryId', conflict.entry_id,
    'conflictId', conflict.id,
    'baseRevision', '1',
    'choices', p_choices,
    'expectedVersion', '2',
    'ifMatch', '2',
    'idempotencyKey', p_key,
    'context', jsonb_build_object(
      'actingPartyId', (select value from s10_ids where key = 'organization'),
      'actingContextId', 'a9100000-0000-4000-8000-000000000094',
      'correlationId', 'a9100000-0000-4000-8000-000000000095'))
  from platform_private.cms_conflict_records conflict
  where conflict.entry_id = (select value::uuid from s10g_ids where key = 'entryId')
    and conflict.state = 'open'
$body$;

create temp table s10g_before_resolve on commit drop as select pg_temp.s10g_counts() as counts;

select pg_temp.s10_rpc_probe_persist(
  'resolve_' || c.label, null,
  'select platform_api.cms_resolve_conflict('
    || quote_literal(pg_temp.s10g_resolve_request(c.choices,
         's10-gallery-resolve-' || lpad(c.n::text, 4, '0'))::text)
    || '::jsonb)')
from (values
  (1, 'tax_nonempty', jsonb_build_array(
    jsonb_build_object('path', '/fields/' || pg_temp.s10g_fid('tags'), 'choice', 'explicit',
      'value', '{"termIds":["a9100000-0000-4000-8000-0000000000f1"]}'::jsonb),
    jsonb_build_object('path', '/fields/' || pg_temp.s10g_fid('hero'), 'choice', 'yours'))),
  (2, 'media_object', jsonb_build_array(
    jsonb_build_object('path', '/fields/' || pg_temp.s10g_fid('tags'), 'choice', 'yours'),
    jsonb_build_object('path', '/fields/' || pg_temp.s10g_fid('hero'), 'choice', 'explicit',
      'value', '{"assetId":"a9100000-0000-4000-8000-0000000000a1","assetVersion":"3"}'::jsonb))),
  (3, 'media_array', jsonb_build_array(
    jsonb_build_object('path', '/fields/' || pg_temp.s10g_fid('tags'), 'choice', 'yours'),
    jsonb_build_object('path', '/fields/' || pg_temp.s10g_fid('hero'), 'choice', 'explicit',
      'value', '[{"assetId":"a9100000-0000-4000-8000-0000000000a1","assetVersion":"3"}]'::jsonb))),
  (4, 'tax_string', jsonb_build_array(
    jsonb_build_object('path', '/fields/' || pg_temp.s10g_fid('tags'), 'choice', 'explicit',
      'value', '"term-one"'::jsonb),
    jsonb_build_object('path', '/fields/' || pg_temp.s10g_fid('hero'), 'choice', 'yours'))),
  (5, 'media_string', jsonb_build_array(
    jsonb_build_object('path', '/fields/' || pg_temp.s10g_fid('tags'), 'choice', 'yours'),
    jsonb_build_object('path', '/fields/' || pg_temp.s10g_fid('hero'), 'choice', 'explicit',
      'value', '"asset"'::jsonb)))
) c(n, label, choices);

select is(pg_temp.s10_probe_message('resolve_' || label), 'taxonomy_source_unavailable',
  'cms_resolve_conflict: ' || label || ' fails closed with the typed taxonomy_source_unavailable reason [BE03b]')
from unnest(array['tax_nonempty']) label;
select is(pg_temp.s10_probe_message('resolve_' || label), 'media_source_unavailable',
  'cms_resolve_conflict: ' || label || ' fails closed with the typed media_source_unavailable reason [BE03b]')
from unnest(array['media_object', 'media_array']) label;
select is(pg_temp.s10_probe_message('resolve_' || label), 'VALIDATION_FAILED',
  'cms_resolve_conflict: ' || label || ' is the typed VALIDATION_FAILED refusal [BE03b]')
from unnest(array['tax_string', 'media_string']) label;
select is(pg_temp.s10g_counts(), (select counts from s10g_before_resolve),
  'cms_resolve_conflict: every refused choice committed no revision, value, idempotency reservation, outbox or audit row and left the conflict open [BE03b]');
select is(
  (select count(*)::integer from platform_private.cms_conflict_records
   where entry_id = (select value::uuid from s10g_ids where key = 'entryId') and state = 'open'),
  1, 'the conflict is still open after the refused resolutions [BE03b]');

create temp table s10g_resolved on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_resolve_conflict('
    || quote_literal(pg_temp.s10g_resolve_request(jsonb_build_array(
         jsonb_build_object('path', '/fields/' || pg_temp.s10g_fid('tags'), 'choice', 'explicit',
           'value', '{"termIds":[]}'::jsonb),
         jsonb_build_object('path', '/fields/' || pg_temp.s10g_fid('hero'), 'choice', 'explicit',
           'value', '[]'::jsonb)), 's10-gallery-resolve-1001')::text)
    || '::jsonb)') as response;
select is(pg_temp.s10_last_error_message(), null::text,
  'cms_resolve_conflict resolves to EMPTY taxonomy and media values and stores rich_text, object and list values unchanged [BE03b, AC-080]');
select is(
  (select value from platform_private.cms_entry_field_values
   where revision_id = (select (response->>'id')::uuid from s10g_resolved)
     and field_id = pg_temp.s10g_fid('tags')::uuid),
  '{"termIds":[]}'::jsonb,
  'the resolved taxonomy value is stored exactly [BE03b]');
select is(
  (select value from platform_private.cms_entry_field_values
   where revision_id = (select (response->>'id')::uuid from s10g_resolved)
     and field_id = pg_temp.s10g_fid('meta')::uuid),
  '{"label":"two"}'::jsonb,
  'the resolved revision carries the object value forward [AC-080]');

select * from finish();
rollback;
