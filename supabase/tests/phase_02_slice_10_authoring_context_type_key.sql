-- Slice 12 evolve-contract (CMS-03B-14): the author-safe
-- AuthoringContextType projection gains a server-derived `typeKey`.
--
-- STATUS: UNRUN.  The native/database prerequisites are blocked, so this suite
-- has not been executed and is neither observed RED nor observed green.
--
-- Adding a required response member is a breaking contract change: an old
-- strict parser without `typeKey` no longer accepts a current projection, and
-- the member is never optional or a catch-all so a caller cannot substitute it.
-- The key is derived server-side from the owning content type, so it is present
-- on every creatableTypes row and on the selectedType row, it always equals the
-- live registry `cms_content_types.type_key`, and a caller-supplied `typeKey`
-- beside the query version is a structural refusal.  The suite is written
-- before the projection/migration change, so an absent key is evidence-backed
-- RED.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(12);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

-- Act as the owner whose active compiled type the fixture created.
select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization')
);

-- No query version: every creatable active type carries the derived key.
select pg_temp.s10_rpc_probe(
  'context_type_key_list',
  null,
  $sql$select platform_api.cms_get_entry_authoring_context('{}'::jsonb)$sql$
);

select ok(
  pg_temp.s10_probe_state('context_type_key_list') = '00000'
    and pg_catalog.jsonb_typeof(
      pg_temp.s10_probe_response('context_type_key_list') -> 'creatableTypes'
    ) = 'array'
    and pg_catalog.jsonb_typeof(
      pg_temp.s10_probe_response('context_type_key_list')
        -> 'creatableTypes' -> 0 -> 'typeKey'
    ) = 'string',
  'each creatable authoring-context type carries a string typeKey'
);

select is(
  pg_temp.s10_probe_response('context_type_key_list')
    -> 'creatableTypes' -> 0 ->> 'typeKey',
  'article',
  'the creatable type exposes the registry type_key of its content type'
);

select ok(
  coalesce((
    select pg_catalog.bool_and(
      coalesce(entry.value ->> 'typeKey', '') = type_row.type_key
        and coalesce(entry.value ->> 'typeKey', '') ~ '^[a-z][a-z0-9_]{1,63}$'
    )
    from pg_catalog.jsonb_array_elements(
      pg_temp.s10_probe_response('context_type_key_list') -> 'creatableTypes'
    ) as entry(value)
    join platform_private.cms_content_types type_row
      on type_row.id = (entry.value ->> 'contentTypeId')::uuid
  ), false),
  'every creatable typeKey is server-derived from the live content type'
);

-- With the active version: the selected type carries the derived key too.
select pg_temp.s10_rpc_probe(
  'context_type_key_selected',
  null,
  $sql$select platform_api.cms_get_entry_authoring_context(jsonb_build_object(
    'contentTypeVersionId', (select value from s10_ids where key = 'draftVersionId')))$sql$
);

select ok(
  pg_temp.s10_probe_state('context_type_key_selected') = '00000'
    and pg_catalog.jsonb_typeof(
      pg_temp.s10_probe_response('context_type_key_selected')
        -> 'selectedType' -> 'typeKey'
    ) = 'string',
  'the selected authoring-context type carries a string typeKey'
);

select is(
  pg_temp.s10_probe_response('context_type_key_selected')
    -> 'selectedType' ->> 'typeKey',
  (select type_row.type_key
     from platform_private.cms_content_types type_row
    where type_row.id = (select value::uuid from s10_ids where key = 'typeId')),
  'the selected type exposes the registry type_key of the selected content type'
);

-- Response-only: a caller may never supply the derived key beside the version.
select pg_temp.s10_rpc_probe(
  'context_type_key_smuggled',
  null,
  $sql$select platform_api.cms_get_entry_authoring_context(jsonb_build_object(
    'contentTypeVersionId', (select value from s10_ids where key = 'draftVersionId'),
    'typeKey', 'article'))$sql$
);

select is(
  pg_temp.s10_probe_state('context_type_key_smuggled'), 'P0001',
  'a caller-supplied typeKey beside the query version is refused'
);

select pg_temp.s10_rpc_probe(
  'context_type_key_alone',
  null,
  $sql$select platform_api.cms_get_entry_authoring_context(
    '{"typeKey":"article"}'::jsonb)$sql$
);

select is(
  pg_temp.s10_probe_state('context_type_key_alone'), 'P0001',
  'a caller-supplied typeKey with no query version is refused'
);

-- The key is derived from the content type row, never echoed from the caller.
select ok(
  coalesce((select
    pg_catalog.pg_get_functiondef(proc.oid) ~* '''typeKey'''
    and pg_catalog.pg_get_functiondef(proc.oid)
      ~* 'type_row[[:space:]]*[.][[:space:]]*type_key'
    from pg_proc proc
   where proc.oid = to_regprocedure(
     'platform_private.cms_authoring_context_type(uuid)')),
  false),
  'the authoring-context type projection derives typeKey from the content type'
);

select finish();
rollback;
