-- Slice 12 lane dec206: the cmsCompositionInstancesRead signed cursor and Worker transport (DEC-206 as aligned to BE00 collection rules,
-- BE03c 182, 409; BE00 00-infrastructure.md:491; the CMS-03C-13 precedent 20261014140310).
--   cms_list_composition_instances_signed  requires the Vault history-signing key, verifies the signed context-bound cursor in constant time
--                                          (domain 'cms-03c-instances') and signs the next cursor.  A structurally malformed envelope is
--                                          INVALID_REQUEST; an unverifiable, forged, tampered or over-lived one is the shared helper's CONFLICT,
--                                          which this read maps to INVALID_REQUEST: BE03c 409 answers every cursor fault of this read 400
--                                          (no 409 exists in its error matrix).  An expired or cross-context cursor is judged by the reader.
--   platform_api.cms_list_composition_instances  the Worker transport: EXECUTE for service_role only, the app.cms_rpc flag restored
-- Both stay with the migration owner (the only role that may reach the Vault cursor helpers); the keyset reader (20261022050000) is the
-- definer-owned function that names the forced-RLS CMS tables.  Forward-only.
begin;
set local lock_timeout = '5s';

create function platform_private.cms_list_composition_instances_signed(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  v_keys constant text[] := array['queryHash', 'lastInstanceId', 'expiresAt']::text[];
  v_request jsonb := p_request;
begin
  if p_request is null or pg_catalog.jsonb_typeof(p_request) is distinct from 'object'
     or not platform_private.cms_exact_keys(
       p_request, array['entryId', 'context']::text[],
       array['entryId', 'cursor', 'limit', 'context', 'correlationId']::text[]) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  perform platform_private.cms_signed_cursor_require_key();
  if p_request ? 'cursor' and p_request->'cursor' <> 'null'::jsonb then
    begin
      v_request := pg_catalog.jsonb_set(
        p_request, '{cursor}',
        pg_catalog.to_jsonb(platform_private.cms_signed_cursor_open('cms-03c-instances', p_request->'cursor', v_keys)), false);
    exception when sqlstate 'P0001' then
      -- BE03c 409: a tampered, expired or cross-context cursor of this read is 400, not the sibling reads' 409.
      if sqlerrm = 'CONFLICT' then
        raise exception 'INVALID_REQUEST' using errcode = 'P0001';
      end if;
      raise;
    end;
  end if;
  return platform_private.cms_signed_cursor_seal_page(
    'cms-03c-instances', platform_private.cms_list_composition_instances(v_request), v_keys);
end;
$body$;

comment on function platform_private.cms_list_composition_instances_signed(jsonb) is
  'cmsCompositionInstancesRead signed wrapper: requires the Vault history-signing key, verifies the signed context-bound cursor in constant time (domain cms-03c-instances) and signs the next cursor. Every cursor fault (malformed, tampered, forged, expired, over-lived, cross-context) is INVALID_REQUEST (BE03c 409). Private.';

create function platform_api.cms_list_composition_instances(p_request jsonb)
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
  rpc_result := platform_private.cms_list_composition_instances_signed(p_request);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

comment on function platform_api.cms_list_composition_instances(jsonb) is
  'cmsCompositionInstancesRead (GET /api/v1/cms/entries/{entryId}/compositions): CompositionInstancesQuery -> CompositionInstancePage, a page of the entry''s current draft revision''s composition instances with a signed cursor. Safe read; executable by service_role only.';

revoke all on function platform_private.cms_list_composition_instances_signed(jsonb) from public, anon, authenticated, service_role;
revoke all on function platform_api.cms_list_composition_instances(jsonb) from public, anon, authenticated, service_role;
grant usage on schema platform_api to service_role;
grant execute on function platform_api.cms_list_composition_instances(jsonb) to service_role;

commit;
