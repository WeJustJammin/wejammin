-- Slice 10 write-path hardening (lane H, wave 2): cms_restore_revision
-- (CMS-03B-04) redefined from its latest definition (20261005011900).  The body is
-- that definition with only the changes listed here; signature, SECURITY DEFINER
-- attributes, search_path, owner and grants are unchanged (CREATE OR REPLACE).
--
--   * DEC-146 / P2-S10-AC-085: a restore refuses with DEPENDENCY_UNAVAILABLE,
--     writing nothing (not even the idempotency reservation), when the active
--     version's compiled artifact has not frozen exactly the protected validator
--     descriptors the registry names (cms_validators_frozen_current, 20261005012000).
--   * Item H2: the active version row is locked FOR SHARE (cms_lock_schema_version_shared,
--     20261005012100) before the schema evidence is read, so the 03a activation
--     switch and a restore serialize; a version that is no longer active is CONFLICT.
--   * Item H1: the edit-capability check is cms_require_entry_capability_locked
--     (20261005012100): the authority-bearing rows are locked FOR SHARE first and the
--     capability proven afterwards, so a committed revocation wins over an in-flight
--     restore and a later one waits for the restore to commit.
--   * Item H3: the external content targets of the source revision's relations are
--     locked FOR SHARE (cms_lock_entry_rows_shared, 20261005012100) before
--     cms_restore_relations_resolvable re-resolves them.
--   * P2-S10-AC-025 (write-path audit): the stale entry-version CAS raises the typed
--     VERSION_MISMATCH with errcode P0001, the append / resolve path, instead of a
--     bare SQLSTATE 40001.
--   * P2-S10-AC-027: the audit/outbox evidence of a restore now records the chain
--     identity, the chain hash and safe counts: besides the unchanged locked
--     cms.entry.revision-created.v1 ({ entryId, revisionId }), the transaction
--     commits one audit row targeting the immutable chain manifest and one outbox
--     event cms.entry.revision-restored.v1 { entryId, revisionId, sourceRevisionId,
--     migrationChainId, chainHash, edgeCount, valueCount, relationCount }.  No
--     migrated value reaches either; neither a refusal nor a replay emits them.
--   * Conflict lifecycle (write-path audit "conflict wedge"): the restored draft
--     supersedes the entry's open conflicts in the same transaction.
--   * Item 6e: semantic validation refusals carry a bounded, safe violation DETAIL (a
--     JSON array of RFC 6901 pointers): `/entryId`, `/revisionId`, `/migrationChainId`,
--     `/expectedVersion`; a chain id that does not equal the re-derived chain is
--     migration_chain_mismatch at `/migrationChainId`.
--   * Contract requests of lane G and lane I (NOTES): the resource carries
--     `entryVersion` (requested expectedVersion + 1, DEC-145) and an exact-key replay
--     sets the PostgREST response header x-cms-idempotent-replay: true.
--
-- Forward-only.
begin;

