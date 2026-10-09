-- Slice 11 lane S11-3c, CMS-03B-08 (BE03b "Preview token and verification (CMS-03B-08,
-- CMS-03B-19)", Route field validation matrix, Transaction and external seams, E5; tracker
-- P2-S11-AC-023 .. AC-028, AC-089, AC-117, AC-118): platform_private.cms_mint_preview(p_request
-- jsonb) returns jsonb with the platform_api wrapper the Worker calls (service_role only).
--
-- A caller with PREVIEW SCOPE on the revision (entry assignee, active reviewer assignee of a review of
-- the revision, or owner-party publisher; cms_preview_scope_holds, the same predicate the CMS-03B-19
-- verifier rechecks on every open) mints a 15-minute token bound to the person, user, acting context,
-- revision, the full VersionSet, locale, audience, route, expiry and a nonce.
--
-- The token is DERIVED and never stored: base64url(HMAC-SHA-256(key, "cms.preview.token.v1" ||
-- JCS{ tokenId, nonce, entryId, revisionId })) without padding (43 characters) under the Vault-held
-- history-signing key (no new secret).  The table keeps only the lowercase SHA-256 of the token string
-- and the binding evidence; the idempotent response stored with the reservation omits the token, so the
-- plaintext exists in no table.  An exact replay re-derives the identical token while the row is active
-- and unexpired (trying the active key, then keys rotated out within the last day); after expiry or
-- revocation, or when no current key reproduces the stored hash, it is 409 preview_expired and a new
-- key mints a new token.
--
-- Order (a refusal is a P0001 whose whole message is the token; nothing a refusal does is committed):
--   1. structure: exact keys (an `evidence` or owner member is unknown -> INVALID_REQUEST), uuids, positive
--      decimal versions that agree (VALIDATION_FAILED at /expectedVersion, /ifMatch), locale, audience,
--      route grammar and a strict 13-member version set (VALIDATION_FAILED at /locale, /audience, /route,
--      /versionSet);
--   2. concealment: an absent, foreign, not-`active` or non-member entry is NOT_FOUND;
--   3. global lock order: the entry FOR SHARE (position 0), the minting person's authority rows FOR SHARE
--      (position 1: person, tenure, grants, entry assignments) and the person's review assignments
--      (position 5), then the scope is PROVED under those locks (403 capability_missing), so a
--      revocation committed first wins and a later one waits and then revokes the new token;
--   4. a revision that is not of the entry is NOT_FOUND (for a scoped caller);
--   5. the idempotency reservation (a completed one is the replay above), the entry If-Match
--      (VERSION_MISMATCH {expectedVersion, currentVersion}), and the version-set check: the set is
--      recomputed from canonical state and must equal the request (409 version_set_stale);
--   6. the signing key (DEPENDENCY_UNAVAILABLE without one), the hash-only token row, one audit record
--      and NO outbox event, and the completed reservation commit together (201).
-- Forward-only.
begin;

set local lock_timeout = '5s';

