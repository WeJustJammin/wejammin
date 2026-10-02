-- Every platform_private CMS helper and command stays unreachable by any
-- client or service role: the security-definer platform_api wrappers are the
-- only entry points (BE03a "Database invariants and grants").  The DEC-108
-- commands added after the registry-authority sweep are covered by the same
-- sweep.  Forward-only.
begin;

do $body$
declare
  function_oid oid;
begin
  for function_oid in
    select p.oid
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'platform_private'
       and p.proname like 'cms_%'
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated, service_role',
      function_oid::regprocedure
    );
  end loop;
end;
$body$;

commit;
