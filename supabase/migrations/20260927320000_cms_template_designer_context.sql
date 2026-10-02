-- CMS-11 protected, disclosure-safe picker context. No browser role may call
-- this RPC directly; the Worker derives actor and acting party from session.
begin;

create or replace function platform_private.cms_template_context(p_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  actor_id uuid;
  acting_party_id uuid;
  types jsonb;
  blocks jsonb;
begin
  if not platform_private.cms_exact_keys(
    p_request, array['context']::text[], array['context']::text[]
  ) or pg_catalog.jsonb_typeof(p_request->'context') <> 'object' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;

  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  if not platform_private.cms_template_designer_authorized(
    actor_id, acting_party_id
  ) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', selected.id,
    'typeKey', selected.type_key,
    'activeVersionId', selected.active_version_id,
    'activeVersion', selected.version_no,
    'sourceLocale', selected.source_locale
  ) order by selected.type_key collate "C", selected.id), '[]'::jsonb)
  into types
  from (
    select distinct on (content_type.id)
      content_type.id, content_type.type_key,
      version_row.id as active_version_id,
      version_row.version_no, version_row.source_locale
    from platform_private.cms_content_types content_type
    join platform_private.cms_content_type_versions version_row
      on version_row.content_type_id = content_type.id
     and version_row.owner_id = content_type.owner_id
    join platform_private.cms_schema_artifacts artifact
      on artifact.id = version_row.schema_artifact_id
     and artifact.content_type_version_id = version_row.id
     and artifact.state = 'compiled'
    where content_type.owner_id = acting_party_id
      and content_type.state = 'active'
      and version_row.state = 'active'
    order by content_type.id, version_row.version_no desc, version_row.id desc
    limit 64
  ) selected;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'blockKey', selected.block_key,
    'blockVersion', selected.block_version
  ) order by selected.block_key collate "C", selected.block_version), '[]'::jsonb)
  into blocks
  from (
    select block_row.block_key, block_row.block_version
    from platform_private.cms_block_definition_versions block_row
    where block_row.owner_id = acting_party_id
      and block_row.state = 'registered'
      and coalesce((
        select lifecycle_event.to_lifecycle
        from platform_private.cms_block_definition_lifecycle_events lifecycle_event
        where lifecycle_event.block_definition_version_id = block_row.id
        order by lifecycle_event.created_at desc, lifecycle_event.id desc
        limit 1
      ), 'supported') = 'supported'
    order by block_row.block_key collate "C", block_row.block_version
    limit 128
  ) selected;

  return pg_catalog.jsonb_build_object(
    'contentTypes', types,
    'registeredBlocks', blocks
  );
end;
$body$;

create or replace function platform_api.cms_template_context(p_request jsonb)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $body$
  select platform_private.cms_template_context(p_request)
$body$;

revoke all on function platform_private.cms_template_context(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_api.cms_template_context(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_template_context(jsonb)
  to service_role;

comment on function platform_api.cms_template_context(jsonb) is
  'CMS-11 protected designer picker context; caller scope and grant rechecked in private authority, no owner or renderer internals returned.';

commit;
