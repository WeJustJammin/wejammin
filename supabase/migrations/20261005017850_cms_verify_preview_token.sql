-- Slice 11 lane S11-3c, CMS-03B-19 (BE03b "Internal service operations", "Preview token and
-- verification (CMS-03B-08, CMS-03B-19)", Per-operation authorization matrix; BE04c "Shard 03
-- preview-token verifier" seam; tracker P2-S11-AC-073 .. AC-078, AC-118):
-- platform_api.cms_verify_preview_token(p_request jsonb) returns jsonb, the one database RPC the
-- Shard 04 delivery principal calls on every preview open.
--
-- Request (PreviewVerificationRequest, exact keys): tokenHash (lowercase SHA-256 of the presented
-- token's UTF-8 bytes; the plaintext never reaches the database), actorPersonId, actingContextVersion
-- (the BE04c value the caller resolved for the actor), route, locale, audience.
--
-- The answer is `valid: true` with the stored VersionSet only when ALL hold: a token row with that
-- hash exists and is `active`, unrevoked and unexpired (clock instant < expires_at); its person is
-- the supplied actor; its capability_snapshot_hash equals the supplied acting-context version; its
-- route, locale and audience equal the request EXACTLY (code point for code point: no case folding,
-- no normalization, no trailing-slash tolerance); its entry is `active` and the revision belongs to
-- it; and the minting person's preview scope still holds (cms_preview_scope_holds, entry assignee |
-- active reviewer assignee | owner-party publisher), so a lazy loss of authority ends a preview even
-- before any revoking trigger ran.  EVERY other input is ONE byte-identical denial (valid false, the
-- five other members null, `revoked` false), including every structurally malformed request: the
-- function is total and never raises on caller input, so the Worker's retry ladder and circuit see
-- only genuine dependency faults.  `revoked` is true only when the row exists, is bound to the
-- supplied actor and is revoked, whatever else differs, so the verifier is not an existence oracle
-- for anyone but the token's own owner.
--
-- Read-safe: both functions are STABLE, so PostgreSQL itself refuses an insert, update, delete,
-- audit or outbox write from them.  The private implementation has no API grant; the platform_api
-- wrapper is executable by service_role only (the Worker holds the registered delivery credential;
-- DEC-156).  Forward-only.
begin;

set local lock_timeout = '5s';

create or replace function platform_private.cms_verify_preview_token(p_request jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  denied constant jsonb := pg_catalog.jsonb_build_object(
    'valid', false, 'userId', null, 'entryId', null, 'revisionId', null,
    'exactVersionSet', null, 'expiresAt', null, 'revoked', false
  );
  token_row platform_private.cms_preview_tokens%rowtype;
  entry_lifecycle text;
  actor_person uuid;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);

  -- Structure: anything but the six strict members is the denial (no error to retry on).
  if p_request is null
     or pg_catalog.jsonb_typeof(p_request) is distinct from 'object'
     or not platform_private.cms_exact_keys(
       p_request,
       array['tokenHash', 'actorPersonId', 'actingContextVersion', 'route', 'locale', 'audience']::text[],
       array['tokenHash', 'actorPersonId', 'actingContextVersion', 'route', 'locale', 'audience']::text[]
     )
     or pg_catalog.jsonb_typeof(p_request->'tokenHash') is distinct from 'string'
     or p_request->>'tokenHash' !~ '^[a-f0-9]{64}$'
     or pg_catalog.jsonb_typeof(p_request->'actorPersonId') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->>'actorPersonId') is not true
     or pg_catalog.jsonb_typeof(p_request->'actingContextVersion') is distinct from 'string'
     or p_request->>'actingContextVersion' !~ '^[a-f0-9]{64}$'
     or pg_catalog.jsonb_typeof(p_request->'route') is distinct from 'string'
     or pg_catalog.char_length(p_request->>'route') not between 1 and 4096
     or pg_catalog.jsonb_typeof(p_request->'locale') is distinct from 'string'
     or pg_catalog.char_length(p_request->>'locale') not between 2 and 35
     or pg_catalog.jsonb_typeof(p_request->'audience') is distinct from 'string'
     or p_request->>'audience' !~ '^[a-z0-9_-]{1,48}$' then
    return denied;
  end if;
  actor_person := (p_request->>'actorPersonId')::uuid;

  select token_item.* into token_row
    from platform_private.cms_preview_tokens token_item
   where token_item.token_hash = p_request->>'tokenHash';
  -- Unknown hash, or a row bound to someone else: the same bytes (the forwarded-token case).
  if not found or token_row.person_id is distinct from actor_person then
    return denied;
  end if;
  -- The bound actor's own revoked token is the one answer that differs.
  if token_row.state = 'revoked' then
    return denied || pg_catalog.jsonb_build_object('revoked', true);
  end if;
  if token_row.state is distinct from 'active'
     or token_row.revoked_at is not null
     or pg_catalog.clock_timestamp() >= token_row.expires_at
     or token_row.capability_snapshot_hash::text is distinct from p_request->>'actingContextVersion'
     or token_row.route is distinct from p_request->>'route'
     or token_row.locale is distinct from p_request->>'locale'
     or token_row.audience is distinct from p_request->>'audience' then
    return denied;
  end if;

  select entry_item.lifecycle into entry_lifecycle
    from platform_private.cms_content_entries entry_item
   where entry_item.id = token_row.entry_id;
  if entry_lifecycle is distinct from 'active'
     or not exists (
       select 1
         from platform_private.cms_entry_revisions revision_item
        where revision_item.id = token_row.revision_id
          and revision_item.entry_id = token_row.entry_id
     )
     or not platform_private.cms_preview_scope_holds(
       token_row.person_id, token_row.acting_party_id, token_row.entry_id, token_row.revision_id
     ) then
    return denied;
  end if;

  return pg_catalog.jsonb_build_object(
    'valid', true,
    'userId', token_row.person_id,
    'entryId', token_row.entry_id,
    'revisionId', token_row.revision_id,
    'exactVersionSet', token_row.version_set,
    'expiresAt', platform_private.auth_iso_time(token_row.expires_at),
    'revoked', false
  );
end;
$body$;

comment on function platform_private.cms_verify_preview_token(jsonb) is
  'CMS-03B-19 implementation: valid only for an active, unexpired token bound to exactly the supplied actor, acting-context version, route, locale and audience on an active entry whose minting person still holds preview scope; every other input (malformed ones included) is one byte-identical denial, with revoked true only for the bound actor''s own revoked token. STABLE: it can write nothing. Private; the platform_api wrapper is the service_role entry point.';

create or replace function platform_api.cms_verify_preview_token(p_request jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  rpc_result := platform_private.cms_verify_preview_token(p_request);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

comment on function platform_api.cms_verify_preview_token(jsonb) is
  'CMS-03B-19 (internal, never a browser route): PreviewVerificationRequest -> PreviewVerificationResult for the Shard 04 delivery principal. Read-safe (STABLE); executable by service_role only.';

-- SEC-2: what the verifier reads, held by the definer role only.
grant select on table
  platform_private.cms_preview_tokens,
  platform_private.cms_content_entries,
  platform_private.cms_entry_revisions
  to wejammin_cms_definer;
grant create on schema platform_private, platform_api to wejammin_cms_definer;
alter function platform_private.cms_verify_preview_token(jsonb) owner to wejammin_cms_definer;
alter function platform_api.cms_verify_preview_token(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private, platform_api from wejammin_cms_definer;

revoke all on function platform_private.cms_verify_preview_token(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_api.cms_verify_preview_token(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_verify_preview_token(jsonb) to service_role;

commit;
