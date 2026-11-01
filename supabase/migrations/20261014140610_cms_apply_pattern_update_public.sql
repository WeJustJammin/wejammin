-- Slice 12 lane pattern-updates (BE03c route row 177, Slice 12 lock order rule 4 1357; tracker P2-S12-AC-118, AC-121, AC-261): the Worker
-- transport of CMS-03C-15.
--
--   platform_api.cms_apply_pattern_update(p_request jsonb) returns jsonb   the CompositionUpdateResource { items }
--
-- Delegates to the private command and, like every CMS wrapper (20261003120410), remembers the RPC-context flag and restores it before it
-- returns.  The command runs in a nested block: `deadlock_detected` and a lock timeout (`lock_not_available`) at a lock step become the
-- retryable CONFLICT token the Worker maps to 409 COMPOSITION_VERSION_CONFLICT; the block's sub-transaction is rolled back, so nothing of the
-- command, its idempotency reservation included, survives and the same Idempotency-Key may be retried.
-- The 200 body is exactly { items } (the closed CompositionUpdateResource).  The committed entry aggregate version the command returns beside
-- the items is published as the strong ETag through the PostgREST `response.headers` setting, on the first execution and on every idempotent
-- replay alike (the stored version, not the current one).
-- SECURITY DEFINER owned by the CMS definer (SEC-2); EXECUTE for service_role only.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function platform_api.cms_apply_pattern_update(p_request jsonb)
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
    rpc_result := platform_private.cms_apply_pattern_update(p_request);
  exception
    when deadlock_detected or lock_not_available then
      raise exception 'CONFLICT' using errcode = 'P0001';
  end;
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  perform pg_catalog.set_config('response.headers',
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('etag', '"' || (rpc_result->>'entryVersion') || '"'))::text, true);
  return pg_catalog.jsonb_build_object('items', rpc_result->'items');
end;
$body$;

comment on function platform_api.cms_apply_pattern_update(jsonb) is
  'CMS-03C-15 Worker transport: delegates to platform_private.cms_apply_pattern_update, restores the RPC-context flag, converts a deadlock or lock timeout to the retryable CONFLICT token, answers exactly { items } and publishes the committed entry aggregate version as the ETag. service_role only.';

grant create on schema platform_private, platform_api to wejammin_cms_definer;
alter function platform_api.cms_apply_pattern_update(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private, platform_api from wejammin_cms_definer;
revoke all on function platform_api.cms_apply_pattern_update(jsonb) from public, anon, authenticated, service_role;
grant usage on schema platform_api to service_role;
grant execute on function platform_api.cms_apply_pattern_update(jsonb) to service_role;

do $closure$
begin
  if not pg_catalog.has_function_privilege('wejammin_cms_definer',
       pg_catalog.to_regprocedure('platform_private.cms_apply_pattern_update(jsonb)'), 'EXECUTE') then
    execute 'grant execute on function platform_private.cms_apply_pattern_update(jsonb) to wejammin_cms_definer';
  end if;
end;
$closure$;

commit;
