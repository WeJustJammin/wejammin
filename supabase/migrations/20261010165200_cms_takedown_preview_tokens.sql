-- Slice 11 lane preview-projection, BE03b "Preview token and verification (CMS-03B-08, CMS-03B-19)": a preview token
-- is revoked (CAS: `revoked_at`, state `revoked`, `version` + 1) "by the service-role takedown RPC"; DEC-156: the
-- internal RPCs are granted to service_role and principal-bound at the Worker module boundary; tracker
-- P2-S11-AC-118.
--
-- platform_api.cms_takedown_preview_tokens(p_request jsonb) returns jsonb is that RPC.  It is the only API route to
-- the private seam platform_private.cms_revoke_preview_tokens (20261005017870), narrowed to the one reason this
-- entry point serves:
--
--   request  { reasonCode: "takedown", correlationId: uuid, entryId?: uuid, personId?: uuid }   at least one target;
--            the other two reasons of the seam (authority_lost, entry_unavailable) belong to the DB-internal producers
--            (the authority-loss triggers and the entry-lifecycle cascades) and are INVALID_REQUEST here
--   result   { revokedTokens: integer }   the unexpired active tokens revoked; a repeat answers 0 (idempotent);
--            an entry and a person together are an AND
--
-- The seam validates the closed request (exact keys, uuids, a target) and does the CAS revocation under FOR UPDATE row
-- locks ordered by id.  Like the seam it writes no audit record, event or reservation: the Shard 16 caller that
-- applies a privacy / security / takedown rule owns the audit of the cause, and the Worker port logs the call.
-- EXECUTE is service_role's alone (the Worker holds the registered credential); PUBLIC, anon and authenticated are
-- refused at the function ACL.  The previous RPC-context flag is restored on return (SEC-2 D).  Forward-only.
begin;

set local lock_timeout = '5s';

create or replace function platform_api.cms_takedown_preview_tokens(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  if p_request is null
     or pg_catalog.jsonb_typeof(p_request) is distinct from 'object'
     or pg_catalog.jsonb_typeof(p_request->'reasonCode') is distinct from 'string'
     or p_request->>'reasonCode' is distinct from 'takedown' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  rpc_result := platform_private.cms_revoke_preview_tokens(p_request);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

comment on function platform_api.cms_takedown_preview_tokens(jsonb) is
  'BE03b CMS-03B-08 takedown (internal, never a browser route): { reasonCode takedown, correlationId, entryId?, personId? } -> { revokedTokens }. CAS-revokes the unexpired active preview tokens of an entry and/or a minting person; idempotent; no audit of its own (the Shard 16 caller owns the cause). Executable by service_role only.';

grant create on schema platform_api to wejammin_cms_definer;
alter function platform_api.cms_takedown_preview_tokens(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_api from wejammin_cms_definer;
revoke all on function platform_api.cms_takedown_preview_tokens(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_takedown_preview_tokens(jsonb) to service_role;

commit;
