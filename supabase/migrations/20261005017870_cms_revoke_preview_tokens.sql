-- Slice 11 lane S11-3c, preview-token revocation entry point (BE03b "Preview token and verification
-- (CMS-03B-08, CMS-03B-19)", Persisted model; tracker P2-S11-AC-118):
-- platform_private.cms_revoke_preview_tokens(p_request jsonb) returns jsonb, the NAMED private RPC the
-- authority-loss cascades, the entry-lifecycle producers and the Shard 16 takedown RPC call to revoke
-- unexpired preview tokens.  It validates a closed request and wraps cms_revoke_active_preview_tokens (the
-- S11-3s CAS primitive: state active -> revoked, revoked_at, version + 1, token rows locked FOR UPDATE).
--
--   request  { reasonCode: authority_lost | entry_unavailable | takedown, correlationId: uuid,
--              personId?: uuid, entryId?: uuid }   at least one of personId / entryId
--   result   { revokedTokens: integer }
--
-- Idempotent (an expired or already revoked token is skipped, a repeat answers 0).  A version-set movement
-- never revokes a token.  There is NO platform_api wrapper and no API grant: it is a database-internal
-- seam, and the caller owns the audit record of the cause it is revoking for.  Forward-only.
begin;

set local lock_timeout = '5s';

create or replace function platform_private.cms_revoke_preview_tokens(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  revoked_count integer;
begin
  if p_request is null
     or pg_catalog.jsonb_typeof(p_request) is distinct from 'object'
     or not platform_private.cms_exact_keys(
       p_request,
       array['reasonCode', 'correlationId']::text[],
       array['reasonCode', 'correlationId', 'personId', 'entryId']::text[]
     )
     or pg_catalog.jsonb_typeof(p_request->'reasonCode') is distinct from 'string'
     or (p_request->>'reasonCode') not in ('authority_lost', 'entry_unavailable', 'takedown')
     or pg_catalog.jsonb_typeof(p_request->'correlationId') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->>'correlationId') is not true
     or (p_request ? 'personId' and p_request->'personId' <> 'null'::jsonb
         and (pg_catalog.jsonb_typeof(p_request->'personId') is distinct from 'string'
              or platform_private.cms_valid_uuid(p_request->>'personId') is not true))
     or (p_request ? 'entryId' and p_request->'entryId' <> 'null'::jsonb
         and (pg_catalog.jsonb_typeof(p_request->'entryId') is distinct from 'string'
              or platform_private.cms_valid_uuid(p_request->>'entryId') is not true))
     or (coalesce(p_request->'personId', 'null'::jsonb) = 'null'::jsonb
         and coalesce(p_request->'entryId', 'null'::jsonb) = 'null'::jsonb) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  revoked_count := platform_private.cms_revoke_active_preview_tokens(
    case when coalesce(p_request->'entryId', 'null'::jsonb) = 'null'::jsonb
      then null else (p_request->>'entryId')::uuid end,
    case when coalesce(p_request->'personId', 'null'::jsonb) = 'null'::jsonb
      then null else (p_request->>'personId')::uuid end
  );
  return pg_catalog.jsonb_build_object('revokedTokens', revoked_count);
end;
$body$;

comment on function platform_private.cms_revoke_preview_tokens(jsonb) is
  'BE03b: the named private seam that revokes (CAS) the unexpired active preview tokens of an entry and/or a person for a closed reason (authority_lost, entry_unavailable, takedown); idempotent; { revokedTokens }. No API grant and no wrapper: called by authority-loss, lifecycle and takedown producers. Private.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_revoke_preview_tokens(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_revoke_preview_tokens(jsonb)
  from public, anon, authenticated, service_role;

commit;
