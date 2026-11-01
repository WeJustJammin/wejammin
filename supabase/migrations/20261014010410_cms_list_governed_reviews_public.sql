-- Slice 12 lane governed-a: the CMS-03C-11 Worker transport wrapper (a safe read).  It delegates to the signed-cursor wrapper
-- platform_private.cms_list_governed_reviews_signed(jsonb); like the 03b CMS-03B-17 wrapper it stays with the migration owner (the
-- only role that may reach the Vault cursor helpers), EXECUTE granted to service_role only, with the app.cms_rpc flag restored.
-- Forward-only.
begin;

create or replace function platform_api.cms_list_governed_reviews(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  rpc_result := platform_private.cms_list_governed_reviews_signed(p_request);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

comment on function platform_api.cms_list_governed_reviews(jsonb) is
  'CMS-03C-11 (GET /api/v1/cms/governed-reviews): GovernedReviewQueueQuery -> GovernedReviewQueuePage over the caller''s assigned, submitted or owned governed reviews. Safe read; executable by service_role only.';

revoke all on function platform_api.cms_list_governed_reviews(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_list_governed_reviews(jsonb) to service_role;

commit;
