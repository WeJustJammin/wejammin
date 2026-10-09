-- Slice 11 lane S11-3c, DEC-159(4) / BE05c "Accessibility and content-quality checker" Inputs, BE03b
-- "Accessibility provider (DEC-134, D25)"; tracker P2-S11-AC-101): platform_private.cms_load_quality_gate_input
-- (p_request jsonb) returns jsonb with the platform_api wrapper the Worker's in-process quality_gate_evaluate
-- calls (service_role only): the ONE read-only RPC load of the revision the cms.a11y.structural checker needs.
--
-- Read-only: no audit, outbox or idempotency row.  Two request shapes (S11-4 WORKER <-> SQL CONTRACT):
--   A  { phase: submit | schedule | publish | workflow_read, entryId?, revisionId?, context } for the browser
--      phases; the caller must hold the CMS-03B-15 read scope on the entry/revision (an assignee, an
--      owner-party publisher or a reviewer assignee of a review of the revision).  A missing revisionId is the
--      entry's current draft; a missing entryId is the revision's entry.
--   B  { phase: 'execute', scheduleId, revisionId, dependencyHash } for the schedule sweep (service principal,
--      no context): the schedule must exist for that revision and carry exactly that frozen dependency hash.
-- Any hidden, absent, unauthorized or unreadable target is the ONE uniform NOT_FOUND (the Worker then sends
-- no evidence, which the database reports as accessibility unavailable / checker_failed, never a pass), as is
-- a document above 1 MiB.
--
-- The answer is exactly the Worker's AccessibilityCheckerInput: revisionId, revisionNumber (decimal string),
-- locale, revisionContentHash (the revision payload_hash), dependencyHash, renderPlanHash and the nodes in
-- RENDER ORDER.  dependencyHash is what cms_evaluate_preflight verifies the evidence binding against:
--   submit | workflow_read   the manifest rebuilt now (cms_build_dependency_manifest);
--   schedule | publish       the frozen dependency_hash of the revision's approved review;
--   execute                  the hash of the request (it must equal the schedule's frozen hash).
-- Nodes:
--   field   one per non-null top-level rich_text value of the revision in its locale, in the schema's field
--           order (editor order, then field key), carrying the stored value verbatim for the shared
--           rich_text.v1 validator (a rich_text property nested inside an `object` value is not addressable by
--           a stable field id and is not part of the Phase 2 structural input);
--   block   one per live (draft | active) composition instance, after the fields, in template slot order
--           (the slot's index in the revision's template; every instance when there is none), then path
--           (bytewise), then id; its pointer is /composition/<instance id>, its lifecycle the latest
--           lifecycle event of the registered block (supported when none) or `unregistered` when the registry
--           has no such key/version, its recordHash the block's release digest (the instance's recorded
--           digest when unregistered), nameRequired the manifest's accessibility_contract.nameRequired, and
--           accessibleNameFieldDefined / accessibleName the registry's accessible_name short_text prop
--           definition and the instance's string value of it.
-- renderPlanHash is the SHA-256 of the JCS { templateVersionId, nodes: [identity of every node in order] }: the
-- order the database chose, bound into the checker's inputHash.  A media node never exists in Phase 2.
-- Forward-only.
begin;

set local lock_timeout = '5s';

