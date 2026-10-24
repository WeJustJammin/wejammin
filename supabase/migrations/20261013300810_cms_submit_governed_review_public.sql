-- Slice 12 lane s12_governed_red GREEN: the CMS-03C-06 Worker transport wrapper. It delegates to
-- platform_private.cms_submit_governed_review(jsonb) and carries the predecessor cms_submit_review
-- transport ACL (20261005017640): SECURITY DEFINER, owned by the CMS definer, EXECUTE granted to
-- service_role only (never public, anon or authenticated), with the residual lock-failure -> CONFLICT
-- mapping and the app.cms_rpc flag restored. Forward-only.

begin;

create or replace function platform_api.cms_submit_governed_review(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  begin
    rpc_result := platform_private.cms_submit_governed_review(p_request);
  exception
    -- BE03b lock order: a residual deadlock or lock failure is the typed retryable CONFLICT.
    when deadlock_detected or lock_not_available then
      raise exception 'CONFLICT' using errcode = 'P0001';
  end;
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

comment on function platform_api.cms_submit_governed_review(jsonb) is
  'CMS-03C-06 Worker transport: delegates to platform_private.cms_submit_governed_review; service_role only.';

grant create on schema platform_api to wejammin_cms_definer;
alter function platform_api.cms_submit_governed_review(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_api from wejammin_cms_definer;
revoke all on function platform_api.cms_submit_governed_review(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_submit_governed_review(jsonb) to service_role;

commit;

