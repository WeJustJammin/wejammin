-- Slice 12 lane taxonomy-terms, CMS-03C-17 signed cursor and Worker transport (BE03c 179, DEC-140; P2-S12-AC-133, AC-134).
--   cms_list_taxonomy_selector_signed  requires the Vault history-signing key, verifies the signed context-bound cursor in constant time (domain
--                                      'cms-03c-17') and signs the next cursor; a structurally malformed envelope is INVALID_REQUEST, an
--                                      unverifiable, expired or foreign-bound one is CONFLICT
--   platform_api.cms_list_taxonomy_selector  EXECUTE granted to service_role only, the app.cms_rpc flag restored
-- Both stay with the migration owner (the only role that may reach the Vault cursor helpers).  Forward-only.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_list_taxonomy_selector_signed(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  payload_keys constant text[] := array['queryHash', 'lastTaxonomyKey', 'lastTermKey', 'expiresAt']::text[];
  signed_request jsonb := p_request;
begin
  if p_request is null or pg_catalog.jsonb_typeof(p_request) is distinct from 'object'
     or not platform_private.cms_exact_keys(
       p_request, array['typeKey', 'fieldKey', 'locale', 'context']::text[],
       array['typeKey', 'fieldKey', 'locale', 'cursor', 'limit', 'context', 'correlationId']::text[]) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  perform platform_private.cms_signed_cursor_require_key();
  if p_request ? 'cursor' and p_request->'cursor' <> 'null'::jsonb then
    signed_request := pg_catalog.jsonb_set(
      p_request, '{cursor}',
      pg_catalog.to_jsonb(platform_private.cms_signed_cursor_open('cms-03c-17', p_request->'cursor', payload_keys)), false);
  end if;
  return platform_private.cms_signed_cursor_seal_page(
    'cms-03c-17', platform_private.cms_list_taxonomy_selector(signed_request), payload_keys);
end;
$body$;

comment on function platform_private.cms_list_taxonomy_selector_signed(jsonb) is
  'CMS-03C-17 signed wrapper: requires the Vault history-signing key, verifies the signed context-bound cursor (domain cms-03c-17) and signs the next cursor. A malformed envelope is INVALID_REQUEST; an unverifiable, expired or foreign-bound one is CONFLICT. Private.';

create or replace function platform_api.cms_list_taxonomy_selector(p_request jsonb)
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
  rpc_result := platform_private.cms_list_taxonomy_selector_signed(p_request);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

comment on function platform_api.cms_list_taxonomy_selector(jsonb) is
  'CMS-03C-17 (GET /api/v1/cms/taxonomies/selector): TaxonomySelectorQuery -> TaxonomySelectorPage over the active terms of the owner''s active vocabularies for a content type and field. Safe read; executable by service_role only.';

revoke all on function platform_private.cms_list_taxonomy_selector_signed(jsonb) from public, anon, authenticated, service_role;
revoke all on function platform_api.cms_list_taxonomy_selector(jsonb) from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_list_taxonomy_selector(jsonb) to service_role;

commit;
