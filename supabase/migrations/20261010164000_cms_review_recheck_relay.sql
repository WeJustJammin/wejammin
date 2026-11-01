-- Slice 11 dependency recheck, relay half (BE03b "Review invalidation / Dependency
-- recheck"; tracker P2-S11-AC-113): the six events whose consumers enqueue the BE00 job
-- `cms.review.dependency_recheck` reach the platform queue.
--
--   cms.schema.activated.v1, cms.template.activated.v1, cms.pattern.activated.v1,
--   cms.taxonomy.changed.v1, cms.localization.changed.v1, cms.block.lifecycle.changed.v1
--
-- The outbox relay reads through `claim_outbox_batch`, a closed allowlist of
-- (event type, aggregate type) tuples; none of the six was on it, so no consumer could
-- ever have received one.  This migration widens the allowlist and registers the two
-- missing producer prefixes.  The claim keeps its argument list, claim rule, lease
-- columns, ordering, owner and grants; only the tuple list grows:
--
--   cms.schema.activated.v1         cms_content_type_version   (CMS-03A-04, the Worker activation)
--   cms.block.lifecycle.changed.v1  cms_block_definition_version (CMS-03A-08)
--   cms.localization.changed.v1     cms_content_entry          (CMS-03C-04 and the source fan-out)
--   cms.template.activated.v1       any registry key           (CMS-03C-09, Slice 12)
--   cms.pattern.activated.v1        any registry key           (CMS-03C-09, Slice 12)
--   cms.taxonomy.changed.v1         any registry key           (CMS-03C-03 / -09, Slice 12)
--
-- The three Slice 12 events have no producer yet, so their aggregate is not pinned: the
-- claim requires only a registry-key aggregate type, and Slice 12 narrows it to its own
-- tuple in its forward migration.  Their event-type prefixes `cms.pattern.` and
-- `cms.taxonomy.` were not in the producer registry (`cms.template.` and
-- `cms.localization.` were); a claimed row of an unregistered prefix resolves a NULL
-- producer that the Worker refuses, which would wedge the sweep, so both prefixes are
-- registered to the composition producer here (insert-if-absent, so a later slice that
-- registers them first is not contradicted).  Forward-only.
begin;

set local lock_timeout = '5s';

select pg_catalog.set_config('app.cms_rpc', 'true', true);
insert into platform_private.outbox_event_producers(event_type_prefix, producer)
values
  ('cms.pattern.', 'cms.composition'),
  ('cms.taxonomy.', 'cms.composition')
on conflict (event_type_prefix) do nothing;

create or replace function platform_private.claim_outbox_batch(
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
      and (
        (e.event_type, e.aggregate_type) in (
          ('job.requested', 'job'),
          ('identity.mfa-factor.changed.v1', 'mfa_factor'),
          ('identity.security-notification.requested.v1', 'security_event'),
          ('cms.capability.grant.changed.v1', 'cms_capability_grant'),
          ('cms.schema.activated.v1', 'cms_content_type_version'),
          ('cms.block.lifecycle.changed.v1', 'cms_block_definition_version'),
          ('cms.localization.changed.v1', 'cms_content_entry'))
        or (e.event_type in (
              'cms.template.activated.v1', 'cms.pattern.activated.v1',
              'cms.taxonomy.changed.v1')
            and e.aggregate_type ~ '^[a-z][a-z0-9_]{0,63}$'))
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

commit;
