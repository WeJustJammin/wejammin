-- Slice 11 lane S11-3d, BE03b "Derived revision workflow state (E2)" (tracker
-- P2-S11-AC-085): the CMS-03B-01 revision append response takes its `state` from the
-- ONE derivation instead of a literal.
--
-- "No other code computes or stores a revision state."  The response used to carry
-- the literal 'draft'; it now carries
-- platform_private.cms_revision_effective_state of the revision this command
-- created.  A revision created in the same transaction has no review, schedule or
-- publication evidence, so the derived value is `draft` and the contract is
-- unchanged -- but the value now comes from the helper, so a future workflow stage
-- added to it (the single place E2 names) reaches the write responses with no
-- edit here.  The helper runs after every lock of the command (BE03b global lock
-- order, DEC-157) and is a plain STABLE read, so it takes no lock of its own.
--
-- Nothing else changes: the body below is the 20261005014000 definition
-- with that one projection replaced (CREATE OR REPLACE keeps the owner, the
-- search_path, the grants and the comment of the function).  The physical-state
-- checks of the append commands (the current draft is `draft`) are NOT derived on
-- purpose: BE03b appends a revision to a submitted, approved or scheduled draft and
-- invalidates its live review (revision_superseded), so deriving them would forbid
-- exactly that; after 20261005018090 the physical column is the constant `draft`
-- and those checks hold trivially.  Forward-only.
begin;

