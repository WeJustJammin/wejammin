-- Slice 09 (SEC-3, AC120, AC156, AC208): a replayed release nonce is observable.
-- A (release key, nonce) pair that was already claimed raised a bare CONFLICT, the
-- same exception the registration pair, digest and lifecycle conflicts raise, so the
-- Worker could not tell a replay from any other 409.  It therefore never counted
-- cms_release_nonce_claim_total{outcome=rejected} (only an executor 401 was counted)
-- and the nonce_rejection_spike alert could not fire.  The replay now raises CONFLICT
-- with DETAIL 'RELEASE_NONCE_REPLAYED' (the PostgREST `details` the adapter reads);
-- every other conflict stays detail-free.  Nothing else in the claim changes (body
-- regenerated from the live function, one statement).  Forward-only.
begin;

CREATE OR REPLACE FUNCTION platform_private.cms_release_nonce_claim_at(p_request jsonb, p_operation_id text, p_actor_id uuid, p_now_at timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  release_key_value text := p_request->>'releaseKeyId';
  nonce text := p_request->>'releaseNonce';
  issued text := p_request->>'releaseIssuedAt';
  raw_hash text := p_request->>'releaseRawBodyHash';
  supplied_signature_hash text := p_request->>'releaseSignatureHash';
  signature_value text := p_request->>'releaseSignature';
  verified text := p_request->>'releaseVerifiedAt';
  issued_at timestamptz;
  verified_at timestamptz;
  now_at timestamptz := coalesce(p_now_at, pg_catalog.clock_timestamp());
  receipt_id uuid;
  signature_bytes bytea;
  computed_signature_hash text;
  public_key_value bytea;
begin
  if release_key_value is null or release_key_value !~ '^[a-z][a-z0-9_.-]{1,95}$'
     or not platform_private.cms_valid_uuid(nonce)
     or issued is null or raw_hash is null or raw_hash !~ '^[a-f0-9]{64}$'
     or supplied_signature_hash is null or supplied_signature_hash !~ '^[a-f0-9]{64}$'
     or not platform_private.cms_valid_base64(signature_value)
     or verified is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;
  begin
    issued_at := issued::timestamptz;
    verified_at := verified::timestamptz;
  exception when others then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end;
  if issued_at > now_at + interval '5 minutes'
     or issued_at < now_at - interval '5 minutes'
     or verified_at > now_at + interval '5 minutes'
     or verified_at < now_at - interval '5 minutes' then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;
  begin
    signature_bytes := pg_catalog.decode(signature_value, 'base64');
  exception when others then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end;
  if pg_catalog.octet_length(signature_bytes) <> 64 then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;
  computed_signature_hash := pg_catalog.encode(
    extensions.digest(signature_bytes, 'sha256'), 'hex'
  );
  if supplied_signature_hash <> computed_signature_hash then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;
  -- Lock the exact current trust row before verifying either release or
  -- props evidence.  A rotation/revocation update must wait for this
  -- transaction, so both signatures observe one key state.
  select principal.public_key into public_key_value
  from platform_private.cfg_release_principals principal
  where principal.principal_id = p_actor_id
    and principal.key_id = release_key_value
    and principal.active
    and principal.revoked_at is null
    and (principal.valid_from is null or principal.valid_from <= issued_at)
    and (principal.valid_through is null or principal.valid_through >= issued_at)
    and (principal.valid_from is null or principal.valid_from <= now_at)
    and (principal.valid_through is null or principal.valid_through >= now_at)
    and principal.public_key is not null
    and pg_catalog.octet_length(principal.public_key) = 32
  for update;
  if public_key_value is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;
  if not pgsodium.crypto_sign_verify_detached(
    signature_bytes,
    pg_catalog.convert_to(
      platform_private.cms_release_signing_payload(p_request, p_operation_id), 'utf8'
    ),
    public_key_value
  ) then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;
  insert into platform_private.cms_release_nonce_receipts(
    release_key_id, nonce_hash, operation_id, issued_at, expires_at,
    raw_body_hash, signature_hash, verified_at, outcome
  ) values (
    release_key_value, encode(extensions.digest(convert_to(nonce, 'utf8'), 'sha256'), 'hex'), p_operation_id,
    issued_at, issued_at + interval '10 minutes', raw_hash,
    computed_signature_hash, now_at, 'claimed'
  ) on conflict (release_key_id, nonce_hash) do nothing
  returning id into receipt_id;
  if receipt_id is null then
    -- A replay of an already claimed (release key, nonce) is a CONFLICT whose DETAIL names
    -- the replay, so the Worker counts it as a rejected nonce claim.
    raise exception 'CONFLICT' using errcode = 'P0001', detail = 'RELEASE_NONCE_REPLAYED';
  end if;
  return receipt_id;
exception when invalid_text_representation or datetime_field_overflow then
  raise exception 'INVALID_REQUEST' using errcode = 'P0001';
end;
$function$;

commit;
