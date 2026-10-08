-- Slice 10 WP-S10-3 (CMS-07 / CMS-03B-03, decisions D5 and D6): schema-aware
-- revision comparison over the field, block AND relation domains, plus the safe
-- restore descriptor.
--
-- The prior private producer (20260930130000_cms_history_compare_cursor_binding)
-- hashed stable field ids only and emitted a bare "path", so a field-only 200
-- could hide a meaningful block or relation change.  This forward-only
-- replacement keeps every admission, authority, cursor-binding and keyset rule
-- of that producer and replaces only the comparison projection with the locked
-- BE03b shape:
--
--   * every change carries domain in (field, block, relation) plus the safe
--     path/kind/leftHash/rightHash contract;
--   * ordering is by domain (field, block, relation) then path (bytewise C);
--   * relation paths use the keyed cms.compare.relation.v1 targetToken and never
--     a raw target identity, and the change output publishes no target key;
--   * more than 512 combined changes is the typed comparison_too_large refusal
--     (never a truncated 200 or a scrubbed INTERNAL_ERROR), and an unresolvable
--     recorded version is comparison_unavailable;
--   * compare.restore carries the safe D6 descriptor shape derived from the
--     completed 03a migration-plan edges, through the SAME canonical chain
--     helpers the restore command uses (cms_restore_chain_derive and
--     cms_restore_chain_manifest_id from 20261005010500), so a compare-issued
--     migrationChainId can never disagree with the identity restore re-derives;
--   * a comparison side whose lineage cannot be resolved (entry/owner/content
--     type, compiled artifact hash, 03a block registry) is the non-disclosing
--     comparison_unavailable refusal, never a partial answer.
--
-- This migration also re-asserts the SIGNED history cursor admission around the
-- replaced producer.  The producer is the unsigned internal reader; callers
-- reach it only through platform_private.cms_list_revisions_signed (and the
-- service-role platform_api.cms_list_revisions wrapper), which verifies the
-- six-key signed cursor envelope on the way in and signs the next page cursor
-- on the way out.  The envelope mechanics live in three shared private helpers
-- (cms_signed_cursor_require_key / _open / _seal_page) that the CMS-03B-13
-- entry list (20261005010700) reuses, so both cursors share one Vault key
-- lookup, one retired-key grace rule and one constant-time MAC comparison.
--
-- The producer body is read by the QA-RED suite through pg_get_functiondef, so
-- every literal contract token above is present verbatim in the definition.
-- Forward-only.

begin;

-- ---------------------------------------------------------------------------
-- Shared signed-cursor envelope (CMS-03B-03 history, CMS-03B-13 entry list).
--
-- A signed cursor is base64(JCS({...payload, keyId, signature})) where
--   signature = hex(HMAC-SHA-256(
--     key  = Vault secret `keyId`,
--     data = '<domain>:v1:' || keyId || ':' || JCS(payload)))
-- and the payload carries the query-binding hash, the last keyset position and
-- the absolute expiry.  The domain separates the history ('cms-03b-03') and
-- entry-list ('cms-03b-13') cursors so one can never validate as the other even
-- though they share the per-environment Vault key.
--
-- Key handling: the active key is the Vault secret named
-- cms_editorial_history_cursor_active; a rotated key keeps verifying under a
-- cms_editorial_history_cursor_retired_* name for one cursor lifetime (24h from
-- its last Vault update).  A Vault secret with any other (or no) name never
-- verifies a cursor.  No migration provisions an operational key.
-- ---------------------------------------------------------------------------

-- Fails closed (DEPENDENCY_UNAVAILABLE) while the environment has no valid
-- active signing key, so a misprovisioned environment is visible on the first
-- request rather than only once a result spans a second page.
create or replace function platform_private.cms_signed_cursor_require_key()
returns void
language plpgsql
security definer
set search_path = ''
as $body$
declare
  active_key_id uuid;
  active_key_hex text;
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
end;
$body$;

-- Admits one inbound signed cursor and returns the UNSIGNED base64 cursor the
-- keyset reader consumes.  A structurally malformed envelope (not a string, not
-- 1..512 octets, not base64 JSON, wrong key set, non-UUID keyId, non-hex
-- signature) is a caller fault, INVALID_REQUEST; a well-formed envelope whose
-- key cannot verify it, whose MAC fails, or whose expiry is missing or beyond
-- the 24-hour ceiling is CONFLICT.  The MAC comparison is constant time.
create or replace function platform_private.cms_signed_cursor_open(
  p_domain text,
  p_cursor jsonb,
  p_payload_keys text[]
)
returns text
language plpgsql
security definer
set search_path = ''
as $body$
declare
  envelope_keys text[] := p_payload_keys || array['keyId', 'signature']::text[];
  cursor_text text;
  envelope jsonb;
  unsigned_payload jsonb;
  verifying_key_hex text;
  verifying_key_name text;
  verifying_key_updated_at timestamptz;
  expected_mac bytea;
  now_at timestamptz := pg_catalog.clock_timestamp();
