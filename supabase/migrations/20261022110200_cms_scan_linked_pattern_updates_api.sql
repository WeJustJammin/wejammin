-- Slice 12 lane linked-scan (BE03c "Job transport (DEC-166, DEC-180 G9)", "Slice 12 lock order"; tracker P2-S12-AC-212, AC-213): the
-- Worker transport of the linked-update scan.
--
--   platform_api.cms_scan_linked_pattern_updates(request) returns { examined, appended, nextCursor }
--       Delegates to the private run and, like every CMS wrapper, remembers the RPC-context flag and restores it before it returns.  The
--       private run sets the flag itself, so the wrapper works for a caller that holds none (a PostgREST call).  A deadlock or a lock
--       failure at a lock step is the typed retryable CONFLICT token: the nested block's sub-transaction is rolled back, so nothing of
--       the run survives and the run may be retried whole (the run is idempotent).
-- SECURITY DEFINER owned by the CMS definer (SEC-2); EXECUTE for service_role only.  Forward-only.
begin;
set local lock_timeout = '5s';

create or replace function platform_api.cms_scan_linked_pattern_updates(p_request jsonb)
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
    rpc_result := platform_private.cms_scan_linked_pattern_updates(p_request);
  exception
    when deadlock_detected or lock_not_available then
      raise exception 'CONFLICT' using errcode = 'P0001';
  end;
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

comment on function platform_api.cms_scan_linked_pattern_updates(jsonb) is
  'Service-role wrapper of the linked-update scan job run (cms.pattern.linked_update_scan). Restores the RPC context; a deadlock or lock failure is CONFLICT.';

grant create on schema platform_api to wejammin_cms_definer;
alter function platform_api.cms_scan_linked_pattern_updates(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_api from wejammin_cms_definer;
revoke all on function platform_api.cms_scan_linked_pattern_updates(jsonb) from public, anon, authenticated, service_role;
grant usage on schema platform_api to service_role;
grant execute on function platform_api.cms_scan_linked_pattern_updates(jsonb) to service_role;

do $closure$
begin
  if not pg_catalog.has_function_privilege('wejammin_cms_definer',
       pg_catalog.to_regprocedure('platform_private.cms_scan_linked_pattern_updates(jsonb)'), 'EXECUTE') then
    execute 'grant execute on function platform_private.cms_scan_linked_pattern_updates(jsonb) to wejammin_cms_definer';
  end if;
end;
$closure$;

commit;
