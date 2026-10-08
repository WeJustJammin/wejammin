-- Slice 10 gap resolution DEC-146 (P2-S10-AC-085, audit D-12): the protected
-- immutable `rich_text.v1`@1 validator is frozen into the compiled schema artifact
-- and revalidated before every editorial transition.
--
-- BE03a "Protected Validator Registry": rich_text.v1 version 1 is the only member
-- of the code-owned protected validator registry, and the compile rule freezes the
-- validator identity into the artifact and the definition hash.  DEC-146 makes the
-- registry entry concrete: a canonical immutable grammar descriptor whose JCS
-- SHA-256 is the artifact hash of the validator, referenced as
-- `cms/validators/rich_text.v1/v1`.  platform_private.cms_protected_validator_descriptor
-- is the SQL registry (the TypeScript registry in
-- packages/contracts/src/content-schema-registry/protected-validators.ts holds the
-- same descriptor and hash, pinned by its own test).
--
--   * Compile.  An artifact whose definition uses the grammar (a rich_text field, an
--     explicit rich_text.v1 pair, or an object field with a rich_text property)
--     carries `editor_manifest.validators = [ { key, version, artifactRef,
--     artifactHash } ]`; an artifact that does not use it carries no such key, so
--     its hash is unchanged.  The entry is inside the editor manifest and so inside
--     the artifact hash and the definition hash.
--   * Activation.  cms_activation_references_valid refuses an artifact whose frozen
--     validators differ from the registry's descriptors for the definition.
--   * Editorial transitions.  cms_create_entry, cms_create_revision,
--     cms_resolve_conflict and cms_restore_revision refuse with
--     DEPENDENCY_UNAVAILABLE, writing nothing, when the artifact's frozen validators
--     are missing, extra or stale against the registry.

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
-- The SQL registry.
-- ---------------------------------------------------------------------------
select is(
  platform_private.cms_protected_validator_descriptor('rich_text.v1', 1),
  jsonb_build_object(
    'key', 'rich_text.v1', 'version', 1,
    'artifactRef', 'cms/validators/rich_text.v1/v1',
    'artifactHash', '4fe960667baa6d616e9fe00527d3e1a1d5740013b37f548eec74e20a244f2d15'),
  'the registry resolves rich_text.v1 version 1 to its artifact reference and descriptor hash [DEC-146]');
select is(platform_private.cms_protected_validator_descriptor('rich_text.v1', 2), null::jsonb,
  'an unregistered version has no descriptor');
select is(platform_private.cms_protected_validator_descriptor('cms.text', 1), null::jsonb,
  'an unregistered key has no descriptor');
select is(platform_private.cms_protected_validator_descriptor(null, 1), null::jsonb,
  'a null key has no descriptor');
select is(
  platform_private.cms_jcs_sha256(platform_private.cms_protected_validator_descriptor_body('rich_text.v1', 1)),
  '4fe960667baa6d616e9fe00527d3e1a1d5740013b37f548eec74e20a244f2d15',
  'the artifact hash is the JCS SHA-256 of the canonical immutable grammar descriptor');
select is(
  platform_private.cms_protected_validator_descriptor('rich_text.v1', 1)->>'artifactHash',
  platform_private.cms_jcs_sha256(platform_private.cms_protected_validator_descriptor_body('rich_text.v1', 1)),
  'the registry entry always carries the recomputed descriptor hash');
select ok(
  pg_temp.s10_fn_exists('platform_private', 'cms_protected_validator_descriptor', 'text, bigint')
    and pg_temp.s10_no_execute_for('platform_private', 'cms_protected_validator_descriptor', 'authenticated')
    and pg_temp.s10_no_execute_for('platform_private', 'cms_protected_validator_descriptor', 'anon')
    and pg_temp.s10_no_execute_for('platform_private', 'cms_protected_validator_descriptor', 'service_role')
    and pg_temp.s10_fn_exists('platform_private', 'cms_validators_frozen_current', 'uuid')
    and pg_temp.s10_no_execute_for('platform_private', 'cms_validators_frozen_current', 'authenticated')
    and pg_temp.s10_no_execute_for('platform_private', 'cms_validators_frozen_current', 'anon')
    and pg_temp.s10_no_execute_for('platform_private', 'cms_validators_frozen_current', 'service_role'),
  'the registry and the frozen-validator predicate are private: no API role may execute them');

