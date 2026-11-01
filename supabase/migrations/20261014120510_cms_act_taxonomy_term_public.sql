-- Slice 12 lane taxonomy-terms, CMS-03C-03 Worker transport (BE03c Authorization at 1447 and 1478, lock-order step 4 at 1357; P2-S12-AC-018,
-- AC-021): the platform_api wrapper.  It delegates to platform_private.cms_act_taxonomy_term(jsonb) and carries the neighbouring transport ACL
-- (20261013300810, 20261014030300): SECURITY DEFINER, owned by the CMS definer, EXECUTE granted to service_role only (never public, anon or
-- authenticated), the residual deadlock or lock-acquisition failure mapped to the typed retryable CONFLICT with nothing committed (BE03c 1357),
-- and the RPC-context flag restored for the rest of the caller's transaction.  Forward-only.
begin;
set local lock_timeout = '5s';

create or replace function platform_api.cms_act_taxonomy_term(p_request jsonb)
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
    rpc_result := platform_private.cms_act_taxonomy_term(p_request);
  exception
    when deadlock_detected or lock_not_available then
      raise exception 'CONFLICT' using errcode = 'P0001';
  end;
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

comment on function platform_api.cms_act_taxonomy_term(jsonb) is
  'CMS-03C-03 Worker transport: delegates to platform_private.cms_act_taxonomy_term; service_role only.';

grant create on schema platform_api to wejammin_cms_definer;
alter function platform_api.cms_act_taxonomy_term(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_api from wejammin_cms_definer;
revoke all on function platform_api.cms_act_taxonomy_term(jsonb) from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_act_taxonomy_term(jsonb) to service_role;

commit;
