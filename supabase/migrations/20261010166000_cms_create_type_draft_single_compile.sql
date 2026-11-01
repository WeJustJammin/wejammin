-- Slice 09 (AC217; P2-S09-AC-217): CMS-03A-01 compiles the definition once.
--
-- The checked criterion "128-field create RPC p95 < 300 ms" (BE03a Performance budgets) fails on the
-- development host on main (create128 p95 333-401 ms in seven of seven fresh-reset runs).  The profile of
-- platform_private.cms_create_type_draft attributed the time to the artifact hash (78-85 ms: both compiled
-- manifests, then the RFC 8785 text of a document that carries the canonical field array twice), the
-- artifact row (56-58 ms: both manifests built a second time), the 128 per-field validations (65-69 ms)
-- and the 128-row insert with its row triggers (83-91 ms).  This forward migration replaces ONLY that
-- function, with the identical request grammar, error precedence, error codes, idempotency, audit and
-- outbox effects, hashes and stored bytes:
--   * the canonical type definition is built once (cms_compiled_editor_manifest and
--     cms_compiled_renderer_manifest rebuild it three times apiece, and the hash and the artifact row each
--     called both: twelve builds for a definition without protected validators), the two manifests are the
--     compile rule of those functions applied to it, and the artifact row stores those same values;
--   * the hashed document carries the canonical field array in two slots; its RFC 8785 text is produced once
--     and spliced into both (see the body comment), so the artifact hash is unchanged.
-- Nothing else moves: the validation pass, the set-based field insert, the relation and capability loops,
-- the emitted event and the response are the previous statements, in the previous order (the artifact insert,
-- whose 512 KiB bound can refuse with a check violation, still precedes the field validation).
--
-- Preservation (checked in this transaction): the installed body must be exactly the one of
-- 20261003100400 (md5 of prosrc), owned by wejammin_cms_definer, SECURITY DEFINER, VOLATILE,
-- search_path = '', with the definer-only ACL; after the replacement every pg_proc attribute except
-- the source (owner, ACL, volatility, security, config, signature, language, strictness) and the
-- comment are unchanged.  The parity suite supabase/tests/phase_02_slice_09_create_draft_parity.sql
-- holds the verbatim previous body and proves identical outputs and row images.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  target_oid oid := pg_catalog.to_regprocedure('platform_private.cms_create_type_draft(jsonb)');
  cms_owner oid := 'wejammin_cms_definer'::pg_catalog.regrole;
  original pg_catalog.pg_proc%rowtype;
begin
  select proc.* into original from pg_catalog.pg_proc proc where proc.oid = target_oid;
  if not found then
    raise exception 'CMS create type draft function missing' using errcode = '55000';
  end if;
  if pg_catalog.md5(original.prosrc) is distinct from 'f5d93c0442dd733e401065dca1d9ecc6'
     or original.proowner is distinct from cms_owner
     or original.prokind is distinct from 'f'
     or original.provolatile is distinct from 'v'
     or original.prosecdef is distinct from true
     or original.proisstrict is distinct from false
     or original.proleakproof is distinct from false
     or original.proparallel is distinct from 'u'
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.proacl is distinct from
       array['wejammin_cms_definer=X/wejammin_cms_definer']::pg_catalog.aclitem[]
     or original.pronargs is distinct from 1
     or original.pronargdefaults is distinct from 0
     or original.proargnames is distinct from array['p_request']::text[]
     or pg_catalog.oidvectortypes(original.proargtypes) is distinct from 'jsonb'
     or original.prorettype is distinct from 'jsonb'::pg_catalog.regtype
     or original.proretset is distinct from false
     or original.prolang is distinct from (
       select lang.oid from pg_catalog.pg_language lang where lang.lanname = 'plpgsql'
     ) then
    raise exception 'CMS create type draft baseline mismatch (installed source md5 %)',
      pg_catalog.md5(original.prosrc) using errcode = '55000';
  end if;
  perform pg_catalog.set_config(
    'wejammin.create_type_draft_metadata',
    ((pg_catalog.to_jsonb(original) - 'prosrc')::text), true);
  perform pg_catalog.set_config(
    'wejammin.create_type_draft_comment',
    coalesce(pg_catalog.obj_description(original.oid, 'pg_proc'), ''), true);
