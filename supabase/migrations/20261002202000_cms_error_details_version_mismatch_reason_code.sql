-- Slice 09 R8 (r8-worker-cms NEEDS-DB ND-1, ND-2, ND-3): BE00 error details.
--
-- ND-1  BE00: "A well-formed stale tag returns 409 VERSION_MISMATCH after the
--       authorized resource is resolved".  Every Slice 09 command that carries
--       an If-Match / expectedVersion (CMS-03A-02, -03, -04, -08, -09, -10, -11,
--       -12, -14, -16, -17) raised a bare CONFLICT for a stale version, so the
--       wire reported conflict=INVALID_TRANSITION.  Each now checks the version
--       first, right after the authorized resource has been resolved and locked,
--       and raises VERSION_MISMATCH with DETAIL {"expectedVersion":"<n>",
--       "currentVersion":"<n>"} (decimal strings, as BE00 discloses them only to
--       a caller who may read the resource).  A state conflict at the current
--       version stays a bare CONFLICT with no detail.
-- ND-2  BE00 makes reasonCode required on every 403.  Each Slice 09 FORBIDDEN
--       now carries DETAIL {"reasonCode":"<registered>"}: OWNER_REQUIRED for the
--       owner-only operations (receipt identity: CMS-03A-14 assignment and
--       CMS-03A-15..18 grants), CAPABILITY_REQUIRED for a missing capability or
--       a readable review without an effective assignment.  Never a policy
--       predicate.
-- ND-3  BE03a OD-4 (AC1182): locale violations are { path, message }; the DETAIL
--       member is renamed from `pointer` to `path` (the JSON-pointer value is
--       unchanged).
--
-- Only the guarded conditions change; every body is otherwise byte-identical to
-- its previous definition and every signature and grant is unchanged.  The two
-- raise helpers are private and not executable by any API role.  Forward-only.
begin;

create function platform_private.cms_raise_version_mismatch(p_expected bigint, p_current bigint)
returns void
language plpgsql
set search_path = ''
as $body$
begin
  raise exception 'VERSION_MISMATCH' using errcode = 'P0001',
    detail = pg_catalog.jsonb_build_object(
      'expectedVersion', p_expected::text, 'currentVersion', p_current::text)::text;
end;
$body$;

create function platform_private.cms_raise_forbidden(p_reason_code text)
returns void
language plpgsql
set search_path = ''
as $body$
begin
  if p_reason_code is null
     or p_reason_code not in ('CAPABILITY_REQUIRED', 'OWNER_REQUIRED', 'MFA_REQUIRED', 'POLICY_NOT_MET') then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  raise exception 'FORBIDDEN' using errcode = 'P0001',
    detail = pg_catalog.jsonb_build_object('reasonCode', p_reason_code)::text;
end;
$body$;

revoke all on function
  platform_private.cms_raise_version_mismatch(bigint, bigint),
  platform_private.cms_raise_forbidden(text)
