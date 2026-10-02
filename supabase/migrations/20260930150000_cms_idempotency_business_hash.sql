-- A lost-response retry receives fresh Worker trace IDs. Bind the idempotency
-- reservation to the command, effective acting party, and authority-bearing
-- acting context, not its transport trace or session metadata.
-- Existing CMS reservations only store the old digest, not the original body;
-- their business hash cannot be recovered safely. Require the ordinary expiry
-- sweep to clear them before this forward-only cutover.
begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';
lock table platform_private.idempotency_records in share row exclusive mode;

do $body$
begin
  if exists (
    select 1
      from platform_private.idempotency_records
     where operation like 'CMS-%'
  ) then
    raise exception 'CMS_IDEMPOTENCY_HASH_CUTOVER_PENDING'
      using errcode = 'P0001',
        hint = 'Keep CMS writes disabled for cutover; wait for every old CMS reservation to expire (up to 30 days), run the approved expiry sweep, then retry this migration.';
  end if;
end;
$body$;

create or replace function platform_private.cms_request_hash(p_request jsonb)
returns bytea
language sql
immutable
set search_path = ''
as $body$
  select extensions.digest(
    pg_catalog.convert_to(
      (case
        when coalesce(p_request, '{}'::jsonb) ? 'context'
          and pg_catalog.jsonb_typeof(p_request->'context') = 'object' then
          pg_catalog.jsonb_set(
            coalesce(p_request, '{}'::jsonb)
              - array['idempotencyKey', 'correlationId']::text[],
            '{context}'::text[],
            pg_catalog.jsonb_set(
              pg_catalog.jsonb_set(
                '{}'::jsonb,
                '{actingPartyId}'::text[],
                coalesce(p_request #> '{context,actingPartyId}', 'null'::jsonb),
                true
              ),
              '{actingContextId}'::text[],
              coalesce(p_request #> '{context,actingContextId}', 'null'::jsonb),
              true
            ),
            true
          )
        else coalesce(p_request, '{}'::jsonb)
          - array['idempotencyKey', 'correlationId']::text[]
      end)::text,
      'utf8'
    ),
    'sha256'
  )
$body$;

-- The effective party can come from the server GUC when the request omits
-- context.actingPartyId. Bind that resolved value independently of the raw
-- JSON so one actor cannot replay an earlier party's response under another.
create or replace function platform_private.cms_reserve(
  p_request jsonb,
  p_actor_id uuid,
  p_operation text
)
returns platform_private.idempotency_records
language plpgsql
security definer
set search_path = ''
as $body$
declare
  reservation platform_private.idempotency_records;
  key_value text := nullif(p_request->>'idempotencyKey', '');
  acting_party_id uuid;
begin
  if key_value is null or key_value !~ '^[ -~]{8,128}$' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  acting_party_id := platform_private.cms_acting_party(p_request, p_actor_id);
  reservation := platform_private.identity_idempotency_reserve(
    p_actor_id, p_operation, platform_private.cms_key_hash(key_value),
    extensions.digest(
      platform_private.cms_request_hash(p_request)
        || pg_catalog.uuid_send(acting_party_id),
      'sha256'
    )
  );
  if reservation.state = 'failed_retryable'::platform_private.idempotency_state then
    update platform_private.idempotency_records
    set state = 'reserved', response_ref = null
    where id = reservation.id;
    select * into reservation from platform_private.idempotency_records where id = reservation.id;
  end if;
  return reservation;
end;
$body$;

commit;
