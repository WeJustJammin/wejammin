-- Slice 09 (SEC-5, AC034; BE03a rows 164/165 and the CMS-03A-05/08 denial rows): a
-- human or admin caller on the release routes is 403, not 401.  BE03a defines the
-- signed release-worker principal as the only caller and says "human/admin or
-- invalid capability is 403", while "only a missing or invalid release principal, or
-- signature verification failure, returns exactly 401".  The database answered every
-- non-principal caller with UNAUTHENTICATED, so a signed-in human (an `authenticated`
-- role, or a release call whose request context names a verified human actor) saw 401
-- and the 403 row existed only as a Worker mapping of a stubbed port.
-- platform_private.cms_release_route_gate is the one gate both commands now open
-- with: a human or admin caller is FORBIDDEN, and every other caller is judged as
-- before (service_role plus an active signed release principal, else UNAUTHENTICATED:
-- an anonymous caller, an unknown, revoked or expired key, a bad signature).  Nothing
-- else in either command changes (bodies regenerated from the live functions, one
-- line each); the shared cms_require_release_worker keeps its answer for the
-- migration-worker gates.  Forward-only.
begin;

create function platform_private.cms_release_route_gate(p_request jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $body$
begin
  if platform_private.request_jwt_claim('role') = 'authenticated'
     or nullif(p_request->'context'->>'authUserId', '') is not null then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  perform platform_private.cms_require_release_worker();
end;
$body$;
revoke all on function platform_private.cms_release_route_gate(jsonb) from public, anon, authenticated, service_role;
grant execute on function platform_private.cms_release_route_gate(jsonb) to wejammin_cms_definer;

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

CREATE OR REPLACE FUNCTION platform_private.cms_advance_block_lifecycle(p_request jsonb)
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
  block_row platform_private.cms_block_definition_versions%rowtype;
  current_lifecycle text := 'supported';
  event_id uuid;
  event_at timestamptz;
  response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  perform platform_private.cms_release_route_gate(p_request);
  actor_id := platform_private.cms_release_actor(p_request);
  correlation_id := platform_private.cms_correlation(p_request);
  reservation := platform_private.cms_reserve(p_request, actor_id, 'CMS-03A-08:' || coalesce(p_request->>'blockDefinitionVersionId', ''));
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    return jsonb_build_object('resourceKind', 'block_definition_lifecycle_event', 'id', (reservation.response_ref->>'resourceRef')::uuid);
  end if;
  if not platform_private.cms_valid_uuid(p_request->>'blockDefinitionVersionId')
     or p_request->>'fromLifecycle' not in ('supported', 'deprecated')
     or p_request->>'toLifecycle' not in ('deprecated', 'withdrawn')
     or not (
       (p_request->>'fromLifecycle' = 'supported' and p_request->>'toLifecycle' = 'deprecated')
       or (p_request->>'fromLifecycle' = 'deprecated' and p_request->>'toLifecycle' = 'withdrawn')
     )
     or not platform_private.cms_valid_version(p_request->>'expectedVersion')
     or p_request->>'releaseDigest' !~ '^[a-f0-9]{64}$' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  receipt_id := platform_private.cms_release_nonce_claim(p_request, 'CMS-03A-08', actor_id);
  select * into release_receipt
  from platform_private.cms_release_nonce_receipts
  where id = receipt_id;
  select * into block_row from platform_private.cms_block_definition_versions
  where id = (p_request->>'blockDefinitionVersionId')::uuid
    and owner_id = actor_id
  for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  select to_lifecycle into current_lifecycle
  from platform_private.cms_block_definition_lifecycle_events
  where block_definition_version_id = block_row.id
  order by created_at desc, id desc limit 1;
  current_lifecycle := coalesce(current_lifecycle, 'supported');
  if block_row.version <> (p_request->>'expectedVersion')::bigint then
    perform platform_private.cms_raise_version_mismatch((p_request->>'expectedVersion')::bigint, block_row.version);
  end if;
  if current_lifecycle <> p_request->>'fromLifecycle'
     or block_row.version <> (p_request->>'expectedVersion')::bigint
     or block_row.release_digest <> p_request->>'releaseDigest' then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  event_at := pg_catalog.clock_timestamp();
  insert into platform_private.cms_block_definition_lifecycle_events(
    owner_id, state, version, block_definition_version_id, block_key, block_version,
    from_lifecycle, to_lifecycle, release_digest, release_principal_id, release_key_id,
    release_raw_body_hash, release_signature_hash, release_nonce_hash, release_verified_at,
    created_at, updated_at
  ) values (
    actor_id, 'recorded', 1, block_row.id, block_row.block_key, block_row.block_version,
    p_request->>'fromLifecycle', p_request->>'toLifecycle', block_row.release_digest, actor_id,
    release_receipt.release_key_id, release_receipt.raw_body_hash,
    release_receipt.signature_hash, release_receipt.nonce_hash, release_receipt.verified_at,
    event_at, event_at
  ) returning id into event_id;
  perform platform_private.cms_emit_event(
    'cms.block.lifecycle.advance', actor_id, actor_id, 'cms_block_definition_lifecycle_event', event_id,
    'CMS_BLOCK_LIFECYCLE_CHANGED', 'cms.block.lifecycle.changed.v1', 'cms_block_definition_version',
    block_row.id, block_row.version,
    jsonb_build_object(
      'blockDefinitionVersionId', block_row.id, 'blockKey', block_row.block_key,
      'blockVersion', block_row.block_version, 'fromLifecycle', p_request->>'fromLifecycle',
      'toLifecycle', p_request->>'toLifecycle', 'releaseDigest', block_row.release_digest,
      'releaseKeyId', release_receipt.release_key_id,
      'releaseNonceHash', release_receipt.nonce_hash,
      'releaseVerifiedAt', release_receipt.verified_at
    ), correlation_id
  );
  update platform_private.cms_release_nonce_receipts set outcome = 'consumed', consumed_at = now(), updated_at = now() where id = receipt_id;
  select jsonb_build_object(
    'resourceKind', 'block_definition_lifecycle_event', 'id', event.id, 'version', event.version::text,
    'blockDefinitionVersionId', event.block_definition_version_id, 'blockKey', event.block_key,
    'blockVersion', event.block_version, 'fromLifecycle', event.from_lifecycle,
    'toLifecycle', event.to_lifecycle, 'lifecycle', event.to_lifecycle,
    'releaseDigest', event.release_digest, 'releaseKeyId', event.release_key_id,
    'releaseNonceHash', event.release_nonce_hash, 'releaseVerifiedAt', event.release_verified_at,
    'eventType', 'cms.block.lifecycle.changed.v1', 'createdAt', event.created_at
  ) into response from platform_private.cms_block_definition_lifecycle_events event where event.id = event_id;
  perform platform_private.cms_complete(reservation.id, event_id, 201, response);
  return response;
end;
$function$;

commit;
