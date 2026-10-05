-- Slice 09 P240 (AC190): "BE00 event envelopes contain eventId, eventType,
-- schemaVersion, occurredAt, producer, correlationId, causationId, aggregateType,
-- aggregateId, decimal aggregateVersion, and IDs only."
--
-- The shared outbox row stores no producer, so the relay would have had to
-- invent one.  This migration makes the producer a registered fact:
--   * platform_private.outbox_event_producers is a code-owned, immutable map from
--     a dotted event-type prefix to the producing component (longest prefix
--     wins), seeded here for every event family the platform emits;
--   * platform_private.outbox_event_producer(event_type) resolves it, NULL for an
--     unregistered type so a dispatcher can refuse the event instead of guessing;
--   * claim_outbox_batch (the relay's read) now also returns occurred_at and the
--     resolved producer, so the dispatched envelope can carry both members.
-- The claim keeps its argument list, claim rule, ordering and grants; only the
-- result gains the two columns.  Forward-only.
begin;

create table platform_private.outbox_event_producers (
  event_type_prefix text not null primary key,
  producer text not null,
  created_at timestamptz not null default now(),
  constraint outbox_event_producers_prefix_check
    check (event_type_prefix ~ '^[a-z][a-z0-9_-]*(\.[a-z0-9_-]+)*\.$'),
  constraint outbox_event_producers_producer_check
    check (producer ~ '^[a-z][a-z0-9._-]{0,79}$')
);

select pg_catalog.set_config('app.cms_rpc', 'true', true);
insert into platform_private.outbox_event_producers(event_type_prefix, producer)
values
  ('job.', 'platform.infrastructure'),
  ('object.', 'platform.infrastructure'),
  ('provider.', 'platform.infrastructure'),
  ('webhook.', 'platform.infrastructure'),
  ('identity.', 'identity.authority'),
  ('admin.', 'platform.admin'),
  ('config.', 'platform.configuration'),
  ('profile.', 'profile.portfolio'),
  ('cms.schema.', 'cms.schema_registry'),
  ('cms.block.', 'cms.schema_registry'),
  ('cms.capability.', 'cms.schema_registry'),
  ('cms.entry.', 'cms.editorial'),
  ('cms.localization.', 'cms.composition'),
  ('cms.template.', 'cms.composition');

create trigger outbox_event_producers_write_guard
before insert on platform_private.outbox_event_producers
for each row execute function platform_private.cms_write_guard();
create trigger outbox_event_producers_immutable_guard
before update or delete on platform_private.outbox_event_producers
for each row execute function platform_private.cms_immutable_guard();

alter table platform_private.outbox_event_producers enable row level security;
alter table platform_private.outbox_event_producers force row level security;
revoke all on table platform_private.outbox_event_producers
  from public, anon, authenticated, service_role;
-- Rows are code-owned: readable by the pinned definer lookup (no role holds a
-- table grant), insertable only inside a migration/RPC context, never updated
-- or deleted.
create policy outbox_event_producers_read_policy on platform_private.outbox_event_producers
  for select to public using (true);
create policy outbox_event_producers_seed_policy on platform_private.outbox_event_producers
  for insert to public with check (platform_private.cms_rpc_context_valid());

create or replace function platform_private.outbox_event_producer(p_event_type text)
returns text
language sql
stable
security definer
set search_path = ''
as $body$
  select registered.producer
    from platform_private.outbox_event_producers registered
   where p_event_type is not null
     and pg_catalog.starts_with(p_event_type, registered.event_type_prefix)
     and pg_catalog.length(p_event_type) > pg_catalog.length(registered.event_type_prefix)
   order by pg_catalog.length(registered.event_type_prefix) desc
   limit 1
$body$;
revoke all on function platform_private.outbox_event_producer(text)
  from public, anon, authenticated, service_role;

drop function platform_api.claim_outbox_batch(uuid, integer, integer);
drop function platform_private.claim_outbox_batch(uuid, integer, integer);

create function platform_private.claim_outbox_batch(
  p_lease_token uuid, p_lease_seconds integer, p_batch_size integer
)
returns table (
  event_id uuid, event_type text, schema_version integer, aggregate_type text,
  aggregate_id uuid, aggregate_version bigint, correlation_id uuid,
  causation_id uuid, lease_token uuid, dispatch_attempt_count integer,
  occurred_at timestamptz, producer text
)
language plpgsql
security definer
set search_path = ''
as $function$
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
      e.dispatch_lease_token, e.dispatch_attempt_count, e.occurred_at
  )
  select c.id, c.event_type, c.schema_version, c.aggregate_type,
    c.aggregate_id, c.aggregate_version, c.correlation_id, c.causation_id,
    c.dispatch_lease_token, c.dispatch_attempt_count, c.occurred_at,
    platform_private.outbox_event_producer(c.event_type)
  from claimed c;
end;
$function$;

create function platform_api.claim_outbox_batch(
  p_lease_token uuid, p_lease_seconds integer, p_batch_size integer
)
returns table (
  event_id uuid, event_type text, schema_version integer, aggregate_type text,
  aggregate_id uuid, aggregate_version bigint, correlation_id uuid,
  causation_id uuid, lease_token uuid, dispatch_attempt_count integer,
  occurred_at timestamptz, producer text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_lease_token is null
     or p_lease_token = '00000000-0000-0000-0000-000000000000'::uuid
     or p_lease_seconds not between 1 and 840 or p_batch_size not between 1 and 100 then
    raise exception 'invalid outbox batch adapter input' using errcode = '22023';
  end if;
  return query select * from platform_private.claim_outbox_batch(
    p_lease_token, p_lease_seconds, p_batch_size
  ) limit 100;
end;
$$;

revoke all on function platform_private.claim_outbox_batch(uuid, integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function platform_api.claim_outbox_batch(uuid, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.claim_outbox_batch(uuid, integer, integer) to service_role;

commit;