from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION platform_private.cms_grant_owner(p_actor_id uuid, p_acting_party_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  owner_person uuid;
begin
  owner_person := platform_private.identity_actor_person(p_actor_id);
  if owner_person is null
     or p_acting_party_id is null
     or not exists (
       select 1 from platform_private.cms_owner_initialization receipt
        where receipt.auth_user_id = p_actor_id
          and receipt.person_id = owner_person
          and receipt.organization_id = p_acting_party_id
     ) then
    perform platform_private.cms_raise_forbidden('OWNER_REQUIRED');
  end if;
  return owner_person;
end;
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_require_capability(p_actor_id uuid, p_acting_party_id uuid, p_capability text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  resolved_person_id uuid;
begin
  resolved_person_id := platform_private.identity_actor_person(p_actor_id);
  if resolved_person_id is null or p_acting_party_id is null then
    perform platform_private.cms_raise_forbidden('CAPABILITY_REQUIRED');
  end if;
  if not exists (
    select 1
    from identity_private.membership_tenure tenure
    join identity_private.organization_actor_grant actor_grant
      on actor_grant.organization_id = tenure.organization_id
     and actor_grant.person_id = tenure.person_id
    where tenure.organization_id = p_acting_party_id
      and tenure.person_id = resolved_person_id
      and tenure.state = 'confirmed'
      and tenure.starts_on <= current_date
      and (tenure.ends_on is null or tenure.ends_on >= current_date)
      and actor_grant.capability_code = p_capability
      and actor_grant.active
      and actor_grant.valid_from <= current_date
      and (actor_grant.valid_through is null or actor_grant.valid_through >= current_date)
  ) then
    perform platform_private.cms_raise_forbidden('CAPABILITY_REQUIRED');
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_require_read(p_actor_id uuid, p_acting_party_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  resolved_person_id uuid;
begin
  resolved_person_id := platform_private.identity_actor_person(p_actor_id);
  if resolved_person_id is null or p_acting_party_id is null then
    perform platform_private.cms_raise_forbidden('CAPABILITY_REQUIRED');
  end if;
  if not exists (
    select 1
    from identity_private.membership_tenure tenure
    join identity_private.organization_actor_grant actor_grant
      on actor_grant.organization_id = tenure.organization_id
     and actor_grant.person_id = tenure.person_id
    where tenure.organization_id = p_acting_party_id
      and tenure.person_id = resolved_person_id
      and tenure.state = 'confirmed'
      and tenure.starts_on <= current_date
      and (tenure.ends_on is null or tenure.ends_on >= current_date)
      and actor_grant.capability_code in ('cms.schema_registry.read', 'cms.schema_designer')
      and actor_grant.active
      and actor_grant.valid_from <= current_date
      and (actor_grant.valid_through is null or actor_grant.valid_through >= current_date)
  ) then
    perform platform_private.cms_raise_forbidden('CAPABILITY_REQUIRED');
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_get_schema_review(p_request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid;
  acting_party_id uuid;
  person_id uuid;
  scope text;
  review_id uuid;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  if not platform_private.cms_exact_keys(
    p_request, array['reviewId']::text[], array['reviewId','context','correlationId']::text[]
  ) or not platform_private.cms_valid_uuid(p_request->>'reviewId') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  review_id := (p_request->>'reviewId')::uuid;
  person_id := platform_private.identity_actor_person(actor_id);
  scope := platform_private.cms_review_scope(review_id, actor_id, acting_party_id);
  if scope is null then
    -- A review of the caller's own acting party that the caller cannot read for
    -- want of the capability (a confirmed member acting as the owner party) is
    -- known and readable in the party scope: 403.  Every other caller, an
    -- absent review and a cross-owner review are the same concealed 404.
    if exists (
      select 1 from platform_private.cms_schema_reviews review
       where review.id = review_id and review.owner_id = acting_party_id
    ) and platform_private.cms_grant_subject_eligible(acting_party_id, person_id) then
      perform platform_private.cms_raise_forbidden('CAPABILITY_REQUIRED');
    end if;
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  return platform_private.cms_schema_review_resource(
    review_id, person_id, scope = 'designer',
    scope = 'designer' and platform_private.cms_review_is_owner(actor_id, acting_party_id));
end;
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_review_owner_authority_end(p_actor_id uuid, p_acting_party_id uuid)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  owner_person uuid;
  grant_through date;
begin
  owner_person := platform_private.identity_actor_person(p_actor_id);
  if not exists (
    select 1 from platform_private.cms_owner_initialization receipt
     where receipt.auth_user_id = p_actor_id
       and receipt.person_id = owner_person
       and receipt.organization_id = p_acting_party_id
  ) then
    perform platform_private.cms_raise_forbidden('OWNER_REQUIRED');
  end if;
  if not platform_private.cms_person_holds_capability(
    p_acting_party_id, owner_person, 'cms.schema_designer'
  ) then
    perform platform_private.cms_raise_forbidden('CAPABILITY_REQUIRED');
  end if;
  select actor_grant.valid_through into grant_through
    from identity_private.organization_actor_grant actor_grant
   where actor_grant.organization_id = p_acting_party_id
     and actor_grant.person_id = owner_person
     and actor_grant.capability_code = 'cms.schema_designer';
  if grant_through is null then
    return 'infinity'::timestamptz;
  end if;
  return ((grant_through + 1)::timestamp at time zone 'UTC');
end;
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_locale_violation_detail(p_issues jsonb)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select pg_catalog.jsonb_build_object('violations', coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'path',
      '/' || (select pg_catalog.string_agg(
                pg_catalog.replace(pg_catalog.replace(segment.value, '~', '~0'), '/', '~1'),
                '/' order by segment.ord)
              from pg_catalog.jsonb_array_elements_text(issue.value->'path')
                with ordinality segment(value, ord)),
      'message', issue.value->>'message') order by issue.ord), '[]'::jsonb))::text
  from pg_catalog.jsonb_array_elements(p_issues) with ordinality issue(value, ord)
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_add_field_definition(p_request jsonb)
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
  type_version platform_private.cms_content_type_versions%rowtype;
  field_id uuid;
  definition_id uuid;
  field_input jsonb := p_request->'field';
  field_row platform_private.cms_field_definition_versions%rowtype;
  response jsonb;
  expected_version bigint;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  perform platform_private.cms_require_capability(actor_id, acting_party_id, 'cms.schema_designer');
  correlation_id := platform_private.cms_correlation(p_request);
  reservation := platform_private.cms_reserve(p_request, actor_id, 'CMS-03A-02:' || coalesce(p_request->>'contentTypeId', ''));
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    return jsonb_build_object('resourceKind', 'field_definition_version', 'id', (reservation.response_ref->>'resourceRef')::uuid);
  end if;
  expected_version := platform_private.cms_expected_version(p_request);
  if not platform_private.cms_exact_keys(
    p_request,
    array['contentTypeId','versionId','field','migrationPlanId','expectedVersion']::text[],
    array['contentTypeId','versionId','field','migrationPlanId','expectedVersion','ifMatch','idempotencyKey','context','correlationId']::text[]
  )
     or not platform_private.cms_valid_uuid(p_request->>'contentTypeId')
     or not platform_private.cms_valid_uuid(p_request->>'versionId')
     or pg_catalog.jsonb_typeof(field_input) is distinct from 'object'
     or not (p_request ? 'migrationPlanId')
     or (p_request->'migrationPlanId' <> 'null'::jsonb and not platform_private.cms_valid_uuid(p_request->>'migrationPlanId')) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  select * into type_version
  from platform_private.cms_content_type_versions
  where id = (p_request->>'versionId')::uuid
    and content_type_id = (p_request->>'contentTypeId')::uuid
    and owner_id = acting_party_id
  for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if p_request->'migrationPlanId' <> 'null'::jsonb
     and not platform_private.cms_migration_plan_ready(
       (p_request->>'migrationPlanId')::uuid,
       type_version.content_type_id,
       type_version.id
     ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if type_version.version <> expected_version then
    perform platform_private.cms_raise_version_mismatch(expected_version, type_version.version);
  end if;
  if type_version.state not in ('draft'::platform_private.cms_definition_state, 'review'::platform_private.cms_definition_state)
     or type_version.version <> expected_version then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if not platform_private.cms_valid_field_input(field_input, false) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  field_id := nullif(field_input->>'stableFieldId', '')::uuid;
  if field_id is null then
    field_id := extensions.gen_random_uuid();
    definition_id := field_id;
    if exists (select 1 from platform_private.cms_field_definition_versions where content_type_version_id = type_version.id and field_key = field_input->>'key') then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    insert into platform_private.cms_field_definition_versions(
      id, owner_id, state, version, content_type_version_id, stable_field_id,
      field_key, kind, constraints, validator_key, validator_version, required,
      default_mode, default_value, localization_mode, editor_config, created_by
    ) values (
      field_id, type_version.owner_id, coalesce(nullif(field_input->>'lifecycle', ''), 'active'),
      1, type_version.id, field_id, field_input->>'key', field_input->>'kind',
      coalesce(field_input->'constraints', '{}'::jsonb), nullif(field_input->>'validatorKey', ''),
      nullif(field_input->>'validatorVersion', '')::bigint, coalesce((field_input->>'required')::boolean, false),
      coalesce(nullif(field_input->>'defaultMode', ''), 'none'), field_input->'defaultValue',
      coalesce(nullif(field_input->>'localizationMode', ''), 'none'), coalesce(field_input->'editorConfig', '{}'::jsonb), actor_id
    );
  else
    select * into field_row from platform_private.cms_field_definition_versions
    where content_type_version_id = type_version.id and stable_field_id = field_id for update;
    if not found or field_row.field_key is distinct from field_input->>'key' then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    if p_request->'migrationPlanId' = 'null'::jsonb
       and (
         field_row.kind is distinct from field_input->>'kind'
         or (not field_row.required and (field_input->>'required')::boolean)
         or field_row.constraints is distinct from field_input->'constraints'
         or field_row.default_mode is distinct from field_input->>'defaultMode'
         or field_row.localization_mode is distinct from field_input->>'localizationMode'
         or field_row.state is distinct from field_input->>'lifecycle'
       ) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    update platform_private.cms_field_definition_versions
    set state = coalesce(nullif(field_input->>'lifecycle', ''), state),
        version = version + 1,
        updated_at = now(),
        kind = field_input->>'kind',
        constraints = coalesce(field_input->'constraints', '{}'::jsonb),
        validator_key = nullif(field_input->>'validatorKey', ''),
        validator_version = nullif(field_input->>'validatorVersion', '')::bigint,
        required = coalesce((field_input->>'required')::boolean, false),
        default_mode = coalesce(nullif(field_input->>'defaultMode', ''), 'none'),
        default_value = field_input->'defaultValue',
        localization_mode = coalesce(nullif(field_input->>'localizationMode', ''), 'none'),
        editor_config = coalesce(field_input->'editorConfig', '{}'::jsonb)
    where id = field_row.id;
    definition_id := field_row.id;
  end if;
  update platform_private.cms_content_type_versions
  set version = version + 1, updated_at = now()
  where id = type_version.id;
  perform platform_private.cms_record_audit(
    'cms.schema.field.change', actor_id, acting_party_id, 'cms_field_definition_version',
    definition_id, 'CMS_FIELD_SCHEMA_CHANGED', correlation_id
  );
  select jsonb_build_object(
    'resourceKind', 'field_definition_version', 'id', field.id, 'version', field.version::text,
    'contentHash', encode(extensions.digest(convert_to(field::text, 'utf8'), 'sha256'), 'hex'),
    'createdAt', field.created_at, 'updatedAt', field.updated_at,
    'contentTypeVersionId', field.content_type_version_id, 'stableFieldId', field.stable_field_id,
    'key', field.field_key, 'kind', field.kind, 'required', field.required,
    'validatorKey', field.validator_key, 'validatorVersion', field.validator_version::text,
    'defaultMode', field.default_mode, 'localizationMode', field.localization_mode,
    'lifecycle', field.state, 'migrationPlanId', nullif(p_request->>'migrationPlanId', '')::uuid
  ) into response from platform_private.cms_field_definition_versions field where field.id = definition_id;
  perform platform_private.cms_complete(reservation.id, definition_id, 201, response);
  return response;
end;
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_bind_relation(p_request jsonb)
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
  type_version platform_private.cms_content_type_versions%rowtype;
  field_row platform_private.cms_field_definition_versions%rowtype;
  relation_id uuid;
  expected_version bigint;
  response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  perform platform_private.cms_require_capability(actor_id, acting_party_id, 'cms.schema_designer');
  correlation_id := platform_private.cms_correlation(p_request);
  reservation := platform_private.cms_reserve(p_request, actor_id, 'CMS-03A-03:' || coalesce(p_request->>'versionId', ''));
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    return jsonb_build_object('resourceKind', 'relation_definition', 'id', (reservation.response_ref->>'resourceRef')::uuid);
  end if;
  expected_version := platform_private.cms_expected_version(p_request);
  if not platform_private.cms_exact_keys(
    p_request,
    array['contentTypeId','versionId','fieldId','targetKind','targetType','projectionKey','cardinality','min','max','ordered','onUnavailable','expectedVersion']::text[],
    array['contentTypeId','versionId','fieldId','targetKind','targetType','projectionKey','cardinality','min','max','ordered','onUnavailable','expectedVersion','ifMatch','idempotencyKey','context','correlationId']::text[]
  )
     or not platform_private.cms_valid_uuid(p_request->>'contentTypeId')
     or not platform_private.cms_valid_uuid(p_request->>'versionId')
     or not platform_private.cms_valid_relation_input(
       jsonb_build_object(
         'fieldId', p_request->>'fieldId',
         'targetKind', p_request->>'targetKind',
         'targetType', p_request->>'targetType',
         'projectionKey', p_request->>'projectionKey',
         'cardinality', p_request->>'cardinality',
         'min', p_request->>'min',
         'max', p_request->>'max',
         'ordered', p_request->'ordered',
         'onUnavailable', p_request->>'onUnavailable'
       )
     ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  select * into type_version from platform_private.cms_content_type_versions
  where id = (p_request->>'versionId')::uuid
    and content_type_id = (p_request->>'contentTypeId')::uuid
    and owner_id = acting_party_id
  for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if type_version.version <> expected_version then
    perform platform_private.cms_raise_version_mismatch(expected_version, type_version.version);
  end if;
  if type_version.state not in ('draft'::platform_private.cms_definition_state, 'review'::platform_private.cms_definition_state)
     or type_version.version <> expected_version then raise exception 'CONFLICT' using errcode = 'P0001'; end if;
  select * into field_row from platform_private.cms_field_definition_versions
  where id = (p_request->>'fieldId')::uuid and content_type_version_id = type_version.id for update;
  if not found or field_row.kind <> 'relation' then raise exception 'VALIDATION_FAILED' using errcode = 'P0001'; end if;
  if (p_request->>'min')::integer > (p_request->>'max')::integer
     or (p_request->>'min')::integer > 128 or (p_request->>'max')::integer > 128
     or (p_request->>'cardinality' = 'one' and ((p_request->>'max')::integer <> 1 or (p_request->>'min')::integer not in (0, 1))) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  insert into platform_private.cms_relation_definitions(
    owner_id, state, version, field_definition_id, target_kind, target_type,
    projection_key, cardinality, min_count, max_count, ordered, on_unavailable, created_by
  ) values (
    type_version.owner_id, 'draft', 1, field_row.id, p_request->>'targetKind',
    p_request->>'targetType', p_request->>'projectionKey', p_request->>'cardinality',
    (p_request->>'min')::integer, (p_request->>'max')::integer,
    coalesce((p_request->>'ordered')::boolean, false), p_request->>'onUnavailable', actor_id
  ) returning id into relation_id;
  update platform_private.cms_content_type_versions set version = version + 1, updated_at = now()
  where id = type_version.id;
  if not found then raise exception 'CONFLICT' using errcode = 'P0001'; end if;
  perform platform_private.cms_record_audit(
    'cms.schema.relation.bind', actor_id, acting_party_id, 'cms_relation_definition',
    relation_id, 'CMS_RELATION_BOUND', correlation_id
  );
  select jsonb_build_object(
    'resourceKind', 'relation_definition', 'id', relation.id, 'version', relation.version::text,
    'contentHash', encode(extensions.digest(convert_to(relation::text, 'utf8'), 'sha256'), 'hex'),
    'createdAt', relation.created_at, 'updatedAt', relation.updated_at,
    'contentTypeVersionId', type_version.id, 'fieldId', relation.field_definition_id,
    'targetKind', relation.target_kind, 'targetType', relation.target_type,
    'projectionKey', relation.projection_key, 'cardinality', relation.cardinality,
    'min', relation.min_count, 'max', relation.max_count, 'ordered', relation.ordered,
    'onUnavailable', relation.on_unavailable
  ) into response from platform_private.cms_relation_definitions relation where relation.id = relation_id;
  perform platform_private.cms_complete(reservation.id, relation_id, 201, response);
  return response;
end;
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_activate_schema(p_request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
<<activation_block>>
declare
  actor_id uuid;
  acting_party_id uuid;
  correlation_id uuid;
  reservation platform_private.idempotency_records;
  candidate platform_private.cms_content_type_versions%rowtype;
  current_active platform_private.cms_content_type_versions%rowtype;
  review_row platform_private.cms_schema_reviews%rowtype;
  binding record;
  expected_version bigint;
  approval_ids uuid[];
  review_id uuid;
  migration_plan_id uuid;
  evidence jsonb;
  response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  perform platform_private.cms_require_capability(actor_id, acting_party_id, 'cms.schema_designer');
  correlation_id := platform_private.cms_correlation(p_request);
  reservation := platform_private.cms_reserve_conflict(
    p_request, actor_id, 'CMS-03A-04:' || coalesce(p_request->>'versionId', ''));
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    return jsonb_build_object('state', 'active', 'contentTypeVersionId',
      (reservation.response_ref->>'resourceRef')::uuid, 'eventType', 'cms.schema.activated.v1');
  end if;
  if not platform_private.cms_exact_keys(
    p_request,
    array['contentTypeId','versionId','expectedVersion','dryRunId','approvalIds','migrationPlanId']::text[],
    array['contentTypeId','versionId','expectedVersion','dryRunId','approvalIds','migrationPlanId',
          'expectedActivationEvidenceHash','idempotencyKey','ifMatch','context','correlationId']::text[]
  ) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  expected_version := platform_private.cms_expected_version(p_request);
  if not platform_private.cms_valid_uuid(p_request->>'contentTypeId')
     or not platform_private.cms_valid_uuid(p_request->>'versionId')
     or not platform_private.cms_valid_uuid(p_request->>'dryRunId')
     or pg_catalog.jsonb_typeof(p_request->'approvalIds') is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_request->'approvalIds') not between 1 and 8 then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(p_request->'approvalIds') a
     where not platform_private.cms_valid_uuid(a)
  ) or (select count(distinct value) from jsonb_array_elements_text(p_request->'approvalIds') value)
         <> jsonb_array_length(p_request->'approvalIds') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  select array_agg(value::uuid order by value::uuid) into approval_ids
    from jsonb_array_elements_text(p_request->'approvalIds') as approval(value);
  select * into candidate from platform_private.cms_content_type_versions
   where id = (p_request->>'versionId')::uuid
     and content_type_id = (p_request->>'contentTypeId')::uuid
     and owner_id = acting_party_id
   for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform platform_private.cms_lock_activation_graph(candidate.id);
  if candidate.version <> expected_version then
    perform platform_private.cms_raise_version_mismatch(expected_version, candidate.version);
  end if;
  if candidate.state <> 'approved' or candidate.version <> expected_version then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if candidate.dry_run_id is distinct from (p_request->>'dryRunId')::uuid then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from platform_private.cms_schema_artifacts artifact
     where artifact.id = candidate.schema_artifact_id
       and artifact.content_type_version_id = candidate.id
       and artifact.artifact_hash = candidate.definition_hash
       and artifact.state = 'compiled'
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  current_active := null;
  select * into current_active from platform_private.cms_content_type_versions active_version
   where active_version.content_type_id = candidate.content_type_id
     and active_version.owner_id = candidate.owner_id
     and active_version.state = 'active'
     and active_version.id <> candidate.id
   order by active_version.id
   for update;
  if candidate.supersedes_id is distinct from current_active.id then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if candidate.compatibility in ('conditional', 'breaking')
     and nullif(p_request->>'migrationPlanId', '') is null then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if p_request->'migrationPlanId' <> 'null'::jsonb
     and not platform_private.cms_valid_uuid(p_request->>'migrationPlanId') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  -- Only the activator's own binding-bound MFA is rechecked; the server-verified
  -- envelope's step-up flags and timestamps are never authority.
  select * into binding from platform_private.cms_review_binding(
    p_request, actor_id, acting_party_id, true);
  perform platform_private.cms_lock_activation_authority(candidate.id, actor_id, binding.binding_id);
  review_id := platform_private.cms_resolve_activation_review(candidate.id, approval_ids);
  select * into review_row from platform_private.cms_schema_reviews where id = review_id;
  -- The review froze the candidate's locale configuration hash; the candidate
  -- row must still recompute to exactly that value.
  if review_row.locale_config_hash is distinct from platform_private.cms_locale_config_hash(
       candidate.source_locale, candidate.default_locale,
       candidate.supported_locales, candidate.fallback_chains) then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if not platform_private.cms_activation_references_valid(candidate.id) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  evidence := jsonb_build_object(
    'key', review_row.policy_key,
    'version', review_row.policy_version::text,
    'policyHash', review_row.policy_hash,
    'riskClass', review_row.risk_class,
    'requiredDecisionCount', review_row.required_decision_count,
    'requiredCapabilities', review_row.required_capabilities,
    'approvalEvidenceHash', review_row.approval_evidence_hash
  );
  if p_request ? 'expectedActivationEvidenceHash'
     and p_request->'expectedActivationEvidenceHash' <> 'null'::jsonb
     and p_request->>'expectedActivationEvidenceHash' <> review_row.approval_evidence_hash then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  migration_plan_id := platform_private.cms_advance_activation_plan(
    candidate.id, current_active.id,
    case when p_request->'migrationPlanId' = 'null'::jsonb
      then null else (p_request->>'migrationPlanId')::uuid end,
    (p_request->>'dryRunId')::uuid
  );
  -- The previous active version is superseded first: at most one version of a
  -- type may be active at any instant.
  if current_active.id is not null then
    update platform_private.cms_content_type_versions
       set state = 'superseded', updated_at = now(), version = version + 1
     where id = current_active.id;
  end if;
  update platform_private.cms_content_type_versions
     set state = 'active', version = version + 1, updated_at = now(),
         approved_at = coalesce(approved_at, now())
   where id = candidate.id and version = expected_version;
  if not found then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  update platform_private.cms_content_types
     set state = 'active', version = version + 1, updated_at = now()
   where id = candidate.content_type_id;
  perform platform_private.cms_emit_event(
    'cms.schema.activate', actor_id, acting_party_id, 'cms_content_type_version', candidate.id,
    'CMS_SCHEMA_ACTIVATED', 'cms.schema.activated.v1', 'cms_content_type_version', candidate.id,
    expected_version + 1,
    jsonb_build_object(
      'contentTypeId', candidate.content_type_id,
      'schemaVersionId', candidate.id,
      'migrationPlanId', migration_plan_id,
      'localeConfigHash', review_row.locale_config_hash,
      'activationEvidence', evidence
    ), correlation_id
  );
  -- The SchemaActivationResource: the common resource metadata plus the
  -- activation facts; the committed event id is never part of the resource.
  response := platform_private.cms_with_content_hash(jsonb_build_object(
    'id', candidate.id, 'version', (expected_version + 1)::text,
    'createdAt', candidate.created_at, 'updatedAt', pg_catalog.clock_timestamp(),
    'contentTypeVersionId', candidate.id, 'state', 'active',
    'activatedAt', pg_catalog.clock_timestamp(),
    'migrationPlanId', migration_plan_id, 'activationEvidence', evidence,
    'localeConfigHash', review_row.locale_config_hash,
    'jobId', null, 'eventType', 'cms.schema.activated.v1'
  ));
  perform platform_private.cms_complete(reservation.id, candidate.id, 202, response);
  return response;
end;
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_create_schema_successor(p_request jsonb)
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
  source_row platform_private.cms_content_type_versions%rowtype;
  expected_version bigint;
  new_version_id uuid := extensions.gen_random_uuid();
  new_artifact_id uuid := extensions.gen_random_uuid();
  next_version_no integer;
  type_key text;
  response jsonb;
  supported_present boolean;
  chains_present boolean;
  locale_issues jsonb;
  new_supported jsonb;
  new_chains jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  perform platform_private.cms_require_capability(actor_id, acting_party_id, 'cms.schema_designer');
  correlation_id := platform_private.cms_correlation(p_request);
  reservation := platform_private.cms_reserve_conflict(
    p_request, actor_id, 'CMS-03A-09');
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    return platform_private.cms_type_version_resource((reservation.response_ref->>'resourceRef')::uuid);
  end if;
  if not platform_private.cms_exact_keys(
    p_request,
    array['contentTypeId','versionId','expectedVersion']::text[],
    array['contentTypeId','versionId','expectedVersion','supportedLocales','fallbackChains',
          'idempotencyKey','ifMatch','context','correlationId']::text[]
  ) or not platform_private.cms_valid_uuid(p_request->>'contentTypeId')
     or not platform_private.cms_valid_uuid(p_request->>'versionId') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  expected_version := platform_private.cms_expected_version(p_request);
  supported_present := coalesce(pg_catalog.jsonb_typeof(p_request->'supportedLocales'), 'null') <> 'null';
  chains_present := coalesce(pg_catalog.jsonb_typeof(p_request->'fallbackChains'), 'null') <> 'null';
  if supported_present <> chains_present then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001',
      detail = platform_private.cms_locale_violation_detail(pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'path', pg_catalog.jsonb_build_array('fallbackChains'),
          'message', 'supportedLocales and fallbackChains must be both null or both present')));
  end if;
  select * into source_row
    from platform_private.cms_content_type_versions version_row
   where version_row.id = (p_request->>'versionId')::uuid
     and version_row.content_type_id = (p_request->>'contentTypeId')::uuid
     and version_row.owner_id = acting_party_id
   for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform platform_private.cms_lock_activation_graph(source_row.id);
  if source_row.version <> expected_version then
    perform platform_private.cms_raise_version_mismatch(expected_version, source_row.version);
  end if;
  if source_row.state <> 'active'::platform_private.cms_definition_state
     or source_row.version <> expected_version then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  -- The locale configuration: both null clones the source; both present
  -- replaces it under the inherited, immutable source and default locale.
  if supported_present then
    if not platform_private.cms_locale_config_shape_valid(
         p_request->'supportedLocales', p_request->'fallbackChains') then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    locale_issues := platform_api.cms_validate_locale_config(
      source_row.source_locale, source_row.default_locale,
      p_request->'supportedLocales', p_request->'fallbackChains');
    if pg_catalog.jsonb_array_length(locale_issues) > 0 then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001',
        detail = platform_private.cms_locale_violation_detail(locale_issues);
    end if;
    new_supported := platform_private.cms_locale_sorted(p_request->'supportedLocales');
    new_chains := p_request->'fallbackChains';
  else
    new_supported := source_row.supported_locales;
    new_chains := source_row.fallback_chains;
  end if;
  -- One live successor draft per type: a draft, review or approved candidate
  -- of the same type already exists.
  if exists (
    select 1 from platform_private.cms_content_type_versions live
     where live.content_type_id = source_row.content_type_id
       and live.state in (
         'draft'::platform_private.cms_definition_state,
         'review'::platform_private.cms_definition_state,
         'approved'::platform_private.cms_definition_state
       )
  ) then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  select max(version_row.version_no) + 1 into next_version_no
    from platform_private.cms_content_type_versions version_row
   where version_row.content_type_id = source_row.content_type_id;
  select type_row.type_key into type_key
    from platform_private.cms_content_types type_row
   where type_row.id = source_row.content_type_id;
  insert into platform_private.cms_content_type_versions(
    id, owner_id, state, version, content_type_id, version_no, labels,
    workflow_key, workflow_version, source_locale, default_locale,
    supported_locales, fallback_chains, locale_config_hash,
    default_template_version_id, schema_artifact_id, definition_hash,
    compatibility, supersedes_id, dry_run_id, created_by
  ) values (
    new_version_id, source_row.owner_id, 'draft', 1, source_row.content_type_id,
    next_version_no, source_row.labels, source_row.workflow_key,
    source_row.workflow_version, source_row.source_locale, source_row.default_locale,
    new_supported, new_chains,
    platform_private.cms_locale_config_hash(
      source_row.source_locale, source_row.default_locale, new_supported, new_chains),
    source_row.default_template_version_id, new_artifact_id,
    pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
      'successor-placeholder:' || new_version_id::text, 'utf8'), 'sha256'), 'hex'),
    'unknown', source_row.id, null, actor_id
  );
  insert into platform_private.cms_schema_artifacts(
    id, owner_id, state, version, content_type_version_id, compiler_version,
    zod_contract_ref, editor_manifest, renderer_manifest, artifact_hash, compiled_at
  ) values (
    new_artifact_id, source_row.owner_id, 'compiled', 1, new_version_id, '1',
    platform_private.cms_artifact_contract_ref(type_key, next_version_no),
    '{"schema":{},"fields":[]}'::jsonb,
    '{"relations":[],"templateBindings":[],"capabilityBindings":[]}'::jsonb,
    pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
      'artifact-placeholder:' || new_artifact_id::text, 'utf8'), 'sha256'), 'hex'),
    pg_catalog.clock_timestamp()
  );
  -- Fields and their relations are cloned in one statement so each relation is
  -- remapped to its own new field row while stable ids and keys are preserved.
  with source_fields as materialized (
    select field.*, extensions.gen_random_uuid() as clone_id
      from platform_private.cms_field_definition_versions field
     where field.content_type_version_id = source_row.id
  ), cloned_fields as (
    insert into platform_private.cms_field_definition_versions(
      id, owner_id, state, version, content_type_version_id, stable_field_id,
      field_key, kind, constraints, validator_key, validator_version, required,
      default_mode, default_value, localization_mode, editor_config, created_by
    )
    select source_fields.clone_id, source_fields.owner_id, source_fields.state, 1,
           new_version_id, source_fields.stable_field_id, source_fields.field_key,
           source_fields.kind, source_fields.constraints, source_fields.validator_key,
           source_fields.validator_version, source_fields.required,
           source_fields.default_mode, source_fields.default_value,
           source_fields.localization_mode, source_fields.editor_config, actor_id
      from source_fields
    returning id
  )
  insert into platform_private.cms_relation_definitions(
    owner_id, state, version, field_definition_id, target_kind, target_type,
    projection_key, cardinality, min_count, max_count, ordered, on_unavailable, created_by
  )
  select relation.owner_id, 'draft', 1, source_fields.clone_id, relation.target_kind,
         relation.target_type, relation.projection_key, relation.cardinality,
         relation.min_count, relation.max_count, relation.ordered,
         relation.on_unavailable, actor_id
    from platform_private.cms_relation_definitions relation
    join source_fields on source_fields.id = relation.field_definition_id
   where (select count(*) from cloned_fields) >= 0;
  insert into platform_private.cms_content_type_template_bindings(
    owner_id, state, version, content_type_version_id, template_version_id, position
  )
  select binding.owner_id, 'draft', 1, new_version_id, binding.template_version_id, binding.position
    from platform_private.cms_content_type_template_bindings binding
   where binding.content_type_version_id = source_row.id;
  insert into platform_private.cms_content_type_capability_bindings(
    owner_id, state, version, content_type_version_id, capability_key, capability_version
  )
  select binding.owner_id, 'draft', 1, new_version_id, binding.capability_key, binding.capability_version
    from platform_private.cms_content_type_capability_bindings binding
   where binding.content_type_version_id = source_row.id;
  perform platform_private.cms_compile_candidate(new_version_id);
  perform platform_private.cms_emit_event(
    'cms.schema.successor.create', actor_id, acting_party_id, 'cms_content_type_version',
    new_version_id, 'CMS_SCHEMA_SUCCESSOR_CREATED', 'cms.schema.draft.created.v1',
    'cms_content_type_version', new_version_id, 1,
    jsonb_build_object(
      'contentTypeId', source_row.content_type_id, 'schemaVersionId', new_version_id,
      'typeKey', type_key, 'version', next_version_no::text,
      'supersedesVersionId', source_row.id
    ), correlation_id
  );
  response := platform_private.cms_type_version_resource(new_version_id);
  perform platform_private.cms_complete(reservation.id, new_version_id, 201, response);
  return response;
