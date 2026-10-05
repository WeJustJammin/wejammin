-- The DEC-109/DEC-119 private helpers and commands stay unreachable by any client
-- or service role: the security-definer platform_api wrappers are the only entry
-- points (BE03a "Database invariants and grants").  The same sweep the DEC-108
-- chain ends with, repeated for the commands added after it.  Forward-only.
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