-- ---------------------------------------------------------------------------
-- Compile: which artifacts freeze the validator.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.s10f_type_request(p_key text, p_idem text, p_fields jsonb)
returns jsonb
language sql
stable
as $body$
  select request || jsonb_build_object(
    'typeKey', p_key, 'label', 'Freeze ' || p_key, 'idempotencyKey', p_idem,
    'fields', p_fields, 'relations', '[]'::jsonb)
  from s10_type_request
$body$;

create or replace function pg_temp.s10f_field(
  p_id text, p_key text, p_kind text, p_constraints jsonb, p_vkey text, p_vver text
)
returns jsonb
language sql
immutable
as $body$
  select jsonb_build_object('stableFieldId', p_id, 'key', p_key, 'kind', p_kind,
    'constraints', p_constraints, 'required', false,
    'validatorKey', p_vkey, 'validatorVersion', p_vver,
    'defaultMode', 'none', 'localizationMode', 'none',
    'editorConfig', jsonb_build_object('label', initcap(p_key), 'order', 0),
    'lifecycle', 'active')
$body$;

create temp table s10f_types on commit drop as
select t.tag, platform_api.cms_create_type_draft(
  pg_temp.s10f_type_request('s10freeze' || t.tag, 's10-freeze-type-' || t.tag, t.fields)) as response
from (values
  ('plain', jsonb_build_array(
    pg_temp.s10f_field('a9100000-0000-4000-8000-000000000e01', 'title', 'short_text', '{}', null, null))),
  ('richtext', jsonb_build_array(
    pg_temp.s10f_field('a9100000-0000-4000-8000-000000000e02', 'title', 'short_text', '{}', null, null),
    pg_temp.s10f_field('a9100000-0000-4000-8000-000000000e03', 'body', 'rich_text', '{}', null, null))),
  ('objrt', jsonb_build_array(
    pg_temp.s10f_field('a9100000-0000-4000-8000-000000000e04', 'card', 'object',
      '{"objectStructure":{"properties":[{"key":"intro","kind":"rich_text","required":false,"constraints":{}}]}}',
      null, null))),
  ('objplain', jsonb_build_array(
    pg_temp.s10f_field('a9100000-0000-4000-8000-000000000e05', 'card', 'object',
      '{"objectStructure":{"properties":[{"key":"label","kind":"scalar","required":false,"constraints":{}}]}}',
      null, null))),
  ('explicit', jsonb_build_array(
    pg_temp.s10f_field('a9100000-0000-4000-8000-000000000e06', 'body', 'rich_text', '{}', 'rich_text.v1', '1'))),
  ('both', jsonb_build_array(
    pg_temp.s10f_field('a9100000-0000-4000-8000-000000000e07', 'body', 'rich_text', '{}', 'rich_text.v1', '1'),
    pg_temp.s10f_field('a9100000-0000-4000-8000-000000000e08', 'card', 'object',
      '{"objectStructure":{"properties":[{"key":"intro","kind":"rich_text","required":false,"constraints":{}}]}}',
      null, null)))
) t(tag, fields);

create or replace function pg_temp.s10f_manifest(p_tag text)
returns jsonb
language sql
stable
as $body$
  select artifact.editor_manifest
  from s10f_types t
  join platform_private.cms_schema_artifacts artifact
    on artifact.id = (t.response->>'schemaArtifactId')::uuid
  where t.tag = p_tag
$body$;

select is((select count(*)::integer from s10f_types where response is not null), 6,
  'the six freeze fixture types compile through the real authoring RPC');
select is(pg_temp.s10f_manifest('plain') ? 'validators', false,
  'an artifact that does not use the grammar carries no validators key, so its hash is unchanged [DEC-146]');
select is(pg_temp.s10f_manifest('objplain') ? 'validators', false,
  'an object with only scalar properties does not use the grammar');