create or replace function platform_private.cms_accessibility_checker_input(
  p_revision_id uuid, p_dependency_hash text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  revision_row platform_private.cms_entry_revisions%rowtype;
  template_slots jsonb := '[]'::jsonb;
  nodes jsonb;
  identities jsonb;
begin
  select revision_item.* into revision_row
    from platform_private.cms_entry_revisions revision_item
   where revision_item.id = p_revision_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if revision_row.template_version_id is not null then
    select coalesce(template_item.slots, '[]'::jsonb) into template_slots
      from platform_private.cms_template_versions template_item
     where template_item.id = revision_row.template_version_id;
  end if;

  select coalesce(pg_catalog.jsonb_agg(ordered.node order by ordered.group_no, ordered.ordinal,
                                       ordered.sort_text collate "C", ordered.sort_id), '[]'::jsonb),
         coalesce(pg_catalog.jsonb_agg(ordered.identity order by ordered.group_no, ordered.ordinal,
                                       ordered.sort_text collate "C", ordered.sort_id), '[]'::jsonb)
    into nodes, identities
    from (
      select 0 as group_no,
             case when definition.editor_config->>'order' ~ '^[0-9]{1,9}$'
                  then (definition.editor_config->>'order')::integer else 0 end as ordinal,
             definition.field_key::text as sort_text,
             definition.stable_field_id as sort_id,
             pg_catalog.jsonb_build_object(
               'kind', 'field', 'fieldId', pg_catalog.lower(definition.stable_field_id::text),
               'fieldKind', 'rich_text', 'value', value_row.value) as node,
             pg_catalog.jsonb_build_object(
               'kind', 'field', 'fieldId', pg_catalog.lower(definition.stable_field_id::text)) as identity
        from platform_private.cms_entry_field_values value_row
        join platform_private.cms_field_definition_versions definition on definition.id = value_row.field_definition_id
       where value_row.revision_id = revision_row.id
         and value_row.locale = revision_row.locale
         and definition.kind = 'rich_text'
         and value_row.value is not null
         and pg_catalog.jsonb_typeof(value_row.value) <> 'null'
      union all
      select 1,
             case when revision_row.template_version_id is null then 0 else coalesce((
               select slot.ord::integer
                 from pg_catalog.jsonb_array_elements(template_slots) with ordinality slot(value, ord)
                where slot.value->>'key' = instance.slot_key
             ), 100000) end,
             instance.path::text,
             instance.id,
             pg_catalog.jsonb_build_object(
               'kind', 'block',
               'pointer', '/composition/' || instance.id::text,
               'blockKey', instance.block_key,
               'blockVersion', instance.block_version::integer,
               'recordHash', coalesce(block.release_digest::text, instance.block_registry_digest::text),
               'lifecycle', case when block.id is null then 'unregistered' else coalesce((
                   select lifecycle.to_lifecycle
                     from platform_private.cms_block_definition_lifecycle_events lifecycle
                    where lifecycle.block_definition_version_id = block.id
                    order by lifecycle.created_at desc, lifecycle.id desc
                    limit 1
                 ), 'supported') end,
               'nameRequired', coalesce(block.accessibility_contract->'nameRequired' = 'true'::jsonb, false),
               'accessibleNameFieldDefined', coalesce(exists (
                   select 1
                     from pg_catalog.jsonb_array_elements(
                       case when pg_catalog.jsonb_typeof(block.props_schema_snapshot->'fields') = 'array'
                            then block.props_schema_snapshot->'fields' else '[]'::jsonb end
                     ) prop(value)
                    where prop.value->>'name' = 'accessible_name' and prop.value->>'kind' = 'short_text'
                 ), false),
               'accessibleName', case when pg_catalog.jsonb_typeof(instance.props->'accessible_name') = 'string'
                                      then instance.props->>'accessible_name' end),
             pg_catalog.jsonb_build_object(
               'kind', 'block', 'pointer', '/composition/' || instance.id::text,
               'blockKey', instance.block_key, 'blockVersion', instance.block_version::integer)
        from platform_private.cms_composition_instances instance
        left join platform_private.cms_block_definition_versions block
          on block.block_key = instance.block_key and block.block_version = instance.block_version
       where instance.revision_id = revision_row.id
         and instance.state in ('draft', 'active')
    ) ordered;

  return pg_catalog.jsonb_build_object(
    'revisionId', pg_catalog.lower(revision_row.id::text),
    'revisionNumber', revision_row.revision_number::text,
    'locale', revision_row.locale,
    'revisionContentHash', revision_row.payload_hash::text,
    'dependencyHash', p_dependency_hash,
    'renderPlanHash', platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
      'templateVersionId', revision_row.template_version_id, 'nodes', identities)),
    'nodes', nodes
  );
