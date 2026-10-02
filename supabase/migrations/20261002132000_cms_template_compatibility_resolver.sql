-- BE03c DEC-108: the named, non-mutating, service-role-only template
-- compatibility resolver.  It resolves the exact template version, content
-- type and candidate content-type version under the server-verified owner
-- scope; absence and concealment are NOT_FOUND, a withdrawn definition is
-- WITHDRAWN, an incompatible one INCOMPATIBLE and an expected-version
-- mismatch VERSION_MISMATCH.  Success is the literal invariant
-- compatible:true / withdrawn:false.  Forward-only.
begin;

create or replace function platform_private.cms_resolve_template_compatibility(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  actor_id uuid;
  acting_party_id uuid;
  template_row platform_private.cms_template_versions%rowtype;
  version_row platform_private.cms_content_type_versions%rowtype;
  expected_template_version bigint;
begin
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  if not platform_private.cms_exact_keys(
    p_request,
    array['templateVersionId','contentTypeId','contentTypeVersionId']::text[],
    array['templateVersionId','contentTypeId','contentTypeVersionId',
          'expectedTemplateVersionNo','context','correlationId']::text[]
  ) or not platform_private.cms_valid_uuid(p_request->>'templateVersionId')
     or not platform_private.cms_valid_uuid(p_request->>'contentTypeId')
     or not platform_private.cms_valid_uuid(p_request->>'contentTypeVersionId')
     or (p_request ? 'expectedTemplateVersionNo'
         and not platform_private.cms_valid_version(p_request->>'expectedTemplateVersionNo')) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  select * into template_row
    from platform_private.cms_template_versions template
   where template.id = (p_request->>'templateVersionId')::uuid
     and template.owner_id = acting_party_id;
  select * into version_row
    from platform_private.cms_content_type_versions candidate
   where candidate.id = (p_request->>'contentTypeVersionId')::uuid
     and candidate.content_type_id = (p_request->>'contentTypeId')::uuid
     and candidate.owner_id = acting_party_id;
  if template_row.id is null or version_row.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if template_row.state in ('retired', 'blocked') then
    raise exception 'WITHDRAWN' using errcode = 'P0001';
  end if;
  if not platform_private.cms_template_binding_compatible(
    template_row.id, acting_party_id, version_row.content_type_id
  ) then
    raise exception 'INCOMPATIBLE' using errcode = 'P0001';
  end if;
  if p_request ? 'expectedTemplateVersionNo' then
    expected_template_version := (p_request->>'expectedTemplateVersionNo')::bigint;
    if template_row.version <> expected_template_version then
      raise exception 'VERSION_MISMATCH' using errcode = 'P0001';
    end if;
  end if;
  return pg_catalog.jsonb_build_object(
    'templateVersionId', template_row.id,
    'templateKey', template_row.template_key,
    'templateVersionNo', template_row.version::text,
    'state', template_row.state,
    'compatible', true,
    'withdrawn', false,
    'templateDigest', template_row.content_hash,
    'contentTypeId', version_row.content_type_id,
    'contentTypeVersionId', version_row.id
  );
end;
$body$;

create or replace function platform_api.cms_resolve_template_compatibility(p_request jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $body$
  select platform_private.cms_resolve_template_compatibility(p_request)
$body$;

revoke all on function platform_private.cms_resolve_template_compatibility(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_private.cms_resolve_template_compatibility(jsonb) to service_role;
revoke all on function platform_api.cms_resolve_template_compatibility(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_resolve_template_compatibility(jsonb) to service_role;

commit;
