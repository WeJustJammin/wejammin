-- CMS-11 owner-scoped current definition for edit/reconciliation. Apply after
-- template authority and context; no table or existing RPC is modified.
-- Reversal (before dependent route deployment): drop the platform_api wrapper,
-- then the platform_private function with the same jsonb signature.
begin;

create function platform_private.cms_template_latest(p_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  actor_id uuid;
  acting_party_id uuid;
  latest_row platform_private.cms_template_versions%rowtype;
begin
  if not platform_private.cms_exact_keys(
    p_request, array['templateKey','context']::text[],
    array['templateKey','context']::text[]
  ) or coalesce(p_request->>'templateKey', '') !~ '^[a-z][a-z0-9-]{1,63}$'
     or pg_catalog.jsonb_typeof(p_request->'context') <> 'object' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;

  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  if not platform_private.cms_template_designer_authorized(
    actor_id, acting_party_id
  ) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select * into latest_row
    from platform_private.cms_template_versions candidate
   where candidate.template_key = p_request->>'templateKey'
     and candidate.owner_id = acting_party_id
   order by candidate.version desc
   limit 1;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  return pg_catalog.jsonb_build_object(
    'id', latest_row.id,
    'version', latest_row.version::text,
    'contentHash', latest_row.content_hash,
    'createdAt', platform_private.auth_iso_time(latest_row.created_at),
    'updatedAt', platform_private.auth_iso_time(latest_row.updated_at),
    'state', latest_row.state,
    'templateKey', latest_row.template_key,
    'templateVersion', latest_row.version,
    'compatibleTypeIds', latest_row.compatible_type_ids,
    'reservedRegions', latest_row.reserved_regions,
    'blockRegistryDigest', latest_row.block_registry_digest,
    'slots', latest_row.slots,
    'bindings', latest_row.bindings,
    'locale', latest_row.locale,
    'audience', latest_row.audience
  );
end;
$body$;

create function platform_api.cms_template_latest(p_request jsonb)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $body$
  select platform_private.cms_template_latest(p_request)
$body$;

revoke all on function platform_private.cms_template_latest(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_api.cms_template_latest(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_template_latest(jsonb)
  to service_role;

comment on function platform_api.cms_template_latest(jsonb) is
  'CMS-11 designer-scoped latest version; complete editable definition, no private authority fields.';

commit;
