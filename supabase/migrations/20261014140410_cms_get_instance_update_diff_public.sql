-- Slice 12 lane pattern-updates: the CMS-03C-14 Worker transport wrapper (a safe read).  It delegates to
-- platform_private.cms_get_instance_update_diff(jsonb) and, like every CMS wrapper (20261003120410), remembers the RPC-context flag and
-- restores it before it returns.  SECURITY DEFINER owned by the CMS definer (SEC-2); EXECUTE for service_role only.  Forward-only.
begin;
set local lock_timeout = '5s';

create or replace function platform_api.cms_get_instance_update_diff(p_request jsonb)
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
  rpc_result := platform_private.cms_get_instance_update_diff(p_request);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

comment on function platform_api.cms_get_instance_update_diff(jsonb) is
  'CMS-03C-14 (GET /api/v1/cms/compositions/instances/{instanceId}/update-diff): the three-way diff of one pattern instance. Safe read; executable by service_role only.';

grant create on schema platform_api to wejammin_cms_definer;
alter function platform_api.cms_get_instance_update_diff(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_api from wejammin_cms_definer;
revoke all on function platform_api.cms_get_instance_update_diff(jsonb) from public, anon, authenticated, service_role;
grant usage on schema platform_api to service_role;
grant execute on function platform_api.cms_get_instance_update_diff(jsonb) to service_role;

commit;