begin
  if pg_catalog.jsonb_typeof(p_cursor) is distinct from 'string' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  cursor_text := p_cursor #>> '{}';
  if pg_catalog.octet_length(cursor_text) not between 1 and 512 then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  begin
    envelope := pg_catalog.convert_from(
      pg_catalog.decode(cursor_text, 'base64'), 'utf8'
    )::jsonb;
  exception when others then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end;
  if not platform_private.cms_exact_keys(envelope, envelope_keys, envelope_keys)
     or not platform_private.cms_valid_uuid(envelope->>'keyId')
     or coalesce(envelope->>'signature', '') !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;

  select secret.decrypted_secret, secret.name, secret.updated_at
    into verifying_key_hex, verifying_key_name, verifying_key_updated_at
  from vault.decrypted_secrets secret
  where secret.id = (envelope->>'keyId')::uuid;
  -- A null name or timestamp must never fall through a three-valued NOT: only
  -- the active secret, or a freshly retired one, may verify a cursor.
  if verifying_key_hex is null
     or not coalesce(verifying_key_hex ~ '^[0-9a-f]{64}$', false)
     or not coalesce(
       verifying_key_name = 'cms_editorial_history_cursor_active'
       or (
         verifying_key_name like 'cms_editorial_history_cursor_retired_%'
         and verifying_key_updated_at > now_at - interval '1 day'
       ),
       false
     ) then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;

  unsigned_payload := envelope - 'keyId' - 'signature';
  expected_mac := extensions.hmac(
    pg_catalog.convert_to(
      p_domain || ':v1:' || (envelope->>'keyId') || ':'
        || platform_private.cms_jcs(unsigned_payload),
      'utf8'
    ),
    pg_catalog.decode(verifying_key_hex, 'hex'),
    'sha256'
  );
  if not platform_private.cms_history_cursor_mac_equal(
    expected_mac,
    pg_catalog.decode(envelope->>'signature', 'hex')
  ) then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;

  -- A valid MAC must not turn an issued 24-hour cursor into a longer-lived
  -- credential, and a signed payload without a numeric expiry is not ours.
  if coalesce(unsigned_payload->>'expiresAt', '') !~ '^[0-9]{1,12}$'
     or (unsigned_payload->>'expiresAt')::bigint >
        pg_catalog.floor(pg_catalog.date_part('epoch', now_at))::bigint
          + 86400 then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;

  return pg_catalog.replace(
    pg_catalog.encode(
      pg_catalog.convert_to(platform_private.cms_jcs(unsigned_payload), 'utf8'),
      'base64'
    ),
    E'\n', ''
  );
end;
$body$;

