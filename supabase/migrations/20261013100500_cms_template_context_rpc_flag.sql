-- Slice 12 FIX (BE03c cmsTemplateContextRead; P2-S12-AC-159, AC-161): the picker context sets the
-- RPC-context flag its reads need.
--
-- platform_private.cms_template_context selects from forced-RLS CMS tables through a definer-owned
-- function (SEC-2), whose policies admit a row only while app.cms_rpc = 'true'.  The read never set it,
-- so over the real API (a request starts without the flag) it listed no content type and no block for
-- a designer who owns some; the pgTAP suites missed it because their fixtures leave the flag set.  The
-- private function is replaced with the one added statement (everything else is the body of
-- 20260927320000) and platform_api.cms_template_context becomes the flag-restoring wrapper every other
-- CMS read has (20261003120410).  Language, volatility, SECURITY DEFINER, search_path, owner and ACL of
-- the private function, and everything but the language of the wrapper, are checked unchanged.
-- Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $before$
declare
  private_target regprocedure := pg_catalog.to_regprocedure('platform_private.cms_template_context(jsonb)');
  api_target regprocedure := pg_catalog.to_regprocedure('platform_api.cms_template_context(jsonb)');
begin
  if private_target is null or api_target is null then
    raise exception 'template context read is missing' using errcode = '55000';
  end if;
  perform pg_catalog.set_config('wejammin.fix_context_private_attrs', (
    select (pg_catalog.to_jsonb(proc) - 'prosrc')::text
      from pg_catalog.pg_proc proc where proc.oid = private_target), true);
  perform pg_catalog.set_config('wejammin.fix_context_api_attrs', (
    select ((pg_catalog.to_jsonb(proc) - 'prosrc') - 'prolang')::text
      from pg_catalog.pg_proc proc where proc.oid = api_target), true);
end;
$before$;

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
  -- SEC-2: the forced policies of the CMS tables admit a row only inside an RPC context.  A real
  -- request starts without the flag, so the read sets it (its platform_api wrapper restores it).
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
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
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  rpc_result := platform_private.cms_template_context(p_request);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

do $after$
declare
  private_target regprocedure := pg_catalog.to_regprocedure('platform_private.cms_template_context(jsonb)');
  api_target regprocedure := pg_catalog.to_regprocedure('platform_api.cms_template_context(jsonb)');
begin
  if (select (pg_catalog.to_jsonb(proc) - 'prosrc')::text
        from pg_catalog.pg_proc proc where proc.oid = private_target)
     is distinct from pg_catalog.current_setting('wejammin.fix_context_private_attrs', true)
     or (select ((pg_catalog.to_jsonb(proc) - 'prosrc') - 'prolang')::text
           from pg_catalog.pg_proc proc where proc.oid = api_target)
     is distinct from pg_catalog.current_setting('wejammin.fix_context_api_attrs', true) then
    raise exception 'template context read: owner, ACL, security, volatility or config changed'
      using errcode = '55000';
  end if;
end;
$after$;

commit;