create or replace function platform_private.cms_restore_revision(p_request jsonb)
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
  source_row platform_private.cms_entry_revisions%rowtype;
  current_row platform_private.cms_entry_revisions%rowtype;
  version_row platform_private.cms_content_type_versions%rowtype;
  manifest_row platform_private.cms_restore_chain_manifests%rowtype;
  plan_row platform_private.cms_schema_migration_plans%rowtype;
  active_version_count integer;
  requested_entry_id uuid;
  requested_revision_id uuid;
  requested_chain_id uuid;
  requested_entry_version bigint;
  derived jsonb;
  derived_hash text;
  derived_chain_id uuid;
  derived_plan_ids jsonb;
  derived_edge_count smallint;
  chain_version_ids jsonb;
  walk_version_id uuid;
  plan_id_text text;
  new_revision_id uuid := extensions.gen_random_uuid();
  snapshot_time timestamptz := pg_catalog.now();
  source_values jsonb;
  chain_values jsonb;
  translated jsonb;
  final_values jsonb;
  final_provenance jsonb;
  parent_ids jsonb;
  payload_hash text;
  response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);

  -- Request shape: exactly the five contract members (the four BE03b request
  -- members plus the mandatory Idempotency-Key the Worker projects into the
  -- body), plus the transport-only ifMatch/context/correlationId.  Any other
  -- key (an ownership, acting-party or capability assertion) has no slot and is
  -- refused before any read.  A request without a key is refused here, so no
  -- write can ever happen without a reservation.
  if not platform_private.cms_exact_keys(
    p_request,
    array[
      'entryId', 'revisionId', 'migrationChainId', 'expectedVersion',
      'idempotencyKey'
    ]::text[],
    array[
      'entryId', 'revisionId', 'migrationChainId', 'expectedVersion',
      'idempotencyKey', 'ifMatch', 'context', 'correlationId'
    ]::text[]
  ) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if platform_private.cms_valid_uuid(p_request->>'entryId') is not true then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/entryId"]';
  end if;
  if platform_private.cms_valid_uuid(p_request->>'revisionId') is not true then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/revisionId"]';
  end if;
  if platform_private.cms_valid_uuid(p_request->>'migrationChainId') is not true then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/migrationChainId"]';
  end if;
  if platform_private.cms_valid_version(p_request->>'expectedVersion') is not true
     or pg_catalog.length(p_request->>'expectedVersion') > 19
     or (pg_catalog.length(p_request->>'expectedVersion') = 19
         and p_request->>'expectedVersion' > '9223372036854775807') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/expectedVersion"]';
  end if;
  -- The If-Match transport copy, when presented, must equal the CAS version.
  if p_request ? 'ifMatch'
     and (platform_private.cms_valid_version(p_request->>'ifMatch') is not true
          or p_request->>'ifMatch' <> p_request->>'expectedVersion') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  requested_entry_id := (p_request->>'entryId')::uuid;
  requested_revision_id := (p_request->>'revisionId')::uuid;
  requested_chain_id := (p_request->>'migrationChainId')::uuid;
  requested_entry_version := (p_request->>'expectedVersion')::bigint;

  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  author_person_id := platform_private.identity_actor_person(actor_id);
  correlation_id := platform_private.cms_correlation(p_request);

  -- Establish tenant visibility, then edit authority, before probing the
  -- source revision or reserving a key: a hidden entry is concealed and a
  -- visible entry without edit authority is refused, whatever the revision.
  select * into entry_row
  from platform_private.cms_content_entries candidate
  where candidate.id = requested_entry_id
  for update;
  if not found
     or not platform_private.cms_entry_tenant_visible(actor_id, entry_row.owner_party_id)
     or entry_row.owner_party_id is distinct from acting_party_id then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform platform_private.cms_require_entry_capability_locked(
    actor_id, acting_party_id, array['cms.author', 'cms.editor']::text[], entry_row.id
  );
  if entry_row.lifecycle <> 'active' then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;

  -- Source read and lineage disposition: the source revision must belong to
  -- this entry and owner, and its recorded schema version must be a version of
  -- the entry's own content type under the same owner.  An absent, foreign or
  -- mis-lineaged source is concealed as NOT_FOUND before any key is reserved,
  -- so a probe never creates an idempotency row.
  select * into source_row
  from platform_private.cms_entry_revisions candidate
  where candidate.id = requested_revision_id
    and candidate.entry_id = entry_row.id
    and candidate.owner_id = entry_row.owner_id
  for share;
  if not found or not exists (
    select 1
    from platform_private.cms_content_type_versions source_version
    join platform_private.cms_content_types content_type
      on content_type.id = source_version.content_type_id
    where source_version.id = source_row.schema_version_id
      and source_version.content_type_id = entry_row.content_type_id
      and source_version.owner_id = entry_row.owner_id
      and content_type.owner_id = entry_row.owner_id
  ) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Reserve before any effect, and before the entry-version CAS: a replay must
  -- return the exact first outcome even though the entry has since advanced.
  -- The business hash covers the request body, so the same key with another
  -- migrationChainId, source revision or expected version is the typed
  -- IDEMPOTENCY_MISMATCH, never a second restore (AC025).
  reservation := platform_private.cms_reserve(p_request, actor_id, 'CMS-03B-04');
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

  -- A restore is a mutation of the entry, so the entry-version CAS is enforced
  -- before the chain is resolved: a stale expectedVersion is a 409 serialization
  -- failure, never a silent write or an incidental chain refusal.
  if entry_row.version <> requested_entry_version then
    raise exception 'VERSION_MISMATCH' using errcode = 'P0001';
  end if;

  select * into current_row
  from platform_private.cms_entry_revisions candidate
  where candidate.id = entry_row.current_draft_revision_id
    and candidate.entry_id = entry_row.id
    and candidate.locale = source_row.locale
  for share;
  if not found or current_row.state <> 'draft' then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;

  -- The source is immutable history: refuse to launder a corrupt snapshot into
  -- a fresh draft with freshly computed hashes.  The payload hash is derived
  -- from the stored values, so it is verified here; per-value hashes are never
  -- trusted from the source and are recomputed below.
  select coalesce(
    pg_catalog.jsonb_object_agg(stored.field_id::text, stored.value), '{}'::jsonb
  )
  into source_values
  from platform_private.cms_entry_field_values stored
  where stored.revision_id = source_row.id
    and stored.locale = source_row.locale;
  if platform_private.cms_jcs_sha256(source_values) <> source_row.payload_hash::text then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  -- A restore needs exactly one active schema version to translate onto, and
  -- the active 03a evidence must still be proven (re-fetched, never assumed).
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
  -- active version row FOR SHARE before any schema evidence is read or written
  -- and recheck it is still active (the 03a switch takes the conflicting lock).
  perform platform_private.cms_lock_schema_version_shared(version_row.id);
  if not platform_private.cms_restore_active_schema_evidence_valid(version_row.id) then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;
  -- BE03b:546 lists the editorial workflow-policy evidence among the evidence
  -- re-fetched before restore, exactly as cms_create_revision re-fetches it.  An
  -- absent (no owner-approved projection) or malformed projection is a
  -- dependency outage and nothing, not even the reservation, is committed.
  if not platform_private.cms_editorial_workflow_policy_valid(version_row.id) then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;
  -- DEC-146 (P2-S10-AC-085): the active version's compiled artifact must have
  -- frozen exactly the protected validator descriptors the registry names.
  if not platform_private.cms_validators_frozen_current(version_row.id) then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;

  -- Re-derive the immutable chain from the completed plan edges.  An
  -- ambiguous, unreachable or over-64-edge path is refused, never guessed or
  -- truncated.
  derived := platform_private.cms_restore_chain_derive(
    entry_row.content_type_id, source_row.schema_version_id, version_row.id
  );
  if derived is null then
    raise exception 'migration_chain_unavailable' using errcode = 'P0001';
  end if;
  derived_hash := derived->>'hash';
  derived_plan_ids := derived->'planIds';
  derived_edge_count := (derived->>'edgeCount')::smallint;
  derived_chain_id := platform_private.cms_restore_chain_manifest_id(derived_hash);
  if derived_edge_count > 64
     or derived_chain_id is distinct from requested_chain_id then
    raise exception 'migration_chain_mismatch' using errcode = 'P0001',
      detail = '["/migrationChainId"]';
  end if;

  -- Bind every edge: each is a completed plan of this entry's content type and
  -- owner (a foreign edge conceals the chain), chains consecutively from the
  -- source schema, and is bound to the activation of its target version.  The
  -- ordered version ids become the verification evidence.
  chain_version_ids := pg_catalog.jsonb_build_array(source_row.schema_version_id);
  walk_version_id := source_row.schema_version_id;
  for plan_id_text in
    select item.plan_id
    from pg_catalog.jsonb_array_elements_text(derived_plan_ids)
      with ordinality as item(plan_id, edge_position)
    order by item.edge_position
  loop
    select * into plan_row
    from platform_private.cms_schema_migration_plans candidate
    where candidate.id = plan_id_text::uuid;
    if not found
       or plan_row.content_type_id is distinct from entry_row.content_type_id
       or plan_row.owner_id is distinct from entry_row.owner_id then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
    if plan_row.state <> 'completed'
       or plan_row.from_version_id is distinct from walk_version_id
       or not exists (
         select 1
         from platform_private.cms_content_type_versions activated
         where activated.id = plan_row.to_version_id
           and activated.content_type_id = entry_row.content_type_id
           and activated.activation_approval_evidence_hash is not null
       ) then
      raise exception 'migration_chain_unavailable' using errcode = 'P0001';
    end if;
    walk_version_id := plan_row.to_version_id;
    chain_version_ids := chain_version_ids || pg_catalog.to_jsonb(walk_version_id);
  end loop;
  if walk_version_id is distinct from version_row.id then
    raise exception 'migration_chain_unavailable' using errcode = 'P0001';
  end if;

  -- Record the manifest insert-if-absent, then verify the stored identity
  -- matches the re-derived chain exactly and still hashes to its own content.
  -- Trusted evidence must never be a second, divergent manifest for the same
  -- hash.
  insert into platform_private.cms_restore_chain_manifests(
    owner_id, content_type_id, source_schema_version_id, target_schema_version_id,
    plan_ids, edge_count, manifest_hash, created_at, updated_at
  ) values (
    entry_row.owner_id, entry_row.content_type_id, source_row.schema_version_id,
    version_row.id, derived_plan_ids, derived_edge_count, derived_hash::char(64),
    snapshot_time, snapshot_time
  )
  on conflict (manifest_hash) do nothing;
  select * into manifest_row
  from platform_private.cms_restore_chain_manifests manifest
  where manifest.manifest_hash = derived_hash::char(64);
  if not found
     or manifest_row.plan_ids is distinct from derived_plan_ids
     or manifest_row.edge_count is distinct from derived_edge_count
     or manifest_row.content_type_id is distinct from entry_row.content_type_id
     or manifest_row.source_schema_version_id is distinct from source_row.schema_version_id
     or manifest_row.target_schema_version_id is distinct from version_row.id
     or manifest_row.owner_id is distinct from entry_row.owner_id
     or platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
          'contentTypeId', manifest_row.content_type_id,
          'sourceSchemaVersionId', manifest_row.source_schema_version_id,
          'targetSchemaVersionId', manifest_row.target_schema_version_id,
          'planIds', manifest_row.plan_ids
        )) <> manifest_row.manifest_hash::text then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  -- Template resolution: the source revision's template binding is re-resolved
  -- through the same private BE03c compatibility gate the successor flow uses
  -- against the active schema version.  An absent, withdrawn or incompatible
  -- template refuses the restore.
  if source_row.template_version_id is not null then
    begin
      perform platform_private.cms_successor_template_gate(
        actor_id, acting_party_id, source_row.template_version_id,
        entry_row.content_type_id, version_row.id,
        pg_catalog.jsonb_build_array('templateVersionId')
      );
    exception
      when raise_exception then
        raise exception 'template_incompatible' using errcode = 'P0001';
    end;
  end if;
  -- Every pinned taxonomy version must still resolve for the owner.
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements_text(source_row.taxonomy_version_ids) pinned(taxonomy_id)
    where platform_private.cms_valid_uuid(pinned.taxonomy_id) is not true
       or not exists (
         select 1
         from platform_private.cms_taxonomy_versions taxonomy
         where taxonomy.id = pinned.taxonomy_id::uuid
           and taxonomy.owner_id = entry_row.owner_id
       )
  ) then
    raise exception 'migration_chain_incomplete' using errcode = 'P0001';
  end if;

  -- Codex review H3: the external content targets of the source revision's
  -- relations are locked FOR SHARE (ascending id, held to commit) before they are
  -- re-resolved, so a target cannot change between the check and the new draft.
  perform platform_private.cms_lock_entry_rows_shared(array(
    select stored.target_id
    from platform_private.cms_entry_relations stored
    where stored.revision_id = source_row.id
      and stored.target_kind = 'content'
      and stored.target_id <> entry_row.id
  ));

  -- Translate the source values across the verified chain with the registered
  -- transforms.  An edge the executor cannot prove, an unregistered transform
  -- or a chain that does not apply end to end is an incomplete chain.
  chain_values := platform_private.cms_restore_chain_values(
    source_row.id, derived_plan_ids
  );
  if chain_values is null then
    raise exception 'migration_chain_incomplete' using errcode = 'P0001';
  end if;
  -- Rebind every value to the TARGET active field definition and revalidate it
  -- through the protected value gate; a value or relation the target schema
  -- cannot prove refuses the whole restore and nothing is dropped or invented.
  translated := platform_private.cms_restore_translate_values(
    source_row.id, version_row.id, chain_values
  );
  if translated is null
     or not platform_private.cms_restore_relations_resolvable(
       entry_row.id, source_row.id, version_row.id
     ) then
    raise exception 'migration_chain_incomplete' using errcode = 'P0001';
  end if;
  final_values := translated->'values';
  final_provenance := translated->'provenance';

  -- Every hash is recomputed server-side from the translated preimage: the
  -- per-value hash from each value and the payload hash from the whole map.
  payload_hash := platform_private.cms_jcs_sha256(final_values);
  parent_ids := pg_catalog.jsonb_build_array(current_row.id, source_row.id);

  insert into platform_private.cms_entry_revisions(
    id, owner_id, entry_id, revision_number, schema_version_id,
    template_version_id, taxonomy_version_ids, parent_revision_ids, locale,
    payload_hash, author_person_id, acting_party_id, state, version,
    validation_state, validation_report, created_at, updated_at
  ) values (
    new_revision_id, entry_row.owner_id, entry_row.id,
    current_row.revision_number + 1, version_row.id,
    source_row.template_version_id, source_row.taxonomy_version_ids,
    parent_ids, source_row.locale, payload_hash::char(64),
    author_person_id, acting_party_id, 'draft', 1, 'valid', '{}'::jsonb,
    snapshot_time, snapshot_time
  );
  insert into platform_private.cms_entry_field_values(
    owner_id, state, version, revision_id, field_id, field_definition_id,
    locale, value, provenance, value_hash, created_at, updated_at
  )
  select entry_row.owner_id, 'active', 1, new_revision_id,
         definition.stable_field_id, definition.id, source_row.locale,
         translated.field_value, final_provenance ->> translated.field_key,
         case when pg_catalog.jsonb_typeof(translated.field_value) = 'null' then null
           else platform_private.cms_jcs_sha256(translated.field_value)::char(64) end,
         snapshot_time, snapshot_time
  from pg_catalog.jsonb_each(final_values) translated(field_key, field_value)
  join platform_private.cms_field_definition_versions definition
    on definition.content_type_version_id = version_row.id
   and definition.stable_field_id::text = translated.field_key
   and definition.state = 'active';
  insert into platform_private.cms_entry_relations(
    owner_id, state, version, revision_id, field_id, field_definition_id,
    target_kind, target_id, expected_target_version, position, on_unavailable,
    created_at, updated_at
  )
  select entry_row.owner_id, 'active', 1, new_revision_id, stored.field_id,
         definition.id, stored.target_kind, stored.target_id,
         case
           when stored.target_kind = 'content' and stored.target_id = entry_row.id
             then requested_entry_version + 1
           else stored.expected_target_version
         end,
         stored.position, relation_definition.on_unavailable,
         snapshot_time, snapshot_time
  from platform_private.cms_entry_relations stored
  join platform_private.cms_field_definition_versions definition
    on definition.content_type_version_id = version_row.id
   and definition.stable_field_id = stored.field_id
   and definition.state = 'active'
  join platform_private.cms_relation_definitions relation_definition
    on relation_definition.field_definition_id = definition.id
  where stored.revision_id = source_row.id;

  -- The source revision is immutable: restore never mutates or activates it.

  update platform_private.cms_content_entries
  set current_draft_revision_id = new_revision_id,
      version = version + 1,
      updated_at = snapshot_time
  where id = entry_row.id and version = requested_entry_version;
  if not found then
    raise exception 'VERSION_MISMATCH' using errcode = 'P0001';
  end if;
  -- Write-path audit (conflict wedge; BE03b ConflictRecord states): the draft just
  -- advanced, so every open conflict whose `theirs` revision it replaced is obsolete
  -- and is superseded in this same transaction (version + 1, no resolution evidence).
  update platform_private.cms_conflict_records conflict
  set state = 'superseded', version = conflict.version + 1, updated_at = snapshot_time
  where conflict.entry_id = entry_row.id and conflict.state = 'open';

  -- The locked cms.entry.revision-created.v1 event stays exactly
  -- { entryId, revisionId }.
  perform platform_private.cms_emit_event(
    'cms.entry.revision.restore', actor_id, acting_party_id,
    'cms_content_entry', entry_row.id, 'CMS_ENTRY_REVISION_CREATED',
    'cms.entry.revision-created.v1', 'cms_content_entry', entry_row.id,
    requested_entry_version + 1,
    pg_catalog.jsonb_build_object('entryId', entry_row.id, 'revisionId', new_revision_id),
    correlation_id
  );
  -- AC027: "Audit/outbox evidence records only chain identity/hash and safe counts,
  -- never migrated values."  The same transaction commits one evidence pair: the
  -- audit row targets the immutable chain manifest (the chain identity) and the
  -- outbox event carries the entry, revision and source revision ids, the chain id
  -- and hash and the edge, value and relation counts -- identifiers, a hash and
  -- counts only, never a migrated value.
  perform platform_private.cms_emit_event(
    'cms.entry.revision.restore.chain', actor_id, acting_party_id,
    'cms_restore_chain_manifest', manifest_row.id,
    'CMS_ENTRY_RESTORE_CHAIN_APPLIED',
    'cms.entry.revision-restored.v1', 'cms_content_entry', entry_row.id,
    requested_entry_version + 1,
    pg_catalog.jsonb_build_object(
      'entryId', entry_row.id,
      'revisionId', new_revision_id,
      'sourceRevisionId', source_row.id,
      'migrationChainId', derived_chain_id,
      'chainHash', derived_hash,
      'edgeCount', derived_edge_count,
      'valueCount', (
        select pg_catalog.count(*)
        from platform_private.cms_entry_field_values restored
        where restored.revision_id = new_revision_id
      ),
      'relationCount', (
        select pg_catalog.count(*)
        from platform_private.cms_entry_relations restored
        where restored.revision_id = new_revision_id
      )
    ),
    correlation_id
  );
  response := pg_catalog.jsonb_build_object(
    'resource', pg_catalog.jsonb_build_object(
      'id', new_revision_id, 'version', '1',
      'createdAt', platform_private.auth_iso_time(snapshot_time),
      'updatedAt', platform_private.auth_iso_time(snapshot_time),
      'state', 'draft', 'entryId', entry_row.id,
      'revisionNumber', (current_row.revision_number + 1)::text,
      'schemaVersionId', version_row.id,
      'templateVersionId', source_row.template_version_id,
      'taxonomyVersionIds', source_row.taxonomy_version_ids,
      'locale', source_row.locale, 'contentHash', payload_hash,
      'parentRevisionIds', parent_ids, 'validationState', 'valid',
      'conflictId', null,
      -- DEC-145 (lane G): the committed entry aggregate version, the ONLY valid next
      -- expectedVersion / If-Match; `version` stays the immutable snapshot's own.
      'entryVersion', (requested_entry_version + 1)::text
    ),
    'restoreVerification', pg_catalog.jsonb_build_object(
      'request', pg_catalog.jsonb_build_object(
        'entryId', requested_entry_id,
        'revisionId', requested_revision_id,
        'migrationChainId', derived_chain_id,
        'expectedVersion', requested_entry_version::text
      ),
      'registry', pg_catalog.jsonb_build_object(
        'revisionId', source_row.id,
        'migrationChainId', derived_chain_id,
        'sourceSchemaVersionId', source_row.schema_version_id,
        'activeSchemaVersionId', version_row.id,
        'chainSchemaVersionIds', chain_version_ids,
        'entryVersion', requested_entry_version::text
      ),
      'seams', pg_catalog.jsonb_build_array(
        'source_revision_readable_and_immutable',
        'migration_chain_registered_and_ordered',
        'migration_chain_covers_source_to_active_schema',
        'active_schema_compatibility_recheck',
        'non_fabricating_defaults_and_relations_translation',
        'entry_version_cas',
        'new_draft_revision_only_never_activates_source',
        'restore_idempotency_and_epoch_fencing'
      )
    )
  );
  perform platform_private.cms_complete(reservation.id, new_revision_id, 201, response);
  return response;
end;
$body$;

commit;