-- Signs the unsigned nextCursor a keyset reader produced and returns the page
-- with the sealed six-key envelope in its place.  A page with no next cursor is
-- returned unchanged.  The reader is trusted internal code, so a next cursor
-- that is not exactly the declared unsigned payload, or a sealed envelope that
-- would exceed the 512-character contract, is a scrubbed INTERNAL_ERROR.
create or replace function platform_private.cms_signed_cursor_seal_page(
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
  active_key_id uuid;
  active_key_hex text;
  unsigned_payload jsonb;
  signature_hex text;
  signed_text text;
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
  if not platform_private.cms_exact_keys(
    unsigned_payload, p_payload_keys, p_payload_keys
  ) then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  select secret.id, secret.decrypted_secret
    into active_key_id, active_key_hex
  from vault.decrypted_secrets secret
  where secret.name = 'cms_editorial_history_cursor_active'
  limit 1;
  if active_key_id is null
     or not coalesce(active_key_hex ~ '^[0-9a-f]{64}$', false) then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;

  signature_hex := pg_catalog.encode(
    extensions.hmac(
      pg_catalog.convert_to(
        p_domain || ':v1:' || active_key_id::text || ':'
          || platform_private.cms_jcs(unsigned_payload),
        'utf8'
      ),
      pg_catalog.decode(active_key_hex, 'hex'),
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
    p_page, '{nextCursor}', pg_catalog.to_jsonb(signed_text), false
  );
end;
$body$;

comment on function platform_private.cms_signed_cursor_require_key() is
  'Shared signed-cursor guard: DEPENDENCY_UNAVAILABLE unless the Vault holds a valid 64-hex cms_editorial_history_cursor_active secret.';
comment on function platform_private.cms_signed_cursor_open(text, jsonb, text[]) is
  'Shared signed-cursor admission: validates the six-key envelope shape, resolves the Vault active/freshly-retired key, verifies the domain-separated HMAC in constant time, caps expiry at 24h, and returns the unsigned base64 cursor for the keyset reader. Malformed envelope is INVALID_REQUEST; unverifiable, forged or over-lived is CONFLICT.';
comment on function platform_private.cms_signed_cursor_seal_page(text, jsonb, text[]) is
  'Shared signed-cursor issuance: signs a keyset reader nextCursor with the active Vault key under the domain separator and returns the page carrying the sealed six-key envelope (<=512 chars).';

revoke all on function platform_private.cms_signed_cursor_require_key()
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_signed_cursor_open(text, jsonb, text[])
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_signed_cursor_seal_page(text, jsonb, text[])
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Comparison lineage and relation-token helpers.
--
-- The two lineage guards are SECURITY INVOKER on purpose and are owned by the
-- non-BYPASSRLS wejammin_cms_definer role (moved below, as every function that
-- names a forced Slice 09 table must be: SEC-2 / P2-S09-AC-181).  The producer
-- below runs as that role too, so every read here is subject to the same
-- forced-RLS policies and table grants as the producer itself, and no API role
-- can execute them.  The relation token names no table and stays with the
-- migration owner, with EXECUTE granted to the definer alone.
-- ---------------------------------------------------------------------------

-- True when p_version_id is a schema version of the entry's content type and
-- owner whose compiled artifact resolves and carries the recorded definition
-- hash.  A version that cannot prove its artifact is not a safe comparison or
-- restore anchor.
create or replace function platform_private.cms_compare_version_resolvable(
  p_entry_id uuid,
  p_version_id uuid
)
returns boolean
language sql
stable
set search_path = ''
as $body$
  select exists (
    select 1
    from platform_private.cms_content_entries entry_row
    join platform_private.cms_content_type_versions version_row
      on version_row.content_type_id = entry_row.content_type_id
     and version_row.owner_id = entry_row.owner_id
    join platform_private.cms_schema_artifacts artifact_row
      on artifact_row.id = version_row.schema_artifact_id
     and artifact_row.content_type_version_id = version_row.id
     and artifact_row.artifact_hash = version_row.definition_hash
    where entry_row.id = p_entry_id
      and version_row.id = p_version_id
  )
$body$;

-- True when the revision belongs to the entry and its owner, records a
-- resolvable schema version, and every active composition instance it carries
-- resolves to a registered 03a block definition version.  An unresolved block
-- is a non-disclosing comparison_unavailable at the producer, never a diff
-- computed against an unverifiable registry digest.
create or replace function platform_private.cms_compare_revision_resolvable(
  p_entry_id uuid,
  p_revision_id uuid
)
returns boolean
language sql
stable
set search_path = ''
as $body$
  select exists (
    select 1
    from platform_private.cms_content_entries entry_row
    join platform_private.cms_entry_revisions revision_row
      on revision_row.entry_id = entry_row.id
     and revision_row.owner_id = entry_row.owner_id
    where entry_row.id = p_entry_id
      and revision_row.id = p_revision_id
      and platform_private.cms_compare_version_resolvable(
        entry_row.id, revision_row.schema_version_id
      )
  )
  and not exists (
    select 1
    from platform_private.cms_composition_instances instance
    where instance.revision_id = p_revision_id
      and instance.state = 'active'
      and not exists (
        select 1
        from platform_private.cms_block_definition_versions block_row
        where block_row.block_key = instance.block_key
          and block_row.block_version = instance.block_version
      )
  )
$body$;

-- The keyed relation targetToken: lowercase hex HMAC-SHA-256 over
-- '<domain>:' || JCS({entryId, fieldId, targetKind, targetId}) with the
-- Vault-held history-signing key.  A keyed token, not a bare hash, stops a
-- reader confirming a guessed hidden target UUID, and the same tuple always
-- yields the same token so an unchanged relation compares as unchanged.
create or replace function platform_private.cms_compare_relation_token(
  p_domain text,
  p_key bytea,
  p_entry_id uuid,
  p_field_id uuid,
  p_target_kind text,
  p_target_id uuid
)
returns text
language sql
stable
set search_path = ''
as $body$
  select pg_catalog.encode(
    extensions.hmac(
      pg_catalog.convert_to(
        p_domain || ':' || platform_private.cms_jcs(
          pg_catalog.jsonb_build_object(
            'entryId', p_entry_id,
            'fieldId', p_field_id,
            'targetKind', p_target_kind,
            'targetId', p_target_id
          )
        ),
        'utf8'
      ),
      p_key,
      'sha256'
    ),
    'hex'
  )
$body$;

comment on function platform_private.cms_compare_version_resolvable(uuid, uuid) is
  'CMS-03B-03 lineage guard: the schema version belongs to the entry content type and owner and its compiled artifact hash equals the recorded definition hash.';
comment on function platform_private.cms_compare_revision_resolvable(uuid, uuid) is
  'CMS-03B-03 lineage guard: the revision belongs to the entry and owner, records a resolvable schema version and resolves every active block through the 03a registry.';
comment on function platform_private.cms_compare_relation_token(text, bytea, uuid, uuid, text, uuid) is
  'CMS-03B-03 keyed relation targetToken (cms.compare.relation.v1): HMAC-SHA-256 over the JCS of {entryId, fieldId, targetKind, targetId}; never exposes the target identity.';

-- SEC-2: the lineage guards read forced-RLS tables, so they are owned by the
-- non-BYPASSRLS definer role.  ALTER FUNCTION ... OWNER TO requires CREATE on the
-- function's schema for the new owner, granted for the length of this
-- transaction only; the definer already holds every table verb they use.  The
-- revokes run after the ownership move so the CREATE-time PUBLIC EXECUTE default
-- cannot survive.
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_compare_version_resolvable(uuid, uuid)
  owner to wejammin_cms_definer;
alter function platform_private.cms_compare_revision_resolvable(uuid, uuid)
  owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;

revoke all on function platform_private.cms_compare_version_resolvable(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_compare_revision_resolvable(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_compare_relation_token(text, bytea, uuid, uuid, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function platform_private.cms_compare_relation_token(text, bytea, uuid, uuid, text, uuid)
  to wejammin_cms_definer;

create or replace function platform_private.cms_list_revisions(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  actor_id uuid;
  resolved_acting_party_id uuid;
  entry_row platform_private.cms_content_entries%rowtype;
  target_entry_id uuid;
  requested_state text;
  requested_locale text;
  compare_revision_id uuid;
  limit_value integer := 25;
  limit_input text;
  cursor_text text;
  cursor_value jsonb;
  cursor_expires bigint;
  cursor_last_number bigint;
  cursor_last_id uuid;
  query_hash text;
  capability_candidate text;
  authorized_capability text;
  revision_row platform_private.cms_entry_revisions;
  compared_revision_row platform_private.cms_entry_revisions%rowtype;
  newest_revision_row platform_private.cms_entry_revisions%rowtype;
  rows_seen integer := 0;
  has_more boolean := false;
  cursor_revision_number bigint;
  cursor_revision_id uuid;
  next_cursor text;
  page_items jsonb := '[]'::jsonb;
  left_id uuid;
  right_id uuid;
  left_payload jsonb;
  right_payload jsonb;
  left_blocks jsonb;
  right_blocks jsonb;
  left_relations jsonb;
  right_relations jsonb;
  left_map jsonb;
  right_map jsonb;
  relation_key_hex text;
  relation_key bytea;
  compare_changes jsonb := '[]'::jsonb;
  active_version_id uuid;
  active_version_count integer;
  chain_derived jsonb;
  chain_plan_ids jsonb;
  chain_edge_count integer := 0;
  chain_availability text;
  chain_hash text;
  restore_descriptor jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  resolved_acting_party_id := platform_private.cms_acting_party(p_request, actor_id);

  -- Request shape: entryId is required; cursor/limit/state/compareRevisionId/
  -- locale are the only accepted filters.  context and correlationId are
  -- control fields, never authority.
  if not platform_private.cms_exact_keys(
    p_request,
    array['entryId']::text[],
    array[
      'entryId', 'cursor', 'limit', 'state', 'compareRevisionId', 'locale',
      'context', 'correlationId'
    ]::text[]
  ) then raise exception 'INVALID_REQUEST' using errcode = 'P0001'; end if;

  if not platform_private.cms_valid_uuid(p_request->>'entryId') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  target_entry_id := (p_request->>'entryId')::uuid;

  if p_request ? 'state'
     and p_request->'state' <> 'null'::jsonb
     and coalesce(p_request->>'state', '') not in (
       'draft', 'submitted', 'approved', 'rejected', 'scheduled', 'published'
     ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  requested_state := case
    when p_request->'state' = 'null'::jsonb then null
    else p_request->>'state'
  end;

  if p_request ? 'locale'
     and p_request->'locale' <> 'null'::jsonb
     and coalesce(p_request->>'locale', '') !~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  requested_locale := case
    when p_request->'locale' = 'null'::jsonb then null
    else p_request->>'locale'
  end;

  if p_request ? 'compareRevisionId'
     and p_request->'compareRevisionId' <> 'null'::jsonb then
    if not platform_private.cms_valid_uuid(p_request->>'compareRevisionId') then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    compare_revision_id := (p_request->>'compareRevisionId')::uuid;
  end if;

  -- limit is a query bound, not a malformed selector: an out-of-range window is
  -- a 422 VALIDATION_FAILED, matching the registry's query-bounds column rather
  -- than the malformed-query 400.
  if p_request ? 'limit' and p_request->'limit' <> 'null'::jsonb then
    limit_input := p_request->>'limit';
    if limit_input is null
       or limit_input !~ '^[0-9]{1,2}$'
       or (limit_input::integer) not between 1 and 50 then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    limit_value := limit_input::integer;
  end if;

  if p_request ? 'cursor' then
    cursor_text := nullif(p_request->>'cursor', '');
  end if;
  if cursor_text is not null
     and pg_catalog.octet_length(cursor_text) not between 1 and 512 then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;

  select * into entry_row
  from platform_private.cms_content_entries candidate
  where candidate.id = target_entry_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Authority: a registered grant keyed to the acting party AND an active
  -- assignment on this entry.  A caller that presents a capability key without
  -- the grant/assignment is refused exactly like a caller that presents none.
  authorized_capability := null;
  foreach capability_candidate in array
    platform_private.cms_revision_reader_capabilities()
  loop
    if platform_private.cms_authority_origin(
         actor_id, resolved_acting_party_id, capability_candidate, target_entry_id
       ) is not null then
      authorized_capability := capability_candidate;
      exit;
    end if;
  end loop;
  if authorized_capability is null then
    if platform_private.cms_entry_tenant_visible(actor_id, entry_row.owner_id) then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Cursor envelope: {queryHash, lastRevisionNumber, lastRevisionId, expiresAt}.
  -- queryHash binds the cursor to the exact actor, acting party, entry, filters,
  -- and window, so a cursor cannot be replayed against another context.
  query_hash := platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
    'actorId', actor_id::text,
    'actingPartyId', resolved_acting_party_id::text,
    'entryId', target_entry_id::text,
    'state', requested_state,
    'locale', requested_locale,
    'compareRevisionId', compare_revision_id::text,
    'limit', limit_value::text
  ));

  if cursor_text is not null then
    begin
      cursor_value := pg_catalog.convert_from(
        pg_catalog.decode(cursor_text, 'base64'), 'utf8'
      )::jsonb;
    exception
      when others then
        raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end;

    if not platform_private.cms_exact_keys(
      cursor_value,
      array['queryHash', 'lastRevisionNumber', 'lastRevisionId', 'expiresAt']::text[],
      array['queryHash', 'lastRevisionNumber', 'lastRevisionId', 'expiresAt']::text[]
    ) then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;

    -- A cursor whose shape is wrong is malformed (400).  A cursor that is
    -- well-formed but bound to another actor, party, entry, filter set, or
    -- window, or that has expired, is a cursor/context mismatch (409), exactly
    -- as the registry error matrix separates the two.
    if coalesce(cursor_value->>'queryHash', '') is distinct from query_hash
       or not platform_private.cms_valid_version(cursor_value->>'lastRevisionNumber')
       or not platform_private.cms_valid_uuid(cursor_value->>'lastRevisionId')
       or coalesce(cursor_value->>'expiresAt', '') !~ '^[0-9]{1,12}$' then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;

    cursor_expires := (cursor_value->>'expiresAt')::bigint;
    cursor_last_number := (cursor_value->>'lastRevisionNumber')::bigint;
    cursor_last_id := (cursor_value->>'lastRevisionId')::uuid;

    if cursor_expires <= pg_catalog.floor(
         pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
       )::bigint then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
  end if;

  -- The comparison target is resolved before pagination so an unreadable or
  -- off-entry target is a 404 regardless of which window was requested.
  if compare_revision_id is not null then
    select * into compared_revision_row
    from platform_private.cms_entry_revisions candidate
    where candidate.id = compare_revision_id;
    if not found then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
    if compared_revision_row.entry_id <> target_entry_id then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
    if platform_private.cms_revision_page_disposition(
         actor_id, resolved_acting_party_id, compared_revision_row
       ) = 'absent' then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
  end if;

  -- Keyset walk: descending (revision_number, id).  Concealed rows still
  -- advance the scan (a cursor must not become a probe), so has_more is decided
  -- only by the first row the caller is allowed to see beyond the window.
  for revision_row in
    select candidate.*
    from platform_private.cms_entry_revisions candidate
    where candidate.entry_id = target_entry_id
      and (requested_state is null or candidate.state = requested_state)
      and (requested_locale is null or candidate.locale = requested_locale)
      and (
        cursor_text is null
        or candidate.revision_number < cursor_last_number
        or (
          candidate.revision_number = cursor_last_number
          and candidate.id < cursor_last_id
        )
      )
    order by candidate.revision_number desc, candidate.id desc
  loop
    if platform_private.cms_revision_page_disposition(
         actor_id, resolved_acting_party_id, revision_row
       ) = 'absent' then
      continue;
    end if;

    if rows_seen >= limit_value then
      has_more := true;
      exit;
    end if;
    rows_seen := rows_seen + 1;
    cursor_revision_number := revision_row.revision_number;
    cursor_revision_id := revision_row.id;

    page_items := page_items || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'id', revision_row.id,
        'revisionNumber', revision_row.revision_number::text,
        'locale', revision_row.locale,
        'state', revision_row.state,
        'contentHash', platform_private.cms_revision_content_hash(
          revision_row.id,
          revision_row.payload_hash::text,
          revision_row.locale,
          revision_row.schema_version_id
        ),
        'createdAt', platform_private.auth_iso_time(revision_row.created_at),
        'authorClass', platform_private.cms_revision_author_class(
          revision_row.entry_id, revision_row.author_person_id
        )
      )
    );
  end loop;

  if has_more then
    next_cursor := pg_catalog.replace(
      pg_catalog.encode(
        pg_catalog.convert_to(
          platform_private.cms_jcs(pg_catalog.jsonb_build_object(
            'queryHash', query_hash,
          'lastRevisionNumber', cursor_revision_number::text,
          'lastRevisionId', cursor_revision_id::text,
            'expiresAt', (
              pg_catalog.floor(
                pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
              ) + 86400
            )::bigint::text
          )),
          'utf8'
        ),
        'base64'
      ),
      E'\n', ''
    );
    -- A cursor that cannot fit the 512-character contract is withheld rather
    -- than truncated; the client re-reads the first window instead.
    if pg_catalog.octet_length(next_cursor) > 512 then
      next_cursor := null;
      has_more := false;
    end if;
  end if;

  if compare_revision_id is null then
    return pg_catalog.jsonb_build_object(
      'items', page_items,
      'nextCursor', next_cursor,
      'pageVersion', entry_row.version::text,
      'compare', null
    );
  end if;

  -- The right side of the comparison is the newest readable revision on the
  -- entry that matches the requested locale.  The state filter is deliberately
  -- not applied: state is a window filter for the history list, and narrowing
  -- the comparison side to it would silently change what "latest" means.
  select * into newest_revision_row
  from platform_private.cms_entry_revisions candidate
  where candidate.entry_id = target_entry_id
    and (requested_locale is null or candidate.locale = requested_locale)
    and platform_private.cms_revision_page_disposition(
          actor_id, resolved_acting_party_id, candidate
        ) = 'visible'
  order by candidate.revision_number desc, candidate.id desc
  limit 1;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- An unresolvable recorded lineage on either side is a non-disclosing
  -- refusal: the comparison cannot be computed safely, so it is not fabricated.
  -- Each side must belong to this entry and owner, record a schema version of
  -- the entry's content type whose compiled artifact hash equals the recorded
  -- definition hash, and resolve every active block through the 03a registry.
  if not platform_private.cms_compare_revision_resolvable(
       target_entry_id, compared_revision_row.id
     )
     or not platform_private.cms_compare_revision_resolvable(
       target_entry_id, newest_revision_row.id
     ) then
    raise exception 'comparison_unavailable' using errcode = 'P0001';
  end if;

  left_id := compared_revision_row.id;
  right_id := newest_revision_row.id;

  left_payload := platform_private.cms_revision_field_payload(
    left_id, compared_revision_row.locale, compared_revision_row.schema_version_id
  );
  right_payload := platform_private.cms_revision_field_payload(
    right_id, newest_revision_row.locale, newest_revision_row.schema_version_id
  );

  -- The relation token reuses the Vault-held history-signing key with the
  -- cms.compare.relation.v1 domain separator (no new secret).  It is only
  -- required when the entry actually carries relations; a missing key with
  -- relations present is a non-disclosing refusal.
  select secret.decrypted_secret
    into relation_key_hex
  from vault.decrypted_secrets secret
  where secret.name = 'cms_editorial_history_cursor_active'
  limit 1;
  if relation_key_hex is not null and relation_key_hex ~ '^[0-9a-f]{64}$' then
    relation_key := pg_catalog.decode(relation_key_hex, 'hex');
  end if;
  if exists (
       select 1
       from platform_private.cms_entry_relations relation_row
       where relation_row.revision_id in (left_id, right_id)
     ) then
    if relation_key is null then
      raise exception 'comparison_unavailable' using errcode = 'P0001';
    end if;
    -- Relation lineage: the stored relation must resolve, through its field
    -- definition version, to the stable field it is keyed by on the schema
    -- version its revision recorded, and that definition must carry a
    -- relation definition.  The comparison key stays the stable field id; the
    -- version-specific definition id is never part of the path.
    if exists (
         select 1
         from platform_private.cms_entry_relations relation_row
         join platform_private.cms_entry_revisions relation_revision
           on relation_revision.id = relation_row.revision_id
         where relation_row.revision_id in (left_id, right_id)
           and not exists (
             select 1
             from platform_private.cms_field_definition_versions field_row
             join platform_private.cms_relation_definitions definition_row
               on definition_row.field_definition_id = field_row.id
             where field_row.id = relation_row.field_definition_id
               and field_row.stable_field_id = relation_row.field_id
               and field_row.content_type_version_id
                 = relation_revision.schema_version_id
           )
       ) then
      raise exception 'comparison_unavailable' using errcode = 'P0001';
    end if;
  end if;

  -- Block side map: JCS hash of the locked {blockKey, blockVersion,
  -- blockRegistryDigest, mode, patternRef, props, bindings} input, keyed by the
  -- composition instance path.  The registry digest and bindings are folded
  -- into the digest; no target identity is ever included.  Two active
  -- instances on one path would silently collapse into one map entry, and a
  -- path whose /blocks/<path> pointer cannot fit the 256-character JsonPointer
  -- contract could never be returned intact, so each is a non-disclosing
  -- refusal rather than a hidden or truncated change.
  if exists (
       select 1
       from platform_private.cms_composition_instances instance
       where instance.revision_id in (left_id, right_id)
         and instance.state = 'active'
       group by instance.revision_id, instance.path
       having pg_catalog.count(*) > 1
     )
     or exists (
       select 1
       from platform_private.cms_composition_instances instance
       where instance.revision_id in (left_id, right_id)
         and instance.state = 'active'
         and pg_catalog.octet_length('/blocks/' || instance.path) > 256
     ) then
    raise exception 'comparison_unavailable' using errcode = 'P0001';
  end if;
  select
    coalesce(pg_catalog.jsonb_object_agg(block_side.path, block_side.side_hash)
      filter (where block_side.revision_id = left_id), '{}'::jsonb),
    coalesce(pg_catalog.jsonb_object_agg(block_side.path, block_side.side_hash)
      filter (where block_side.revision_id = right_id), '{}'::jsonb)
  into left_blocks, right_blocks
  from (
    select instance.revision_id,
           '/blocks/' || instance.path as path,
           platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
             'blockKey', instance.block_key,
             'blockVersion', instance.block_version,
             'blockRegistryDigest',
               pg_catalog.btrim(instance.block_registry_digest::text),
             'mode', instance.link_mode,
             'patternRef', case
               when instance.pattern_id is null then null
               else pg_catalog.jsonb_build_object(
                 'patternId', instance.pattern_id,
                 'patternVersion', instance.pattern_version
               )
             end,
             'props', instance.props,
             'bindings', instance.bindings
           )) as side_hash
    from platform_private.cms_composition_instances instance
    where instance.revision_id in (left_id, right_id)
      and instance.state = 'active'
  ) block_side;

  -- Relation side map: keyed by the stable field id and the keyed targetToken
  -- (HMAC-SHA-256 over the JCS of {entryId, fieldId, targetKind, targetId} with
  -- the cms.compare.relation.v1 separator), never a raw target identity.  The
  -- same relation yields the same token on both sides of one read, so an
  -- unchanged relation compares as unchanged.  The side hash is the JCS hash
  -- of the locked {relationDefinitionVersion, position, expectedTargetVersion}
  -- input and never folds a target identity into the digest.
  select
    coalesce(pg_catalog.jsonb_object_agg(relation_side.path, relation_side.side_hash)
      filter (where relation_side.revision_id = left_id), '{}'::jsonb),
    coalesce(pg_catalog.jsonb_object_agg(relation_side.path, relation_side.side_hash)
      filter (where relation_side.revision_id = right_id), '{}'::jsonb)
  into left_relations, right_relations
  from (
    select relation_row.revision_id,
           '/relations/' || relation_row.field_id::text || '/'
             || platform_private.cms_compare_relation_token(
                  'cms.compare.relation.v1',
                  relation_key,
                  target_entry_id,
                  relation_row.field_id,
                  relation_row.target_kind,
                  relation_row.target_id
                ) as path,
           platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
             'relationDefinitionVersion', (
               select definition_row.version
               from platform_private.cms_relation_definitions definition_row
               where definition_row.field_definition_id
                 = relation_row.field_definition_id
               order by definition_row.version desc
               limit 1
             ),
             'position', relation_row.position,
             'expectedTargetVersion', relation_row.expected_target_version
           )) as side_hash
    from platform_private.cms_entry_relations relation_row
    where relation_row.revision_id in (left_id, right_id)
  ) relation_side;

  -- The field projection is keyed by the stable field id; the locked compare
  -- path namespaces it as /fields/<stableFieldId> so the domain classifier and
  -- the bytewise ordering see a field pointer rather than a bare id (which would
  -- otherwise be classified into the relation domain).  jsonb_each preserves an
  -- explicit-null value as JSON null, so a declared-null field keeps a null side
  -- hash instead of a fabricated digest.
  left_map := coalesce((
    select pg_catalog.jsonb_object_agg(
      '/fields/' || field_key.key, field_key.value
    )
    from pg_catalog.jsonb_each(left_payload) as field_key(key, value)
  ), '{}'::jsonb) || left_blocks || left_relations;
  right_map := coalesce((
    select pg_catalog.jsonb_object_agg(
      '/fields/' || field_key.key, field_key.value
    )
    from pg_catalog.jsonb_each(right_payload) as field_key(key, value)
  ), '{}'::jsonb) || right_blocks || right_relations;

  -- A semantic linear change list keyed by the stable pointer path across all
  -- three domains.  Only the pointer and the two safe hashes are exposed: no
  -- value and no target identity.  left is the explicitly requested
  -- compareRevisionId and right is the newest readable revision, so kind=added
  -- means the item exists only on the newer side.  Ordering is by domain
  -- (field, block, relation) then path, bytewise.
  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'domain', change_key.domain,
      'path', change_key.path,
      'kind', case
        when left_map ? change_key.path
         and right_map ? change_key.path
         and left_map->change_key.path
             is distinct from right_map->change_key.path then 'changed'
        when left_map ? change_key.path
         and right_map ? change_key.path then 'unchanged'
        when right_map ? change_key.path then 'added'
        else 'removed'
      end,
      'leftHash', case
        when left_map ? change_key.path
          then left_map->change_key.path #>> '{}'
        else null
      end,
      'rightHash', case
        when right_map ? change_key.path
          then right_map->change_key.path #>> '{}'
        else null
      end
    ) order by change_key.domain_rank, change_key.path collate "C"
  ), '[]'::jsonb) into compare_changes
  from (
    select path_key.path,
           case
             when path_key.path like '/fields/%' then 'field'
             when path_key.path like '/blocks/%' then 'block'
             else 'relation'
           end as domain,
           case
             when path_key.path like '/fields/%' then 1
             when path_key.path like '/blocks/%' then 2
             else 3
           end as domain_rank
    from (
      select pg_catalog.jsonb_object_keys(left_map) as path
      union
      select pg_catalog.jsonb_object_keys(right_map) as path
    ) path_key
  ) change_key;

  if pg_catalog.jsonb_array_length(compare_changes) > 512 then
    raise exception 'comparison_too_large' using errcode = 'P0001';
  end if;

  -- D6 restore descriptor for leftRevisionId, derived through the SAME
  -- canonical chain helpers the restore command (20261005010500) re-derives
  -- from, so a compare-issued migrationChainId always equals the identity
  -- restore requires.  Zero edges is a genuine same-schema restore.  The
  -- descriptor is fail-closed: more or fewer than one active version, an
  -- active version whose compiled artifact does not verify, or an ambiguous,
  -- unreachable or over-64-edge path is chain_unavailable, and a plan without a
  -- registered transform is transform_missing; nothing is fabricated.
  select pg_catalog.count(*)::integer,
         (pg_catalog.array_agg(version_row.id))[1]
    into active_version_count, active_version_id
  from platform_private.cms_content_type_versions version_row
  where version_row.content_type_id = entry_row.content_type_id
    and version_row.state::text = 'active';
  if active_version_count <> 1 then
    active_version_id := null;
  end if;

  chain_derived := null;
  if active_version_id is not null
     and platform_private.cms_compare_version_resolvable(
       target_entry_id, active_version_id
     ) then
    chain_derived := platform_private.cms_restore_chain_derive(
      entry_row.content_type_id,
      compared_revision_row.schema_version_id,
      active_version_id
    );
  end if;

  if chain_derived is null then
    chain_availability := 'chain_unavailable';
    chain_plan_ids := '[]'::jsonb;
    chain_edge_count := 0;
    chain_hash := platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
      'contentTypeId', entry_row.content_type_id,
      'sourceSchemaVersionId', compared_revision_row.schema_version_id,
      'targetSchemaVersionId', active_version_id,
      'planIds', chain_plan_ids
    ));
  else
    chain_availability := 'available';
    chain_plan_ids := chain_derived->'planIds';
    chain_edge_count := (chain_derived->>'edgeCount')::integer;
    chain_hash := chain_derived->>'hash';
    if exists (
      select 1
      from pg_catalog.jsonb_array_elements_text(chain_plan_ids) as member(plan_id)
      join platform_private.cms_schema_migration_plans plan_row
        on plan_row.id = member.plan_id::uuid
      where plan_row.transform_key is not null
        and not exists (
          select 1
          from platform_private.cms_schema_transform_registry registry_row
          where registry_row.transform_key = plan_row.transform_key
            and registry_row.transform_version = plan_row.transform_version
        )
    ) then
      chain_availability := 'transform_missing';
    end if;
  end if;

  restore_descriptor := pg_catalog.jsonb_build_object(
    'migrationChainId', platform_private.cms_restore_chain_manifest_id(chain_hash),
    'edgeCount', chain_edge_count,
    'chainHash', chain_hash,
    'availability', chain_availability
  );

  return pg_catalog.jsonb_build_object(
    'items', page_items,
    'nextCursor', next_cursor,
    'pageVersion', entry_row.version::text,
    'compare', pg_catalog.jsonb_build_object(
      'leftRevisionId', compared_revision_row.id,
      'rightRevisionId', newest_revision_row.id,
      'restore', restore_descriptor,
      'changes', compare_changes
    )
  );