create or replace function platform_private.cms_create_revision(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  actor_id uuid;
  acting_party_id uuid;
  author_person_id uuid;
  correlation_id uuid;
  reservation platform_private.idempotency_records;
  entry_row platform_private.cms_content_entries%rowtype;
  base_row platform_private.cms_entry_revisions%rowtype;
  current_row platform_private.cms_entry_revisions%rowtype;
  version_row platform_private.cms_content_type_versions%rowtype;
  artifact_row platform_private.cms_schema_artifacts%rowtype;
  field_row platform_private.cms_field_definition_versions%rowtype;
  open_conflict platform_private.cms_conflict_records%rowtype;
  presence_field_id uuid;
  active_version_count integer;
  requested_entry_id uuid;
  requested_base_number bigint;
  requested_entry_version bigint;
  new_revision_id uuid := extensions.gen_random_uuid();
  conflict_id uuid;
  stale_superseded boolean := false;
  snapshot_time timestamptz := pg_catalog.now();
  base_values jsonb;
  current_values jsonb;
  next_values jsonb;
  path_input text;
  value_field_id_text text;
  path_index integer;
  value_input jsonb;
  payload_hash text;
  candidate_hash text;
  conflict_hash text;
  changed_overlaps boolean := false;
  parent_ids jsonb;
  values_patch jsonb := '{}'::jsonb;
  relation_patch jsonb := '{}'::jsonb;
  canonical_patch jsonb := '{}'::jsonb;
  base_rel jsonb;
  current_rel jsonb;
  empty_relation constant jsonb := '{"targets":[]}'::jsonb;
  relation_spec jsonb;
  response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  author_person_id := platform_private.identity_actor_person(actor_id);
  correlation_id := platform_private.cms_correlation(p_request);

  if not platform_private.cms_exact_keys(
    p_request,
    array[
      'entryId', 'baseRevision', 'changedPaths', 'values', 'locale',
      'expectedVersion', 'ifMatch', 'idempotencyKey'
    ]::text[],
    array[
      'entryId', 'baseRevision', 'changedPaths', 'values', 'locale',
      'expectedVersion', 'ifMatch', 'idempotencyKey', 'context', 'correlationId'
    ]::text[]
  ) then raise exception 'INVALID_REQUEST' using errcode = 'P0001'; end if;
  if platform_private.cms_valid_uuid(p_request->>'entryId') is not true then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/entryId"]';
  end if;
  if coalesce(p_request->>'locale', '') !~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/locale"]';
  end if;
  if platform_private.cms_valid_version(p_request->>'baseRevision') is not true
     or pg_catalog.length(p_request->>'baseRevision') > 19
     or (pg_catalog.length(p_request->>'baseRevision') = 19
         and p_request->>'baseRevision' > '9223372036854775807') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/baseRevision"]';
  end if;
  if platform_private.cms_valid_version(p_request->>'expectedVersion') is not true
     or pg_catalog.length(p_request->>'expectedVersion') > 19
     or (pg_catalog.length(p_request->>'expectedVersion') = 19
         and p_request->>'expectedVersion' > '9223372036854775807') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/expectedVersion"]';
  end if;
  if platform_private.cms_valid_version(p_request->>'ifMatch') is not true
     or pg_catalog.length(p_request->>'ifMatch') > 19
     or (pg_catalog.length(p_request->>'ifMatch') = 19
         and p_request->>'ifMatch' > '9223372036854775807') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/ifMatch"]';
  end if;
  if p_request->>'expectedVersion' <> p_request->>'ifMatch' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  requested_entry_id := (p_request->>'entryId')::uuid;
  requested_base_number := (p_request->>'baseRevision')::bigint;
  requested_entry_version := (p_request->>'expectedVersion')::bigint;

  -- Establish tenant visibility before probing assignment or reserving a key.
  select * into entry_row
  from platform_private.cms_content_entries candidate
  where candidate.id = requested_entry_id
  for update;
  if not found or not platform_private.cms_entry_tenant_visible(actor_id, entry_row.owner_party_id)
     or entry_row.owner_party_id is distinct from acting_party_id then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform platform_private.cms_require_entry_capability_locked(
    actor_id, acting_party_id, array['cms.author', 'cms.editor']::text[], entry_row.id
  );
  -- BE03b route field validation matrix, CMS-03B-01 entryId: "must resolve to active
  -- ContentEntry after structural validation" -> 400 or policy-safe 404.  A malformed id is
  -- the 400 (DEC-145); an entry that exists but is not active does not resolve to an active
  -- ContentEntry, so it is the policy-safe 404, the same refusal as an absent entry (it was a
  -- 409 INVALID_TRANSITION).  The check follows the capability proof, so a caller with no
  -- authority on the entry learns nothing about its lifecycle.
  if entry_row.lifecycle <> 'active' then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- A replay must return the exact first outcome even when the parent has
  -- since advanced.  Reservation therefore precedes the entry-version CAS.
  reservation := platform_private.cms_reserve(p_request, actor_id, 'CMS-03B-01');
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      -- Lane I (NOTES): an exact-key replay is marked with the PostgREST response
      -- header the Worker counts; the body is the first response, unchanged.
      perform pg_catalog.set_config(
        'response.headers', '[{"x-cms-idempotent-replay": "true"}]', true
      );
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  -- BE03b "Rate buckets ...": concurrent revision writes cap at three per actor,
  -- enforced here so the cap holds across Worker isolates.  Taken after the replay
  -- short-circuit above (a replay is answered, not counted) and before any insert; a
  -- fourth concurrent write is RATE_LIMITED (429) and rolls everything back.
  perform platform_private.cms_acquire_revision_write_slot(actor_id);
  if entry_row.version <> requested_entry_version then
    raise exception 'VERSION_MISMATCH' using errcode = 'P0001';
  end if;

  select * into current_row
  from platform_private.cms_entry_revisions candidate
  where candidate.id = entry_row.current_draft_revision_id
    and candidate.entry_id = entry_row.id
    and candidate.locale = p_request->>'locale'
  for share;
  if not found or current_row.state <> 'draft' then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;
  select * into base_row
  from platform_private.cms_entry_revisions candidate
  where candidate.entry_id = entry_row.id
    and candidate.revision_number = requested_base_number
    and candidate.locale = p_request->>'locale'
  for share;
  -- BE03b route field validation matrix, CMS-03B-01 baseRevision: "positive bigint decimal
  -- string; revision must be readable" -> 422 or 409 VERSION_MISMATCH.  A well-formed
  -- baseRevision that names no revision of this entry in the request locale is a body-field
  -- validation failure (422 at /baseRevision), not "the entry is unavailable" (it was a
  -- 404); 409 VERSION_MISMATCH remains the entry-version compare-and-swap above.
  if not found then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001',
      detail = '["/baseRevision"]';
  end if;

  -- A schema migration needs its own immutable chain.  The write must not
  -- silently reinterpret an older revision against a newer active schema.
  select count(*) into active_version_count
  from platform_private.cms_content_type_versions candidate
  where candidate.content_type_id = entry_row.content_type_id
    and candidate.state::text = 'active';
  if active_version_count <> 1 then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;
  select * into version_row
  from platform_private.cms_content_type_versions candidate
  where candidate.content_type_id = entry_row.content_type_id
    and candidate.state::text = 'active';
  -- BE03b "Entry and revision writes serialize with schema activation": lock the
  -- target version row FOR SHARE before any schema evidence is read or written and
  -- recheck it is still active (the 03a switch takes the conflicting lock).
  perform platform_private.cms_lock_schema_version_shared(version_row.id);
  if version_row.id is distinct from current_row.schema_version_id
     or version_row.id is distinct from base_row.schema_version_id
     or platform_private.cms_type_version_resource(version_row.id)->'activationEvidence'
        is null
     or platform_private.cms_type_version_resource(version_row.id)->'activationEvidence'
        = 'null'::jsonb then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;
  -- BE03b:546: the editorial workflow-policy evidence is re-fetched from the
  -- registry projection and fully validated by the predicate restore shares; an
  -- absent or malformed projection is a dependency outage.
  if not platform_private.cms_editorial_workflow_policy_valid(version_row.id) then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;
  select * into artifact_row
  from platform_private.cms_schema_artifacts candidate
  where candidate.id = version_row.schema_artifact_id
    and candidate.content_type_version_id = version_row.id
    and candidate.state::text = 'compiled';
  if not found or artifact_row.artifact_hash is distinct from version_row.definition_hash
     or artifact_row.compiler_version is null
     or artifact_row.zod_contract_ref is null then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;
  -- DEC-146 (P2-S10-AC-085): the compiled artifact must have frozen exactly the
  -- protected validator descriptors the registry names for this schema; a missing,
  -- extra or stale freeze is a dependency outage and nothing is written.
  if not platform_private.cms_validators_frozen_current(version_row.id) then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from platform_private.cms_field_definition_versions field
    where field.content_type_version_id = version_row.id
      and field.validator_key is not null
      and not (platform_private.cms_validator_registry_valid(
                 field.validator_key, field.validator_version)
               or platform_private.cms_protected_validator_ref(
                 field.validator_key, field.validator_version))
  ) then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if pg_catalog.jsonb_typeof(p_request->'changedPaths') is distinct from 'array' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/changedPaths"]';
  end if;
  if pg_catalog.jsonb_typeof(p_request->'values') is distinct from 'object' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/values"]';
  end if;
  if pg_catalog.jsonb_array_length(p_request->'changedPaths') not between 1 and 128 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/changedPaths"]';
  end if;
  if not platform_private.cms_json_bounded(p_request->'values', 262144, 8, 128, 128)
     or (select count(*) from pg_catalog.jsonb_object_keys(p_request->'values')) > 128 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/values"]';
  end if;
  if (select count(distinct path) <> count(*)
      from pg_catalog.jsonb_array_elements_text(p_request->'changedPaths') path) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/changedPaths"]';
  end if;
  -- A revision request is a patch over the immutable current snapshot.  A
  -- changed path must have exactly one matching stable-field value, and no
  -- unmentioned value may be silently ignored or accepted as a hidden edit.
  if (select count(*) from pg_catalog.jsonb_object_keys(p_request->'values'))
     <> pg_catalog.jsonb_array_length(p_request->'changedPaths') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/values"]';
  end if;
  for path_input, path_index in
    select item.value, item.ordinality - 1
    from pg_catalog.jsonb_array_elements_text(p_request->'changedPaths')
      with ordinality as item(value, ordinality)
  loop
    if path_input !~ '^/fields/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or pg_catalog.length(path_input) > 256 then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = pg_catalog.jsonb_build_array('/changedPaths/' || path_index::text)::text;
    end if;
    value_field_id_text := pg_catalog.substr(path_input, 9);
    if not (p_request->'values' ? value_field_id_text) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = pg_catalog.jsonb_build_array('/changedPaths/' || path_index::text)::text;
    end if;
    select * into field_row
    from platform_private.cms_field_definition_versions field
    where field.content_type_version_id = version_row.id
      and field.stable_field_id = value_field_id_text::uuid;
    if not found or field_row.state <> 'active' then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = pg_catalog.jsonb_build_array('/changedPaths/' || path_index::text)::text;
    end if;
    -- The advisory presence pointer follows the last validated changed field.
    presence_field_id := field_row.stable_field_id;
    -- The draft helper proves every kind that has a complete value gate (the
    -- scalar, calendar, enum, rich_text.v1, DEC-133 object, list, relation,
    -- taxonomy and media encodings); a broad JSON container check is
    -- insufficient.
    if not platform_private.cms_authored_value_kind_supported(field_row.kind) then
      raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
    end if;
    value_input := p_request->'values'->value_field_id_text;
    if field_row.kind = 'relation' then
      -- BE03b:1049 / P2-S10-AC-073: a relation is an ordered targets value
      -- resolved against its immutable RelationDefinition and written to
      -- normalized EntryRelation rows outside the payload hash.  A JSON null is
      -- never a relation (an empty targets array clears it).
      perform platform_private.cms_require_draft_value_valid(
        version_row.id, value_field_id_text::uuid, value_input, 'authored'
      );
      relation_patch := relation_patch || pg_catalog.jsonb_build_object(
        value_field_id_text,
        platform_private.cms_resolve_relation_targets(
          actor_id, acting_party_id, entry_row.id, requested_entry_version,
          field_row.id, value_input
        )
      );
      canonical_patch := canonical_patch || pg_catalog.jsonb_build_object(
        value_field_id_text,
        platform_private.cms_relation_value_canonical(value_input, entry_row.id)
      );
    else
      perform platform_private.cms_require_draft_value_valid(
        version_row.id, value_field_id_text::uuid, value_input,
        case when value_input = 'null'::jsonb then 'explicit_null' else 'authored' end
      );
      -- BE03b: a well-formed NON-EMPTY taxonomy or media value has no producer
      -- yet and fails closed with its typed reason; nothing is appended.
      perform platform_private.cms_require_value_source_available(
        version_row.id, value_field_id_text::uuid, value_input
      );
      values_patch := values_patch || pg_catalog.jsonb_build_object(
        value_field_id_text, value_input
      );
    end if;
  end loop;

  -- BE03b EditPresence / IA03 Presence: every authorized autosave that reaches
  -- the write renews the author's advisory two-minute lease inside this
  -- transaction, after the capability, tenant, lifecycle, CAS and per-path
  -- validation gates above have all passed.  The renewal re-proves authority
  -- under the entry lock it shares with this write, writes only the private
  -- presence row, never advances the entry aggregate, never blocks another
  -- editor and grants nothing.  A conflict disposition is still an authorized
  -- autosave and renews; a refused or failed write raises before this point.
  perform platform_private.cms_touch_edit_presence(
    pg_catalog.jsonb_build_object(
      'entryId', entry_row.id,
      'currentFieldId', presence_field_id
    )
    || case when p_request ? 'context'
         then pg_catalog.jsonb_build_object('context', p_request->'context')
         else '{}'::jsonb end
  );

  select coalesce(pg_catalog.jsonb_object_agg(field.field_id::text, field.value), '{}'::jsonb)
    into base_values
  from platform_private.cms_entry_field_values field
  where field.revision_id = base_row.id and field.locale = base_row.locale;
  select coalesce(pg_catalog.jsonb_object_agg(field.field_id::text, field.value), '{}'::jsonb)
    into current_values
  from platform_private.cms_entry_field_values field
  where field.revision_id = current_row.id and field.locale = current_row.locale;
  if platform_private.cms_jcs_sha256(base_values) <> base_row.payload_hash::text
     or platform_private.cms_jcs_sha256(current_values) <> current_row.payload_hash::text then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  if exists (
    select 1
    from platform_private.cms_entry_field_values old
    left join platform_private.cms_field_definition_versions definition
      on definition.id = old.field_definition_id
     and definition.content_type_version_id = version_row.id
     and definition.stable_field_id = old.field_id
    where old.revision_id in (base_row.id, current_row.id)
      and (definition.id is null
           or definition.state <> 'active'
           or definition.kind = 'relation'
           or not platform_private.cms_authored_value_kind_supported(definition.kind)
           or platform_private.cms_draft_field_value_valid(
             version_row.id, old.field_id, old.value, old.provenance
           ) is not true)
  ) then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;

  for value_field_id_text in
    select item.key from pg_catalog.jsonb_object_keys(values_patch) item(key)
  loop
    if base_values->value_field_id_text is distinct from current_values->value_field_id_text
       and values_patch->value_field_id_text is distinct from current_values->value_field_id_text then
      changed_overlaps := true;
    end if;
  end loop;
  -- A relation field overlaps exactly like a value: the base and the current draft
  -- differ and the proposal differs from the current draft.  Compared in the
  -- canonical relation form, an absent relation equals an empty one.
  base_rel := platform_private.cms_revision_relation_values(base_row.id);
  current_rel := platform_private.cms_revision_relation_values(current_row.id);
  for value_field_id_text in
    select item.key from pg_catalog.jsonb_object_keys(canonical_patch) item(key)
  loop
    if coalesce(base_rel->value_field_id_text, empty_relation)
         is distinct from coalesce(current_rel->value_field_id_text, empty_relation)
       and canonical_patch->value_field_id_text
         is distinct from coalesce(current_rel->value_field_id_text, empty_relation) then
      changed_overlaps := true;
    end if;
  end loop;
  if changed_overlaps then
    -- The unsuccessful candidate is never represented as a committed revision.
    -- Return a successful *private* disposition so the conflict INSERT and
    -- idempotency result commit; the Worker maps it to a public BE00 409.
    candidate_hash := platform_private.cms_jcs_sha256(base_values || (p_request->'values'));
    select * into open_conflict
    from platform_private.cms_conflict_records conflict
    where conflict.entry_id = entry_row.id and conflict.state = 'open'
    for update;
    -- Write-path audit (conflict wedge): an open conflict whose `theirs` revision is
    -- no longer the current draft is stale (rows written before commands superseded
    -- on advance).  It is superseded here and a fresh conflict is recorded against
    -- the live draft, never reused.
    if found and open_conflict.theirs_revision_id is distinct from current_row.id then
      update platform_private.cms_conflict_records conflict
      set state = 'superseded', version = conflict.version + 1, updated_at = snapshot_time
      where conflict.id = open_conflict.id and conflict.state = 'open';
      stale_superseded := true;
    end if;
    if found and not stale_superseded then
      conflict_id := open_conflict.id;
      conflict_hash := open_conflict.conflict_hash::text;
    else
      conflict_hash := platform_private.cms_jcs_sha256(
        pg_catalog.jsonb_build_object(
          'entryId', entry_row.id, 'baseRevisionId', base_row.id,
          'theirsRevisionId', current_row.id, 'yoursHash', candidate_hash,
          'changedPaths', p_request->'changedPaths'
        )
      );
      insert into platform_private.cms_conflict_records(
        owner_id, entry_id, base_revision_id, theirs_revision_id,
        yours_source, proposed_values, proposed_values_hash, changed_paths,
        base_hash, theirs_hash, yours_hash, conflict_hash, state,
        version, created_at, updated_at
      ) values (
        entry_row.owner_id, entry_row.id, base_row.id, current_row.id,
        'proposed', p_request->'values',
        platform_private.cms_jcs_sha256(p_request->'values')::char(64),
        p_request->'changedPaths', base_row.payload_hash,
        current_row.payload_hash, candidate_hash::char(64),
        conflict_hash::char(64), 'open', 1, snapshot_time, snapshot_time
      ) returning id into conflict_id;
    end if;
    response := pg_catalog.jsonb_build_object(
      'kind', 'conflict', 'code', 'VERSION_MISMATCH',
      'details', pg_catalog.jsonb_build_object(
        'expectedVersion', requested_entry_version::text,
        'currentVersion', entry_row.version::text,
        'conflictHash', conflict_hash
      )
    );
    perform platform_private.cms_complete(reservation.id, conflict_id, 409, response);
    return response;
  end if;

  -- Preserve unaffected normalized relations on this new immutable snapshot.
  -- A self-reference is pinned to the entry version being committed, so an
  -- ordinary subsequent edit cannot strand the author behind its own stale
  -- expected-target version; an external target still requires exact match.
  -- A relation this request replaces is written fresh below (resolved against
  -- its RelationDefinition when validated above), so only the untouched
  -- relations are carried and re-checked here.
  -- Codex review H3: the external content targets of the relations this append
  -- carries are locked FOR SHARE (ascending id, held to commit) before the guards
  -- below re-check them; the relations it replaces were locked by
  -- cms_resolve_relation_targets.
  perform platform_private.cms_lock_entry_rows_shared(array(
    select relation.target_id
    from platform_private.cms_entry_relations relation
    where relation.revision_id = current_row.id
      and not (relation_patch ? relation.field_id::text)
      and relation.target_kind = 'content'
      and relation.target_id <> entry_row.id
  ));
  if exists (
    select 1
    from platform_private.cms_entry_relations relation
    left join platform_private.cms_relation_definitions definition
      on definition.field_definition_id = relation.field_definition_id
    where relation.revision_id = current_row.id
      and not (relation_patch ? relation.field_id::text)
      and (definition.id is null
           or definition.target_kind <> relation.target_kind
           or definition.on_unavailable <> relation.on_unavailable)
  ) then raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001'; end if;
  if exists (
    select 1
    from platform_private.cms_entry_relations relation
    left join platform_private.cms_content_entries target
      on relation.target_kind = 'content' and target.id = relation.target_id
    where relation.revision_id = current_row.id
      and not (relation_patch ? relation.field_id::text)
      and (relation.target_kind <> 'content'
           or target.id is null
           or target.owner_party_id is distinct from entry_row.owner_party_id
           or target.lifecycle <> 'active'
           or (relation.expected_target_version is not null
               and target.id <> entry_row.id
               and target.version <> relation.expected_target_version))
  ) then raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001'; end if;

  next_values := current_values || values_patch;
  payload_hash := platform_private.cms_jcs_sha256(next_values);
  parent_ids := case when base_row.id = current_row.id
    then pg_catalog.jsonb_build_array(current_row.id)
    else pg_catalog.jsonb_build_array(current_row.id, base_row.id) end;

  insert into platform_private.cms_entry_revisions(
    id, owner_id, entry_id, revision_number, schema_version_id,
    template_version_id, taxonomy_version_ids, parent_revision_ids, locale,
    payload_hash, author_person_id, acting_party_id, state, version,
    validation_state, validation_report, created_at, updated_at
  ) values (
    new_revision_id, entry_row.owner_id, entry_row.id,
    current_row.revision_number + 1, version_row.id,
    current_row.template_version_id, current_row.taxonomy_version_ids,
    parent_ids, p_request->>'locale', payload_hash::char(64),
    author_person_id, acting_party_id, 'draft', 1, 'valid', '{}'::jsonb,
    snapshot_time, snapshot_time
  );
  insert into platform_private.cms_entry_field_values(
    owner_id, state, version, revision_id, field_id, field_definition_id,
    locale, value, provenance, value_hash, created_at, updated_at
  )
  select entry_row.owner_id, 'active', 1, new_revision_id, old.field_id,
         old.field_definition_id, old.locale, old.value, old.provenance,
         old.value_hash, snapshot_time, snapshot_time
  from platform_private.cms_entry_field_values old
  where old.revision_id = current_row.id
    and old.locale = current_row.locale
    and not (p_request->'values' ? old.field_id::text);
  for value_field_id_text in
    select item.key from pg_catalog.jsonb_object_keys(values_patch) item(key)
  loop
    select * into field_row
    from platform_private.cms_field_definition_versions field
    where field.content_type_version_id = version_row.id
      and field.stable_field_id = value_field_id_text::uuid;
    value_input := values_patch->value_field_id_text;
    insert into platform_private.cms_entry_field_values(
      owner_id, state, version, revision_id, field_id, field_definition_id,
      locale, value, provenance, value_hash, created_at, updated_at
    ) values (
      entry_row.owner_id, 'active', 1, new_revision_id, value_field_id_text::uuid,
      field_row.id, p_request->>'locale', value_input,
      case when value_input = 'null'::jsonb then 'explicit_null' else 'authored' end,
      case when value_input = 'null'::jsonb then null
        else platform_private.cms_jcs_sha256(value_input)::char(64) end,
      snapshot_time, snapshot_time
    );
  end loop;
  insert into platform_private.cms_entry_relations(
    owner_id, state, version, revision_id, field_id, field_definition_id,
    target_kind, target_id, expected_target_version, position, on_unavailable,
    created_at, updated_at
  )
  select entry_row.owner_id, 'active', 1, new_revision_id, old.field_id,
         old.field_definition_id, old.target_kind, old.target_id,
         case
           when old.target_kind = 'content' and old.target_id = entry_row.id
             then requested_entry_version + 1
           else old.expected_target_version
         end,
         old.position, old.on_unavailable,
         snapshot_time, snapshot_time
  from platform_private.cms_entry_relations old
  where old.revision_id = current_row.id
    and not (relation_patch ? old.field_id::text);
  -- The relations this request replaces, resolved above: targetKind and
  -- onUnavailable from the RelationDefinition, position = request index.
  for value_field_id_text in
    select item.key from pg_catalog.jsonb_object_keys(relation_patch) item(key)
  loop
    select * into field_row
    from platform_private.cms_field_definition_versions field
    where field.content_type_version_id = version_row.id
      and field.stable_field_id = value_field_id_text::uuid;
    for relation_spec in
      select spec.value
      from pg_catalog.jsonb_array_elements(relation_patch->value_field_id_text) spec(value)
    loop
      insert into platform_private.cms_entry_relations(
        owner_id, state, version, revision_id, field_id, field_definition_id,
        target_kind, target_id, expected_target_version, position, on_unavailable,
        created_at, updated_at
      ) values (
        entry_row.owner_id, 'active', 1, new_revision_id, value_field_id_text::uuid,
        field_row.id, relation_spec->>'targetKind', (relation_spec->>'targetId')::uuid,
        (relation_spec->>'expectedTargetVersion')::bigint,
        (relation_spec->>'position')::integer, relation_spec->>'onUnavailable',
        snapshot_time, snapshot_time
      );
    end loop;
  end loop;

  update platform_private.cms_content_entries
  set current_draft_revision_id = new_revision_id,
      version = version + 1,
      updated_at = snapshot_time
  where id = entry_row.id and version = requested_entry_version;
  if not found then raise exception 'VERSION_MISMATCH' using errcode = 'P0001'; end if;
  -- Write-path audit (conflict wedge; BE03b ConflictRecord states): the draft just
  -- advanced, so every open conflict whose `theirs` revision it replaced is
  -- obsolete and is superseded in this same transaction (version + 1, no resolution
  -- evidence).  A later same-field clash records a fresh conflict.
  update platform_private.cms_conflict_records conflict
  set state = 'superseded', version = conflict.version + 1, updated_at = snapshot_time
  where conflict.entry_id = entry_row.id and conflict.state = 'open';

  perform platform_private.cms_emit_event(
    'cms.entry.revision.create', actor_id, acting_party_id,
    'cms_content_entry', entry_row.id, 'CMS_ENTRY_REVISION_CREATED',
    'cms.entry.revision-created.v1', 'cms_content_entry', entry_row.id,
    requested_entry_version + 1,
    pg_catalog.jsonb_build_object('entryId', entry_row.id, 'revisionId', new_revision_id),
    correlation_id
  );
  response := pg_catalog.jsonb_build_object(
    'id', new_revision_id, 'version', '1',
    'createdAt', platform_private.auth_iso_time(snapshot_time),
    'updatedAt', platform_private.auth_iso_time(snapshot_time),
    'state', platform_private.cms_revision_effective_state(new_revision_id),
    'entryId', entry_row.id,
    'revisionNumber', (current_row.revision_number + 1)::text,
    'schemaVersionId', version_row.id,
    'templateVersionId', current_row.template_version_id,
    'taxonomyVersionIds', current_row.taxonomy_version_ids,
    'locale', p_request->>'locale', 'contentHash', payload_hash,
    'parentRevisionIds', parent_ids, 'validationState', 'valid',
    'conflictId', null,
    -- DEC-145 (lane G): the committed entry aggregate version, the ONLY valid next
    -- expectedVersion / If-Match; `version` stays the immutable snapshot's own.
    'entryVersion', (requested_entry_version + 1)::text
  );
  perform platform_private.cms_complete(reservation.id, new_revision_id, 201, response);
  return response;
end;
$body$;

commit;
