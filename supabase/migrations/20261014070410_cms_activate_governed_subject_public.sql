-- Slice 12 lane governed-b: the CMS-03C-09 Worker transport wrapper.  It delegates to platform_private.cms_activate_governed_subject(jsonb) and
-- carries the 03b wrapper ACL (20261005017630): SECURITY DEFINER, owned by the CMS definer, EXECUTE granted to service_role only (never
-- public, anon or authenticated), with the residual lock-failure -> CONFLICT mapping and the app.cms_rpc flag restored.  Forward-only.
begin;

create or replace function platform_api.cms_activate_governed_subject(p_request jsonb)
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
    rpc_result := platform_private.cms_activate_governed_subject(p_request);
  exception
    -- BE03c lock order (DEC-180): a residual deadlock or lock failure is the typed retryable CONFLICT.
    when deadlock_detected or lock_not_available then
      raise exception 'CONFLICT' using errcode = 'P0001';
  end;
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

comment on function platform_api.cms_activate_governed_subject(jsonb) is
  'CMS-03C-09 (POST /api/v1/cms/governed-reviews/{reviewId}/activation): GovernedActivationRequest -> GovernedActivationResource (200 activate, 202 schedule) or the committed refusal envelope. Executable by service_role only.';

grant create on schema platform_api to wejammin_cms_definer;
alter function platform_api.cms_activate_governed_subject(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_api from wejammin_cms_definer;
revoke all on function platform_api.cms_activate_governed_subject(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_activate_governed_subject(jsonb) to service_role;

commit;