-- The route grammar of a preview (and of a publication route): one leading slash and never `//host`,
-- 1..2048 code points, no query or fragment, no backslash, no C0/DEL/C1 control character, no `.` or
-- `..` segment, no empty interior segment, no percent-encoded dot, slash or backslash.  A trailing
-- slash is a valid directory path.  Identical to the CmsPreviewRouteSchema of the contracts package.
create or replace function platform_private.cms_preview_route_valid(p_route text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $body$
declare
  rest text;
  segments text[];
  position_index integer;
begin
  if p_route is null
     or pg_catalog.char_length(p_route) not between 1 and 2048
     or pg_catalog.left(p_route, 1) <> '/'
     or pg_catalog.left(p_route, 2) = '//'
     or p_route ~ '[\u0001-\u001f\u007f-\u009f]'
     or pg_catalog.strpos(p_route, E'\\') > 0
     or p_route ~ '[?#]'
     or p_route ~* '%(2e|2f|5c)' then
    return false;
  end if;
  rest := pg_catalog.substr(p_route, 2);
  if rest = '' then
    return true;
  end if;
  segments := pg_catalog.string_to_array(rest, '/');
  for position_index in 1 .. pg_catalog.cardinality(segments) loop
    if segments[position_index] in ('.', '..')
       or (segments[position_index] = '' and position_index < pg_catalog.cardinality(segments)) then
      return false;
    end if;
  end loop;
  return true;
end;
$body$;

comment on function platform_private.cms_preview_route_valid(text) is
  'BE03b preview/publication route grammar: a normalized site path of 1..2048 code points (one leading slash, never //host, no query, fragment, backslash, control character, dot or empty interior segment, no percent-encoded dot, slash or backslash). Private; IMMUTABLE.';

-- The Vault keys a preview token may be derived under: the active history-signing key first, then the
-- keys rotated out within the last day (the cursor-key lifecycle).  Owned by the migration owner, which
-- may read the Vault; the CMS definer role gets EXECUTE only.
create or replace function platform_private.cms_preview_signing_keys()
returns table(key_hex text, is_active boolean)
language sql
stable
security definer
set search_path = ''
as $body$
  select secret.decrypted_secret::text, secret.name = 'cms_editorial_history_cursor_active'
    from vault.decrypted_secrets secret
   where secret.decrypted_secret ~ '^[0-9a-f]{64}$'
     and (
       secret.name = 'cms_editorial_history_cursor_active'
       or (secret.name like 'cms_editorial_history_cursor_retired_%'
           and secret.updated_at > pg_catalog.clock_timestamp() - interval '1 day')
     )
   order by (secret.name = 'cms_editorial_history_cursor_active') desc, secret.updated_at desc, secret.id
$body$;

comment on function platform_private.cms_preview_signing_keys() is
  'The Vault keys a CMS-03B-08 preview token can be derived under: the active history-signing key, then keys rotated out within one day. Private; reads the Vault, so it is owned by the migration owner and executable by the CMS definer role only.';

-- token = base64url(HMAC-SHA-256(key, "cms.preview.token.v1" || JCS{ tokenId, nonce, entryId, revisionId })),
-- 43 characters, unpadded.
create or replace function platform_private.cms_preview_token_derive(
  p_token_id uuid, p_nonce uuid, p_entry_id uuid, p_revision_id uuid, p_key_hex text
)
returns text
language sql
stable
set search_path = ''
as $body$
  select pg_catalog.translate(
    pg_catalog.rtrim(
      pg_catalog.replace(
        pg_catalog.encode(
          extensions.hmac(
            pg_catalog.convert_to(
              'cms.preview.token.v1' || platform_private.cms_jcs(pg_catalog.jsonb_build_object(
                'tokenId', p_token_id, 'nonce', p_nonce, 'entryId', p_entry_id, 'revisionId', p_revision_id
              )),
              'utf8'
            ),
            pg_catalog.decode(p_key_hex, 'hex'),
            'sha256'
          ),
          'base64'
        ),
        E'\n', ''
      ),
      '='
    ),
    '+/', '-_'
  )
$body$;

comment on function platform_private.cms_preview_token_derive(uuid, uuid, uuid, uuid, text) is
  'CMS-03B-08 token derivation: unpadded base64url HMAC-SHA-256 under the given hex key over "cms.preview.token.v1" and the JCS { tokenId, nonce, entryId, revisionId }. Private.';

create or replace function platform_private.cms_mint_preview(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  actor_id uuid;
  acting_party_id uuid;
  person uuid;
  correlation_id uuid;
  requested_entry uuid;
  requested_revision uuid;
  expected_version bigint;
  requested_locale text;
  requested_audience text;
  requested_route text;
  requested_set jsonb;
  reservation platform_private.idempotency_records;
  entry_row platform_private.cms_content_entries%rowtype;
  stored_row platform_private.cms_preview_tokens%rowtype;
  revision_belongs boolean;
  recomputed jsonb;
  key_row record;
  active_key text;
  token_id uuid := extensions.gen_random_uuid();
  nonce_value uuid := extensions.gen_random_uuid();
  token_text text;
  minted_at timestamptz;
  response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  correlation_id := platform_private.cms_correlation(p_request);

  -- 1. structure
  if not platform_private.cms_exact_keys(
    p_request,
    array['entryId', 'revisionId', 'locale', 'audience', 'route', 'versionSet', 'expectedVersion', 'ifMatch',
          'idempotencyKey']::text[],
    array['entryId', 'revisionId', 'locale', 'audience', 'route', 'versionSet', 'expectedVersion', 'ifMatch',
          'idempotencyKey', 'context', 'correlationId']::text[]
  ) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if pg_catalog.jsonb_typeof(p_request->'entryId') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->>'entryId') is not true
     or pg_catalog.jsonb_typeof(p_request->'revisionId') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->>'revisionId') is not true then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if pg_catalog.jsonb_typeof(p_request->'expectedVersion') is distinct from 'string'
     or platform_private.cms_valid_version(p_request->>'expectedVersion') is not true
     or pg_catalog.length(p_request->>'expectedVersion') > 19
     or (pg_catalog.length(p_request->>'expectedVersion') = 19
         and p_request->>'expectedVersion' > '9223372036854775807') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/expectedVersion"]';
  end if;
  if pg_catalog.jsonb_typeof(p_request->'ifMatch') is distinct from 'string'
     or platform_private.cms_valid_version(p_request->>'ifMatch') is not true
     or pg_catalog.length(p_request->>'ifMatch') > 19
     or (pg_catalog.length(p_request->>'ifMatch') = 19
         and p_request->>'ifMatch' > '9223372036854775807') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/ifMatch"]';
  end if;
  if p_request->>'expectedVersion' <> p_request->>'ifMatch' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if pg_catalog.jsonb_typeof(p_request->'locale') is distinct from 'string'
     or pg_catalog.char_length(p_request->>'locale') > 35
     or p_request->>'locale' !~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/locale"]';
  end if;
  if pg_catalog.jsonb_typeof(p_request->'audience') is distinct from 'string'
     or p_request->>'audience' !~ '^[a-z0-9_-]{1,48}$' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/audience"]';
  end if;
  if pg_catalog.jsonb_typeof(p_request->'route') is distinct from 'string'
     or platform_private.cms_preview_route_valid(p_request->>'route') is not true then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/route"]';
  end if;
  requested_set := p_request->'versionSet';
  if not platform_private.cms_exact_keys(
    requested_set,
    array['schemaVersionId', 'schemaHash', 'schemaArtifact', 'validatorRefs', 'workflowPolicy',
          'activationEvidence', 'templateVersionId', 'templateHash', 'taxonomyVersionIds',
          'blockVersionIds', 'patternVersionIds', 'settingsVersion', 'compilerVersion']::text[],
    array['schemaVersionId', 'schemaHash', 'schemaArtifact', 'validatorRefs', 'workflowPolicy',
          'activationEvidence', 'templateVersionId', 'templateHash', 'taxonomyVersionIds',
          'blockVersionIds', 'patternVersionIds', 'settingsVersion', 'compilerVersion']::text[]
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/versionSet"]';
  end if;
  requested_entry := (p_request->>'entryId')::uuid;
  requested_revision := (p_request->>'revisionId')::uuid;
  expected_version := (p_request->>'expectedVersion')::bigint;
  requested_locale := p_request->>'locale';
  requested_audience := p_request->>'audience';
  requested_route := p_request->>'route';

  -- 2. concealment
  begin
    person := platform_private.identity_actor_person(actor_id);
  exception when others then
    person := null;
  end;
  select entry_item.* into entry_row
    from platform_private.cms_content_entries entry_item
   where entry_item.id = requested_entry;
  if not found
     or person is null
     or entry_row.owner_party_id is distinct from acting_party_id
     or entry_row.lifecycle is distinct from 'active'
     or not platform_private.cms_entry_tenant_visible(actor_id, entry_row.owner_party_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- 3. global lock order, then the scope PROVED under the locks
  select entry_item.* into entry_row
    from platform_private.cms_content_entries entry_item
   where entry_item.id = requested_entry
     for share;
  if entry_row.lifecycle is distinct from 'active' then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform platform_private.cms_lock_entry_authority(actor_id, acting_party_id, entry_row.id);
  perform platform_private.cms_lock_person_authority(
    acting_party_id, array[person]::uuid[], array['cms.publisher']::text[]);
  perform 1
    from platform_private.cms_editorial_review_assignments reviewer_assignment
    join platform_private.cms_editorial_reviews review_item on review_item.id = reviewer_assignment.review_id
   where reviewer_assignment.reviewer_person_id = person
     and review_item.entry_id = entry_row.id
   order by reviewer_assignment.id
     for share of reviewer_assignment;
  select exists (
    select 1
      from platform_private.cms_entry_revisions revision_item
     where revision_item.id = requested_revision and revision_item.entry_id = entry_row.id
  ) into revision_belongs;
  -- A revision that is not of the entry is probed with the entry's current draft, so the caller learns
  -- nothing about it unless they hold scope on the entry at all.
  if not platform_private.cms_preview_scope_holds(
    person, acting_party_id, entry_row.id,
    case when revision_belongs then requested_revision else entry_row.current_draft_revision_id end
  ) then
    raise exception 'capability_missing' using errcode = 'P0001';
  end if;
  if not revision_belongs then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- 5. reservation (the replay), If-Match, version set
  reservation := platform_private.cms_reserve(p_request, actor_id, 'CMS-03B-08');
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if not (reservation.response_ref->'safeHeaders' ? 'response') then
      raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
    end if;
    select token_item.* into stored_row
      from platform_private.cms_preview_tokens token_item
     where token_item.id = (reservation.response_ref->>'resourceRef')::uuid;
    if not found
       or stored_row.state is distinct from 'active'
       or stored_row.revoked_at is not null
       or pg_catalog.clock_timestamp() >= stored_row.expires_at then
      raise exception 'preview_expired' using errcode = 'P0001';
    end if;
    for key_row in select keys.key_hex from platform_private.cms_preview_signing_keys() keys loop
      token_text := platform_private.cms_preview_token_derive(
        stored_row.id, stored_row.nonce, stored_row.entry_id, stored_row.revision_id, key_row.key_hex);
      if pg_catalog.encode(extensions.digest(pg_catalog.convert_to(token_text, 'utf8'), 'sha256'), 'hex')
         = stored_row.token_hash::text then
        perform pg_catalog.set_config('response.headers', '[{"x-cms-idempotent-replay": "true"}]', true);
        return (reservation.response_ref->'safeHeaders'->'response')
               || pg_catalog.jsonb_build_object('token', token_text);
      end if;
    end loop;
    -- No current key reproduces the stored hash: the token cannot be re-issued.
    raise exception 'preview_expired' using errcode = 'P0001';
  end if;
  if entry_row.version <> expected_version then
    perform platform_private.cms_raise_version_mismatch(expected_version, entry_row.version);
  end if;
  recomputed := platform_private.cms_revision_version_set(
    requested_revision, platform_private.cms_build_dependency_manifest(requested_revision));
  if platform_private.cms_jcs_sha256(requested_set) is distinct from platform_private.cms_jcs_sha256(recomputed) then
    raise exception 'version_set_stale' using errcode = 'P0001';
  end if;

  -- 6. derive, persist the hash, audit
  select keys.key_hex into active_key
    from platform_private.cms_preview_signing_keys() keys
   where keys.is_active
   limit 1;
  if active_key is null then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;
  token_text := platform_private.cms_preview_token_derive(
    token_id, nonce_value, entry_row.id, requested_revision, active_key);
  minted_at := pg_catalog.clock_timestamp();
  insert into platform_private.cms_preview_tokens(
    id, owner_id, state, version, token_hash, entry_id, revision_id, user_id, acting_party_id,
    capability_snapshot_hash, version_set, locale, audience, route, expires_at, nonce, revoked_at,
    created_at, updated_at, person_id
  ) values (
    token_id, entry_row.owner_id, 'active', 1,
    pg_catalog.encode(extensions.digest(pg_catalog.convert_to(token_text, 'utf8'), 'sha256'), 'hex'),
    entry_row.id, requested_revision, actor_id, acting_party_id,
    platform_private.cms_acting_context_version(person, acting_party_id), recomputed,
    requested_locale, requested_audience, requested_route,
    minted_at + interval '15 minutes', nonce_value, null, minted_at, minted_at, person
  );
  perform platform_private.cms_record_audit(
    'cms.preview.mint', actor_id, acting_party_id, 'cms_preview_token', token_id,
    'CMS_PREVIEW_MINTED', correlation_id);
  response := pg_catalog.jsonb_build_object(
    'token', token_text,
    'expiresAt', platform_private.auth_iso_time(minted_at + interval '15 minutes'),
    'entryId', entry_row.id,
    'revisionId', requested_revision,
    'locale', requested_locale,
    'audience', requested_audience,
    'route', requested_route,
    'versionSet', recomputed,
    'revoked', false
  );
  -- The stored idempotent response never holds the plaintext: the replay re-derives it.
  perform platform_private.cms_complete(reservation.id, token_id, 201, response - 'token');
  return response;
end;
$body$;

comment on function platform_private.cms_mint_preview(jsonb) is
  'CMS-03B-08: a caller with preview scope on a revision mints a 15-minute token bound to person, user, acting context, revision, the recomputed VersionSet, locale, audience and route. The token is derived (HMAC-SHA-256 under the Vault history-signing key) and never stored; only its SHA-256 is. An exact replay re-derives the same token while the row is active and unexpired, else preview_expired. Audit, no outbox. Private; the Worker calls the platform_api wrapper.';

create or replace function platform_api.cms_mint_preview(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  begin
    rpc_result := platform_private.cms_mint_preview(p_request);
  exception
    -- BE03b lock order: a residual deadlock or lock failure is the typed retryable CONFLICT.
    when deadlock_detected or lock_not_available then
      raise exception 'CONFLICT' using errcode = 'P0001';
  end;
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

comment on function platform_api.cms_mint_preview(jsonb) is
  'CMS-03B-08 (POST /api/v1/cms/previews): PreviewRequest -> PreviewTokenResource. Executable by service_role only.';

-- SEC-2: what the command reads and writes, held by the definer role only.
grant insert, select on table platform_private.cms_preview_tokens to wejammin_cms_definer;
grant select on table platform_private.cms_editorial_reviews to wejammin_cms_definer;
grant select, update on table platform_private.cms_editorial_review_assignments to wejammin_cms_definer;
grant create on schema platform_private, platform_api to wejammin_cms_definer;
alter function platform_private.cms_preview_route_valid(text) owner to wejammin_cms_definer;
alter function platform_private.cms_preview_token_derive(uuid, uuid, uuid, uuid, text) owner to wejammin_cms_definer;
alter function platform_private.cms_mint_preview(jsonb) owner to wejammin_cms_definer;
alter function platform_api.cms_mint_preview(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private, platform_api from wejammin_cms_definer;

revoke all on function platform_private.cms_preview_route_valid(text)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_preview_signing_keys()
  from public, anon, authenticated, service_role;
grant execute on function platform_private.cms_preview_signing_keys() to wejammin_cms_definer;
revoke all on function platform_private.cms_preview_token_derive(uuid, uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_mint_preview(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_api.cms_mint_preview(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_mint_preview(jsonb) to service_role;

commit;
