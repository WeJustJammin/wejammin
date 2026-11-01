-- Slice 12 lane governed-a: the CMS-03C-10 Worker transport wrapper (a safe read: no lock-failure mapping is needed).  It
-- delegates to platform_private.cms_get_governed_review(jsonb); SECURITY DEFINER, owned by the CMS definer, EXECUTE granted to
-- service_role only, with the app.cms_rpc flag restored.  Forward-only.
begin;

create or replace function platform_api.cms_get_governed_review(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  rpc_result := platform_private.cms_get_governed_review(p_request);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

comment on function platform_api.cms_get_governed_review(jsonb) is
  'CMS-03C-10 (GET /api/v1/cms/governed-reviews/{reviewId}): reviewId -> GovernedReviewDetailResource. Safe read; executable by service_role only.';

grant create on schema platform_api to wejammin_cms_definer;
alter function platform_api.cms_get_governed_review(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_api from wejammin_cms_definer;
revoke all on function platform_api.cms_get_governed_review(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_get_governed_review(jsonb) to service_role;

commit;
