-- Slice 12 lane nestable-read: the cmsPatternNestableRead signed cursor and Worker transport (DEC-196; BE03c 184, 413; BE00 00-infrastructure 491;
-- the CMS-03C-13 precedent 20261014140310 and the cmsCompositionInstancesRead precedent 20261022050010; P2-S12-AC-105, AC-261).
--   cms_list_pattern_nestable_signed  requires the Vault history-signing key, verifies the signed context-bound cursor in constant time
--                                     (domain 'cms-03c-nestable', so a CMS-03C-13 cursor never opens here) and signs the next cursor.  A
--                                     structurally malformed envelope is INVALID_REQUEST; an unverifiable, forged or tampered one is the shared
--                                     helper's CONFLICT, which this read maps to INVALID_REQUEST: BE03c 184 answers every cursor fault of this
--                                     read 400.  An expired or cross-context cursor is judged by the reader (also INVALID_REQUEST).
--   platform_api.cms_list_pattern_nestable  the Worker transport: EXECUTE for service_role only, the app.cms_rpc flag restored
-- Both stay with the migration owner (the only role that may reach the Vault cursor helpers); the keyset reader (20261027100000) is the
-- definer-owned function that names the forced-RLS CMS tables.  Forward-only.
begin;
set local lock_timeout = '5s';

create function platform_private.cms_list_pattern_nestable_signed(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  v_keys constant text[] := array['queryHash', 'lastPatternKey', 'lastPatternVersion', 'expiresAt']::text[];
  v_request jsonb := p_request;
begin
  if p_request is null or pg_catalog.jsonb_typeof(p_request) is distinct from 'object'
     or not platform_private.cms_exact_keys(
       p_request, array['contentTypeId', 'context']::text[],
       array['contentTypeId', 'cursor', 'limit', 'context', 'correlationId']::text[]) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  perform platform_private.cms_signed_cursor_require_key();
  if p_request ? 'cursor' and p_request->'cursor' <> 'null'::jsonb then
    begin
      v_request := pg_catalog.jsonb_set(
        p_request, '{cursor}',
        pg_catalog.to_jsonb(platform_private.cms_signed_cursor_open('cms-03c-nestable', p_request->'cursor', v_keys)), false);
    exception when sqlstate 'P0001' then
      -- BE03c 184 and BE00 491: a tampered, forged or cross-context cursor of this read is 400, not the CMS-03C-13 409.
      if sqlerrm = 'CONFLICT' then
        raise exception 'INVALID_REQUEST' using errcode = 'P0001';
      end if;
      raise;
    end;
  end if;
  return platform_private.cms_signed_cursor_seal_page(
    'cms-03c-nestable', platform_private.cms_list_pattern_nestable(v_request), v_keys);
end;
$body$;

comment on function platform_private.cms_list_pattern_nestable_signed(jsonb) is
  'cmsPatternNestableRead signed wrapper: requires the Vault history-signing key, verifies the signed context-bound cursor in constant time (domain cms-03c-nestable) and signs the next cursor. Every cursor fault (malformed, tampered, forged, expired, cross-context) is INVALID_REQUEST (BE03c 184). Private.';

create function platform_api.cms_list_pattern_nestable(p_request jsonb)
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
  rpc_result := platform_private.cms_list_pattern_nestable_signed(p_request);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

comment on function platform_api.cms_list_pattern_nestable(jsonb) is
  'cmsPatternNestableRead (GET /api/v1/cms/patterns/nestable): PatternNestableQuery -> PatternSelectorPage over the active pattern versions of the owner party compatible with every requested content type, designer only. Safe read; executable by service_role only.';

revoke all on function platform_private.cms_list_pattern_nestable_signed(jsonb) from public, anon, authenticated, service_role;
revoke all on function platform_api.cms_list_pattern_nestable(jsonb) from public, anon, authenticated, service_role;
grant usage on schema platform_api to service_role;
grant execute on function platform_api.cms_list_pattern_nestable(jsonb) to service_role;

commit;
