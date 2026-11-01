-- Slice 12 lane dec208: the Worker transport of the locale observability read (DEC-208, DEC-213, DEC-216).  Internal: it has no
-- browser route and no operation id.  It delegates to platform_private.cms_locale_observability_read(timestamptz, timestamptz),
-- which sets the transaction-local RPC context its forced-RLS reads require; like every CMS wrapper (20261003120410) it remembers
-- the caller's app.cms_rpc value and restores it before it returns (SEC-2: an RPC does not leave the RPC-context flag set).
-- SECURITY DEFINER owned by the CMS definer (SEC-2), empty search_path; EXECUTE for service_role only (revoked from PUBLIC, anon and
-- authenticated).  The call is bounded by the Worker's 5,000 ms deadline.  Forward-only.
begin;
set local lock_timeout = '5s';

create function platform_api.cms_locale_observability_read(
  p_window_start timestamptz,
  p_window_end timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  rpc_result := platform_private.cms_locale_observability_read(p_window_start, p_window_end);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

comment on function platform_api.cms_locale_observability_read(timestamptz, timestamptz) is
  'DEC-208 / DEC-213: internal Worker read of the per-minute locale observability sample {fanoutRows, staleFieldsAppended, staleLegalFields}; window must be a whole-minute closed-open 60 s span or VALIDATION_FAILED. Executable by service_role only.';

grant create on schema platform_api to wejammin_cms_definer;
alter function platform_api.cms_locale_observability_read(timestamptz, timestamptz) owner to wejammin_cms_definer;
revoke create on schema platform_api from wejammin_cms_definer;
revoke all on function platform_api.cms_locale_observability_read(timestamptz, timestamptz)
  from public, anon, authenticated, service_role;
grant usage on schema platform_api to service_role;
grant execute on function platform_api.cms_locale_observability_read(timestamptz, timestamptz) to service_role;

do $closure$
begin
  if not pg_catalog.has_function_privilege('wejammin_cms_definer',
       pg_catalog.to_regprocedure('platform_private.cms_locale_observability_read(timestamptz,timestamptz)'), 'EXECUTE') then
    execute 'grant execute on function platform_private.cms_locale_observability_read(timestamptz, timestamptz) to wejammin_cms_definer';
  end if;
end;
$closure$;

commit;
