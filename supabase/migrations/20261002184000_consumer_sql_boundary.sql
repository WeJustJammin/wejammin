-- G1 SQL boundary for the registered Slice 09 event consumers (BE01a, BE03a, BE00).
-- The Worker consumers are typed against these exact platform_api names and
-- parameters, all service-role-only security definers with an empty pinned
-- search_path:
--   auth_mfa_factor_reconcile_read(p_factor_id)      AC-913  one factor's reconciliation view
--   auth_mfa_reconciling_age()                       AC-908  gauge input (count, oldest age)
--   identity_security_notification_read(p_security_event_id)  AC-916  immutable event behind a request
--   cms_capability_grant_read_current(p_grant_id)    AC-689  authoritative grant state
--   consumer_dead_letter_event(p_request)            AC-689  durable, idempotent dead letter
-- plus the private append-only platform_private.consumer_dead_letters table
-- (forced RLS, no client grant) and the widening of the outbox relay selector from
-- job.requested to the four (event_type, aggregate_type) tuples the Worker accepts
-- (schema_version 1 each); the returned column list is unchanged.  Forward-only.
begin;

create function platform_api.auth_mfa_factor_reconcile_read(p_factor_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $body$
  select coalesce(
    (select pg_catalog.jsonb_build_object(
        'found', true, 'state', f.state::text, 'authUserId', f.auth_user_id,
        'providerFactorId', f.provider_factor_id, 'version', f.version::text)
       from identity.mfa_factor_registry f where f.id = p_factor_id),
    pg_catalog.jsonb_build_object('found', false))
$body$;

create function platform_api.auth_mfa_reconciling_age()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $body$
  select pg_catalog.jsonb_build_object(
    'count', count(*),
    'oldestAgeSeconds', case when count(*) = 0 then null
      else extract(epoch from pg_catalog.clock_timestamp() - min(updated_at)) end)
    from identity.mfa_factor_registry where state = 'reconciling'
$body$;

create function platform_api.identity_security_notification_read(p_security_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $body$
  select coalesce(
    (select pg_catalog.jsonb_build_object(
        'found', true, 'reasonCode', e.reason_code, 'requestId', e.request_id)
       from identity.security_events e
      where e.id = p_security_event_id
        and e.action in ('mfa.enroll.verified', 'mfa.factor.removed', 'mfa.factors.reset')),
    pg_catalog.jsonb_build_object('found', false))
$body$;

create function platform_api.cms_capability_grant_read_current(p_grant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $body$
  select coalesce(
    (select pg_catalog.jsonb_build_object(
        'found', true, 'grantId', g.id, 'subjectPersonId', g.subject_person_ref,
        'version', g.version::text,
        'state', case when g.state = 'revoked' then 'revoked'
                      when g.valid_through < (pg_catalog.clock_timestamp() at time zone 'UTC')::date then 'lapsed'
                      else 'active' end,
        'capabilityCode', g.capability_code)
       from platform_private.cms_capability_grants g where g.id = p_grant_id),
    pg_catalog.jsonb_build_object('found', false))
$body$;

create table platform_private.consumer_dead_letters (
  id uuid primary key default extensions.gen_random_uuid(),
  consumer text not null check (consumer ~ '^[a-z][a-z0-9._-]{0,63}$'),
  event_id uuid,
  event_type text check (event_type ~ '^[a-z][a-z0-9._-]{0,159}$'),
  schema_version integer check (schema_version > 0),
  aggregate_type text check (aggregate_type ~ '^[a-z][a-z0-9_]{0,63}$'),
  aggregate_id uuid,
  aggregate_version text check (aggregate_version ~ '^[1-9][0-9]{0,18}$'),
  reason_code text not null check (reason_code in (
    'INVALID_QUEUE_PAYLOAD', 'UNKNOWN_EVENT_VERSION', 'SOURCE_RECORD_NOT_FOUND',
    'UNSUPPORTED_NOTIFICATION_TEMPLATE')),
  created_at timestamptz not null default pg_catalog.clock_timestamp()
);
create unique index consumer_dead_letters_event
  on platform_private.consumer_dead_letters (consumer, event_id) where event_id is not null;
alter table platform_private.consumer_dead_letters enable row level security;
alter table platform_private.consumer_dead_letters force row level security;
revoke all on table platform_private.consumer_dead_letters
  from public, anon, authenticated, service_role;

create function platform_api.consumer_dead_letter_event(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  keys constant text[] := array['aggregateId', 'aggregateType', 'aggregateVersion', 'consumer',
    'eventId', 'eventType', 'reasonCode', 'schemaVersion']::text[];
  event_uuid uuid;
  aggregate_uuid uuid;
begin
  if pg_catalog.jsonb_typeof(p_request) is distinct from 'object'
     or (select pg_catalog.array_agg(k order by k) from pg_catalog.jsonb_object_keys(p_request) k)
        is distinct from keys then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  begin
    event_uuid := (p_request->>'eventId')::uuid;
    aggregate_uuid := (p_request->>'aggregateId')::uuid;
    insert into platform_private.consumer_dead_letters (
      consumer, event_id, event_type, schema_version, aggregate_type, aggregate_id,
      aggregate_version, reason_code
    ) values (
      p_request->>'consumer', event_uuid, p_request->>'eventType',
      (p_request->>'schemaVersion')::integer, p_request->>'aggregateType', aggregate_uuid,
      p_request->>'aggregateVersion', p_request->>'reasonCode'
    )
    on conflict (consumer, event_id) where event_id is not null do nothing;
  exception when invalid_text_representation or check_violation or not_null_violation
      or numeric_value_out_of_range or datatype_mismatch then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end;
  return pg_catalog.jsonb_build_object('accepted', true);
end;
$body$;

CREATE OR REPLACE FUNCTION platform_private.claim_outbox_batch(p_lease_token uuid, p_lease_seconds integer, p_batch_size integer)
 RETURNS TABLE(event_id uuid, event_type text, schema_version integer, aggregate_type text, aggregate_id uuid, aggregate_version bigint, correlation_id uuid, causation_id uuid, lease_token uuid, dispatch_attempt_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  now_at timestamptz := clock_timestamp();
begin
  if p_lease_token is null
     or p_lease_token = '00000000-0000-0000-0000-000000000000'::uuid
     or p_lease_seconds not between 1 and 840 or p_batch_size not between 1 and 100 then
    raise exception 'invalid outbox batch lease request' using errcode = '22023';
  end if;
  if not platform_private.external_effects_allowed() then return; end if;
  return query
  with candidates as (
    select e.id
    from platform_private.outbox_events e
    where e.dispatched_at is null and e.dead_lettered_at is null
      and e.schema_version = 1
      and (e.event_type, e.aggregate_type) in (
        ('job.requested', 'job'),
        ('identity.mfa-factor.changed.v1', 'mfa_factor'),
        ('identity.security-notification.requested.v1', 'security_event'),
        ('cms.capability.grant.changed.v1', 'cms_capability_grant'))
      and (e.dispatch_lease_until is null or e.dispatch_lease_until <= now_at)
    order by e.occurred_at, e.id
    for update skip locked
    limit p_batch_size
  ), claimed as (
    update platform_private.outbox_events e
    set dispatch_lease_token = p_lease_token,
        dispatch_lease_until = now_at + pg_catalog.make_interval(secs => p_lease_seconds),
        dispatch_attempt_count = e.dispatch_attempt_count + 1
    from candidates c
    where e.id = c.id
    returning e.id, e.event_type, e.schema_version, e.aggregate_type,
      e.aggregate_id, e.aggregate_version, e.correlation_id, e.causation_id,
      e.dispatch_lease_token, e.dispatch_attempt_count
  )
  select c.id, c.event_type, c.schema_version, c.aggregate_type,
    c.aggregate_id, c.aggregate_version, c.correlation_id, c.causation_id,
    c.dispatch_lease_token, c.dispatch_attempt_count
  from claimed c;
end;
$function$;

revoke all on function platform_api.auth_mfa_factor_reconcile_read(uuid),
  platform_api.auth_mfa_reconciling_age(),
  platform_api.identity_security_notification_read(uuid),
  platform_api.cms_capability_grant_read_current(uuid),
  platform_api.consumer_dead_letter_event(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.auth_mfa_factor_reconcile_read(uuid),
  platform_api.auth_mfa_reconciling_age(),
  platform_api.identity_security_notification_read(uuid),
  platform_api.cms_capability_grant_read_current(uuid),
  platform_api.consumer_dead_letter_event(jsonb)
  to service_role;

commit;