end;
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_start_schema_dry_run(p_request jsonb)
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
  candidate platform_private.cms_content_type_versions%rowtype;
  source_version platform_private.cms_content_type_versions%rowtype;
  artifact_row platform_private.cms_schema_artifacts%rowtype;
  expected_version bigint;
  request_key text;
  request_version bigint;
  classification text;
  source_hash text;
  target_hash text;
  transform_hash text;
  attempt integer;
  report_id uuid := extensions.gen_random_uuid();
  plan_id uuid := extensions.gen_random_uuid();
  job_id uuid := extensions.gen_random_uuid();
  event_id uuid := extensions.gen_random_uuid();
  plan_report jsonb;
  source_total bigint;
  superseded record;
  frozen_plan platform_private.cms_schema_migration_plans%rowtype;
  completed_plan platform_private.cms_schema_migration_plans%rowtype;
  response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  perform platform_private.cms_require_capability(actor_id, acting_party_id, 'cms.schema_designer');
  correlation_id := platform_private.cms_correlation(p_request);
  reservation := platform_private.cms_reserve_conflict(
    p_request, actor_id, 'CMS-03A-10:' || coalesce(p_request->>'versionId', ''));
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    return platform_private.cms_schema_dry_run_resource((reservation.response_ref->>'resourceRef')::uuid);
  end if;
  if not platform_private.cms_exact_keys(
    p_request,
    array['contentTypeId','versionId','expectedVersion','transformKey','transformVersion']::text[],
    array['contentTypeId','versionId','expectedVersion','transformKey','transformVersion',
          'idempotencyKey','ifMatch','context','correlationId']::text[]
  ) or not platform_private.cms_valid_uuid(p_request->>'contentTypeId')
     or not platform_private.cms_valid_uuid(p_request->>'versionId') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  expected_version := platform_private.cms_expected_version(p_request);
  if pg_catalog.jsonb_typeof(p_request->'transformKey') not in ('string', 'null')
     or pg_catalog.jsonb_typeof(p_request->'transformVersion') not in ('string', 'null')
     or (pg_catalog.jsonb_typeof(p_request->'transformKey') = 'null')
        <> (pg_catalog.jsonb_typeof(p_request->'transformVersion') = 'null') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if pg_catalog.jsonb_typeof(p_request->'transformKey') = 'string' then
    request_key := p_request->>'transformKey';
    if request_key !~ '^[a-z][a-z0-9._-]{0,127}$'
       or not platform_private.cms_valid_version(p_request->>'transformVersion') then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    request_version := (p_request->>'transformVersion')::bigint;
  end if;
  select * into candidate
    from platform_private.cms_content_type_versions version_row
   where version_row.id = (p_request->>'versionId')::uuid
     and version_row.content_type_id = (p_request->>'contentTypeId')::uuid
     and version_row.owner_id = acting_party_id
   for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform platform_private.cms_lock_activation_graph(candidate.id);
  if candidate.version <> expected_version then
    perform platform_private.cms_raise_version_mismatch(expected_version, candidate.version);
  end if;
  if candidate.state in (
    'review'::platform_private.cms_definition_state,
    'approved'::platform_private.cms_definition_state
  ) then
    -- Drift recovery: a frozen candidate may start a new attempt only when the
    -- source its live scan evidence rests on has since changed.
    select plan.* into frozen_plan
      from platform_private.cms_schema_dry_run_reports report
      join platform_private.cms_schema_migration_plans plan on plan.id = report.plan_id
     where report.id = candidate.dry_run_id;
    if not found
       or frozen_plan.superseded_at is not null
       or platform_private.cms_migration_source_unchanged(frozen_plan) then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    perform platform_private.cms_invalidate_activation_reviews(candidate.id);
    select * into candidate from platform_private.cms_content_type_versions
     where id = candidate.id;
    expected_version := candidate.version;
  end if;
  if candidate.state <> 'draft'::platform_private.cms_definition_state then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if candidate.supersedes_id is not null then
    select * into source_version
      from platform_private.cms_content_type_versions version_row
     where version_row.id = candidate.supersedes_id
       and version_row.content_type_id = candidate.content_type_id
       and version_row.owner_id = candidate.owner_id
     for update;
    if not found then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    if source_version.state <> 'active'::platform_private.cms_definition_state then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
  end if;
  perform platform_private.cms_compile_candidate(candidate.id);
  select * into candidate from platform_private.cms_content_type_versions where id = candidate.id;
  select * into artifact_row
    from platform_private.cms_schema_artifacts artifact
   where artifact.id = candidate.schema_artifact_id
     and artifact.content_type_version_id = candidate.id
     and artifact.state = 'compiled';
  if not found or artifact_row.artifact_hash is distinct from candidate.definition_hash then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  classification := platform_private.cms_derive_schema_classification(source_version.id, candidate.id);
  if classification = 'additive' then
    if request_key is not null then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
  elsif request_key is null
        or not platform_private.cms_transform_registry_member_valid(request_key, request_version) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  source_total := platform_private.cms_schema_source_row_count(source_version.id, candidate.id);
  source_hash := coalesce(source_version.definition_hash, pg_catalog.repeat('0', 64));
  target_hash := candidate.definition_hash;
  transform_hash := platform_private.cms_migration_transform_hash(
    classification, request_key, request_version, source_hash, target_hash,
    artifact_row.artifact_hash, artifact_row.compiler_version);
  select coalesce(max(report.attempt_no), 0) + 1 into attempt
    from platform_private.cms_schema_dry_run_reports report
   where report.target_version_id = candidate.id;
  -- Earlier live attempts of this pair are retained but superseded; an
  -- attempt whose backfill already completed is immutable evidence.
  for superseded in
    select plan.id, plan.state from platform_private.cms_schema_migration_plans plan
     where plan.to_version_id = candidate.id
       and plan.from_version_id is not distinct from source_version.id
       and plan.superseded_at is null
     order by plan.created_at, plan.id
     for update
  loop
    -- A completed attempt is immutable evidence of the exact attempt it
    -- recorded.  It stands (the request is refused: there is nothing new to
    -- prove) only while EVERY persisted fingerprint still matches the freshly
    -- computed one: the scanned source rows and source hash, the target
    -- definition, the compiler and artifact identity, the classification and
    -- the registered transform pair with its hash.  Any difference (rows
    -- created after the scan, a target edit, a different transform) makes the
    -- sealed evidence describe a different migration, so it is superseded and a
    -- fresh attempt is created rather than stranding the candidate behind it.
    -- BE03a "Canonical records and fields": an earlier plan that has reached
    -- running, verifying or failed_retryable is a worker-owned attempt; a new
    -- attempt never supersedes it (409 CONFLICT) while the scanned source is
    -- unchanged.  A drifted source is the one recovery (BE03a "Source drift"):
    -- the in-flight evidence no longer describes the migration and is superseded.
    if superseded.state in ('running', 'verifying', 'failed_retryable') then
      select * into completed_plan
        from platform_private.cms_schema_migration_plans old_plan
       where old_plan.id = superseded.id;
      if platform_private.cms_migration_source_unchanged(completed_plan) then
        raise exception 'CONFLICT' using errcode = 'P0001';
      end if;
    end if;
    if superseded.state = 'completed' then
      select * into completed_plan
        from platform_private.cms_schema_migration_plans old_plan
       where old_plan.id = superseded.id;
      if platform_private.cms_migration_source_unchanged(completed_plan)
         and completed_plan.source_count is not distinct from source_total
         and completed_plan.classification is not distinct from classification
         and completed_plan.transform_key is not distinct from request_key
         and completed_plan.transform_version is not distinct from request_version
         and completed_plan.dry_run_report->>'sourceHash' is not distinct from source_hash
         and completed_plan.dry_run_report->>'targetHash' is not distinct from target_hash
         and completed_plan.dry_run_report->>'compilerHash' is not distinct from artifact_row.artifact_hash
         and completed_plan.dry_run_report->>'compilerVersion' is not distinct from artifact_row.compiler_version
         and completed_plan.dry_run_report->>'transformHash' is not distinct from transform_hash then
        raise exception 'CONFLICT' using errcode = 'P0001';
      end if;
    end if;
    update platform_private.cms_schema_migration_plans plan
       set superseded_at = pg_catalog.clock_timestamp(),
           updated_at = pg_catalog.clock_timestamp(),
           version = plan.version + 1
     where plan.id = superseded.id;
    update platform_private.cms_schema_dry_run_reports report
       set state = 'failed', failure_code = 'ATTEMPT_SUPERSEDED',
           version = report.version + 1, updated_at = pg_catalog.clock_timestamp()
     where report.plan_id = superseded.id and report.state in ('queued', 'running');
  end loop;
  plan_report := pg_catalog.jsonb_build_object(
    'dryRunId', report_id,
    'result', 'pass',
    'sourceHash', source_hash,
    'targetHash', target_hash,
    'compilerHash', artifact_row.artifact_hash,
    'compilerVersion', artifact_row.compiler_version,
    'transformHash', transform_hash,
    'sourceCount', source_total::text, 'targetCount', '0', 'rowErrorCount', '0',
    'migratedCount', '0', 'failedCount', '0'
  ) || case when request_key is null then '{}'::jsonb
            else pg_catalog.jsonb_build_object(
              'transformKey', request_key, 'transformVersion', request_version::text) end;
  insert into platform_private.cms_schema_migration_plans(
    id, owner_id, state, version, content_type_id, from_version_id, to_version_id,
    classification, transform_key, transform_version, dry_run_report, created_by,
    source_count
  ) values (
    plan_id, candidate.owner_id, 'draft', 1, candidate.content_type_id, source_version.id,
    candidate.id, classification, request_key, request_version, plan_report, actor_id,
    source_total
  );
  -- A transform plan over affected rows must name exactly one target field the
  -- registered member accepts; the same proof the scan repeats row by row.
  if request_key is not null and source_total > 0 then
    perform platform_private.cms_migration_scan_preflight(plan_id);
  end if;
  select accepted.job_id into job_id
    from platform_private.accept_job_with_outbox(
      actor_id, acting_party_id, 'cms.schema.dry_run', correlation_id,
      extensions.digest(pg_catalog.convert_to('cms.schema.dry_run:' || report_id::text, 'utf8'), 'sha256'),
      extensions.digest(pg_catalog.convert_to('cms.schema.dry_run:' || plan_id::text, 'utf8'), 'sha256'),
      pg_catalog.clock_timestamp() + interval '30 days', job_id, event_id
    ) accepted;
  insert into platform_private.cms_schema_dry_run_reports(
    id, owner_id, content_type_id, source_version_id, target_version_id, classification,
    transform_key, transform_version, compiler_version, created_by, attempt_no, state,
    job_id, plan_id
  ) values (
    report_id, candidate.owner_id, candidate.content_type_id, source_version.id, candidate.id,
    classification, request_key, request_version, artifact_row.compiler_version, actor_id,
    attempt, 'queued', job_id, plan_id
  );
  update platform_private.cms_content_type_versions version_row
     set dry_run_id = report_id,
         compatibility = classification,
         version = version_row.version + 1,
         updated_at = pg_catalog.clock_timestamp()
   where version_row.id = candidate.id and version_row.version = expected_version;
  if not found then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  perform platform_private.cms_emit_event(
    'cms.schema.dry_run.start', actor_id, acting_party_id, 'cms_schema_dry_run', report_id,
    'CMS_SCHEMA_DRY_RUN_STARTED', 'cms.schema.dry_run.requested.v1', 'cms_schema_dry_run',
    report_id, 1,
    pg_catalog.jsonb_build_object(
      'contentTypeId', candidate.content_type_id, 'schemaVersionId', candidate.id,
      'dryRunId', report_id, 'migrationPlanId', plan_id, 'jobId', job_id
    ), correlation_id
  );
  response := platform_private.cms_schema_dry_run_resource(report_id);
  perform platform_private.cms_complete(reservation.id, report_id, 202, response);
  return response;
