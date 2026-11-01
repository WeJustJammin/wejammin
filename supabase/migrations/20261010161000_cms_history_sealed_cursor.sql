-- Slice 11 lane preflight-cursor, finding 3 (BE03b "Derived revision workflow state (E2)",
-- tracker P2-S11-AC-086; DEC-140 fault classes), part 1 of 2: the sealed-cursor primitives.
--
-- A CMS-03B-03 history request that names a `state` scans at most 1,000 keyset candidates,
-- concealed ones included (20261005018020: a cursor must not become a probe), and on reaching
-- that bound answers a cursor positioned after the LAST SCANNED candidate, which can be a revision
-- the caller may not know exists.  The signed envelope of 20261005010400
-- (base64(JCS({queryHash, lastRevisionNumber, lastRevisionId, expiresAt, keyId, signature})))
-- authenticates the position but does not hide it, so decoding the bound-ending cursor revealed the
-- hidden revision UUID and number (BE03b:2014, 2068).
--
-- This file adds the sealed (encrypt-then-MAC) envelope; 20261010161100 makes the history wrapper
-- use it.  The shared signed-cursor helpers of 20261005010400 (used by the entry list and the
-- review queue) are not touched.
--
--   * the unsigned keyset payload is the reader's four members, JCS text space-padded to a fixed
--     208 bytes and encrypted with AES-256-CBC under a fresh random 16-byte nonce, so every sealed
--     cursor has one fixed length (273 raw bytes, 364 characters) whatever position it encodes and
--     the same position never seals to the same bytes twice;
--   * envelope = 0x01 || keyId(16) || nonce(16) || ciphertext(208) || tag(32), tag =
--     HMAC-SHA-256(macKey, 0x01 || keyId || nonce || ciphertext), verified in constant time BEFORE
--     anything is decrypted, so a forged or edited cursor reveals nothing;
--   * the encryption and MAC keys are independent HMAC-SHA-256 derivations of the existing Vault
--     history-cursor key (cms_editorial_history_cursor_active, with the 24-hour retired-key grace of
--     cms_signed_cursor_open), separated by purpose, signing domain and key id.  Nothing is stored
--     or hard-coded; no migration provisions an operational key;
--   * fault classes (DEC-140): a structurally malformed envelope is 400 INVALID_REQUEST; a wrong
--     key, tag, domain, payload or expiry is 409 CONFLICT.
-- Forward-only.
begin;

-- The raw key bytes a sealed cursor under p_key_id may verify with: the active history secret, or a
-- freshly retired one.  Anything else is a cursor signed by an unknown or stale key (409).
create or replace function platform_private.cms_sealed_cursor_verifying_key(p_key_id uuid)
returns bytea
language plpgsql
security definer
set search_path = ''
as $body$
declare
  key_hex text;
  key_name text;
  key_updated_at timestamptz;
begin
  select secret.decrypted_secret, secret.name, secret.updated_at
    into key_hex, key_name, key_updated_at
  from vault.decrypted_secrets secret
  where secret.id = p_key_id;
  -- A null name or timestamp must never fall through a three-valued NOT.
  if key_hex is null
     or not coalesce(key_hex ~ '^[0-9a-f]{64}$', false)
     or not coalesce(
       key_name = 'cms_editorial_history_cursor_active'
       or (
         key_name like 'cms_editorial_history_cursor_retired_%'
         and key_updated_at > pg_catalog.clock_timestamp() - interval '1 day'
       ),
       false
     ) then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  return pg_catalog.decode(key_hex, 'hex');
end;
$body$;

-- One independent 32-byte subkey of the history key: HMAC-SHA-256(master, label), the label naming the
-- purpose (enc | mac), the signing domain and the key id, so no subkey is ever used for two things.
create or replace function platform_private.cms_sealed_cursor_subkey(
  p_master bytea,
  p_purpose text,
  p_domain text,
  p_key_id uuid
)
returns bytea
language sql
immutable
strict
set search_path = ''
as $body$
  select extensions.hmac(
    pg_catalog.convert_to(
      'cms-sealed-cursor:v1:' || p_purpose || ':' || p_domain || ':' || p_key_id::text, 'utf8'
    ),
    p_master,
    'sha256'
  )
$body$;

