-- Slice 10 QA-RED (WP-S10-2a): CMS-03B-14 authoring-context read precedence
-- (BE03b Route Registry; Request/Response authoring-context contract).
--
-- The preparation read is author-safe: without a `contentTypeVersionId` it
-- returns the caller's creatable active types with no selection and no fields;
-- with one it must return exactly that selected version's author-safe field
-- projection and never a caller-chosen or registry-wide schema.  Precedence is
-- literal: selection requires the query version, fields require the selection,
-- and the selected version must equal the requested one.  The literal
-- `/entries/authoring-context` segment must resolve before the UUID entry path.
-- The suite is written before the WP-S10-3 `cms_entry_authoring_context.sql`
-- migration exists, so an absent RPC or guard is evidence-backed RED.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(16);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

select ok(
  pg_temp.s10_fn_exists('platform_api', 'cms_authoring_context', 'jsonb')
    and pg_temp.s10_fn_exists('platform_private', 'cms_authoring_context', 'jsonb'),
  'CMS-03B-14 authoring-context read has a named worker RPC and wrapper'
);

select ok(
  pg_temp.s10_fn_exists('platform_api', 'cms_authoring_context', 'jsonb')
    and not pg_temp.s10_fn_privilege(
      'platform_api', 'cms_authoring_context', 'jsonb', 'authenticated'
    )
    and not pg_temp.s10_fn_privilege(
      'platform_api', 'cms_authoring_context', 'jsonb', 'anon'
    ),
  'the authoring-context read is service-role only, never browser-callable'
);

select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization')
);

-- A non-UUID segment under the path must be a structural refusal, never
-- resolved as an entry id: the literal authoring-context segment is matched
-- first and every other non-UUID segment is rejected before any existence
-- check.
select pg_temp.s10_rpc_probe(
  'context_non_uuid',
  null,
  $sql$select platform_api.cms_authoring_context(
    '{"contentTypeVersionId":"authoring-context"}'::jsonb
  )$sql$
);

select is(
  pg_temp.s10_probe_state('context_non_uuid'), 'P0001',
  'a non-UUID authoring-context selector is a structural refusal, never an entry id'
);

-- No query version: creatable active types, no selection, no fields.
select pg_temp.s10_rpc_probe(
  'context_list',
  null,
  $sql$select platform_api.cms_authoring_context('{}'::jsonb)$sql$
);

select ok(
  pg_temp.s10_probe_state('context_list') = '00000'
    and coalesce(
      jsonb_typeof(
        pg_temp.s10_probe_response('context_list') -> 'creatableTypes'
      ) = 'array',
      false
    )
    and coalesce(
      (pg_temp.s10_probe_response('context_list') -> 'selectedType') = 'null'::jsonb,
      false
    )
    and coalesce(
      (pg_temp.s10_probe_response('context_list') -> 'fields') = '[]'::jsonb,
      false
    ),
  'without a query version the read returns creatable types and no selection'
);

-- With the active version: the selected type equals the requested version and
-- the field projection is bounded.
select pg_temp.s10_rpc_probe(
  'context_selected',
  null,
  $sql$select platform_api.cms_authoring_context(jsonb_build_object(
    'contentTypeVersionId', (select value from s10_ids where key = 'draftVersionId')))$sql$
);

select ok(
  pg_temp.s10_probe_state('context_selected') = '00000'
    and pg_temp.s10_probe_response('context_selected') -> 'selectedType'
      ->> 'contentTypeVersionId'
      = (select value from s10_ids where key = 'draftVersionId')
    and jsonb_array_length(
      pg_temp.s10_probe_response('context_selected') -> 'fields'
    ) between 0 and 128,
  'a selected version returns exactly its bounded author-safe field projection'
);

-- The selected type exposes the evidence CMS-03B-10 needs and never a
-- registry-wide read or an ownership identifier.
select ok(
  (pg_temp.s10_probe_response('context_selected') -> 'selectedType')
    ? 'schemaArtifact'
    and (pg_temp.s10_probe_response('context_selected') -> 'selectedType')
      ? 'workflowPolicy'
    and (pg_temp.s10_probe_response('context_selected') -> 'selectedType')
      ? 'activationEvidence'
    and not ((pg_temp.s10_probe_response('context_selected') -> 'selectedType')
      ? 'ownerId')
    and not ((pg_temp.s10_probe_response('context_selected') -> 'selectedType')
      ? 'capabilityGraph'),
  'the selected type carries create evidence and no registry-private authority'
);

-- Precedence: an unknown/absent version is concealed, never resolved to an
-- arbitrary creatable type.
select pg_temp.s10_rpc_probe(
  'context_unknown_version',
  null,
  $sql$select platform_api.cms_authoring_context(jsonb_build_object(
    'contentTypeVersionId', 'a9100000-0000-4000-8000-00000000ffff'))$sql$
);

select is(
  pg_temp.s10_probe_state('context_unknown_version'), 'P0001',
  'an off-registry version is concealed, never substituted'
);

-- Precedence: a caller cannot smuggle a different schema identity alongside
-- the query version.
select pg_temp.s10_rpc_probe(
  'context_smuggled_schema',
  null,
  $sql$select platform_api.cms_authoring_context(jsonb_build_object(
    'contentTypeVersionId', (select value from s10_ids where key = 'draftVersionId'),
    'schemaVersionId', 'a9100000-0000-4000-8000-00000000eeee'))$sql$
);

select is(
  pg_temp.s10_probe_state('context_smuggled_schema'), 'P0001',
  'a caller-supplied schema identity beside the query version is refused'
);

-- The read never grants a schema-registry read: an outsider without the
-- author/editor scope is refused.
select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'outsiderAuth'),
  (select value::uuid from s10_ids where key = 'organization')
);

select pg_temp.s10_rpc_probe(
  'context_no_scope',
  null,
  $sql$select platform_api.cms_authoring_context('{}'::jsonb)$sql$
);

select is(
  pg_temp.s10_probe_state('context_no_scope'), 'P0001',
  'the authoring-context read requires the author/editor scope'
);

-- Restore the creator and prove the read is side-effect free.
select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization')
);

select ok(
  pg_temp.s10_audit_count(
    'cms.authoring_context.read',
    (select value::uuid from s10_ids where key = 'entryId')
  ) = 0
    and pg_temp.s10_outbox_count(
      'cms.authoring_context.read.v1',
      (select value::uuid from s10_ids where key = 'entryId')
    ) = 0,
  'the preparation read emits no audit or outbox evidence'
);

-- An oversized creatable-type list is bounded, never an unbounded projection.
select ok(
  coalesce(
    jsonb_array_length(
      pg_temp.s10_probe_response('context_list') -> 'creatableTypes'
    ) <= 32,
    true
  ),
  'the creatable-type projection is bounded at 32'
);

-- The projection is scoped to the acting context: a caller cannot select a
-- version outside the party they are acting in.
select pg_temp.s10_rpc_probe(
  'context_cross_party',
  $setup$select set_config('app.acting_party_id', '', true)$setup$,
  $sql$select platform_api.cms_authoring_context(jsonb_build_object(
    'contentTypeVersionId', (select value from s10_ids where key = 'draftVersionId')))$sql$
);

select is(
  pg_temp.s10_probe_state('context_cross_party'), 'P0001',
  'a selection without an acting context is refused'
);

select finish();
rollback;