select is(
  pg_temp.s10f_manifest('richtext')->'validators',
  jsonb_build_array(platform_private.cms_protected_validator_descriptor('rich_text.v1', 1)),
  'a rich_text field freezes the rich_text.v1 artifact reference and hash into the editor manifest [DEC-146, AC-085]');
select is(
  pg_temp.s10f_manifest('objrt')->'validators',
  jsonb_build_array(platform_private.cms_protected_validator_descriptor('rich_text.v1', 1)),
  'an object field with a rich_text property uses the grammar and freezes it');
select is(
  pg_temp.s10f_manifest('explicit')->'validators',
  jsonb_build_array(platform_private.cms_protected_validator_descriptor('rich_text.v1', 1)),
  'an explicit rich_text.v1 pair freezes exactly one entry');
select is(
  pg_temp.s10f_manifest('both')->'validators',
  jsonb_build_array(platform_private.cms_protected_validator_descriptor('rich_text.v1', 1)),
  'a definition that uses the grammar in several fields freezes it once');
select is(
  (select artifact.artifact_hash::text = platform_private.cms_jcs_sha256(jsonb_build_object(
      'compilerVersion', artifact.compiler_version,
      'zodContractRef', artifact.zod_contract_ref,
      'editorManifest', artifact.editor_manifest,
      'rendererManifest', artifact.renderer_manifest,
      'localeConfigHash', platform_private.cms_locale_config_hash(
        version_row.source_locale, version_row.default_locale,
        version_row.supported_locales, version_row.fallback_chains)))
   from s10f_types t
   join platform_private.cms_schema_artifacts artifact
     on artifact.id = (t.response->>'schemaArtifactId')::uuid
   join platform_private.cms_content_type_versions version_row
     on version_row.id = (t.response->>'id')::uuid
   where t.tag = 'richtext'),
  true, 'the frozen validator entry is inside the artifact hash [DEC-146]');
select is(
  (select version_row.definition_hash::text = artifact.artifact_hash::text
   from s10f_types t
   join platform_private.cms_schema_artifacts artifact
     on artifact.id = (t.response->>'schemaArtifactId')::uuid
   join platform_private.cms_content_type_versions version_row
     on version_row.id = (t.response->>'id')::uuid
   where t.tag = 'richtext'),
  true, 'the definition hash equals the artifact hash that freezes the validator');

-- ---------------------------------------------------------------------------
-- Activation boundary: cms_activation_references_valid refuses a stale freeze.
-- ---------------------------------------------------------------------------
select is(
  (select platform_private.cms_activation_references_valid((response->>'id')::uuid)
   from s10f_types where tag = 'richtext'),
  true, 'a compiled rich_text candidate passes the activation reference check with its frozen validator');
select is(
  (select platform_private.cms_activation_references_valid((response->>'id')::uuid)
   from s10f_types where tag = 'plain'),
  true, 'a candidate that does not use the grammar passes with no frozen validator');

savepoint s10f_tamper_activation;
set local session_replication_role = replica;
update platform_private.cms_schema_artifacts artifact
set editor_manifest = artifact.editor_manifest - 'validators'
where artifact.id = (select (response->>'schemaArtifactId')::uuid from s10f_types where tag = 'richtext');
update platform_private.cms_schema_artifacts artifact
set editor_manifest = artifact.editor_manifest
  || jsonb_build_object('validators', jsonb_build_array(
       platform_private.cms_protected_validator_descriptor('rich_text.v1', 1)))
where artifact.id = (select (response->>'schemaArtifactId')::uuid from s10f_types where tag = 'plain');
set local session_replication_role = origin;
select is(
  (select platform_private.cms_activation_references_valid((response->>'id')::uuid)
   from s10f_types where tag = 'richtext'),
  false, 'activation refuses an artifact that uses the grammar but froze no validator');
select is(
  (select platform_private.cms_activation_references_valid((response->>'id')::uuid)
   from s10f_types where tag = 'plain'),
  false, 'activation refuses an artifact that froze a validator its definition does not use');
rollback to savepoint s10f_tamper_activation;
release savepoint s10f_tamper_activation;

