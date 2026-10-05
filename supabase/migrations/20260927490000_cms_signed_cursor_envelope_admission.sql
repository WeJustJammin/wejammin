-- CMS-03B-03 forward-only correction: a signed history cursor that is not
-- structurally well-formed is a caller fault and must return INVALID_REQUEST,
-- while a valid-shaped envelope whose key cannot be verified or whose MAC
-- fails stays CONFLICT.  Replaces only the private wrapper body; the private
-- MAC helper, grants, and delegation wrapper keep their established shape.

begin;

create or replace function platform_private.cms_list_revisions_signed(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  active_key_id uuid;
  active_key_hex text;
  active_key bytea;
  verifying_key_hex text;
  verifying_key_name text;
  verifying_key_updated_at timestamptz;
  signed_cursor jsonb;
  unsigned_payload jsonb;
  unsigned_cursor text;
  signed_text text;
  signature_hex text;
  signature_preimage text;
  expected_mac bytea;
  request_for_reader jsonb := p_request;
  result jsonb;
  now_at timestamptz := pg_catalog.clock_timestamp();
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

  select secret.id, secret.decrypted_secret
    into active_key_id, active_key_hex
  from vault.decrypted_secrets secret
  where secret.name = 'cms_editorial_history_cursor_active'
  limit 1;
  if active_key_id is null
     or not coalesce(
       active_key_hex ~ '^[0-9a-f]{64}$', false
     ) then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;
  active_key := pg_catalog.decode(active_key_hex, 'hex');

  if p_request ? 'cursor' and p_request->'cursor' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(p_request->'cursor') <> 'string'
       or pg_catalog.octet_length(p_request->>'cursor') not between 1 and 512 then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    begin
      signed_cursor := pg_catalog.convert_from(
        pg_catalog.decode(p_request->>'cursor', 'base64'), 'utf8'
      )::jsonb;
    exception when others then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end;
    if signed_cursor is null or not platform_private.cms_exact_keys(
      signed_cursor,
      array[
        'queryHash', 'lastRevisionNumber', 'lastRevisionId', 'expiresAt',
        'keyId', 'signature'
      ]::text[],
      array[
        'queryHash', 'lastRevisionNumber', 'lastRevisionId', 'expiresAt',
        'keyId', 'signature'
      ]::text[]
    )
       or not platform_private.cms_valid_uuid(signed_cursor->>'keyId')
       or coalesce(signed_cursor->>'signature', '')
            !~ '^[0-9a-f]{64}$' then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;

    select secret.decrypted_secret, secret.name, secret.updated_at
      into verifying_key_hex, verifying_key_name, verifying_key_updated_at
    from vault.decrypted_secrets secret
    where secret.id = (signed_cursor->>'keyId')::uuid;
    if verifying_key_hex is null
       or not coalesce(
         verifying_key_hex ~ '^[0-9a-f]{64}$', false
       )
       or not (
         verifying_key_name = 'cms_editorial_history_cursor_active'
         or (
           verifying_key_name like 'cms_editorial_history_cursor_retired_%'
           and verifying_key_updated_at > now_at - interval '1 day'
         )
       ) then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;

    unsigned_payload := signed_cursor - 'keyId' - 'signature';
    signature_preimage := 'cms-03b-03:v1:' || (signed_cursor->>'keyId')
      || ':' || platform_private.cms_jcs(unsigned_payload);
    expected_mac := extensions.hmac(
      pg_catalog.convert_to(signature_preimage, 'utf8'),
      pg_catalog.decode(verifying_key_hex, 'hex'),
      'sha256'
    );
    if not platform_private.cms_history_cursor_mac_equal(
      expected_mac,
      pg_catalog.decode(signed_cursor->>'signature', 'hex')
    ) then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    if coalesce(unsigned_payload->>'expiresAt', '') ~ '^[0-9]{1,12}$' then
      if (unsigned_payload->>'expiresAt')::bigint >
         pg_catalog.floor(pg_catalog.date_part('epoch', now_at))::bigint
           + 86400 then
        raise exception 'CONFLICT' using errcode = 'P0001';
      end if;
    end if;
    unsigned_cursor := pg_catalog.replace(
      pg_catalog.encode(
        pg_catalog.convert_to(
          platform_private.cms_jcs(unsigned_payload), 'utf8'
        ),
        'base64'
      ),
      E'\n', ''
    );
    request_for_reader := pg_catalog.jsonb_set(
      p_request, '{cursor}', pg_catalog.to_jsonb(unsigned_cursor), false
    );
  end if;

  -- The private reader rechecks the actor, assignment, query hash, expiry,
  -- keyset position, schema-aware hashes, and target readability.
  result := platform_private.cms_list_revisions(request_for_reader);
  if not (result ? 'nextCursor') or result->'nextCursor' = 'null'::jsonb then
    return result;
  end if;
  if pg_catalog.jsonb_typeof(result->'nextCursor') <> 'string' then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  begin
    unsigned_payload := pg_catalog.convert_from(
      pg_catalog.decode(result->>'nextCursor', 'base64'), 'utf8'
    )::jsonb;
  exception when others then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end;
  if not platform_private.cms_exact_keys(
    unsigned_payload,
    array[
      'queryHash', 'lastRevisionNumber', 'lastRevisionId', 'expiresAt'
    ]::text[],
    array[
      'queryHash', 'lastRevisionNumber', 'lastRevisionId', 'expiresAt'
    ]::text[]
  ) then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  signature_preimage := 'cms-03b-03:v1:' || active_key_id::text
    || ':' || platform_private.cms_jcs(unsigned_payload);
  signature_hex := pg_catalog.encode(
    extensions.hmac(
      pg_catalog.convert_to(signature_preimage, 'utf8'),
      active_key,
      'sha256'
    ),
    'hex'
  );
  signed_text := pg_catalog.replace(
    pg_catalog.encode(
      pg_catalog.convert_to(
        platform_private.cms_jcs(
          unsigned_payload || pg_catalog.jsonb_build_object(
            'keyId', active_key_id,
            'signature', signature_hex
          )
        ),
        'utf8'
      ),
      'base64'
    ),
    E'\n', ''
  );
  if pg_catalog.octet_length(signed_text) > 512 then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  return pg_catalog.jsonb_set(
    result, '{nextCursor}', pg_catalog.to_jsonb(signed_text), false
  );
end;
$body$;

comment on function platform_private.cms_list_revisions_signed(jsonb) is
  'CMS-03B-03 service-bound history wrapper: requires a per-environment Supabase Vault HMAC key, verifies the signed context-bound cursor in constant time, and signs the next page cursor without exposing key material. A malformed signed envelope (wrong key set, non-UUID keyId, non-hex signature) is INVALID_REQUEST; an unverifiable or context-mismatched valid-shaped envelope stays CONFLICT. No migration provisions an operational key.';

create or replace function platform_api.cms_list_revisions(p_request jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $body$
  select platform_private.cms_list_revisions_signed(p_request)
$body$;

revoke all on function platform_private.cms_history_cursor_mac_equal(bytea, bytea)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_list_revisions_signed(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_api.cms_list_revisions(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_list_revisions(jsonb) to service_role;

commit;
