-- Slice 09 (AC103; found by the real-stack release suite): the CMS-03A-05 answer lacked
-- the ResourceMeta members.  BE03a defines BlockDefinitionVersionResource as ResourceMeta
-- (id, version, contentHash, createdAt, updatedAt) plus the block members, a strict
-- object, and the Worker validates the RPC answer against it.  The database answered
-- without contentHash, createdAt and updatedAt, so every registration that committed
-- (and every idempotent replay of it, which returns the stored answer) reached the wire
-- as 502 DEPENDENCY_UNAVAILABLE.  Worker tests fed the port a fixture that had the
-- members and the pgTAP suite checked only a few of the database's own members, so
-- neither side could see it.  The answer now carries contentHash (the SHA-256 of the
-- registered row, the convention of every other resource), createdAt and updatedAt (equal:
-- the registration is immutable).  Body regenerated from the live function, one
-- expression added.  Forward-only.
begin;

CREATE OR REPLACE FUNCTION platform_private.cms_register_block_at(p_request jsonb, p_now_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid;
  reservation platform_private.idempotency_records;
  correlation_id uuid;
  receipt_id uuid;
  release_receipt platform_private.cms_release_nonce_receipts%rowtype;
  block_id uuid := extensions.gen_random_uuid();
  attestation_evidence jsonb;
  response jsonb;
  now_at timestamptz := coalesce(p_now_at, pg_catalog.clock_timestamp());
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  perform platform_private.cms_release_route_gate(p_request);
  actor_id := platform_private.cms_release_actor(p_request);
  correlation_id := platform_private.cms_correlation(p_request);
  reservation := platform_private.cms_reserve(p_request, actor_id, 'CMS-03A-05:' || coalesce(p_request->>'blockKey', ''));
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    return jsonb_build_object('resourceKind', 'block_definition_version', 'id', (reservation.response_ref->>'resourceRef')::uuid);
  end if;
  if not platform_private.cms_valid_block_request(p_request) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  -- Claim and lock the release-principal row before reading the nested
  -- attestation.  The key rotation cannot split the two verifications.
  receipt_id := platform_private.cms_release_nonce_claim_at(
    p_request, 'CMS-03A-05', actor_id, now_at
  );
  attestation_evidence := platform_private.cms_verify_props_attestation(p_request, actor_id);
  select * into release_receipt
  from platform_private.cms_release_nonce_receipts
  where id = receipt_id;
  -- A (blockKey, blockVersion) pair is registered once and never reused: competing
  -- registrations of one pair serialize on a transaction lock and the loser (or a
  -- later caller) gets the typed 409, never the raw unique violation.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'cms.block:' || (p_request->>'blockKey') || ':' || (p_request->>'blockVersion'), 0));
  if exists (
    select 1 from platform_private.cms_block_definition_versions existing
     where existing.block_key = p_request->>'blockKey'
       and existing.block_version = (p_request->>'blockVersion')::integer
  ) then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  insert into platform_private.cms_block_definition_versions(
    id, owner_id, state, version, block_key, block_version, props_schema_ref,
    props_schema_hash, props_schema_snapshot, props_snapshot_hash,
    props_snapshot_attestation, props_attestation_key_id,
    props_attestation_signature_hash, props_attestation_verified_at, renderer_ref,
    allowed_children, slot_rules, data_source_permissions, accessibility_contract,
    compatibility_range, release_digest, release_principal_id, release_key_id,
    release_raw_body_hash, release_signature_hash, release_nonce_hash,
    release_verified_at
  ) values (
    block_id, actor_id, 'registered', 1, p_request->>'blockKey',
    (p_request->>'blockVersion')::integer, p_request->>'propsSchemaRef',
    p_request->>'propsSchemaHash', p_request->'propsSchemaSnapshot',
    p_request->>'propsSnapshotHash', p_request->'propsSnapshotAttestation',
    attestation_evidence->>'keyId', attestation_evidence->>'signatureHash',
    release_receipt.verified_at,
    p_request->>'rendererRef', coalesce(p_request->'allowedChildren', '[]'::jsonb),
    coalesce(p_request->'slotRules', '{}'::jsonb), coalesce(p_request->'dataSourcePermissions', '[]'::jsonb),
    coalesce(p_request->'accessibility', p_request->'accessibilityContract'),
    coalesce(p_request->'compatibility', p_request->'compatibilityRange'), p_request->>'releaseDigest',
    actor_id, release_receipt.release_key_id,
    release_receipt.raw_body_hash,
    release_receipt.signature_hash,
    encode(extensions.digest(convert_to(p_request->>'releaseNonce', 'utf8'), 'sha256'), 'hex'),
    release_receipt.verified_at
  );
  perform platform_private.cms_emit_event(
    'cms.block.register', actor_id, actor_id, 'cms_block_definition_version', block_id,
    'CMS_BLOCK_REGISTERED', 'cms.block.registered.v1', 'cms_block_definition_version', block_id,
    1,
    jsonb_build_object(
      'blockDefinitionVersionId', block_id,
      'blockKey', p_request->>'blockKey',
      'blockVersion', (p_request->>'blockVersion')::integer,
      'releaseDigest', p_request->>'releaseDigest'
    ), correlation_id
  );
  update platform_private.cms_release_nonce_receipts set outcome = 'consumed', consumed_at = now(), updated_at = now() where id = receipt_id;
  select jsonb_build_object(
    'resourceKind', 'block_definition_version', 'id', block.id, 'version', block.version::text,
    'contentHash', encode(extensions.digest(convert_to(block::text, 'utf8'), 'sha256'), 'hex'),
    'createdAt', block.created_at, 'updatedAt', block.updated_at,
    'blockKey', block.block_key, 'blockVersion', block.block_version,
    'propsSchemaRef', block.props_schema_ref, 'propsSchemaHash', block.props_schema_hash,
    'propsSchemaSnapshot', block.props_schema_snapshot, 'propsSnapshotHash', block.props_snapshot_hash,
    'propsSnapshotAttestation', block.props_snapshot_attestation, 'rendererRef', block.renderer_ref,
    'releaseDigest', block.release_digest, 'releaseKeyId', block.release_key_id,
    'releaseRawBodyHash', block.release_raw_body_hash, 'releaseSignatureHash', block.release_signature_hash,
    'releaseNonceHash', block.release_nonce_hash, 'releaseVerifiedAt', block.release_verified_at,
    'lifecycle', 'supported'
  ) into response from platform_private.cms_block_definition_versions block where block.id = block_id;
  perform platform_private.cms_complete(reservation.id, block_id, 201, response);
  return response;
end;
$function$;

commit;