end;
$body$;

comment on function platform_private.cms_list_revisions(jsonb) is
  'CMS-03B-03 safe revision history and schema-aware comparison.  Authority is server-derived (registered grant keyed to the resolved acting party plus an active entry assignment); a hidden entry is NOT_FOUND and a visible one the caller cannot read is FORBIDDEN.  The comparison covers the field, block and relation domains with domain/path/kind/leftHash/rightHash changes ordered by domain then path; relation paths use the keyed cms.compare.relation.v1 targetToken and never expose a target identity.  More than 512 combined changes is comparison_too_large and an unresolvable recorded version is comparison_unavailable, never a truncated 200.  compare.restore carries the derived migrationChainId/edgeCount/chainHash/availability descriptor.  No row is written and no audit or outbox event is emitted.';

alter function platform_private.cms_list_revisions(jsonb)
  owner to wejammin_cms_definer;

-- SEC-2: the producer runs as the NOLOGIN wejammin_cms_definer role (no BYPASSRLS),
-- so its comparison reads need the same least-privilege grants the other Slice 09/10
-- definer functions carry.  The relation domain reuses the Vault-held history signing
-- key, so the producer reads vault.decrypted_secrets: schema USAGE plus SELECT on that
-- view only (never vault.secrets).  The block domain reads the force-RLS
-- cms_composition_instances; SELECT there is admitted by its existing PUBLIC
-- RPC-context policy (cms_rpc_context_valid()), which the producer satisfies with
-- app.cms_rpc = 'true', so no new policy is added.  Forward-only.
grant usage on schema vault to wejammin_cms_definer;