savepoint s10f_stale_activation;
set local session_replication_role = replica;
update platform_private.cms_schema_artifacts artifact
set editor_manifest = jsonb_set(artifact.editor_manifest, '{validators,0,artifactHash}', to_jsonb(repeat('0', 64)))
where artifact.id = (select (response->>'schemaArtifactId')::uuid from s10f_types where tag = 'richtext');
set local session_replication_role = origin;
select is(
  (select platform_private.cms_activation_references_valid((response->>'id')::uuid)
   from s10f_types where tag = 'richtext'),
  false, 'activation refuses an artifact whose frozen descriptor hash is not the registry hash');
rollback to savepoint s10f_stale_activation;
release savepoint s10f_stale_activation;

-- ---------------------------------------------------------------------------
-- The frozen-validator predicate used before every editorial transition.
-- ---------------------------------------------------------------------------
select is(platform_private.cms_validators_frozen_current((select value::uuid from s10g_ids where key = 'versionId')),
  true, 'the gallery type (rich_text + object fields) is current: its artifact froze the registry descriptor');
select is(platform_private.cms_validators_frozen_current((select value::uuid from s10_ids where key = 'draftVersionId')),
  true, 'the shared article fixture (no rich_text) is current with no frozen validator');
select is(platform_private.cms_validators_frozen_current(extensions.gen_random_uuid()), false,
  'an unknown version is never current');

-- ---------------------------------------------------------------------------
-- Editorial transitions: an entry, a revision, a conflict resolution and a restore.
-- ---------------------------------------------------------------------------
create temp table s10f_created on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_create_entry('
    || quote_literal(pg_temp.s10g_create_request(jsonb_build_object(
         'title', 'Freeze',
         'body', '{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"Hi","marks":[]}]}]}'::jsonb,
         'meta', '{"label":"x"}'::jsonb), 's10-freeze-create-0001')::text)
    || '::jsonb)') as response;
select is(pg_temp.s10_last_error_message(), null::text,
  'control: an entry of the gallery type is created while its artifact is current');
insert into s10g_ids(key, value) select 'entryId', response->'entry'->>'id' from s10f_created;
insert into s10g_ids(key, value)
select 'firstRevisionId', response->'revision'->>'id' from s10f_created;

create temp table s10f_rev2 on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_create_revision('
    || quote_literal(pg_temp.s10g_revision_request(
         (select value from s10g_ids where key = 'entryId'),
         jsonb_build_object('meta', '{"label":"two"}'::jsonb), '1', '1', 's10-freeze-append-0001')::text)
    || '::jsonb)') as response;
select is(pg_temp.s10_last_error_message(), null::text,
  'control: an append succeeds while the artifact is current');
create temp table s10f_conflict on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_create_revision('
    || quote_literal(pg_temp.s10g_revision_request(
         (select value from s10g_ids where key = 'entryId'),
         jsonb_build_object('meta', '{"label":"yours"}'::jsonb), '1', '2', 's10-freeze-append-0002')::text)
    || '::jsonb)') as response;
select is((select response->>'kind' from s10f_conflict), 'conflict',
  'a stale edit of the object field records one durable conflict');

create or replace function pg_temp.s10f_resolve_sql(p_key text)
returns text
language sql
stable
as $body$
  select 'select platform_api.cms_resolve_conflict('
    || quote_literal(jsonb_build_object(
         'entryId', conflict.entry_id, 'conflictId', conflict.id,
         'baseRevision', '1',
         'choices', jsonb_build_array(jsonb_build_object(
           'path', '/fields/' || pg_temp.s10g_fid('meta'), 'choice', 'theirs')),
         'expectedVersion', '2', 'ifMatch', '2', 'idempotencyKey', p_key,
         'context', jsonb_build_object(
           'actingPartyId', (select value from s10_ids where key = 'organization'),
           'actingContextId', 'a9100000-0000-4000-8000-000000000094',
           'correlationId', 'a9100000-0000-4000-8000-000000000095'))::text)
    || '::jsonb)'
  from platform_private.cms_conflict_records conflict
  where conflict.entry_id = (select value::uuid from s10g_ids where key = 'entryId')
  order by conflict.created_at desc
  limit 1
