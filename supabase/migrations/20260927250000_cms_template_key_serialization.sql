-- Serialize every public template definition for one immutable template key.
-- The private RPC locks the latest row, but a first create has no row to lock:
-- two writers could both choose v1 and expose a raw unique-violation SQLSTATE.
-- The API wrapper is the sole service-role entry point; this forward-only
-- replacement holds a transaction-scoped key lock across its private call.
begin;

create or replace function platform_api.cms_define_template(p_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  template_key text := p_request->>'templateKey';
begin
  -- Invalid keys are rejected by the private validator without allocating a
  -- caller-chosen lock. A hash collision only serializes unrelated keys; it
  -- cannot permit two writers of the same key to pass concurrently.
  if template_key ~ '^[a-z][a-z0-9-]{1,63}$' then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('cms.template:' || template_key, 0)
    );
  end if;
  return platform_private.cms_define_template(p_request);
end;
$body$;

revoke all on function platform_api.cms_define_template(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_define_template(jsonb) to service_role;

commit;