grant select on table vault.decrypted_secrets to wejammin_cms_definer;

-- The view projects its decrypted column through the vault-owned decrypt helper,
-- which is owned by the Supabase admin role and EXECUTE-granted only to postgres
-- and service_role.  A non-bypass definer reading the view must hold EXECUTE on
-- exactly that helper (and only that one).
grant execute on function vault._crypto_aead_det_decrypt(bytea, bytea, bigint, bytea, bytea)
  to wejammin_cms_definer;

grant select on table platform_private.cms_composition_instances
  to wejammin_cms_definer;

revoke all on function platform_private.cms_list_revisions(jsonb)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- CMS-03B-03 signed history wrapper.  The producer above is the unsigned
-- internal reader; this wrapper is the only caller-facing path
-- (platform_api.cms_list_revisions delegates here).  It keeps the established
-- admission order -- structural request shape, then the Vault key dependency,
-- then the inbound signed cursor -- and signs the next page cursor with the
-- active key, using the shared envelope helpers above.  The signature domain
-- stays 'cms-03b-03', so cursors issued before this migration remain valid.
-- ---------------------------------------------------------------------------
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
      pg_catalog.to_jsonb(platform_private.cms_signed_cursor_open(
        'cms-03b-03', p_request->'cursor', cursor_payload_keys
      )),
      false
    );
  end if;

  -- The private reader rechecks the actor, assignment, query hash, expiry,
  -- keyset position, schema-aware hashes, and target readability.
  return platform_private.cms_signed_cursor_seal_page(
    'cms-03b-03',
    platform_private.cms_list_revisions(request_for_reader),
    cursor_payload_keys
  );
end;
$body$;

comment on function platform_private.cms_list_revisions_signed(jsonb) is
  'CMS-03B-03 service-bound history wrapper: requires a per-environment Supabase Vault HMAC key, verifies the signed context-bound cursor in constant time, and signs the next page cursor without exposing key material. A malformed signed envelope (wrong key set, non-UUID keyId, non-hex signature) is INVALID_REQUEST; an unverifiable or context-mismatched valid-shaped envelope stays CONFLICT. The comparison producer behind it is unsigned and internal. No migration provisions an operational key.';

revoke all on function platform_private.cms_list_revisions_signed(jsonb)
  from public, anon, authenticated, service_role;

commit;