$body$;

create or replace function pg_temp.s10f_restore_sql(p_key text)
returns text
language sql
stable
as $body$
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

-- Runs all four editorial transitions under the current registry/artifact state
-- and returns their refusal messages, so the same probe asserts both drift modes.
create or replace function pg_temp.s10f_transitions(p_tag text)
returns text
language plpgsql
as $body$
declare
  outcomes text := '';
begin
  perform pg_temp.s10_rpc_call(
    'select platform_api.cms_create_entry('
      || quote_literal(pg_temp.s10g_create_request(
           jsonb_build_object('title', 'Drift'), 's10-freeze-create-' || p_tag)::text)
      || '::jsonb)');
  outcomes := outcomes || 'create=' || coalesce(pg_temp.s10_last_error_message(), 'ok') || ';';
  perform pg_temp.s10_rpc_call(
    'select platform_api.cms_create_revision('
      || quote_literal(pg_temp.s10g_revision_request(
           (select value from s10g_ids where key = 'entryId'),
           jsonb_build_object('title', 'Drift'), '1', '2', 's10-freeze-append-' || p_tag)::text)
      || '::jsonb)');
  outcomes := outcomes || 'append=' || coalesce(pg_temp.s10_last_error_message(), 'ok') || ';';
  perform pg_temp.s10_rpc_call(pg_temp.s10f_resolve_sql('s10-freeze-resolve-' || p_tag));
  outcomes := outcomes || 'resolve=' || coalesce(pg_temp.s10_last_error_message(), 'ok') || ';';
  perform pg_temp.s10_rpc_call(pg_temp.s10f_restore_sql('s10-freeze-restore-' || p_tag));
  outcomes := outcomes || 'restore=' || coalesce(pg_temp.s10_last_error_message(), 'ok');
  return outcomes;
end;
$body$;

-- Drift mode 1: the registry no longer matches what the artifact froze.
create temp table s10f_before_drift on commit drop as select pg_temp.s10g_counts() as counts;
savepoint s10f_registry_drift;
create or replace function platform_private.cms_protected_validator_descriptor(p_key text, p_version bigint)
returns jsonb
language sql
immutable
set search_path = ''
as $body$
  select case when (p_key, p_version) = ('rich_text.v1', 1::bigint)
    then jsonb_build_object('key', 'rich_text.v1', 'version', 1,
      'artifactRef', 'cms/validators/rich_text.v1/v1',
      'artifactHash', repeat('9', 64))
  end
$body$;
select is(
  pg_temp.s10f_transitions('d001'),
  'create=DEPENDENCY_UNAVAILABLE;append=DEPENDENCY_UNAVAILABLE;resolve=DEPENDENCY_UNAVAILABLE;restore=DEPENDENCY_UNAVAILABLE',
  'when the registry no longer matches the frozen descriptor every editorial transition is DEPENDENCY_UNAVAILABLE [DEC-146, AC-085]');
select is(pg_temp.s10g_counts(), (select counts from s10f_before_drift),
  'a refused transition committed no entry, revision, value, conflict, reservation, outbox or audit row');
rollback to savepoint s10f_registry_drift;
release savepoint s10f_registry_drift;

-- Drift mode 2: the artifact froze nothing although the definition uses the grammar.
savepoint s10f_artifact_unfrozen;
set local session_replication_role = replica;
update platform_private.cms_schema_artifacts artifact
set editor_manifest = artifact.editor_manifest - 'validators'
where artifact.id = (select value::uuid from s10g_ids where key = 'artifactId');
set local session_replication_role = origin;
select is(
  pg_temp.s10f_transitions('d002'),
  'create=DEPENDENCY_UNAVAILABLE;append=DEPENDENCY_UNAVAILABLE;resolve=DEPENDENCY_UNAVAILABLE;restore=DEPENDENCY_UNAVAILABLE',
  'when the artifact froze no validator although its definition uses the grammar every editorial transition is DEPENDENCY_UNAVAILABLE [DEC-146, AC-085]');
select is(pg_temp.s10g_counts(), (select counts from s10f_before_drift),
  'the unfrozen artifact refusals committed nothing');
