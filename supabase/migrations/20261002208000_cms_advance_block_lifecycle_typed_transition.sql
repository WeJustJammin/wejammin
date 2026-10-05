-- Slice 09 (re-audit AC152/AC157/AC200): CMS-03A-08 allows only supported -> deprecated and
-- deprecated -> withdrawn.  A pair outside that machine (supported -> withdrawn, deprecated ->
-- deprecated) reached the event insert and leaked the raw check violation of
-- cms_block_definition_lifecycle_events_transition_check; it is now refused before the nonce
-- claim with the typed 422 VALIDATION_FAILED.  The event is stamped with clock_timestamp()
-- instead of the transaction start time, so the derived lifecycle (the latest event by
-- created_at) follows the order in which the block row lock was granted rather than the order
-- in which the competing transactions began.  Body is otherwise identical to the previous
-- definition (regenerated from the live function); grants are unchanged.  Forward-only.
begin;

create or replace function platform_private.cms_advance_block_lifecycle(p_request jsonb)
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
  perform platform_private.cms_require_release_worker();
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
