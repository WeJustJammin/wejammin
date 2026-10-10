-- Slice 11 shared helpers (lane S11-3s, BE03b "Publication preflight registry (D19,
-- DEC-134, D25)", "Accessibility outcome mapping (DEC-150)", DEC-158(c); tracker
-- P2-S11-AC-093 .. AC-097, AC-101, AC-102): the preflight evaluation.
--
--   cms_preflight_registry_current()          the current row (greatest registry version) of each of the
--       seventeen categories, in registry order.
--   cms_accessibility_binding_hash(rev, dep)  SHA-256 of the JCS { checkerKey, checkerVersion, dependencyHash,
--       revisionContentHash (the revision payload_hash), revisionId } -- what the Worker binds its evidence to.
--   cms_text_is_executable(text) / cms_json_executable_leaves(jsonb)   the write-time executable-content and
--       unsafe-link rules re-run by `preflight.security`: a string is unsafe when it is, after removing
--       whitespace/control characters inside it, an executable URL (javascript:, vbscript:, livescript:,
--       data:text/html|javascript|xhtml|svg), or contains a script/style/iframe/object/embed/link/meta/base/
--       form/svg/math element, an HTML event-handler or style attribute inside a tag, or a template
--       expression ({{ {% ${ <%).  SQL text has no stable lexical form and is excluded (every query here is
--       parameterized); owner ruling welcome.
--   cms_evaluate_preflight(request)           PreflightReport { evaluatedAt, passed, results[17] } (registry order,
--       no short circuit).  Request (server-built, exact keys): { phase submit|schedule|publish|execute,
--       revisionId, actingPartyId, actorPersonId, effectiveAt, reviewId?, frozenManifest?, evidence? }.
--
-- Providers (the registry row decides which one runs, by (provider_key, provider_version): every provider
-- this migration implements is version 1.  A row this migration has no implementation for -- a newer
-- database or worker provider of another slice, or another VERSION of a known key -- is unavailable,
-- never a silent pass.  The unavailable token is fixed by DEC-160: `provider_unavailable` for every
-- database and reference-gate category, `checker_failed` for category 11 (accessibility, the worker
-- provider) -- no other unavailable token exists):
--   reference_gate  passes at cms_revision_references(rev, reference_kind) = 0, else failed
--                   provider_unbuilt_reference (blockingCount = the count, capped at 1000)
--   contract        validators_changed (frozen protected validators != registry) | value_invalid (a stored
--                   value fails cms_draft_field_value_valid, or a relation field breaks min/max)
--   schema          schema_not_active (the version/type is not active) | schema_evidence_changed (frozen
--                   `schema` group != rebuilt)
--   template        template_not_active | template_incompatible | template_changed (frozen template != rebuilt)
--   block           block_withdrawn (a frozen or rebuilt block's latest lifecycle is withdrawn) |
--                   block_digest_changed (frozen blocks != rebuilt)
--   settings        settings_changed (frozen settings != the recomputed snapshot)
--   relation        for each FROZEN relation: unavailable target + onUnavailable block => relation_target_unavailable;
--                   an available target whose version differs from the frozen one => relation_version_changed
--   security        unsafe_content (see above) over every stored value and the props/bindings of live instances
--   migration       migration_in_progress (the version is the source or target of a non-terminal plan)
--   domain_binding  binding_not_allowlisted (a RelationDefinition left cms_projection_registry_valid)
--   revocation      entry_unavailable (lifecycle not active; for submit also no active edit assignment with its
--                   standing grant) | publisher_authority_ended (schedule/publish/execute: the actor holds no
--                   current cms.publisher grant that ends no earlier than the effective instant's UTC day) |
--                   reviewer_authority_changed (schedule/publish with a review: a recorded approve no longer counts)
--                   Execute is limited to the entry and the schedule creator's grant (DEC-120).
--   accessibility   (worker) healthy => passed; blocked => failed blocking_finding; failed => unavailable
--                   checker_failed; no evidence => unavailable checker_failed.  Evidence is verified for EVERY
--                   outcome: provider version != the current row, or evaluatedAt more than 60 s from now =>
--                   preflight_evidence_stale; bindingHash != the recomputed one => dependency_changed
--                   (submit/schedule/publish) or preflight_evidence_stale (execute, DEC-158c).
-- The function writes nothing but the idempotent settings snapshot (through the manifest builder); the
-- command decides whether to commit a refusal.  Private; callers run under the CMS RPC context.
-- Forward-only.
begin;

create or replace function platform_private.cms_preflight_registry_current()
returns table(
  category text,
  registry_version bigint,
  owner_slice text,
  provider_key text,
  provider_version bigint,
  provider_kind text,
  reference_kind text
)
language sql
stable
security definer
set search_path = ''
as $body$
  select current_row.category, current_row.version, current_row.owner_slice, current_row.provider_key,
         current_row.provider_version, current_row.provider_kind, current_row.reference_kind
    from (
      select distinct on (registry.category) registry.*
        from platform_private.cms_preflight_registry registry
       order by registry.category, registry.version desc
    ) current_row
   order by pg_catalog.array_position(
     array['contract', 'schema', 'template', 'block', 'pattern', 'taxonomy', 'settings', 'relation',
           'privacy', 'security', 'accessibility', 'media', 'route', 'locale', 'migration',
           'domain_binding', 'revocation']::text[],
     current_row.category
   )
$body$;

comment on function platform_private.cms_preflight_registry_current() is
  'BE03b D19: the current row (greatest registry version) of each of the seventeen preflight categories, in registry order. Private; STABLE.';

create or replace function platform_private.cms_accessibility_binding_hash(
  p_revision_id uuid,
  p_dependency_hash text
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  revision_row platform_private.cms_entry_revisions%rowtype;
  checker record;
begin
  if p_dependency_hash is null or p_dependency_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  select revision.* into revision_row
    from platform_private.cms_entry_revisions revision
   where revision.id = p_revision_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  select current_row.provider_key, current_row.provider_version into checker
    from platform_private.cms_preflight_registry_current() current_row
   where current_row.category = 'accessibility';
  if not found then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;
  return platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
    'checkerKey', checker.provider_key,
    'checkerVersion', checker.provider_version::text,
    'dependencyHash', p_dependency_hash,
    'revisionContentHash', revision_row.payload_hash::text,
    'revisionId', revision_row.id
  ));
end;
$body$;

comment on function platform_private.cms_accessibility_binding_hash(uuid, text) is
  'BE03b D25: the SHA-256 of the JCS { checkerKey, checkerVersion, dependencyHash, revisionContentHash, revisionId } the accessibility evidence is bound to (the Worker computes the same value). Private; STABLE.';

create or replace function platform_private.cms_text_is_executable(p_text text)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $body$
  select p_text is not null and (
    pg_catalog.lower(pg_catalog.regexp_replace(
      p_text, '[[:space:][:cntrl:]  -‏  ﻿]+', '', 'g'
    )) ~ '^(javascript|vbscript|livescript):'
    or pg_catalog.lower(pg_catalog.regexp_replace(
      p_text, '[[:space:][:cntrl:]  -‏  ﻿]+', '', 'g'
    )) ~ '^data:(text/html|text/javascript|application/(x-)?javascript|application/xhtml|image/svg)'
    or p_text ~* '<\s*/?\s*(script|style|iframe|object|embed|link|meta|base|form|svg|math)\y'
    or p_text ~* '<[^>]*[\s"''/](on[a-z]{3,}|style)\s*='
    or p_text ~ '(\{\{|\{%|\$\{|<%)'
  )
$body$;

comment on function platform_private.cms_text_is_executable(text) is
  'BE03b D19 security provider: true when a string is an executable URL (after removing whitespace/control characters), carries a script/style/iframe/object/embed/link/meta/base/form/svg/math element, an HTML event-handler or style attribute inside a tag, or a template expression. SQL text is not a lexical class and is excluded. Private; IMMUTABLE.';

create or replace function platform_private.cms_json_executable_leaves(p_value jsonb)
returns integer
language sql
immutable
security definer
set search_path = ''
as $body$
  with recursive nodes(node) as (
    select p_value
    union all
    select child.value
      from nodes
      cross join lateral (
        select member.value
          from pg_catalog.jsonb_each(
            case when pg_catalog.jsonb_typeof(nodes.node) = 'object' then nodes.node else '{}'::jsonb end
          ) member
        union all
        select element.value
          from pg_catalog.jsonb_array_elements(
            case when pg_catalog.jsonb_typeof(nodes.node) = 'array' then nodes.node else '[]'::jsonb end
          ) element
      ) child
  )
  select pg_catalog.count(*)::integer
    from nodes
   where pg_catalog.jsonb_typeof(nodes.node) = 'string'
     and platform_private.cms_text_is_executable(nodes.node #>> '{}')
$body$;

comment on function platform_private.cms_json_executable_leaves(jsonb) is
  'BE03b D19 security provider: the number of string leaves of a JSON value (any depth) that cms_text_is_executable flags. Private; IMMUTABLE.';

create or replace function platform_private.cms_evaluate_preflight(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  phase text;
  revision_row platform_private.cms_entry_revisions%rowtype;
  version_row platform_private.cms_content_type_versions%rowtype;
  entry_row platform_private.cms_content_entries%rowtype;
  v_party_id uuid;
  v_actor_id uuid;
  v_review_id uuid;
  effective_at timestamptz;
  frozen jsonb;
  rebuilt jsonb;
  evidence jsonb;
  dependency_hash text;
  checker_row record;
  registry_row record;
  results jsonb := '[]'::jsonb;
  outcome text;
  reason text;
  offenders integer;
  all_passed boolean := true;
  member record;
  review_recorded integer;
begin
  -- ---- request ------------------------------------------------------------
  if p_request is null or pg_catalog.jsonb_typeof(p_request) is distinct from 'object'
     or not platform_private.cms_exact_keys(
       p_request,
       array['phase', 'revisionId', 'actingPartyId', 'actorPersonId', 'effectiveAt']::text[],
       array['phase', 'revisionId', 'actingPartyId', 'actorPersonId', 'effectiveAt',
             'reviewId', 'frozenManifest', 'evidence']::text[]
     )
     or pg_catalog.jsonb_typeof(p_request->'phase') is distinct from 'string'
     or (p_request->>'phase') not in ('submit', 'schedule', 'publish', 'execute')
     or pg_catalog.jsonb_typeof(p_request->'revisionId') is distinct from 'string'
     or not platform_private.cms_valid_uuid(p_request->>'revisionId')
     or pg_catalog.jsonb_typeof(p_request->'actingPartyId') is distinct from 'string'
     or not platform_private.cms_valid_uuid(p_request->>'actingPartyId')
     or pg_catalog.jsonb_typeof(p_request->'actorPersonId') is distinct from 'string'
     or not platform_private.cms_valid_uuid(p_request->>'actorPersonId')
     or pg_catalog.jsonb_typeof(p_request->'effectiveAt') is distinct from 'string'
     or p_request->>'effectiveAt' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$'
     or (p_request ? 'reviewId' and p_request->'reviewId' <> 'null'::jsonb
         and (pg_catalog.jsonb_typeof(p_request->'reviewId') is distinct from 'string'
              or not platform_private.cms_valid_uuid(p_request->>'reviewId'))) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  phase := p_request->>'phase';
  v_party_id := (p_request->>'actingPartyId')::uuid;
  v_actor_id := (p_request->>'actorPersonId')::uuid;
  if p_request ? 'reviewId' and p_request->'reviewId' <> 'null'::jsonb then
    v_review_id := (p_request->>'reviewId')::uuid;
  end if;
  begin
    effective_at := (p_request->>'effectiveAt')::timestamptz;
  exception when others then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end;
  if p_request ? 'frozenManifest' and p_request->'frozenManifest' <> 'null'::jsonb then
    frozen := p_request->'frozenManifest';
    begin
      perform platform_private.cms_version_set_of(frozen, '[]'::jsonb);
    exception when raise_exception then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end;
  end if;
  if p_request ? 'evidence' and p_request->'evidence' <> 'null'::jsonb then
    evidence := p_request->'evidence';
    if pg_catalog.jsonb_typeof(evidence) is distinct from 'object'
       or not platform_private.cms_exact_keys(
         evidence,
         array['category', 'providerKey', 'providerVersion', 'outcome', 'blockingCount',
               'inputHash', 'bindingHash', 'evaluatedAt']::text[],
         array['category', 'providerKey', 'providerVersion', 'outcome', 'blockingCount',
               'inputHash', 'bindingHash', 'evaluatedAt']::text[]
       )
       or evidence->>'category' is distinct from 'accessibility'
       or evidence->>'providerKey' is distinct from 'cms.a11y.structural'
       or pg_catalog.jsonb_typeof(evidence->'providerVersion') is distinct from 'string'
       or evidence->>'providerVersion' !~ '^[1-9][0-9]{0,17}$'
       or evidence->>'outcome' not in ('healthy', 'blocked', 'failed')
       or pg_catalog.jsonb_typeof(evidence->'blockingCount') is distinct from 'number'
       or evidence->>'blockingCount' !~ '^(0|[1-9][0-9]{0,3})$'
       or (evidence->>'blockingCount')::integer > 1000
       or (evidence->>'outcome' = 'healthy' and (evidence->>'blockingCount')::integer <> 0)
       or (evidence->>'outcome' = 'blocked' and (evidence->>'blockingCount')::integer = 0)
       or pg_catalog.jsonb_typeof(evidence->'inputHash') is distinct from 'string'
       or evidence->>'inputHash' !~ '^[a-f0-9]{64}$'
       or pg_catalog.jsonb_typeof(evidence->'bindingHash') is distinct from 'string'
       or evidence->>'bindingHash' !~ '^[a-f0-9]{64}$'
       or pg_catalog.jsonb_typeof(evidence->'evaluatedAt') is distinct from 'string'
       or evidence->>'evaluatedAt' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$' then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    begin
      perform (evidence->>'evaluatedAt')::timestamptz;
    exception when others then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end;
  end if;

  -- ---- canonical rows -------------------------------------------------------
  select revision.* into revision_row
    from platform_private.cms_entry_revisions revision
   where revision.id = (p_request->>'revisionId')::uuid;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  select version.* into version_row
    from platform_private.cms_content_type_versions version
   where version.id = revision_row.schema_version_id;
  select entry.* into entry_row
    from platform_private.cms_content_entries entry
   where entry.id = revision_row.entry_id;
  rebuilt := platform_private.cms_build_dependency_manifest(revision_row.id);
  frozen := coalesce(frozen, rebuilt);
  dependency_hash := platform_private.cms_jcs_sha256(rebuilt);

  -- ---- accessibility evidence is verified before anything is decided ---------
  select current_row.provider_key, current_row.provider_version into checker_row
    from platform_private.cms_preflight_registry_current() current_row
   where current_row.category = 'accessibility';
  if evidence is not null and found then
    if evidence->>'providerKey' is distinct from checker_row.provider_key
       or evidence->>'providerVersion' is distinct from checker_row.provider_version::text then
      raise exception 'preflight_evidence_stale' using errcode = 'P0001';
    end if;
    if pg_catalog.abs(extract(epoch from
         (pg_catalog.clock_timestamp() - (evidence->>'evaluatedAt')::timestamptz))) > 60 then
      raise exception 'preflight_evidence_stale' using errcode = 'P0001';
    end if;
    if evidence->>'bindingHash' is distinct from
       platform_private.cms_accessibility_binding_hash(revision_row.id, dependency_hash) then
      if phase = 'execute' then
        raise exception 'preflight_evidence_stale' using errcode = 'P0001';
      end if;
      raise exception 'dependency_changed' using errcode = 'P0001';
    end if;
  end if;

  -- ---- the seventeen categories, in registry order, no short circuit ---------
  for registry_row in
    select * from platform_private.cms_preflight_registry_current()
  loop
    outcome := 'passed';
    reason := null;
    offenders := 0;

    if registry_row.provider_version <> 1 then
      -- Dispatch is on (provider_key, provider_version): this migration implements version 1 of
      -- every provider (database, reference_gate and the Worker checker).  A newer version of a
      -- known key is another slice's provider and is unavailable, never evaluated as version 1
      -- (DEC-160).
      outcome := 'unavailable';
      reason := 'provider_unavailable';

    elsif registry_row.provider_kind = 'reference_gate' then
      offenders := least(
        platform_private.cms_revision_references(revision_row.id, registry_row.reference_kind), 1000
      )::integer;
      if offenders > 0 then
        outcome := 'failed';
        reason := 'provider_unbuilt_reference';
      end if;

    elsif registry_row.provider_kind = 'worker' then
      if registry_row.category <> 'accessibility'
         or registry_row.provider_key <> 'cms.a11y.structural' then
        outcome := 'unavailable';
        reason := 'provider_unavailable';
      elsif evidence is null then
        outcome := 'unavailable';
        reason := 'checker_failed';
      elsif evidence->>'outcome' = 'healthy' then
        null;
      elsif evidence->>'outcome' = 'blocked' then
        outcome := 'failed';
        reason := 'blocking_finding';
        offenders := (evidence->>'blockingCount')::integer;
      else
        outcome := 'unavailable';
        reason := 'checker_failed';
        offenders := (evidence->>'blockingCount')::integer;
      end if;

    elsif registry_row.provider_key <> 'preflight.' || registry_row.category then
      outcome := 'unavailable';
      reason := 'provider_unavailable';

    elsif registry_row.category = 'contract' then
      if not platform_private.cms_validators_frozen_current(version_row.id) then
        reason := 'validators_changed';
        offenders := 1;
      else
        select pg_catalog.count(*)::integer into offenders
          from platform_private.cms_entry_field_values field_value
         where field_value.revision_id = revision_row.id
           and not platform_private.cms_draft_field_value_valid(
             revision_row.schema_version_id, field_value.field_id, field_value.value, field_value.provenance
           );
        offenders := offenders + (
          select pg_catalog.count(*)::integer
            from platform_private.cms_field_definition_versions field
            join platform_private.cms_relation_definitions definition
              on definition.field_definition_id = field.id
            left join lateral (
              select pg_catalog.count(*)::integer as target_count
                from platform_private.cms_entry_relations relation
               where relation.revision_id = revision_row.id
                 and relation.field_definition_id = field.id
                 and relation.state = 'active'
            ) used on true
           where field.content_type_version_id = revision_row.schema_version_id
             and field.state = 'active'
             and (used.target_count < definition.min_count or used.target_count > definition.max_count)
        );
        if offenders > 0 then
          reason := 'value_invalid';
        end if;
      end if;

    elsif registry_row.category = 'schema' then
      if version_row.state::text <> 'active' or not exists (
        select 1 from platform_private.cms_content_types content_type
         where content_type.id = version_row.content_type_id and content_type.state = 'active'
      ) then
        reason := 'schema_not_active';
      elsif frozen->'schema' is distinct from rebuilt->'schema' then
        reason := 'schema_evidence_changed';
      end if;
      offenders := case when reason is null then 0 else 1 end;

    elsif registry_row.category = 'template' then
      if pg_catalog.jsonb_typeof(rebuilt->'template') = 'null'
         and pg_catalog.jsonb_typeof(frozen->'template') = 'null' then
        null;
      elsif pg_catalog.jsonb_typeof(rebuilt->'template') = 'null' then
        reason := 'template_changed';
      elsif not exists (
        select 1 from platform_private.cms_template_versions template
         where template.id = revision_row.template_version_id and template.state = 'active'
      ) then
        reason := 'template_not_active';
      elsif not platform_private.cms_template_binding_compatible(
        revision_row.template_version_id, revision_row.owner_id, version_row.content_type_id
      ) then
        reason := 'template_incompatible';
      elsif frozen->'template' is distinct from rebuilt->'template' then
        reason := 'template_changed';
      end if;
      offenders := case when reason is null then 0 else 1 end;

    elsif registry_row.category = 'block' then
      select pg_catalog.count(*)::integer into offenders
        from (
          select block.value->>'id' as id
            from pg_catalog.jsonb_array_elements(frozen->'blocks') block(value)
          union
          select block.value->>'id'
            from pg_catalog.jsonb_array_elements(rebuilt->'blocks') block(value)
        ) named
       where coalesce((
         select lifecycle.to_lifecycle
           from platform_private.cms_block_definition_lifecycle_events lifecycle
          where lifecycle.block_definition_version_id = named.id::uuid
          order by lifecycle.created_at desc, lifecycle.id desc
          limit 1
       ), 'supported') = 'withdrawn';
      if offenders > 0 then
        reason := 'block_withdrawn';
      elsif frozen->'blocks' is distinct from rebuilt->'blocks' then
        reason := 'block_digest_changed';
        offenders := 1;
      end if;

    elsif registry_row.category = 'settings' then
      if frozen->'settings' is distinct from rebuilt->'settings' then
        reason := 'settings_changed';
        offenders := 1;
      end if;

    elsif registry_row.category = 'relation' then
      for member in
        select frozen_relation.value->>'fieldId' as field_id,
               frozen_relation.value->>'targetId' as target_id,
               (frozen_relation.value->>'targetVersion')::bigint as target_version
          from pg_catalog.jsonb_array_elements(frozen->'relations') frozen_relation(value)
      loop
        declare
          policy text;
          target_lifecycle text;
          target_current bigint;
        begin
          select relation.on_unavailable into policy
            from platform_private.cms_entry_relations relation
           where relation.revision_id = revision_row.id
             and relation.field_id = member.field_id::uuid
             and relation.target_id = member.target_id::uuid
           limit 1;
          select target.lifecycle, target.version into target_lifecycle, target_current
            from platform_private.cms_content_entries target
           where target.id = member.target_id::uuid;
          if target_lifecycle is distinct from 'active' then
            if coalesce(policy, 'block') = 'block' then
              reason := coalesce(reason, 'relation_target_unavailable');
              offenders := offenders + 1;
            end if;
          elsif target_current is distinct from member.target_version then
            if reason is distinct from 'relation_target_unavailable' then
              reason := 'relation_version_changed';
            end if;
            offenders := offenders + 1;
          end if;
        end;
      end loop;

    elsif registry_row.category = 'security' then
      select (
        select coalesce(pg_catalog.sum(platform_private.cms_json_executable_leaves(field_value.value)), 0)
          from platform_private.cms_entry_field_values field_value
         where field_value.revision_id = revision_row.id and field_value.value is not null
      ) + (
        select coalesce(pg_catalog.sum(
                 platform_private.cms_json_executable_leaves(instance.props)
                 + platform_private.cms_json_executable_leaves(instance.bindings)), 0)
          from platform_private.cms_composition_instances instance
         where instance.revision_id = revision_row.id
           and instance.state in ('draft', 'active', 'pending_diff')
      ) into offenders;
      if offenders > 0 then
        reason := 'unsafe_content';
      end if;

    elsif registry_row.category = 'migration' then
      select pg_catalog.count(*)::integer into offenders
        from platform_private.cms_schema_migration_plans plan
       where (plan.from_version_id = version_row.id or plan.to_version_id = version_row.id)
         and plan.state not in ('completed', 'failed_terminal');
      if offenders > 0 then
        reason := 'migration_in_progress';
      end if;

    elsif registry_row.category = 'domain_binding' then
      select pg_catalog.count(*)::integer into offenders
        from platform_private.cms_field_definition_versions field
        join platform_private.cms_relation_definitions definition
          on definition.field_definition_id = field.id
       where field.content_type_version_id = revision_row.schema_version_id
         and field.state = 'active'
         and not platform_private.cms_projection_registry_valid(
           definition.target_kind, definition.target_type, definition.projection_key
         );
      if offenders > 0 then
        reason := 'binding_not_allowlisted';
      end if;

    elsif registry_row.category = 'revocation' then
      if entry_row.lifecycle <> 'active' then
        reason := 'entry_unavailable';
      elsif phase = 'submit' then
        if not exists (
          select 1
            from platform_private.cms_entry_assignments assignment
           where assignment.entry_id = revision_row.entry_id
             and assignment.assignee_person_id = v_actor_id
             and assignment.state = 'active'
             and assignment.capability_key in ('cms.author', 'cms.editor')
             and platform_private.cms_person_holds_capability(v_party_id, v_actor_id, assignment.capability_key)
        ) then
          reason := 'entry_unavailable';
        end if;
      else
        if not exists (
          select 1
            from identity_private.membership_tenure tenure
            join identity_private.organization_actor_grant actor_grant
              on actor_grant.organization_id = tenure.organization_id
             and actor_grant.person_id = tenure.person_id
           where tenure.organization_id = v_party_id
             and tenure.person_id = v_actor_id
             and tenure.state = 'confirmed'
             and tenure.starts_on <= current_date
             and (tenure.ends_on is null or tenure.ends_on >= current_date)
             and actor_grant.capability_code = 'cms.publisher'
             and actor_grant.active
             and actor_grant.valid_from <= current_date
             and (actor_grant.valid_through is null
                  or actor_grant.valid_through >= (effective_at at time zone 'UTC')::date)
        ) then
          reason := 'publisher_authority_ended';
        elsif phase in ('schedule', 'publish') and v_review_id is not null then
          select pg_catalog.count(distinct decision.reviewer_person_id)::integer into review_recorded
            from platform_private.cms_editorial_decisions decision
           where decision.review_id = v_review_id and decision.decision = 'approve';
          if platform_private.cms_editorial_review_distinct_approvals(v_review_id) < review_recorded then
            reason := 'reviewer_authority_changed';
          end if;
        end if;
      end if;
      offenders := case when reason is null then 0 else 1 end;
    end if;

    -- DEC-160 (BE03b "Unavailable reasons"): `unavailable` carries provider_unavailable for every database
    -- or reference-gate category and checker_failed for category 11, the worker accessibility provider.
    -- Every path above that leaves a provider unavailable (an unimplemented version or key, a failed
    -- checker, no evidence) therefore reports accessibility under checker_failed, whatever branch ran.
    if outcome = 'unavailable' and registry_row.category = 'accessibility' then
      reason := 'checker_failed';
    end if;

    if reason is not null and outcome = 'passed' then
      outcome := 'failed';
    end if;
    if outcome <> 'passed' then
      all_passed := false;
      if outcome = 'failed' and offenders = 0 then
        offenders := 1;
      end if;
    end if;
    results := results || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'category', registry_row.category,
      'outcome', outcome,
      'providerKey', registry_row.provider_key,
      'providerVersion', registry_row.provider_version::text,
      'reasonCode', reason,
      'blockingCount', least(offenders, 1000)
    ));
  end loop;

  return pg_catalog.jsonb_build_object(
    'evaluatedAt', platform_private.auth_iso_time(pg_catalog.clock_timestamp()),
    'passed', all_passed,
    'results', results
  );
end;
$body$;

comment on function platform_private.cms_evaluate_preflight(jsonb) is
  'BE03b D19/D25: evaluates the seventeen preflight categories in registry order (no short circuit) and returns the PreflightReport { evaluatedAt, passed, results }. Failed/unavailable results are data: the command aggregates (failed => 422 preflight_failed, else unavailable => 503). Raises only for a malformed request, an absent revision, an unresolvable manifest, and accessibility evidence that is stale or bound to other rows. Private; VOLATILE.';

grant select on table
  identity_private.membership_tenure,
  identity_private.organization_actor_grant,
  platform_private.cms_block_definition_lifecycle_events,
  platform_private.cms_composition_instances,
  platform_private.cms_content_entries,
  platform_private.cms_content_type_versions,
  platform_private.cms_content_types,
  platform_private.cms_editorial_decisions,
  platform_private.cms_entry_assignments,
  platform_private.cms_entry_field_values,
  platform_private.cms_entry_relations,
  platform_private.cms_entry_revisions,
  platform_private.cms_field_definition_versions,
  platform_private.cms_preflight_registry,
  platform_private.cms_relation_definitions,
  platform_private.cms_schema_migration_plans,
  platform_private.cms_template_versions
  to wejammin_cms_definer;
grant execute on function platform_private.cms_template_binding_compatible(uuid, uuid, uuid)
  to wejammin_cms_definer;
grant execute on function platform_private.cms_projection_registry_valid(text, text, text)
  to wejammin_cms_definer;

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_preflight_registry_current()
  owner to wejammin_cms_definer;
alter function platform_private.cms_accessibility_binding_hash(uuid, text)
  owner to wejammin_cms_definer;
alter function platform_private.cms_text_is_executable(text)
  owner to wejammin_cms_definer;
alter function platform_private.cms_json_executable_leaves(jsonb)
  owner to wejammin_cms_definer;
alter function platform_private.cms_evaluate_preflight(jsonb)
  owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_preflight_registry_current()
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_accessibility_binding_hash(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_text_is_executable(text)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_json_executable_leaves(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_evaluate_preflight(jsonb)
  from public, anon, authenticated, service_role;

commit;