rollback to savepoint s10f_artifact_unfrozen;
release savepoint s10f_artifact_unfrozen;

-- Control: the same four transitions succeed while the freeze is current.
select is(
  pg_temp.s10f_transitions('0003'),
  'create=ok;append=ok;resolve=INVALID_TRANSITION;restore=ok',
  'with a current freeze create and append and restore proceed (the resolve of the conflict that the preceding append superseded is the typed INVALID_TRANSITION; cascade: conflict lifecycle, write-path audit P2-S10-AC-053, was a VERSION_MISMATCH on the then-still-open conflict)');

-- ---------------------------------------------------------------------------
-- Explicit pair: validatorRefs naming the protected member are admitted.
-- ---------------------------------------------------------------------------
select set_config('app.cms_rpc', 'true', true);
update platform_private.cms_content_type_versions
set state = 'active', version = version + 1,
    activation_workflow_policy_key = 'cms.entry.author',
    activation_workflow_policy_version = 1,
    activation_workflow_policy_hash = repeat('a', 64),
    activation_required_decision_count = 1,
    activation_required_capabilities = jsonb_build_array('cms.author'),
    activation_approval_evidence_hash = repeat('b', 64),
    updated_at = clock_timestamp()
where id = (select (response->>'id')::uuid from s10f_types where tag = 'explicit');
update platform_private.cms_content_types
set state = 'active', version = version + 1, updated_at = clock_timestamp()
where id = (select (response->>'contentTypeId')::uuid from s10f_types where tag = 'explicit');

create or replace function pg_temp.s10f_explicit_create_sql(p_refs jsonb, p_key text)
returns text
language sql
stable
as $body$
  select 'select platform_api.cms_create_entry('
    || quote_literal((pg_temp.s10g_create_request('{}'::jsonb, p_key) || jsonb_build_object(
         'contentTypeId', t.response->>'contentTypeId',
         'contentTypeVersionId', t.response->>'id',
         'changedPaths', jsonb_build_array('/fields/a9100000-0000-4000-8000-000000000e06'),
         'values', jsonb_build_object('a9100000-0000-4000-8000-000000000e06',
           '{"format":"rich_text.v1","blocks":[{"type":"paragraph","spans":[{"text":"Hi","marks":[]}]}]}'::jsonb),
         'schemaArtifact', jsonb_build_object(
           'id', t.response->>'schemaArtifactId',
           'contentTypeVersionId', t.response->>'id',
           'artifactHash', artifact.artifact_hash,
           'compilerVersion', artifact.compiler_version,
           'zodContractRef', artifact.zod_contract_ref),
         'validatorRefs', p_refs))::text)
    || '::jsonb)'
  from s10f_types t
  join platform_private.cms_schema_artifacts artifact
    on artifact.id = (t.response->>'schemaArtifactId')::uuid
  where t.tag = 'explicit'
$body$;

select pg_temp.s10_rpc_probe_persist('explicit_without_refs', null,
  pg_temp.s10f_explicit_create_sql('[]'::jsonb, 's10-freeze-explicit-0001'));
select is(pg_temp.s10_probe_message('explicit_without_refs'), 'VALIDATION_FAILED',
  'a type that declares the rich_text.v1 pair is refused when the request names no validator ref');
create temp table s10f_explicit_created on commit drop as
select pg_temp.s10_rpc_exec(pg_temp.s10f_explicit_create_sql(
  '[{"key":"rich_text.v1","version":"1"}]'::jsonb, 's10-freeze-explicit-0002')) as response;
select is(pg_temp.s10_last_error_message(), null::text,
  'a request naming the protected rich_text.v1 ref creates an entry of a type that declares the pair [DEC-146]');
select pg_temp.s10_rpc_probe_persist('explicit_unregistered', null,
  pg_temp.s10f_explicit_create_sql('[{"key":"rich_text.v1","version":"2"}]'::jsonb, 's10-freeze-explicit-0003'));
select is(pg_temp.s10_probe_message('explicit_unregistered'), 'VALIDATION_FAILED',
  'an unregistered version of the protected validator is refused');

select * from finish();
rollback;
