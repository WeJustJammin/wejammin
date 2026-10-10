-- Slice 11 lane preflight-cursor, finding 3 (BE03b "Derived revision workflow state (E2)",
-- tracker P2-S11-AC-086; DEC-140 fault classes), part 2 of 2: the history wrapper chooses the
-- cursor envelope by the request.
--
-- A request that names a `state` filter is answered with SEALED cursors (20261010161000), because
-- its bounded scan can end on a concealed candidate; a filter-free request keeps the Slice 10 signed
-- envelope, whose cursor is positioned after the last RETURNED row and so discloses nothing.  The
-- kind is chosen by the request the caller made, never by what the scan met, so a cursor does not
-- reveal whether its tail was concealed.  An inbound cursor is sealed when its first raw byte is 0x01
-- (never the `{` of a JSON envelope) and signed otherwise; the queryHash inside either binds it to
-- the exact actor, acting party, entry, filters and window, so a sealed cursor replayed into another
-- request is a 409.  The reader platform_private.cms_list_revisions and its bounded scan are
-- unchanged.
--
-- CREATE OR REPLACE keeps owner, SECURITY DEFINER, empty search_path, signature and the revoked
-- API-role grants.  Callers: platform_api.cms_list_revisions and the Slice 10 suites.  Forward-only.
begin;

-- CMS-03B-03 signed history wrapper (20261005010400), now choosing the cursor envelope by request:
-- a request that names a `state` filter is served and answered with SEALED cursors, because its
-- bounded scan can end on a concealed candidate; a filter-free request keeps the signed envelope.
-- Admission order is unchanged: structural request shape, the Vault key dependency, the inbound
-- cursor (sealed when its first raw byte is 0x01, otherwise signed), then the reader.
create or replace function platform_private.cms_list_revisions_signed(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  cursor_payload_keys constant text[] := array[
    'queryHash', 'lastRevisionNumber', 'lastRevisionId', 'expiresAt'
  ]::text[];
  request_for_reader jsonb := p_request;
  page jsonb;
begin
  -- Preserve the structural-admission precedence of the underlying reader.
  if p_request is null or not platform_private.cms_exact_keys(
    p_request,
    array['entryId']::text[],
    array[
      'entryId', 'cursor', 'limit', 'state', 'compareRevisionId', 'locale',
      'context', 'correlationId'
    ]::text[]
  ) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;

  perform platform_private.cms_signed_cursor_require_key();

  if p_request ? 'cursor' and p_request->'cursor' <> 'null'::jsonb then
    request_for_reader := pg_catalog.jsonb_set(
      p_request,
      '{cursor}',
      pg_catalog.to_jsonb(
        case
          when platform_private.cms_sealed_cursor_is_sealed(p_request->'cursor') then
            platform_private.cms_sealed_cursor_open('cms-03b-03', p_request->'cursor')
          else
            platform_private.cms_signed_cursor_open(
              'cms-03b-03', p_request->'cursor', cursor_payload_keys
            )
        end
      ),
      false
    );
  end if;

  -- The private reader rechecks the actor, assignment, query hash, expiry, keyset position,
  -- schema-aware hashes and target readability.
  page := platform_private.cms_list_revisions(request_for_reader);

  if p_request ? 'state' and p_request->'state' <> 'null'::jsonb then
    return platform_private.cms_sealed_cursor_seal_page(
      'cms-03b-03', page, cursor_payload_keys
    );
  end if;
  return platform_private.cms_signed_cursor_seal_page(
    'cms-03b-03', page, cursor_payload_keys
  );
end;
$body$;

comment on function platform_private.cms_list_revisions_signed(jsonb) is
  'CMS-03B-03 service-bound history wrapper: requires a per-environment Supabase Vault HMAC key, verifies the inbound cursor (signed JSON envelope, or sealed authenticated-encryption envelope) in constant time, and answers a request that names a state filter with a SEALED cursor (its bounded scan can end on a concealed candidate) and any other request with a signed cursor, without exposing key material. A malformed envelope is INVALID_REQUEST; an unverifiable, expired or context-mismatched valid-shaped one is CONFLICT. The comparison producer behind it is unsigned and internal. No migration provisions an operational key.';

revoke all on function platform_private.cms_list_revisions_signed(jsonb)
  from public, anon, authenticated, service_role;

commit;
