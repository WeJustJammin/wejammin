-- Slice 12 FIX (BE03c lineage id; P2-S12-AC-166, AC-167, AC-191): the latest template read answers
-- the stable lineage id (templateId) the locked TemplateVersionDetail carries.
--
-- Replaces platform_private.cms_template_latest with two changes: the added member, and the RPC-context
-- flag the read never set (SEC-2 made the definer role subject to the forced CMS policies, so over the
-- real API the read found no row and answered NOT_FOUND for the caller's own template; the pgTAP
-- suites missed it because their fixtures leave the flag set).  The lookup already resolved the key
-- only within the caller's owner scope (a key another owner holds is the same NOT_FOUND as an unused
-- key).  platform_api.cms_template_latest becomes the flag-restoring wrapper every other CMS read has
-- (20261003120410).  Language, volatility, SECURITY DEFINER, search_path, owner and ACL of the private
-- function, and everything but the language of the wrapper, are checked unchanged.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $before$
declare
  target regprocedure := pg_catalog.to_regprocedure('platform_private.cms_template_latest(jsonb)');
begin
  if target is null then
    raise exception 'platform_private.cms_template_latest(jsonb) is missing' using errcode = '55000';
  end if;
  perform pg_catalog.set_config('wejammin.fix_latest_attrs', (
    select (pg_catalog.to_jsonb(proc) - 'prosrc')::text
      from pg_catalog.pg_proc proc where proc.oid = target), true);
end;
$before$;

create or replace function platform_private.cms_template_latest(p_request jsonb)
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
  -- SEC-2: the forced policies of the CMS tables admit a row only inside an RPC context.  A real
  -- request starts without the flag, so the read sets it (its platform_api wrapper restores it).
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
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
    'templateId', latest_row.template_id,
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

do $after$
declare
  target regprocedure := pg_catalog.to_regprocedure('platform_private.cms_template_latest(jsonb)');
begin
  if (select (pg_catalog.to_jsonb(proc) - 'prosrc')::text
        from pg_catalog.pg_proc proc where proc.oid = target)
     is distinct from pg_catalog.current_setting('wejammin.fix_latest_attrs', true) then
    raise exception 'platform_private.cms_template_latest(jsonb): owner, ACL, security, volatility or config changed'
      using errcode = '55000';
  end if;
end;
$after$;

do $wrapper_before$
declare
  target regprocedure := pg_catalog.to_regprocedure('platform_api.cms_template_latest(jsonb)');
begin
  if target is null then
    raise exception 'platform_api.cms_template_latest(jsonb) is missing' using errcode = '55000';
  end if;
  perform pg_catalog.set_config('wejammin.fix_latest_wrapper_attrs', (
    select ((pg_catalog.to_jsonb(proc) - 'prosrc') - 'prolang')::text
      from pg_catalog.pg_proc proc where proc.oid = target), true);
end;
$wrapper_before$;

create or replace function platform_api.cms_template_latest(p_request jsonb)
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
  rpc_result := platform_private.cms_template_latest(p_request);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

do $wrapper_after$
declare
  target regprocedure := pg_catalog.to_regprocedure('platform_api.cms_template_latest(jsonb)');
begin
  if (select ((pg_catalog.to_jsonb(proc) - 'prosrc') - 'prolang')::text
        from pg_catalog.pg_proc proc where proc.oid = target)
     is distinct from pg_catalog.current_setting('wejammin.fix_latest_wrapper_attrs', true) then
    raise exception 'platform_api.cms_template_latest: owner, ACL, security, volatility or config changed'
      using errcode = '55000';
  end if;
end;
$wrapper_after$;

commit;
