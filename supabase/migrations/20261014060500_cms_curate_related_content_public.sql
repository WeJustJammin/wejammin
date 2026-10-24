-- Slice 12 lane related, the Worker transport of CMS-03C-05 (BE03c route row 163, Slice 12 lock order rule 4
-- 1357; tracker P2-S12-AC-059, AC-062, AC-261, AC-276):
--
--   platform_api.cms_curate_related_content(p_request jsonb) returns jsonb
--
-- Delegates to the private command and, like every CMS wrapper (20261003120410), remembers the RPC-context flag
-- and restores it before it returns.  The command runs in a nested block: `deadlock_detected` and a lock timeout
-- (`lock_not_available`) at a lock step become the retryable CONFLICT token the Worker maps to 409
-- RELATED_CONTENT_VERSION_CONFLICT; the block's sub-transaction is rolled back, so nothing of the command, its
-- idempotency reservation included, survives and the same Idempotency-Key may be retried.  SECURITY DEFINER owned
-- by the CMS definer (SEC-2); EXECUTE for service_role only.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create function platform_api.cms_curate_related_content(p_request jsonb)
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
  begin
    rpc_result := platform_private.cms_curate_related_content(p_request);
  exception
    when deadlock_detected or lock_not_available then
      raise exception 'CONFLICT' using errcode = 'P0001';
  end;
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

comment on function platform_api.cms_curate_related_content(jsonb) is
  'CMS-03C-05 Worker transport: delegates to platform_private.cms_curate_related_content, restores the RPC-context flag and converts a deadlock or lock timeout to the retryable CONFLICT token. service_role only.';

grant create on schema platform_private, platform_api to wejammin_cms_definer;
alter function platform_private.cms_curate_related_content(jsonb) owner to wejammin_cms_definer;
alter function platform_api.cms_curate_related_content(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private, platform_api from wejammin_cms_definer;
revoke all on function platform_private.cms_curate_related_content(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_api.cms_curate_related_content(jsonb)
  from public, anon, authenticated, service_role;
grant usage on schema platform_api to service_role;
grant execute on function platform_api.cms_curate_related_content(jsonb) to service_role;

commit;
