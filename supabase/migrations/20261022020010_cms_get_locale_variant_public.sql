-- Slice 12 lane dec205: the cmsLocaleVariantRead Worker transport wrapper (a safe read).  It delegates to
-- platform_private.cms_get_locale_variant(jsonb) and, like every CMS wrapper (20261003120410), remembers the RPC-context flag and
-- restores it before it returns.  SECURITY DEFINER owned by the CMS definer (SEC-2); EXECUTE for service_role only.  Forward-only.
begin;
set local lock_timeout = '5s';

create function platform_api.cms_get_locale_variant(p_request jsonb)
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
  rpc_result := platform_private.cms_get_locale_variant(p_request);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

comment on function platform_api.cms_get_locale_variant(jsonb) is
  'cmsLocaleVariantRead (GET /api/v1/cms/entries/{entryId}/locales/{locale}): the entry''s current locale variant or null with its stored values, field resolutions and the active fallback order. Safe read; executable by service_role only.';

grant create on schema platform_api to wejammin_cms_definer;
alter function platform_api.cms_get_locale_variant(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_api from wejammin_cms_definer;
revoke all on function platform_api.cms_get_locale_variant(jsonb) from public, anon, authenticated, service_role;
grant usage on schema platform_api to service_role;
grant execute on function platform_api.cms_get_locale_variant(jsonb) to service_role;

do $closure$
begin
  if not pg_catalog.has_function_privilege('wejammin_cms_definer',
       pg_catalog.to_regprocedure('platform_private.cms_get_locale_variant(jsonb)'), 'EXECUTE') then
    execute 'grant execute on function platform_private.cms_get_locale_variant(jsonb) to wejammin_cms_definer';
  end if;
end;
$closure$;

commit;