end;
$migration$;

CREATE OR REPLACE FUNCTION platform_private.cms_create_type_draft(p_request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid;
  acting_party_id uuid;
  correlation_id uuid;
  reservation platform_private.idempotency_records;
  type_id uuid := extensions.gen_random_uuid();
  version_id uuid := extensions.gen_random_uuid();
  artifact_id uuid := extensions.gen_random_uuid();
  relation_input jsonb;
  capability_input jsonb;
  response jsonb;
  definition_hash text;
  locale_issues jsonb := '[]'::jsonb;
  sorted_supported jsonb;
  contract_ref text;
  locale_hash text;
  canonical_definition jsonb;
  protected_validators jsonb;
  editor_manifest jsonb;
  renderer_manifest jsonb;
  fields_slot constant jsonb := pg_catalog.to_jsonb('#cms-canonical-fields#'::text);
  hash_stub_text text;
  hash_document_text text;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  perform platform_private.cms_require_scope_member(actor_id, acting_party_id);
  perform platform_private.cms_require_capability(actor_id, acting_party_id, 'cms.schema_designer');
  correlation_id := platform_private.cms_correlation(p_request);
  reservation := platform_private.cms_reserve(p_request, actor_id, 'CMS-03A-01');
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    return platform_private.cms_type_version_resource((reservation.response_ref->>'resourceRef')::uuid);
  end if;
  if not platform_private.cms_exact_keys(
    p_request,
    array['typeKey','label','ownerCapability','sourceLocale','defaultLocale','supportedLocales','fallbackChains','workflowKey','workflowVersion','defaultTemplateVersionId','fields','relations','templateBindings','capabilityBindings']::text[],
    array['typeKey','label','ownerCapability','sourceLocale','defaultLocale','supportedLocales','fallbackChains','workflowKey','workflowVersion','defaultTemplateVersionId','fields','relations','templateBindings','capabilityBindings','idempotencyKey','context','correlationId']::text[]
  ) then raise exception 'INVALID_REQUEST' using errcode = 'P0001'; end if;
  if p_request->>'typeKey' !~ '^[a-z][a-z0-9_]{1,63}$'
     or platform_private.cms_reserved_key(p_request->>'typeKey')
     or p_request->>'label' is null
     or pg_catalog.length(pg_catalog.normalize(p_request->>'label', 'NFC')) not between 2 and 120
     or p_request->>'ownerCapability' !~ '^[a-z][a-z0-9._-]{0,127}$'
     or not platform_private.cms_capability_registry_valid(p_request->>'ownerCapability', null)
     or p_request->>'workflowKey' !~ '^[a-z][a-z0-9._-]{0,127}$'
     or not platform_private.cms_valid_version(p_request->>'workflowVersion')
     or not platform_private.cms_workflow_registry_valid(
       p_request->>'workflowKey',
       case when platform_private.cms_valid_version(p_request->>'workflowVersion')
         then (p_request->>'workflowVersion')::bigint else null end
     )
     or pg_catalog.jsonb_typeof(p_request->'fields') is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_request->'fields') > 128
     or pg_catalog.jsonb_typeof(p_request->'relations') is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_request->'relations') > 128
     or pg_catalog.jsonb_typeof(p_request->'templateBindings') is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_request->'templateBindings') > 32
     or pg_catalog.jsonb_typeof(p_request->'capabilityBindings') is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_request->'capabilityBindings') > 32 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  -- DEC-123: a brand-new type is created without a template.  A compatible
  -- template names the type id, which exists only after this command commits,
  -- so a default template or any template binding is refused outright (422),
  -- before any other lookup: the refusal never depends on, and so never
  -- discloses, whether a referenced template exists or is compatible.  The
  -- binding is added through a successor version (CMS-03A-09).
  if p_request->'defaultTemplateVersionId' is distinct from 'null'::jsonb
     or pg_catalog.jsonb_array_length(p_request->'templateBindings') <> 0 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  -- BE03a A01 failure mapping: a request that repeats a stable field identity,
  -- a field key, a relation target field, a template version or a capability
  -- reference is a malformed aggregate (422), never a raw unique-violation
  -- leak.  The check runs before any insert, so nothing is committed.
  if (select pg_catalog.count(*) <> pg_catalog.count(distinct pg_catalog.lower(field_entry->>'stableFieldId'))
        from pg_catalog.jsonb_array_elements(p_request->'fields') field_entry)
     or (select pg_catalog.count(*) <> pg_catalog.count(distinct field_entry->>'key')
        from pg_catalog.jsonb_array_elements(p_request->'fields') field_entry)
     or (select pg_catalog.count(*) <> pg_catalog.count(distinct pg_catalog.lower(relation_entry->>'fieldId'))
        from pg_catalog.jsonb_array_elements(p_request->'relations') relation_entry)
     or (select pg_catalog.count(*) <> pg_catalog.count(distinct pg_catalog.lower(binding_entry->>'templateVersionId'))
        from pg_catalog.jsonb_array_elements(p_request->'templateBindings') binding_entry)
     or (select pg_catalog.count(*) <> pg_catalog.count(distinct (capability_entry->>'capabilityKey') || '@' || (capability_entry->>'capabilityVersion'))
        from pg_catalog.jsonb_array_elements(p_request->'capabilityBindings') capability_entry) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if not platform_private.cms_locale_config_shape_valid(
       p_request->'supportedLocales', p_request->'fallbackChains') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if not platform_private.cms_locale_canonical_valid(p_request->>'sourceLocale') then
    locale_issues := locale_issues || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'path', pg_catalog.jsonb_build_array('sourceLocale'),
      'message', 'locale tag must be a canonical-case BCP 47 tag'));
  end if;
  if not platform_private.cms_locale_canonical_valid(p_request->>'defaultLocale') then
    locale_issues := locale_issues || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'path', pg_catalog.jsonb_build_array('defaultLocale'),
      'message', 'locale tag must be a canonical-case BCP 47 tag'));
  end if;
  locale_issues := locale_issues || platform_api.cms_validate_locale_config(
    p_request->>'sourceLocale', p_request->>'defaultLocale',
    p_request->'supportedLocales', p_request->'fallbackChains');
  if pg_catalog.jsonb_array_length(locale_issues) > 0 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001',
      detail = platform_private.cms_locale_violation_detail(locale_issues);
  end if;
  sorted_supported := platform_private.cms_locale_sorted(p_request->'supportedLocales');
  -- Competing creates of one key serialize on a transaction-scoped lock; the
  -- loser re-reads the committed key below and is refused with 409, never with
  -- a raw unique violation.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('cms.type_key:' || (p_request->>'typeKey'), 0));
  if exists (select 1 from platform_private.cms_content_types where type_key = p_request->>'typeKey') then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  -- AC217: the definition is compiled once.  The canonical definition, both compiled manifests and
  -- the artifact hash used to be rebuilt from the request for the hash and again for the artifact
  -- row, and cms_compiled_editor_manifest / cms_compiled_renderer_manifest rebuild the canonical
  -- definition three times apiece.  Here it is built once and the manifests are the compile rule of
  -- those two functions (20261005012000, 20260902080000) applied to it; the stored manifests, the
  -- artifact hash and definition_hash are the values the previous body produced (the parity suite
  -- phase_02_slice_09_create_draft_parity.sql asserts it against the verbatim previous body and
  -- against cms_compiled_*_manifest and cms_definition_artifact_hash themselves).
  canonical_definition := platform_private.cms_canonical_type_definition(p_request);
  protected_validators := platform_private.cms_required_protected_validators(canonical_definition);
  editor_manifest := pg_catalog.jsonb_build_object(
      'schema', canonical_definition,
      'fields', canonical_definition->'fields'
    ) || case
      when protected_validators = '[]'::jsonb then '{}'::jsonb
      else pg_catalog.jsonb_build_object('validators', protected_validators)
    end;
  renderer_manifest := pg_catalog.jsonb_build_object(
    'relations', canonical_definition->'relations',
    'templateBindings', canonical_definition->'templateBindings',
    'capabilityBindings', canonical_definition->'capabilityBindings'
  );
  contract_ref := platform_private.cms_artifact_contract_ref(p_request->>'typeKey', 1);
  locale_hash := platform_private.cms_locale_config_hash(
    p_request->>'sourceLocale', p_request->>'defaultLocale',
    p_request->'supportedLocales', p_request->'fallbackChains');
  -- The hashed document carries the canonical field array twice (editorManifest.schema.fields and
  -- editorManifest.fields) and the array is most of its bytes.  The RFC 8785 text of an object is
  -- its members' texts joined in key order, so the document is serialised with a one-string slot
  -- in both places and the array's own text is spliced into the slot.  The splice is used only
  -- when the slot text occurs exactly twice (a request that itself contains the slot text takes
  -- the direct serialisation), so both paths yield the text of the complete document.
  hash_stub_text := platform_private.cms_jcs(pg_catalog.jsonb_build_object(
    'compilerVersion', '1',
    'zodContractRef', contract_ref,
    'editorManifest', editor_manifest || pg_catalog.jsonb_build_object(
      'schema', canonical_definition || pg_catalog.jsonb_build_object('fields', fields_slot),
      'fields', fields_slot),
    'rendererManifest', renderer_manifest,
    'localeConfigHash', locale_hash
  ));
  if pg_catalog.length(hash_stub_text)
     - pg_catalog.length(pg_catalog.replace(hash_stub_text, fields_slot::text, ''))
     = 2 * pg_catalog.length(fields_slot::text) then
    hash_document_text := pg_catalog.replace(
      hash_stub_text, fields_slot::text, platform_private.cms_jcs(canonical_definition->'fields'));
  else
    hash_document_text := platform_private.cms_jcs(pg_catalog.jsonb_build_object(
      'compilerVersion', '1',
      'zodContractRef', contract_ref,
      'editorManifest', editor_manifest,
      'rendererManifest', renderer_manifest,
      'localeConfigHash', locale_hash
    ));
  end if;
  definition_hash := pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(hash_document_text, 'utf8')), 'hex');
  insert into platform_private.cms_content_types(
    id, owner_id, state, version, type_key, owner_capability, created_by
  ) values (type_id, acting_party_id, 'retired', 1, p_request->>'typeKey', p_request->>'ownerCapability', actor_id);
  insert into platform_private.cms_content_type_versions(
    id, owner_id, state, version, content_type_id, version_no, labels,
    workflow_key, workflow_version, source_locale, default_locale,
    supported_locales, fallback_chains, locale_config_hash,
    default_template_version_id, schema_artifact_id, definition_hash,
    compatibility, dry_run_id, created_by
  ) values (
    version_id, acting_party_id, 'draft', 1, type_id, 1,
    jsonb_build_object('label', pg_catalog.normalize(p_request->>'label', 'NFC')),
    p_request->>'workflowKey', (p_request->>'workflowVersion')::bigint,
    p_request->>'sourceLocale', p_request->>'defaultLocale',
    sorted_supported, p_request->'fallbackChains',
    platform_private.cms_locale_config_hash(
      p_request->>'sourceLocale', p_request->>'defaultLocale',
      sorted_supported, p_request->'fallbackChains'),
    null, artifact_id,
    definition_hash, 'additive', null, actor_id
  );
  insert into platform_private.cms_schema_artifacts(
    id, owner_id, state, version, content_type_version_id, compiler_version,
    zod_contract_ref, editor_manifest, renderer_manifest, artifact_hash, compiled_at
  ) values (
    artifact_id, acting_party_id, 'compiled', 1, version_id, '1',
    contract_ref, editor_manifest, renderer_manifest, definition_hash, now()
  );
  -- AC217: one validation pass and one set-based insert replace the
  -- per-field plpgsql loop.  Any invalid field raises the same 422 before a
  -- single field row exists; the row-level guards still fire for every row.
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_request->'fields') field_entry(value)
    where not platform_private.cms_valid_field_input(field_entry.value, true)
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  insert into platform_private.cms_field_definition_versions(
    id, owner_id, state, version, content_type_version_id, stable_field_id,
    field_key, kind, constraints, validator_key, validator_version, required,
    default_mode, default_value, localization_mode, editor_config, created_by
  )
  select (field_entry.value->>'stableFieldId')::uuid, acting_party_id,
    coalesce(nullif(field_entry.value->>'lifecycle', ''), 'active'), 1,
    version_id, (field_entry.value->>'stableFieldId')::uuid,
    field_entry.value->>'key', field_entry.value->>'kind',
    coalesce(field_entry.value->'constraints', '{}'::jsonb),
    nullif(field_entry.value->>'validatorKey', ''),
    nullif(field_entry.value->>'validatorVersion', '')::bigint,
    coalesce((field_entry.value->>'required')::boolean, false),
    coalesce(nullif(field_entry.value->>'defaultMode', ''), 'none'),
    field_entry.value->'defaultValue',
    coalesce(nullif(field_entry.value->>'localizationMode', ''), 'none'),
    coalesce(field_entry.value->'editorConfig', '{}'::jsonb), actor_id
  from pg_catalog.jsonb_array_elements(p_request->'fields') field_entry(value);
  for relation_input in select value from jsonb_array_elements(p_request->'relations') as value loop
    if not platform_private.cms_valid_relation_input(relation_input)
       or not exists (
         select 1
         from platform_private.cms_field_definition_versions field
         where field.id = (relation_input->>'fieldId')::uuid
           and field.content_type_version_id = version_id
           and field.kind = 'relation'
       ) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    insert into platform_private.cms_relation_definitions(
      owner_id, state, version, field_definition_id,
      target_kind, target_type, projection_key, cardinality, min_count, max_count,
      ordered, on_unavailable, created_by
    )
    select acting_party_id, 'draft', 1, (relation_input->>'fieldId')::uuid,
      relation_input->>'targetKind', relation_input->>'targetType', relation_input->>'projectionKey',
      relation_input->>'cardinality', (relation_input->>'min')::integer, (relation_input->>'max')::integer,
      coalesce((relation_input->>'ordered')::boolean, false), relation_input->>'onUnavailable', actor_id;
  end loop;
  for capability_input in select value from jsonb_array_elements(p_request->'capabilityBindings') as value loop
    if not platform_private.cms_exact_keys(
      capability_input,
      array['capabilityKey','capabilityVersion']::text[],
      array['capabilityKey','capabilityVersion']::text[]
    ) or capability_input->>'capabilityKey' !~ '^[a-z][a-z0-9._-]{0,127}$'
      or not platform_private.cms_capability_registry_valid(
        capability_input->>'capabilityKey',
        case when platform_private.cms_valid_version(capability_input->>'capabilityVersion')
          then (capability_input->>'capabilityVersion')::bigint else null end
      )
      or not platform_private.cms_valid_version(capability_input->>'capabilityVersion') then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    insert into platform_private.cms_content_type_capability_bindings(
      owner_id, state, version, content_type_version_id, capability_key, capability_version
    ) values (
      acting_party_id, 'draft', 1, version_id, capability_input->>'capabilityKey',
      (capability_input->>'capabilityVersion')::bigint
    );
  end loop;
  -- The draft carries no dry-run evidence: CMS-03A-10 alone produces a report,
  -- plan and job, so a new draft never self-certifies a passing dry run.
  perform platform_private.cms_emit_event(
    'cms.schema.draft.create', actor_id, acting_party_id, 'cms_content_type_version',
    version_id, 'CMS_SCHEMA_DRAFT_CREATED', 'cms.schema.draft.created.v1',
    'cms_content_type_version', version_id, 1,
    jsonb_build_object(
      'contentTypeId', type_id, 'schemaVersionId', version_id,
      'typeKey', p_request->>'typeKey', 'version', '1'
    ), correlation_id
  );
  response := platform_private.cms_type_version_resource(version_id);
  perform platform_private.cms_complete(reservation.id, version_id, 201, response);
  return response;
end;
$function$;

do $migration$
declare
  actual pg_catalog.pg_proc%rowtype;
begin
  select proc.* into actual
    from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure('platform_private.cms_create_type_draft(jsonb)');
  if not found
     or (pg_catalog.to_jsonb(actual) - 'prosrc')::text
        is distinct from pg_catalog.current_setting('wejammin.create_type_draft_metadata')
     or coalesce(pg_catalog.obj_description(actual.oid, 'pg_proc'), '')
        is distinct from pg_catalog.current_setting('wejammin.create_type_draft_comment')
     or pg_catalog.md5(actual.prosrc) is not distinct from 'f5d93c0442dd733e401065dca1d9ecc6' then
    raise exception 'CMS create type draft preservation mismatch' using errcode = '55000';
  end if;
end;
$migration$;

commit;
