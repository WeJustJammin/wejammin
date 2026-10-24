-- Slice 12 lane dec194: the platform_api wrapper of the merge convergence recovery sweep, whose private body is defined in 20261014190050 (plpgsql: the body is bound at call
-- time, so this wrapper may precede it).  It mirrors the CMS-03C-19 pair
-- (20261014070510): SECURITY DEFINER, owned by the CMS definer, EXECUTE granted to service_role only (never public, anon or authenticated), a
-- residual deadlock or lock failure mapped to the typed retryable CONFLICT with nothing committed, and the RPC-context flag the body sets restored
-- for the rest of the caller's transaction.
--   request  none (nothing a caller sends can steer the sweep)
--   answer   { requested: integer }  (a count, no ids)
--   errors   P0001 CONFLICT (lock failure)
-- The caller is the Worker scheduled tick (CMS-03B-20 / CMS-03C-19 sweep pattern).  Forward-only.
begin;
set local lock_timeout = '5s';

create or replace function platform_api.cms_reconcile_taxonomy_merge_converge()
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
    rpc_result := platform_private.cms_reconcile_taxonomy_merge_converge();
  exception
    when deadlock_detected or lock_not_available then
      raise exception 'CONFLICT' using errcode = 'P0001';
  end;
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

comment on function platform_api.cms_reconcile_taxonomy_merge_converge() is
  'DEC-194 Worker transport of the merge convergence recovery sweep: no request -> { requested }. Executable by service_role only.';

grant create on schema platform_api to wejammin_cms_definer;
alter function platform_api.cms_reconcile_taxonomy_merge_converge() owner to wejammin_cms_definer;
revoke create on schema platform_api from wejammin_cms_definer;
revoke all on function platform_api.cms_reconcile_taxonomy_merge_converge() from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_reconcile_taxonomy_merge_converge() to service_role;

commit;
