\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(15);

-- Slice 11 dependency recheck, relay half (BE03b "Review invalidation / Dependency
-- recheck"; tracker P2-S11-AC-113).  The consumers of cms.schema.activated.v1,
-- cms.template.activated.v1, cms.pattern.activated.v1, cms.taxonomy.changed.v1,
-- cms.localization.changed.v1 and cms.block.lifecycle.changed.v1 can only run when the
-- outbox relay places those events on the queue.  claim_outbox_batch is a closed
-- allowlist of (event type, aggregate type) tuples that did not name any of the six, and
-- two of their event-type prefixes had no registered producer (a NULL producer is refused
-- by the Worker).  RED before 20261010164000, GREEN after.

-- ---- the producer registry covers all six families ---------------------------------
select is(platform_private.outbox_event_producer(t.event_type), t.producer,
  t.event_type || ' resolves its registered producer ' || t.producer || ' [P2-S11-AC-113]')
from (values
  ('cms.schema.activated.v1', 'cms.schema_registry'),
  ('cms.template.activated.v1', 'cms.composition'),
  ('cms.pattern.activated.v1', 'cms.composition'),
  ('cms.taxonomy.changed.v1', 'cms.composition'),
  ('cms.localization.changed.v1', 'cms.composition'),
  ('cms.block.lifecycle.changed.v1', 'cms.schema_registry')
) as t(event_type, producer);

-- ---- the claim ----------------------------------------------------------------------
-- Valid tuples are forged with the aggregates the real producers use (and the
-- registry-key aggregate the Slice 12 events will use); the negative controls carry a
-- wrong aggregate, a wrong schema version or an unlisted event type.
insert into platform_private.outbox_events(
  id, event_type, schema_version, aggregate_type, aggregate_id, aggregate_version,
  correlation_id, payload)
values
  ('a1130000-0000-4000-8000-000000000001', 'cms.schema.activated.v1', 1, 'cms_content_type_version',
    'a1130000-0000-4000-8000-0000000000a1', 2, 'a1130000-0000-4000-8000-0000000000c1', '{}'::jsonb),
  ('a1130000-0000-4000-8000-000000000002', 'cms.template.activated.v1', 1, 'cms_template_version',
    'a1130000-0000-4000-8000-0000000000a2', 2, 'a1130000-0000-4000-8000-0000000000c1', '{}'::jsonb),
  ('a1130000-0000-4000-8000-000000000003', 'cms.pattern.activated.v1', 1, 'cms_pattern_version',
    'a1130000-0000-4000-8000-0000000000a3', 2, 'a1130000-0000-4000-8000-0000000000c1', '{}'::jsonb),
  ('a1130000-0000-4000-8000-000000000004', 'cms.taxonomy.changed.v1', 1, 'cms_taxonomy_version',
    'a1130000-0000-4000-8000-0000000000a4', 2, 'a1130000-0000-4000-8000-0000000000c1', '{}'::jsonb),
  ('a1130000-0000-4000-8000-000000000005', 'cms.localization.changed.v1', 1, 'cms_content_entry',
    'a1130000-0000-4000-8000-0000000000a5', 2, 'a1130000-0000-4000-8000-0000000000c1', '{}'::jsonb),
  ('a1130000-0000-4000-8000-000000000006', 'cms.block.lifecycle.changed.v1', 1, 'cms_block_definition_version',
    'a1130000-0000-4000-8000-0000000000a6', 2, 'a1130000-0000-4000-8000-0000000000c1', '{}'::jsonb),
  -- negative controls
  ('a1130000-0000-4000-8000-0000000000f1', 'cms.schema.activated.v1', 1, 'cms_schema',
    'a1130000-0000-4000-8000-0000000000b1', 2, 'a1130000-0000-4000-8000-0000000000c1', '{}'::jsonb),
  ('a1130000-0000-4000-8000-0000000000f2', 'cms.localization.changed.v1', 1, 'cms_locale',
    'a1130000-0000-4000-8000-0000000000b2', 2, 'a1130000-0000-4000-8000-0000000000c1', '{}'::jsonb),
  ('a1130000-0000-4000-8000-0000000000f3', 'cms.block.lifecycle.changed.v1', 1, 'cms_block',
    'a1130000-0000-4000-8000-0000000000b3', 2, 'a1130000-0000-4000-8000-0000000000c1', '{}'::jsonb),
  ('a1130000-0000-4000-8000-0000000000f4', 'cms.template.activated.v1', 1, 'Not A Key',
    'a1130000-0000-4000-8000-0000000000b4', 2, 'a1130000-0000-4000-8000-0000000000c1', '{}'::jsonb),
  ('a1130000-0000-4000-8000-0000000000f5', 'cms.pattern.activated.v1', 2, 'cms_pattern_version',
    'a1130000-0000-4000-8000-0000000000b5', 2, 'a1130000-0000-4000-8000-0000000000c1', '{}'::jsonb),
  ('a1130000-0000-4000-8000-0000000000f6', 'cms.schema.review.invalidated.v1', 1, 'cms_schema_review',
    'a1130000-0000-4000-8000-0000000000b6', 2, 'a1130000-0000-4000-8000-0000000000c1', '{}'::jsonb);

create temp table recheck_claim on commit drop as
select * from platform_api.claim_outbox_batch('a1130000-0000-4000-8000-0000000000e1', 60, 100);

select is(
  (select string_agg(event_type || '/' || aggregate_type || '=' || producer, ',' order by event_type)
     from recheck_claim
    where event_id::text like 'a1130000-0000-4000-8000-00000000000%'),
  'cms.block.lifecycle.changed.v1/cms_block_definition_version=cms.schema_registry,'
  || 'cms.localization.changed.v1/cms_content_entry=cms.composition,'
  || 'cms.pattern.activated.v1/cms_pattern_version=cms.composition,'
  || 'cms.schema.activated.v1/cms_content_type_version=cms.schema_registry,'
  || 'cms.taxonomy.changed.v1/cms_taxonomy_version=cms.composition,'
  || 'cms.template.activated.v1/cms_template_version=cms.composition',
  'the relay claims each of the six recheck source events with its aggregate and registered producer [P2-S11-AC-113]');

select is(
  (select count(*)::integer from recheck_claim
    where event_id::text like 'a1130000-0000-4000-8000-0000000000f%'),
  0,
  'a wrong aggregate, a key that is not a registry key, a wrong schema version and an unlisted event are never claimed [P2-S11-AC-113]');

select is(
  (select count(*)::integer from recheck_claim
    where event_id::text like 'a1130000-0000-4000-8000-00000000000%'
      and (producer is null or occurred_at is null or lease_token is null
           or dispatch_attempt_count <> 1 or schema_version <> 1)),
  0,
  'a claimed recheck source event carries its producer, its outbox instant and a first lease [P2-S11-AC-113]');

select is(
  (select count(*)::integer from platform_private.outbox_events
    where id::text like 'a1130000-0000-4000-8000-00000000000%'
      and dispatch_lease_token = 'a1130000-0000-4000-8000-0000000000e1'
      and dispatch_lease_until > clock_timestamp()),
  6,
  'claiming leases the six rows to the caller without dispatching them [P2-S11-AC-113]');

-- The tuples that were claimed before the widening still are.
insert into platform_private.outbox_events(
  id, event_type, schema_version, aggregate_type, aggregate_id, aggregate_version,
  correlation_id, payload)
values
  ('a1130000-0000-4000-8000-000000000011', 'job.requested', 1, 'job',
    'a1130000-0000-4000-8000-0000000000d1', 1, 'a1130000-0000-4000-8000-0000000000c1',
    '{"jobId":"a1130000-0000-4000-8000-0000000000d1","jobType":"platform.job.execute"}'::jsonb),
  ('a1130000-0000-4000-8000-000000000012', 'identity.mfa-factor.changed.v1', 1, 'mfa_factor',
    'a1130000-0000-4000-8000-0000000000d2', 1, 'a1130000-0000-4000-8000-0000000000c1', '{}'::jsonb),
  ('a1130000-0000-4000-8000-000000000013', 'identity.security-notification.requested.v1', 1, 'security_event',
    'a1130000-0000-4000-8000-0000000000d3', 1, 'a1130000-0000-4000-8000-0000000000c1', '{}'::jsonb),
  ('a1130000-0000-4000-8000-000000000014', 'cms.capability.grant.changed.v1', 1, 'cms_capability_grant',
    'a1130000-0000-4000-8000-0000000000d4', 1, 'a1130000-0000-4000-8000-0000000000c1', '{}'::jsonb);
create temp table recheck_claim_before on commit drop as
select * from platform_api.claim_outbox_batch('a1130000-0000-4000-8000-0000000000e2', 60, 100);
select is(
  (select string_agg(event_type, ',' order by event_type) from recheck_claim_before
    where event_id::text like 'a1130000-0000-4000-8000-00000000001%'),
  'cms.capability.grant.changed.v1,identity.mfa-factor.changed.v1,identity.security-notification.requested.v1,job.requested',
  'the four tuples relayed before the widening are still claimed [P2-S11-AC-113]');

-- ---- the claim keeps its contract -----------------------------------------------------
select is(
  (select array_agg(a order by a) from (
     select unnest(proargnames) a from pg_proc
      where oid = 'platform_private.claim_outbox_batch(uuid,integer,integer)'::regprocedure) x
    where a is not null and a not like 'p\_%'),
  array['aggregate_id', 'aggregate_type', 'aggregate_version', 'causation_id', 'correlation_id',
        'dispatch_attempt_count', 'event_id', 'event_type', 'lease_token', 'occurred_at', 'producer',
        'schema_version'],
  'the claim still returns the identifier columns, occurred_at and the registered producer [P2-S11-AC-113]');

select ok(
  (select p.prosecdef
      and coalesce(p.proconfig, array[]::text[]) @> array['search_path=""']
      and pg_get_userbyid(p.proowner) = 'wejammin_platform_definer'
      and p.provolatile = 'v'
     from pg_proc p where p.oid = 'platform_private.claim_outbox_batch(uuid,integer,integer)'::regprocedure),
  'the private claim is still a VOLATILE SECURITY DEFINER of the platform definer with an empty search_path [P2-S11-AC-113]');

select ok(
  not has_function_privilege('anon', 'platform_private.claim_outbox_batch(uuid,integer,integer)'::regprocedure, 'execute')
    and not has_function_privilege('authenticated', 'platform_private.claim_outbox_batch(uuid,integer,integer)'::regprocedure, 'execute')
    and not has_function_privilege('service_role', 'platform_private.claim_outbox_batch(uuid,integer,integer)'::regprocedure, 'execute')
    and has_function_privilege('service_role', 'platform_api.claim_outbox_batch(uuid,integer,integer)'::regprocedure, 'execute')
    and not has_function_privilege('anon', 'platform_api.claim_outbox_batch(uuid,integer,integer)'::regprocedure, 'execute')
    and not has_function_privilege('authenticated', 'platform_api.claim_outbox_batch(uuid,integer,integer)'::regprocedure, 'execute'),
  'only the service role executes the platform_api claim and no API role the private one [P2-S11-AC-113]');

-- ---- the registry stays immutable ---------------------------------------------------
select throws_ok(
  $$update platform_private.outbox_event_producers set producer = 'x.y' where event_type_prefix = 'cms.pattern.'$$,
  'P0001', 'IMMUTABLE_RECORD',
  'the newly registered prefixes are as immutable as the rest of the map [P2-S11-AC-113]');

select * from finish();
rollback;