end;
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_submit_schema_review(p_request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid;
  acting_party_id uuid;
  person_id uuid;
  correlation_id uuid;
  reservation platform_private.idempotency_records;
  candidate platform_private.cms_content_type_versions%rowtype;
  report_row platform_private.cms_schema_dry_run_reports%rowtype;
  artifact_row platform_private.cms_schema_artifacts%rowtype;
  plan_row platform_private.cms_schema_migration_plans%rowtype;
  binding record;
  policy jsonb;
  expected_version bigint;
  review_id uuid := extensions.gen_random_uuid();
  response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  perform platform_private.cms_require_capability(actor_id, acting_party_id, 'cms.schema_designer');
  correlation_id := platform_private.cms_correlation(p_request);
  reservation := platform_private.cms_reserve_conflict(
    p_request, actor_id, 'CMS-03A-11:' || coalesce(p_request->>'versionId', ''));
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  if not platform_private.cms_exact_keys(
    p_request,
    array['contentTypeId','versionId','expectedVersion','dryRunId']::text[],
    array['contentTypeId','versionId','expectedVersion','dryRunId',
          'idempotencyKey','ifMatch','context','correlationId']::text[]
  ) or not platform_private.cms_valid_uuid(p_request->>'contentTypeId')
     or not platform_private.cms_valid_uuid(p_request->>'versionId')
     or not platform_private.cms_valid_uuid(p_request->>'dryRunId') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  expected_version := platform_private.cms_expected_version(p_request);
  person_id := platform_private.identity_actor_person(actor_id);
  select * into binding from platform_private.cms_review_binding(
    p_request, actor_id, acting_party_id, false);
  select * into candidate
    from platform_private.cms_content_type_versions version_row
   where version_row.id = (p_request->>'versionId')::uuid
     and version_row.content_type_id = (p_request->>'contentTypeId')::uuid
     and version_row.owner_id = acting_party_id
   for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform platform_private.cms_lock_activation_graph(candidate.id);
  if candidate.version <> expected_version then
    perform platform_private.cms_raise_version_mismatch(expected_version, candidate.version);
  end if;
  if candidate.state <> 'draft'::platform_private.cms_definition_state
     or candidate.version <> expected_version then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  -- The evidence is exactly the candidate's own sealed, passed attempt.
  select * into report_row
    from platform_private.cms_schema_dry_run_reports report
   where report.id = (p_request->>'dryRunId')::uuid
     and report.target_version_id = candidate.id
     and report.owner_id = candidate.owner_id;
  if not found
     or candidate.dry_run_id is distinct from report_row.id
     or report_row.state <> 'completed'
     or report_row.result is distinct from 'pass'
     or report_row.row_error_count is distinct from 0
     or report_row.target_hash is distinct from candidate.definition_hash
     or report_row.classification is distinct from candidate.compatibility then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  select * into plan_row from platform_private.cms_schema_migration_plans plan
   where plan.id = report_row.plan_id;
  if not found or plan_row.superseded_at is not null
     or plan_row.state not in ('ready', 'completed') then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if not platform_private.cms_candidate_compiled_current(candidate.id) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  select * into artifact_row
    from platform_private.cms_schema_artifacts artifact
   where artifact.id = candidate.schema_artifact_id
     and artifact.content_type_version_id = candidate.id;
  if report_row.compiler_hash is distinct from artifact_row.artifact_hash
     or report_row.compiler_version is distinct from artifact_row.compiler_version then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from platform_private.cms_schema_reviews review
     where review.content_type_version_id = candidate.id
       and review.definition_hash = candidate.definition_hash
       and review.dry_run_id = report_row.id
       and review.state = 'open'
  ) then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  policy := platform_private.cms_resolve_review_policy(candidate.id);
  insert into platform_private.cms_schema_reviews(
    id, owner_id, state, version, content_type_id, content_type_version_id,
    candidate_version_no, definition_hash, schema_artifact_id, compiler_version,
    dependency_manifest_hash, dry_run_id, dry_run_report_hash, policy_key,
    policy_version, policy_hash, source_policy_key, source_policy_version,
    source_policy_hash, risk_class, required_decision_count, required_capabilities,
    context_hash, submitter_person_ref, locale_config_hash
  ) values (
    review_id, candidate.owner_id, 'open', 1, candidate.content_type_id, candidate.id,
    candidate.version_no, candidate.definition_hash, artifact_row.id,
    artifact_row.compiler_version,
    platform_private.cms_jcs_sha256(artifact_row.renderer_manifest), report_row.id,
    platform_private.cms_jcs_sha256(report_row.report),
    policy->>'policyKey', (policy->>'policyVersion')::bigint, policy->>'policyHash',
    policy->>'sourcePolicyKey', (policy->>'sourcePolicyVersion')::bigint,
    policy->>'sourcePolicyHash', policy->>'riskClass',
    (policy->>'requiredDecisionCount')::smallint, policy->'requiredCapabilities',
    platform_private.cms_review_context_hash(actor_id, person_id, acting_party_id, binding.binding_id),
    person_id, candidate.locale_config_hash
  );
  update platform_private.cms_content_type_versions version_row
     set state = 'review'::platform_private.cms_definition_state,
         version = version_row.version + 1,
         updated_at = pg_catalog.clock_timestamp()
   where version_row.id = candidate.id and version_row.version = expected_version;
  if not found then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  perform platform_private.cms_emit_event(
    'cms.schema.review.submit', actor_id, acting_party_id, 'cms_schema_review', review_id,
    'CMS_SCHEMA_REVIEW_SUBMITTED', 'cms.schema.review.submitted.v1', 'cms_schema_review',
    review_id, 1,
    pg_catalog.jsonb_build_object(
      'reviewId', review_id, 'contentTypeId', candidate.content_type_id,
      'schemaVersionId', candidate.id, 'dryRunId', report_row.id
    ), correlation_id
  );
  response := platform_private.cms_schema_review_resource(
    review_id, person_id, true, platform_private.cms_review_is_owner(actor_id, acting_party_id));
  perform platform_private.cms_complete(reservation.id, review_id, 201, response);
  return response;
