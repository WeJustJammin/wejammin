\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 P240 (AC190): "BE00 event envelopes contain eventId, eventType,
-- schemaVersion, occurredAt, producer, correlationId, causationId, aggregateType,
-- aggregateId, decimal aggregateVersion, and IDs only."  The shared outbox row
-- stores no producer, so the dispatch path derives it from a registered
-- event-type-prefix map: platform_private.outbox_event_producer(event_type).
-- The outbox claim (the relay's read) returns occurred_at and that producer.
-- Every Slice 09 event type must resolve, and an unregistered type resolves to
-- NULL so the relay can refuse it instead of inventing a producer.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc

-- ------------------------------------------------------------ registry ----
select ok(to_regclass('platform_private.outbox_event_producers') is not null,
  'the event-type-prefix producer registry exists [P2-S09-AC-190]');
select is((select c.relrowsecurity and c.relforcerowsecurity from pg_class c where c.oid = to_regclass('platform_private.outbox_event_producers')), true,
  'the registry has forced row level security [P2-S09-AC-190]');
select is((select string_agg(r.role_name || ':' || r.priv, ',' order by r.role_name, r.priv)
    from unnest(array['anon', 'authenticated', 'service_role']) r0(role_name)
    cross join lateral (select r0.role_name, p.priv from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) p(priv)) r
   where to_regclass('platform_private.outbox_event_producers') is not null
     and has_table_privilege(r.role_name, to_regclass('platform_private.outbox_event_producers'), r.priv)),
  null, 'no API role holds any privilege on the registry [P2-S09-AC-190]');
select is((select count(*)::integer from platform_private.outbox_event_producers where producer !~ '^[a-z][a-z0-9._-]{0,79}$'
    or event_type_prefix !~ '^[a-z][a-z0-9_-]*(\.[a-z0-9_-]+)*\.$'), 0,
  'every registered prefix ends in a dot and every producer is a safe token [P2-S09-AC-190]');
select throws_ok($$update platform_private.outbox_event_producers set producer = 'x.y'$$, 'P0001', 'IMMUTABLE_RECORD',
  'the registered map is immutable: an UPDATE is refused even for the table owner [P2-S09-AC-190]');
select throws_ok($$delete from platform_private.outbox_event_producers$$, 'P0001', 'IMMUTABLE_RECORD',
  'the registered map is immutable: a DELETE is refused even for the table owner [P2-S09-AC-190]');
select is((select string_agg(t.tgname, ',' order by t.tgname) from pg_trigger t
   where t.tgrelid = to_regclass('platform_private.outbox_event_producers') and not t.tgisinternal),
  'outbox_event_producers_immutable_guard,outbox_event_producers_write_guard',
  'a write guard and an immutability guard back the policies when row security is bypassed [P2-S09-AC-190]');

-- ------------------------------------------------ one producer per type ----
select is(platform_private.outbox_event_producer(t.event_type), t.producer,
  t.event_type || ' is produced by ' || t.producer || ' [P2-S09-AC-190]')
from (values
  ('cms.schema.draft.created.v1', 'cms.schema_registry'),
  ('cms.schema.dry_run.requested.v1', 'cms.schema_registry'),
  ('cms.schema.review.submitted.v1', 'cms.schema_registry'),
  ('cms.schema.review.decided.v1', 'cms.schema_registry'),
  ('cms.schema.review.assignment.changed.v1', 'cms.schema_registry'),
  ('cms.schema.review.invalidated.v1', 'cms.schema_registry'),
  ('cms.schema.activated.v1', 'cms.schema_registry'),
  ('cms.block.registered.v1', 'cms.schema_registry'),
  ('cms.block.lifecycle.changed.v1', 'cms.schema_registry'),
  ('cms.capability.grant.changed.v1', 'cms.schema_registry'),
  ('identity.mfa-factor.changed.v1', 'identity.authority'),
  ('identity.security-notification.requested.v1', 'identity.authority'),
  ('admin.mfa-factor.reset.v1', 'platform.admin'),
  ('job.requested', 'platform.infrastructure')
) t(event_type, producer);
select is(platform_private.outbox_event_producer('cms.schema.activated.v1'),
  platform_private.outbox_event_producer('cms.schema.draft.created.v9'),
  'the producer follows the longest registered prefix, not the version suffix [P2-S09-AC-190]');
select is(platform_private.outbox_event_producer('unregistered.thing.v1'), null,
  'an event type outside every registered prefix has no producer [P2-S09-AC-190]');
select is(platform_private.outbox_event_producer(null), null,
  'a null event type has no producer [P2-S09-AC-190]');
select is(platform_private.outbox_event_producer('cms.'), null,
  'a bare family prefix that is not itself registered has no producer [P2-S09-AC-190]');
select ok(not has_function_privilege('service_role', 'platform_private.outbox_event_producer(text)', 'execute')
    and not has_function_privilege('authenticated', 'platform_private.outbox_event_producer(text)', 'execute')
    and not has_function_privilege('anon', 'platform_private.outbox_event_producer(text)', 'execute'),
  'the producer lookup is not executable by any API role [P2-S09-AC-190]');

-- --------------------------- every event the real producers emit resolves ----
select pg_temp.s09d_create_type('a', 'p240producer');
select pg_temp.s09d_to_active('a');
select cmp_ok((select count(distinct event_type)::integer from platform_private.outbox_events where event_type like 'cms.schema.%'), '>=', 6,
  'fixture: the real producers emitted the schema lifecycle events [P2-S09-AC-190]');
select is((select string_agg(distinct e.event_type, ',' order by e.event_type) from platform_private.outbox_events e
   where platform_private.outbox_event_producer(e.event_type) is null), null,
  'every outbox event type the real producers emitted resolves to a registered producer [P2-S09-AC-190]');
select is((select string_agg(distinct e.event_type, ',' order by e.event_type) from platform_private.outbox_events e
   where e.event_type like 'cms.%' and platform_private.outbox_event_producer(e.event_type) is distinct from 'cms.schema_registry'
     and e.event_type like 'cms.schema.%'), null,
  'every cms.schema event is attributed to the schema registry [P2-S09-AC-190]');

-- ---------------------------------------------- the claim carries both ----
select is((select array_agg(a order by a) from (select unnest(proargnames) a from pg_proc
    where oid = 'platform_private.claim_outbox_batch(uuid,integer,integer)'::regprocedure) x where a is not null and a not like 'p\_%'),
  array['aggregate_id', 'aggregate_type', 'aggregate_version', 'causation_id', 'correlation_id', 'dispatch_attempt_count', 'event_id', 'event_type',
        'lease_token', 'occurred_at', 'producer', 'schema_version'],
  'the private claim returns occurred_at and producer beside the identifier columns [P2-S09-AC-190]');
select is((select array_agg(a order by a) from (select unnest(proargnames) a from pg_proc
    where oid = 'platform_api.claim_outbox_batch(uuid,integer,integer)'::regprocedure) x where a is not null and a not like 'p\_%'),
  array['aggregate_id', 'aggregate_type', 'aggregate_version', 'causation_id', 'correlation_id', 'dispatch_attempt_count', 'event_id', 'event_type',
        'lease_token', 'occurred_at', 'producer', 'schema_version'],
  'the API claim returns the same columns [P2-S09-AC-190]');

select * from finish();
rollback;