end;
$body$;

comment on function platform_private.cms_accessibility_checker_input(uuid, text) is
  'BE05c cms.a11y.structural input for one revision: revision identity and locale, the revision content hash, the given dependency hash, the render-plan hash and the nodes (top-level rich_text values, then live composition instances) in render order. Private; STABLE.';

create or replace function platform_private.cms_load_quality_gate_input(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  phase text;
  actor_id uuid;
  acting_party_id uuid;
  person uuid;
  requested_entry uuid;
  requested_revision uuid;
  requested_hash text;
  entry_row platform_private.cms_content_entries%rowtype;
  revision_row platform_private.cms_entry_revisions%rowtype;
  schedule_row platform_private.cms_publication_schedules%rowtype;
  dependency_hash text;
  document jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  if p_request is null or pg_catalog.jsonb_typeof(p_request) is distinct from 'object'
     or pg_catalog.jsonb_typeof(p_request->'phase') is distinct from 'string'
     or (p_request->>'phase') not in ('submit', 'schedule', 'publish', 'workflow_read', 'execute') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  phase := p_request->>'phase';

  if phase = 'execute' then
    -- Request B: the sweep's service principal; the target is the schedule's own revision.
    if not platform_private.cms_exact_keys(
         p_request,
         array['phase', 'scheduleId', 'revisionId', 'dependencyHash']::text[],
         array['phase', 'scheduleId', 'revisionId', 'dependencyHash']::text[]
       )
       or pg_catalog.jsonb_typeof(p_request->'scheduleId') is distinct from 'string'
       or platform_private.cms_valid_uuid(p_request->>'scheduleId') is not true
       or pg_catalog.jsonb_typeof(p_request->'revisionId') is distinct from 'string'
       or platform_private.cms_valid_uuid(p_request->>'revisionId') is not true
       or pg_catalog.jsonb_typeof(p_request->'dependencyHash') is distinct from 'string'
       or p_request->>'dependencyHash' !~ '^[a-f0-9]{64}$' then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    select schedule_item.* into schedule_row
      from platform_private.cms_publication_schedules schedule_item
     where schedule_item.id = (p_request->>'scheduleId')::uuid;
    if not found
       or schedule_row.revision_id is distinct from (p_request->>'revisionId')::uuid
       or schedule_row.dependency_hash::text is distinct from p_request->>'dependencyHash' then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
    requested_revision := schedule_row.revision_id;
    dependency_hash := p_request->>'dependencyHash';
  else
    -- Request A: a browser phase, authorized by the CMS-03B-15 read scope.
    actor_id := platform_private.cms_actor(p_request);
    acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
    if not platform_private.cms_exact_keys(
         p_request, array['phase', 'context']::text[],
         array['phase', 'entryId', 'revisionId', 'context', 'correlationId']::text[]
       )
       or (p_request ? 'entryId' and p_request->'entryId' <> 'null'::jsonb
           and (pg_catalog.jsonb_typeof(p_request->'entryId') is distinct from 'string'
                or platform_private.cms_valid_uuid(p_request->>'entryId') is not true))
       or (p_request ? 'revisionId' and p_request->'revisionId' <> 'null'::jsonb
           and (pg_catalog.jsonb_typeof(p_request->'revisionId') is distinct from 'string'
                or platform_private.cms_valid_uuid(p_request->>'revisionId') is not true))
       or (coalesce(p_request->'entryId', 'null'::jsonb) = 'null'::jsonb
           and coalesce(p_request->'revisionId', 'null'::jsonb) = 'null'::jsonb) then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    if coalesce(p_request->'entryId', 'null'::jsonb) <> 'null'::jsonb then
      requested_entry := (p_request->>'entryId')::uuid;
    end if;
    if coalesce(p_request->'revisionId', 'null'::jsonb) <> 'null'::jsonb then
      requested_revision := (p_request->>'revisionId')::uuid;
    end if;
    begin
      person := platform_private.identity_actor_person(actor_id);
    exception when others then
      person := null;
    end;
    if requested_entry is null then
      select revision_item.entry_id into requested_entry
        from platform_private.cms_entry_revisions revision_item
       where revision_item.id = requested_revision;
    end if;
    select entry_item.* into entry_row
      from platform_private.cms_content_entries entry_item
     where entry_item.id = requested_entry;
    if not found
       or person is null
       or entry_row.owner_party_id is distinct from acting_party_id
       or entry_row.lifecycle not in ('active', 'held')
       or not platform_private.cms_entry_tenant_visible(actor_id, entry_row.owner_party_id) then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
    select revision_item.* into revision_row
      from platform_private.cms_entry_revisions revision_item
     where revision_item.id = coalesce(requested_revision, entry_row.current_draft_revision_id)
       and revision_item.entry_id = entry_row.id;
    if not found
       or pg_catalog.cardinality(platform_private.cms_workflow_read_scopes(
         actor_id, acting_party_id, entry_row.id, revision_row.id)) = 0 then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
    requested_revision := revision_row.id;
    if phase in ('submit', 'workflow_read') then
      dependency_hash := platform_private.cms_jcs_sha256(
        platform_private.cms_build_dependency_manifest(requested_revision));
    else
      select review_item.dependency_hash::text into dependency_hash
        from platform_private.cms_editorial_reviews review_item
       where review_item.revision_id = requested_revision
         and review_item.state = 'approved'
       order by review_item.submitted_at desc, review_item.id desc
       limit 1;
      if dependency_hash is null then
        raise exception 'NOT_FOUND' using errcode = 'P0001';
      end if;
    end if;
  end if;

  document := platform_private.cms_accessibility_checker_input(requested_revision, dependency_hash);
  if pg_catalog.octet_length(document::text) > 1048576 then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  return document;
end;
$body$;

comment on function platform_private.cms_load_quality_gate_input(jsonb) is
  'BE05c/BE03b quality-gate input load: the AccessibilityCheckerInput of one revision for a browser phase (read-scope authorized; the dependency hash is the rebuilt manifest hash for submit / workflow_read and the approved review''s frozen hash for schedule / publish) or for the schedule sweep (execute). Read-only; any hidden, absent, unauthorized or unreadable target, and a document above 1 MiB, is the uniform NOT_FOUND. Private; the Worker calls the platform_api wrapper.';

create or replace function platform_api.cms_load_quality_gate_input(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  rpc_result := platform_private.cms_load_quality_gate_input(p_request);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

comment on function platform_api.cms_load_quality_gate_input(jsonb) is
  'The Worker quality gate''s one read-only load of a revision (AccessibilityCheckerInput). Executable by service_role only; never a browser route.';

-- SEC-2: what the load names, held by the definer role only.
grant select on table
  platform_private.cms_entry_revisions,
  platform_private.cms_content_entries,
  platform_private.cms_entry_field_values,
  platform_private.cms_field_definition_versions,
  platform_private.cms_composition_instances,
  platform_private.cms_block_definition_versions,
  platform_private.cms_block_definition_lifecycle_events,
  platform_private.cms_template_versions,
  platform_private.cms_editorial_reviews,
  platform_private.cms_publication_schedules
  to wejammin_cms_definer;
grant create on schema platform_private, platform_api to wejammin_cms_definer;
alter function platform_private.cms_accessibility_checker_input(uuid, text) owner to wejammin_cms_definer;
alter function platform_private.cms_load_quality_gate_input(jsonb) owner to wejammin_cms_definer;
alter function platform_api.cms_load_quality_gate_input(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private, platform_api from wejammin_cms_definer;

revoke all on function platform_private.cms_accessibility_checker_input(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_load_quality_gate_input(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_api.cms_load_quality_gate_input(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_load_quality_gate_input(jsonb) to service_role;

commit;