end;
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_decide_schema_review(p_request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid;
  acting_party_id uuid;
  person_id uuid;
  correlation_id uuid;
  reservation platform_private.idempotency_records;
  review_row platform_private.cms_schema_reviews%rowtype;
  candidate platform_private.cms_content_type_versions%rowtype;
  assignment_row platform_private.cms_schema_review_assignments%rowtype;
  binding record;
  expected_version bigint;
  decision_value text;
  decision_id uuid := extensions.gen_random_uuid();
  decided_instant timestamptz := pg_catalog.clock_timestamp();
  recorded_count integer;
  approvers uuid[];
  missing_slots integer;
  approval_hash text;
  next_state text := 'open';
  response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  correlation_id := platform_private.cms_correlation(p_request);
  reservation := platform_private.cms_reserve_conflict(
    p_request, actor_id, 'CMS-03A-12:' || coalesce(p_request->>'reviewId', ''));
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  if not platform_private.cms_exact_keys(
    p_request,
    array['reviewId','expectedVersion','decision']::text[],
    array['reviewId','expectedVersion','decision','idempotencyKey','ifMatch','context','correlationId']::text[]
  ) or not platform_private.cms_valid_uuid(p_request->>'reviewId') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  expected_version := platform_private.cms_expected_version(p_request);
  decision_value := p_request->>'decision';
  if pg_catalog.jsonb_typeof(p_request->'decision') <> 'string'
     or decision_value not in ('approve', 'reject') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  person_id := platform_private.identity_actor_person(actor_id);
  select * into review_row from platform_private.cms_schema_reviews review
   where review.id = (p_request->>'reviewId')::uuid;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  -- Lock order matches edit invalidation and activation: candidate, then review.
  perform 1 from platform_private.cms_content_type_versions version_row
   where version_row.id = review_row.content_type_version_id for update;
  select * into review_row from platform_private.cms_schema_reviews review
   where review.id = review_row.id for update;
  -- Only an effective assignment authorizes a decision.  A caller to whom the
  -- review is readable (the owning party's schema designer or owner) but who
  -- holds no effective assignment is refused 403 FORBIDDEN; every caller to
  -- whom the review is not readable (another organization, an expired or
  -- revoked assignment, an unrelated human) is told the review does not exist.
  select * into assignment_row
    from platform_private.cms_schema_review_assignments assignment
   where assignment.review_id = review_row.id
     and assignment.owner_id = review_row.owner_id
     and assignment.reviewer_person_ref = person_id
     and platform_private.cms_review_assignment_effective(
       assignment.state, assignment.starts_at, assignment.ends_at)
   order by assignment.created_at desc, assignment.id desc
   limit 1;
  if not found then
    if platform_private.cms_review_scope(review_row.id, actor_id, acting_party_id) is null then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
    perform platform_private.cms_raise_forbidden('CAPABILITY_REQUIRED');
  end if;
  select * into binding from platform_private.cms_review_binding(
    p_request, actor_id, acting_party_id, true);
  if review_row.version <> expected_version then
    perform platform_private.cms_raise_version_mismatch(expected_version, review_row.version);
  end if;
  if review_row.version <> expected_version
     or review_row.state <> 'open'
     or review_row.submitter_person_ref = person_id
     or exists (
       select 1 from platform_private.cms_schema_review_decisions earlier
        where earlier.review_id = review_row.id and earlier.reviewer_person_ref = person_id
     )
     or not platform_private.cms_review_person_eligible(person_id) then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  select * into candidate from platform_private.cms_content_type_versions
   where id = review_row.content_type_version_id;
  perform platform_private.cms_lock_activation_graph(candidate.id);
  -- Frozen-evidence recheck: the candidate must still be exactly what was
  -- frozen into the review.
  if candidate.state <> 'review'::platform_private.cms_definition_state
     or candidate.definition_hash is distinct from review_row.definition_hash
     or candidate.schema_artifact_id is distinct from review_row.schema_artifact_id
     or candidate.dry_run_id is distinct from review_row.dry_run_id then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  select count(*)::integer into recorded_count
    from platform_private.cms_schema_review_decisions decision
   where decision.review_id = review_row.id;
  -- recordedDecisionCount never exceeds the policy requiredDecisionCount.
  if recorded_count >= review_row.required_decision_count then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if decision_value = 'approve' then
    -- An approval is refused when the decisions still unrecorded afterwards
    -- are fewer than the specialist slots no counted approver would hold.
    missing_slots := platform_private.cms_review_unsatisfied_slots(review_row.id, person_id);
    if review_row.required_decision_count - (recorded_count + 1) < missing_slots then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
  end if;
  insert into platform_private.cms_schema_review_decisions(
    id, owner_id, version, created_at, updated_at, review_id, assignment_id,
    assignment_version, reviewer_person_ref, binding_context_hash, capability_key,
    capability_version, decision, decided_at, reviewed_hash, mfa_verified_at
  ) values (
    decision_id, review_row.owner_id, 1, decided_instant, decided_instant, review_row.id,
    assignment_row.id, assignment_row.version, person_id,
    platform_private.cms_review_context_hash(actor_id, person_id, acting_party_id, binding.binding_id),
    'cms.schema_review', 1, decision_value, decided_instant, review_row.definition_hash,
    binding.mfa_verified_at
  );
  if decision_value = 'reject' then
    next_state := 'rejected';
  else
    approvers := platform_private.cms_review_qualifying_approvers(review_row.id);
    if pg_catalog.cardinality(approvers) = review_row.required_decision_count
       and platform_private.cms_review_unsatisfied_slots(review_row.id, null) = 0 then
      next_state := 'approved';
    end if;
  end if;
  if next_state = 'approved' then
    approval_hash := platform_private.cms_schema_review_approval_digest(review_row.id);
    update platform_private.cms_schema_reviews review
       set state = 'approved', decided_at = decided_instant,
           approval_evidence_hash = approval_hash,
           version = review.version + 1, updated_at = decided_instant
     where review.id = review_row.id;
    update platform_private.cms_content_type_versions version_row
       set state = 'approved'::platform_private.cms_definition_state,
           version = version_row.version + 1,
           updated_at = decided_instant,
           approved_at = decided_instant,
           activation_workflow_policy_key = review_row.policy_key,
           activation_workflow_policy_version = review_row.policy_version,
           activation_workflow_policy_hash = review_row.policy_hash,
           activation_required_decision_count = review_row.required_decision_count,
           activation_required_capabilities = review_row.required_capabilities,
           activation_approval_evidence_hash = approval_hash
     where version_row.id = candidate.id;
  elsif next_state = 'rejected' then
    update platform_private.cms_schema_reviews review
       set state = 'rejected', version = review.version + 1, updated_at = decided_instant
     where review.id = review_row.id;
    update platform_private.cms_content_type_versions version_row
       set state = 'draft'::platform_private.cms_definition_state,
           version = version_row.version + 1,
           updated_at = decided_instant
     where version_row.id = candidate.id;
  else
    update platform_private.cms_schema_reviews review
       set version = review.version + 1, updated_at = decided_instant
     where review.id = review_row.id;
  end if;
  perform platform_private.cms_emit_event(
    'cms.schema.review.decide', actor_id, acting_party_id, 'cms_schema_review_decision',
    decision_id, 'CMS_SCHEMA_REVIEW_DECIDED', 'cms.schema.review.decided.v1',
    'cms_schema_review', review_row.id, review_row.version + 1,
    pg_catalog.jsonb_build_object(
      'reviewId', review_row.id, 'decisionId', decision_id, 'schemaVersionId', candidate.id,
      'decision', decision_value, 'state', next_state
    ), correlation_id
  );
  response := platform_private.cms_schema_review_decision_resource(decision_id);
  perform platform_private.cms_complete(reservation.id, decision_id, 201, response);
  return response;
end;
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_assign_schema_review(p_request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid;
  acting_party_id uuid;
  person_id uuid;
  correlation_id uuid;
  reservation platform_private.idempotency_records;
  review_row platform_private.cms_schema_reviews%rowtype;
  assignment_row platform_private.cms_schema_review_assignments%rowtype;
  action text;
  expected_version bigint;
  reviewer_person uuid;
  starts timestamptz := pg_catalog.clock_timestamp();
  ends timestamptz;
  authority_end timestamptz;
  assignment_id uuid;
  reason_text text;
  response jsonb;
  status_code integer;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  correlation_id := platform_private.cms_correlation(p_request);
  reservation := platform_private.cms_reserve_conflict(
    p_request, actor_id, 'CMS-03A-14:' || coalesce(p_request->>'reviewId', ''));
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  action := p_request->>'action';
  if action = 'create' then
    if not platform_private.cms_exact_keys(
      p_request,
      array['reviewId','action','expectedVersion','reviewerPersonId','expiresAt']::text[],
      array['reviewId','action','expectedVersion','reviewerPersonId','expiresAt','reason',
            'idempotencyKey','ifMatch','context','correlationId']::text[]
    ) then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
  elsif action = 'revoke' then
    if not platform_private.cms_exact_keys(
      p_request,
      array['reviewId','action','expectedVersion','assignmentId']::text[],
      array['reviewId','action','expectedVersion','assignmentId','reason',
            'idempotencyKey','ifMatch','context','correlationId']::text[]
    ) then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
  else
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if not platform_private.cms_valid_uuid(p_request->>'reviewId') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  expected_version := platform_private.cms_expected_version(p_request);
  if p_request ? 'reason' then
    reason_text := p_request->>'reason';
    if pg_catalog.jsonb_typeof(p_request->'reason') <> 'string'
       or pg_catalog.octet_length(reason_text) not between 1 and 256 then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
  end if;
  person_id := platform_private.identity_actor_person(actor_id);
  -- Concealment first: a review outside the caller's designer or assigned
  -- scope is indistinguishable from an absent one.
  select * into review_row from platform_private.cms_schema_reviews review
   where review.id = (p_request->>'reviewId')::uuid for update;
  if not found
     or platform_private.cms_review_scope(review_row.id, actor_id, acting_party_id) is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  authority_end := platform_private.cms_review_owner_authority_end(actor_id, acting_party_id);
  perform platform_private.cms_review_binding(p_request, actor_id, acting_party_id, true);
  if review_row.version <> expected_version then
    perform platform_private.cms_raise_version_mismatch(expected_version, review_row.version);
  end if;
  if review_row.version <> expected_version or review_row.state <> 'open' then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if action = 'create' then
    if not platform_private.cms_valid_uuid(p_request->>'reviewerPersonId')
       or pg_catalog.jsonb_typeof(p_request->'expiresAt') <> 'string'
       or p_request->>'expiresAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$' then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    begin
      ends := (p_request->>'expiresAt')::timestamptz;
    exception when others then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end;
    reviewer_person := (p_request->>'reviewerPersonId')::uuid;
    if reviewer_person = review_row.submitter_person_ref
       or not platform_private.cms_review_person_eligible(reviewer_person)
       or not coalesce((
         -- The reviewer's current binding is their most recently selected one.
         select reviewer_binding.state = 'active' and reviewer_binding.expires_at > starts
           from platform_private.acting_context_binding reviewer_binding
          where reviewer_binding.person_id = reviewer_person
          order by reviewer_binding.selected_at desc, reviewer_binding.id desc
          limit 1
       ), false)
       or ends <= starts
       or ends > starts + interval '7 days'
       or ends > authority_end
       or exists (
         select 1 from platform_private.cms_schema_review_decisions decision
          where decision.review_id = review_row.id
            and decision.reviewer_person_ref = reviewer_person
       )
       or exists (
         select 1 from platform_private.cms_schema_review_assignments existing
          where existing.review_id = review_row.id
            and existing.reviewer_person_ref = reviewer_person
            and platform_private.cms_review_assignment_effective(
              existing.state, existing.starts_at, existing.ends_at)
       ) then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    assignment_id := extensions.gen_random_uuid();
    insert into platform_private.cms_schema_review_assignments(
      id, owner_id, review_id, reviewer_person_ref, grantor_person_ref, capability_key,
      actions, state, starts_at, ends_at, reason, created_at, updated_at, version
    ) values (
      assignment_id, review_row.owner_id, review_row.id, reviewer_person, person_id,
      'cms.schema_review', array['read', 'decide']::text[], 'active', starts, ends,
      reason_text, starts, starts, 1
    );
    status_code := 201;
  else
    if not platform_private.cms_valid_uuid(p_request->>'assignmentId') then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    select * into assignment_row from platform_private.cms_schema_review_assignments existing
     where existing.id = (p_request->>'assignmentId')::uuid
       and existing.review_id = review_row.id
       and existing.state = 'active'
     for update;
    if not found then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    assignment_id := assignment_row.id;
    update platform_private.cms_schema_review_assignments existing
       set state = 'revoked',
           reason = coalesce(reason_text, existing.reason),
           version = existing.version + 1,
           updated_at = pg_catalog.clock_timestamp()
     where existing.id = assignment_id;
    status_code := 200;
  end if;
  perform platform_private.cms_emit_event(
    'cms.schema.review.assignment.' || action, actor_id, acting_party_id,
    'cms_schema_review_assignment', assignment_id, 'CMS_SCHEMA_REVIEW_ASSIGNMENT_CHANGED',
    'cms.schema.review.assignment.changed.v1', 'cms_schema_review_assignment', assignment_id,
    (select assignment.version from platform_private.cms_schema_review_assignments assignment
      where assignment.id = assignment_id),
    pg_catalog.jsonb_build_object(
      'reviewId', review_row.id, 'assignmentId', assignment_id,
      'state', case when action = 'create' then 'active' else 'revoked' end
    ), correlation_id
  );
  response := platform_private.cms_schema_review_assignment_resource(assignment_id);
  perform platform_private.cms_complete(reservation.id, assignment_id, status_code, response);
  return response;
end;
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_renew_capability_grant(p_request jsonb)
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
  binding_id uuid;
  mfa_at timestamptz;
  expected_version bigint;
  through date;
  today date := platform_private.cms_grant_today();
  reason_text text;
  grant_row platform_private.cms_capability_grants%rowtype;
  response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  correlation_id := platform_private.cms_correlation(p_request);
  reservation := platform_private.cms_reserve_conflict(
    p_request, actor_id, 'CMS-03A-16:' || coalesce(p_request->>'grantId', ''));
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  if not platform_private.cms_exact_keys(
    p_request,
    array['grantId','expectedVersion','validThrough']::text[],
    array['grantId','expectedVersion','validThrough','reason',
          'idempotencyKey','ifMatch','context','correlationId']::text[]
  ) or not platform_private.cms_valid_uuid(p_request->>'grantId') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  expected_version := platform_private.cms_expected_version(p_request);
  perform platform_private.cms_grant_owner(actor_id, acting_party_id);
  select binding.binding_id, binding.mfa_verified_at into binding_id, mfa_at
    from platform_private.cms_review_binding(p_request, actor_id, acting_party_id, true) binding;
  through := platform_private.cms_grant_valid_through(p_request->'validThrough');
  reason_text := platform_private.cms_grant_reason(p_request);
  select * into grant_row
    from platform_private.cms_capability_grants existing
   where existing.id = (p_request->>'grantId')::uuid
     and existing.owner_id = acting_party_id
   for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if grant_row.version <> expected_version then
    perform platform_private.cms_raise_version_mismatch(expected_version, grant_row.version);
  end if;
  if grant_row.state <> 'active' or grant_row.version <> expected_version then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  update platform_private.cms_capability_grants
     set version = grant_row.version + 1, updated_at = pg_catalog.clock_timestamp(),
         valid_from = today, valid_through = through, last_action = 'renewed',
         reason = coalesce(reason_text, grant_row.reason)
   where id = grant_row.id;
  perform platform_private.cms_capability_grant_project(
    acting_party_id, grant_row.subject_person_ref, grant_row.capability_code, today, through, true);
  perform platform_private.cms_capability_grant_record_event(
    grant_row.id, 'renewed', grant_row.valid_through, actor_id, acting_party_id, binding_id, mfa_at);
  perform platform_private.cms_emit_event(
    'cms.capability.grant.renewed', actor_id, acting_party_id, 'cms_capability_grant',
    grant_row.id, 'CMS_CAPABILITY_GRANT_CHANGED', 'cms.capability.grant.changed.v1',
    'cms_capability_grant', grant_row.id, grant_row.version + 1,
    pg_catalog.jsonb_build_object('grantId', grant_row.id, 'subjectPersonId', grant_row.subject_person_ref),
    correlation_id
  );
  response := platform_private.cms_capability_grant_resource(grant_row.id);
  perform platform_private.cms_complete(reservation.id, grant_row.id, 200, response);
  return response;
end;
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_revoke_capability_grant(p_request jsonb)
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
  binding_id uuid;
  mfa_at timestamptz;
  expected_version bigint;
  reason_text text;
  grant_row platform_private.cms_capability_grants%rowtype;
  response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  correlation_id := platform_private.cms_correlation(p_request);
  reservation := platform_private.cms_reserve_conflict(
    p_request, actor_id, 'CMS-03A-17:' || coalesce(p_request->>'grantId', ''));
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  if not platform_private.cms_exact_keys(
    p_request,
    array['grantId','expectedVersion']::text[],
    array['grantId','expectedVersion','reason','idempotencyKey','ifMatch','context','correlationId']::text[]
  ) or not platform_private.cms_valid_uuid(p_request->>'grantId') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  expected_version := platform_private.cms_expected_version(p_request);
  perform platform_private.cms_grant_owner(actor_id, acting_party_id);
  select binding.binding_id, binding.mfa_verified_at into binding_id, mfa_at
    from platform_private.cms_review_binding(p_request, actor_id, acting_party_id, true) binding;
  reason_text := platform_private.cms_grant_reason(p_request);
  select * into grant_row
    from platform_private.cms_capability_grants existing
   where existing.id = (p_request->>'grantId')::uuid
     and existing.owner_id = acting_party_id
   for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if grant_row.version <> expected_version then
    perform platform_private.cms_raise_version_mismatch(expected_version, grant_row.version);
  end if;
  if grant_row.state <> 'active' or grant_row.version <> expected_version then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  update platform_private.cms_capability_grants
     set state = 'revoked', version = grant_row.version + 1,
         updated_at = pg_catalog.clock_timestamp(), last_action = 'revoked',
         reason = coalesce(reason_text, grant_row.reason)
   where id = grant_row.id;
  perform platform_private.cms_capability_grant_project(
    acting_party_id, grant_row.subject_person_ref, grant_row.capability_code,
    grant_row.valid_from, grant_row.valid_through, false);
  perform platform_private.cms_capability_grant_record_event(
    grant_row.id, 'revoked', null, actor_id, acting_party_id, binding_id, mfa_at);
  perform platform_private.cms_emit_event(
    'cms.capability.grant.revoked', actor_id, acting_party_id, 'cms_capability_grant',
    grant_row.id, 'CMS_CAPABILITY_GRANT_CHANGED', 'cms.capability.grant.changed.v1',
    'cms_capability_grant', grant_row.id, grant_row.version + 1,
    pg_catalog.jsonb_build_object('grantId', grant_row.id, 'subjectPersonId', grant_row.subject_person_ref),
    correlation_id
  );
  response := platform_private.cms_capability_grant_resource(grant_row.id);
  perform platform_private.cms_complete(reservation.id, grant_row.id, 200, response);
  return response;
end;
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_advance_block_lifecycle(p_request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid;
  reservation platform_private.idempotency_records;
  correlation_id uuid;
  receipt_id uuid;
  release_receipt platform_private.cms_release_nonce_receipts%rowtype;
  block_row platform_private.cms_block_definition_versions%rowtype;
  current_lifecycle text := 'supported';
  event_id uuid;
  response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  perform platform_private.cms_require_release_worker();
  actor_id := platform_private.cms_release_actor(p_request);
  correlation_id := platform_private.cms_correlation(p_request);
  reservation := platform_private.cms_reserve(p_request, actor_id, 'CMS-03A-08:' || coalesce(p_request->>'blockDefinitionVersionId', ''));
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    return jsonb_build_object('resourceKind', 'block_definition_lifecycle_event', 'id', (reservation.response_ref->>'resourceRef')::uuid);
  end if;
  if not platform_private.cms_valid_uuid(p_request->>'blockDefinitionVersionId')
     or p_request->>'fromLifecycle' not in ('supported', 'deprecated')
     or p_request->>'toLifecycle' not in ('deprecated', 'withdrawn')
     or not platform_private.cms_valid_version(p_request->>'expectedVersion')
     or p_request->>'releaseDigest' !~ '^[a-f0-9]{64}$' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  receipt_id := platform_private.cms_release_nonce_claim(p_request, 'CMS-03A-08', actor_id);
  select * into release_receipt
  from platform_private.cms_release_nonce_receipts
  where id = receipt_id;
  select * into block_row from platform_private.cms_block_definition_versions
  where id = (p_request->>'blockDefinitionVersionId')::uuid
    and owner_id = actor_id
  for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  select to_lifecycle into current_lifecycle
  from platform_private.cms_block_definition_lifecycle_events
  where block_definition_version_id = block_row.id
  order by created_at desc, id desc limit 1;
  current_lifecycle := coalesce(current_lifecycle, 'supported');
  if block_row.version <> (p_request->>'expectedVersion')::bigint then
    perform platform_private.cms_raise_version_mismatch((p_request->>'expectedVersion')::bigint, block_row.version);
  end if;
  if current_lifecycle <> p_request->>'fromLifecycle'
     or block_row.version <> (p_request->>'expectedVersion')::bigint
     or block_row.release_digest <> p_request->>'releaseDigest' then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  insert into platform_private.cms_block_definition_lifecycle_events(
    owner_id, state, version, block_definition_version_id, block_key, block_version,
    from_lifecycle, to_lifecycle, release_digest, release_principal_id, release_key_id,
    release_raw_body_hash, release_signature_hash, release_nonce_hash, release_verified_at
  ) values (
    actor_id, 'recorded', 1, block_row.id, block_row.block_key, block_row.block_version,
    p_request->>'fromLifecycle', p_request->>'toLifecycle', block_row.release_digest, actor_id,
    release_receipt.release_key_id, release_receipt.raw_body_hash,
    release_receipt.signature_hash, release_receipt.nonce_hash, release_receipt.verified_at
  ) returning id into event_id;
  perform platform_private.cms_emit_event(
    'cms.block.lifecycle.advance', actor_id, actor_id, 'cms_block_definition_lifecycle_event', event_id,
    'CMS_BLOCK_LIFECYCLE_CHANGED', 'cms.block.lifecycle.changed.v1', 'cms_block_definition_version',
    block_row.id, block_row.version,
    jsonb_build_object(
      'blockDefinitionVersionId', block_row.id, 'blockKey', block_row.block_key,
      'blockVersion', block_row.block_version, 'fromLifecycle', p_request->>'fromLifecycle',
      'toLifecycle', p_request->>'toLifecycle', 'releaseDigest', block_row.release_digest,
      'releaseKeyId', release_receipt.release_key_id,
      'releaseRawBodyHash', release_receipt.raw_body_hash,
      'releaseSignatureHash', release_receipt.signature_hash,
      'releaseNonceHash', release_receipt.nonce_hash,
      'releaseVerifiedAt', release_receipt.verified_at
    ), correlation_id
  );
  update platform_private.cms_release_nonce_receipts set outcome = 'consumed', consumed_at = now(), updated_at = now() where id = receipt_id;
  select jsonb_build_object(
    'resourceKind', 'block_definition_lifecycle_event', 'id', event.id, 'version', event.version::text,
    'blockDefinitionVersionId', event.block_definition_version_id, 'blockKey', event.block_key,
    'blockVersion', event.block_version, 'fromLifecycle', event.from_lifecycle,
    'toLifecycle', event.to_lifecycle, 'lifecycle', event.to_lifecycle,
    'releaseDigest', event.release_digest, 'releaseKeyId', event.release_key_id,
    'releaseNonceHash', event.release_nonce_hash, 'releaseVerifiedAt', event.release_verified_at,
    'eventType', 'cms.block.lifecycle.changed.v1', 'createdAt', event.created_at
  ) into response from platform_private.cms_block_definition_lifecycle_events event where event.id = event_id;
  perform platform_private.cms_complete(reservation.id, event_id, 201, response);
  return response;
end;
$function$;

commit;