-- True when the presented cursor is a sealed envelope (first raw byte 0x01) rather than a JSON
-- signed envelope (first byte `{`).  Anything that is not base64 is left to the signed path, which
-- refuses it as a malformed cursor.
create or replace function platform_private.cms_sealed_cursor_is_sealed(p_cursor jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $body$
declare
  raw bytea;
begin
  if pg_catalog.jsonb_typeof(p_cursor) is distinct from 'string' then
    return false;
  end if;
  begin
    raw := pg_catalog.decode(p_cursor #>> '{}', 'base64');
  exception when others then
    return false;
  end;
  return pg_catalog.octet_length(raw) > 0 and pg_catalog.get_byte(raw, 0) = 1;
end;
$body$;

-- Seals an unsigned keyset payload (a jsonb object of at most 208 JCS bytes) into the fixed-length
-- authenticated-encryption cursor.  DEPENDENCY_UNAVAILABLE while the environment has no valid
-- active history key.
create or replace function platform_private.cms_sealed_cursor_seal(p_domain text, p_payload jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $body$
declare
  payload_width constant integer := 208;
  active_key_id uuid;
  active_key_hex text;
  master bytea;
  plaintext bytea;
  nonce bytea;
  ciphertext bytea;
  header bytea;
begin
  select secret.id, secret.decrypted_secret
    into active_key_id, active_key_hex
  from vault.decrypted_secrets secret
  where secret.name = 'cms_editorial_history_cursor_active'
  limit 1;
  if active_key_id is null
     or not coalesce(active_key_hex ~ '^[0-9a-f]{64}$', false) then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if pg_catalog.jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  plaintext := pg_catalog.convert_to(platform_private.cms_jcs(p_payload), 'utf8');
  if pg_catalog.octet_length(plaintext) > payload_width then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  -- ASCII spaces are JSON whitespace: the padded text parses as the same document.
  plaintext := plaintext || pg_catalog.decode(
    pg_catalog.repeat('20', payload_width - pg_catalog.octet_length(plaintext)), 'hex'
  );

  master := pg_catalog.decode(active_key_hex, 'hex');
  nonce := extensions.gen_random_bytes(16);
  ciphertext := extensions.encrypt_iv(
    plaintext,
    platform_private.cms_sealed_cursor_subkey(master, 'enc', p_domain, active_key_id),
    nonce,
    'aes-cbc/pad:none'
  );
  header := pg_catalog.decode('01', 'hex')
    || pg_catalog.decode(pg_catalog.replace(active_key_id::text, '-', ''), 'hex')
    || nonce;
  return pg_catalog.replace(
    pg_catalog.encode(
      header || ciphertext || extensions.hmac(
        header || ciphertext,
        platform_private.cms_sealed_cursor_subkey(master, 'mac', p_domain, active_key_id),
        'sha256'
      ),
      'base64'
    ),
    E'\n', ''
  );
end;
$body$;

-- Admits one inbound sealed cursor and returns the UNSIGNED base64 cursor the keyset reader consumes.
-- A structurally malformed envelope (not a string, not 1..512 characters, not base64, not exactly 273
-- raw bytes of version 0x01) is a caller fault, INVALID_REQUEST.  A well-formed envelope whose key
-- cannot verify it, whose tag fails (constant time, before any decryption), whose payload is not a
-- JSON object, or whose expiry is missing or beyond the 24-hour ceiling is CONFLICT.
create or replace function platform_private.cms_sealed_cursor_open(p_domain text, p_cursor jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $body$
declare
  sealed_length constant integer := 273;
  cursor_text text;
  raw bytea;
  key_id uuid;
  master bytea;
  header bytea;
  ciphertext bytea;
  plaintext bytea;
  payload jsonb;
begin
  if pg_catalog.jsonb_typeof(p_cursor) is distinct from 'string' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  cursor_text := p_cursor #>> '{}';
  if pg_catalog.octet_length(cursor_text) not between 1 and 512 then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  begin
    raw := pg_catalog.decode(cursor_text, 'base64');
  exception when others then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end;
  if pg_catalog.octet_length(raw) <> sealed_length or pg_catalog.get_byte(raw, 0) <> 1 then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;

  key_id := pg_catalog.encode(pg_catalog.substring(raw, 2, 16), 'hex')::uuid;
  master := platform_private.cms_sealed_cursor_verifying_key(key_id);
  header := pg_catalog.substring(raw, 1, 33);
  ciphertext := pg_catalog.substring(raw, 34, 208);
  if not platform_private.cms_history_cursor_mac_equal(
    extensions.hmac(
      header || ciphertext,
      platform_private.cms_sealed_cursor_subkey(master, 'mac', p_domain, key_id),
      'sha256'
    ),
    pg_catalog.substring(raw, 242, 32)
  ) then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;

  plaintext := extensions.decrypt_iv(
    ciphertext,
    platform_private.cms_sealed_cursor_subkey(master, 'enc', p_domain, key_id),
    pg_catalog.substring(raw, 18, 16),
    'aes-cbc/pad:none'
  );
  begin
    payload := pg_catalog.convert_from(plaintext, 'utf8')::jsonb;
  exception when others then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end;
  -- An authenticated payload without a numeric expiry, or one that would turn an issued 24-hour
  -- cursor into a longer-lived credential, is not ours.
  if pg_catalog.jsonb_typeof(payload) is distinct from 'object'
     or coalesce(payload->>'expiresAt', '') !~ '^[0-9]{1,12}$'
     or (payload->>'expiresAt')::bigint >
        pg_catalog.floor(pg_catalog.date_part('epoch', pg_catalog.clock_timestamp()))::bigint
          + 86400 then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;

  return pg_catalog.replace(
    pg_catalog.encode(pg_catalog.convert_to(platform_private.cms_jcs(payload), 'utf8'), 'base64'),
    E'\n', ''
  );
end;
$body$;

-- Seals the unsigned nextCursor a keyset reader produced: the page returns carrying the sealed
-- envelope in its place.  A page with no next cursor is returned unchanged.  The reader is trusted
-- internal code, so a next cursor that is not exactly the declared unsigned payload is a scrubbed
-- INTERNAL_ERROR.
create or replace function platform_private.cms_sealed_cursor_seal_page(
  p_domain text,
  p_page jsonb,
  p_payload_keys text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  unsigned_payload jsonb;
begin
  if not (p_page ? 'nextCursor') or p_page->'nextCursor' = 'null'::jsonb then
    return p_page;
  end if;
  if pg_catalog.jsonb_typeof(p_page->'nextCursor') <> 'string' then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  begin
    unsigned_payload := pg_catalog.convert_from(
      pg_catalog.decode(p_page->>'nextCursor', 'base64'), 'utf8'
    )::jsonb;
  exception when others then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end;
  if not platform_private.cms_exact_keys(unsigned_payload, p_payload_keys, p_payload_keys) then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  return pg_catalog.jsonb_set(
    p_page,
    '{nextCursor}',
    pg_catalog.to_jsonb(platform_private.cms_sealed_cursor_seal(p_domain, unsigned_payload)),
    false
  );
end;
$body$;



comment on function platform_private.cms_sealed_cursor_verifying_key(uuid) is
  'Sealed-cursor key resolution: the raw Vault history key for a key id when it is the active secret or a retired_* secret updated within 24 hours; CONFLICT otherwise.';
comment on function platform_private.cms_sealed_cursor_subkey(bytea, text, text, uuid) is
  'Sealed-cursor key derivation: HMAC-SHA-256 of the history key over a label naming purpose (enc|mac), signing domain and key id.';
comment on function platform_private.cms_sealed_cursor_is_sealed(jsonb) is
  'True when a presented cursor is a sealed envelope (first raw byte 0x01) rather than a JSON signed envelope.';
comment on function platform_private.cms_sealed_cursor_seal(text, jsonb) is
  'Sealed keyset cursor issuance: AES-256-CBC under a fresh nonce over the JCS payload space-padded to 208 bytes, encrypt-then-MAC with HMAC-SHA-256; envelope 0x01 || keyId || nonce || ciphertext || tag, always 273 bytes. DEPENDENCY_UNAVAILABLE without an active Vault key.';
comment on function platform_private.cms_sealed_cursor_open(text, jsonb) is
  'Sealed keyset cursor admission: structural faults are INVALID_REQUEST; key, constant-time tag (before any decryption), payload shape and the 24-hour expiry ceiling are CONFLICT; returns the unsigned base64 cursor the reader consumes.';
comment on function platform_private.cms_sealed_cursor_seal_page(text, jsonb, text[]) is
  'Seals a keyset reader nextCursor into the sealed envelope and returns the page carrying it; a page without a next cursor is unchanged.';

revoke all on function platform_private.cms_sealed_cursor_verifying_key(uuid)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_sealed_cursor_subkey(bytea, text, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_sealed_cursor_is_sealed(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_sealed_cursor_seal(text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_sealed_cursor_open(text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_sealed_cursor_seal_page(text, jsonb, text[])
  from public, anon, authenticated, service_role;

commit;
