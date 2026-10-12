\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(14);

-- Slice 11 relay poison contract (review B-05; BE00 "Queue consumers": a message that is not exactly
-- the envelope is recorded durably as a dead letter and acknowledged).  Migration 20261010164000
-- widened claim_outbox_batch to six event families, so the first sweep also claims their
-- never-relayed history.  An unparseable claimed row is recorded through the existing
-- platform_api.consumer_dead_letter_event (closed reason INVALID_QUEUE_PAYLOAD, identifiers only) and
-- acknowledged through platform_api.complete_outbox_event; the Worker (async-runtime.ts) then goes on
-- with the next row.  This suite proves the DATABASE half of that contract on historical rows whose
-- identifiers Postgres stores but the queue envelope refuses:
--   * the widened claim does lease such a row, in occurred_at order, ahead of valid rows;
--   * the sanitised identity the Worker sends always satisfies the dead-letter table's checks,
--     including an event id that is a hex UUID but not an RFC UUID;
--   * recording is idempotent and completing takes the row out of the claim set;
--   * a row that is merely skipped, not completed, would be claimed first again after its lease
--     expired (why the Worker must acknowledge the poison row).
-- Row 1 is a historical cms.localization.changed.v1 whose correlation id has an invalid variant,
-- row 2 a historical job.requested with a nil causation id, row 3 a valid job.requested, row 4 a
-- poison row whose own event id is not an RFC UUID, row 5 a poison row the control leaves behind.

insert into platform_private.outbox_events(
  id, event_type, schema_version, aggregate_type, aggregate_id, aggregate_version,
  correlation_id, causation_id, payload, occurred_at)
values
  ('a1140000-0000-4000-8000-000000000001', 'cms.localization.changed.v1', 1, 'cms_content_entry',
    'a1140000-0000-4000-8000-0000000000a1', 2, 'a1140000-0000-4000-c000-0000000000c1', null,
    '{}'::jsonb, timestamptz '2020-01-02T00:00:00Z'),
  ('a1140000-0000-4000-8000-000000000002', 'job.requested', 1, 'job',
    'a1140000-0000-4000-8000-0000000000a2', 1, 'a1140000-0000-4000-8000-0000000000c2',
    '00000000-0000-0000-0000-000000000000',
    '{"jobId":"a1140000-0000-4000-8000-0000000000a2","jobType":"platform.job.execute"}'::jsonb,
    timestamptz '2020-01-03T00:00:00Z'),
  ('a1140000-0000-4000-8000-000000000003', 'job.requested', 1, 'job',
    'a1140000-0000-4000-8000-0000000000a3', 1, 'a1140000-0000-4000-8000-0000000000c3', null,
    '{"jobId":"a1140000-0000-4000-8000-0000000000a3","jobType":"platform.job.execute"}'::jsonb,
    timestamptz '2020-01-04T00:00:00Z'),
  ('a1140000-0000-4000-c000-000000000004', 'cms.schema.activated.v1', 1, 'cms_content_type_version',
    'a1140000-0000-4000-c000-0000000000a4', 3, 'a1140000-0000-4000-8000-0000000000c4', null,
    '{}'::jsonb, timestamptz '2020-01-05T00:00:00Z'),
  ('a1140000-0000-4000-8000-000000000005', 'cms.block.lifecycle.changed.v1', 1, 'cms_block_definition_version',
    'a1140000-0000-4000-8000-0000000000a5', 1, 'a1140000-0000-4000-c000-0000000000c5', null,
    '{}'::jsonb, timestamptz '2019-12-31T00:00:00Z');

create temp table poison_claim on commit drop as
select * from platform_api.claim_outbox_batch('a1140000-0000-4000-8000-0000000000e1', 60, 100)
 where event_id::text like 'a1140000-0000-4000-%';

select is(
  (select string_agg(right(event_id::text, 3), ',' order by occurred_at, event_id) from poison_claim),
  '005,001,002,003,004',
  'the widened claim leases the never-relayed history oldest first, unparseable rows included [P2-S11-AC-113]');

-- The request is built exactly as the Worker builds it from a claimed row (async-runtime-parsing.ts):
-- only identifiers in the canonical shape, the closed reason code, the relay's consumer name.
create or replace function pg_temp.relay_dead_letter(p_event uuid)
returns jsonb
language sql
as $body$
  select platform_api.consumer_dead_letter_event(jsonb_build_object(
    'consumer', 'platform.outbox.sweep',
    'eventId', claim.event_id,
    'eventType', claim.event_type,
    'schemaVersion', claim.schema_version,
    'aggregateType', claim.aggregate_type,
    'aggregateId', claim.aggregate_id,
    'aggregateVersion', claim.aggregate_version::text,
    'reasonCode', 'INVALID_QUEUE_PAYLOAD'))
  from poison_claim claim where claim.event_id = p_event
$body$;

select is(pg_temp.relay_dead_letter('a1140000-0000-4000-8000-000000000001'), '{"accepted": true}'::jsonb,
  'a poison cms.localization.changed.v1 (invalid correlation variant) is recorded as a dead letter [P2-S11-AC-113]');
select is(pg_temp.relay_dead_letter('a1140000-0000-4000-8000-000000000002'), '{"accepted": true}'::jsonb,
  'a poison job.requested (nil causation id) is recorded as a dead letter [P2-S11-AC-113]');
select is(pg_temp.relay_dead_letter('a1140000-0000-4000-c000-000000000004'), '{"accepted": true}'::jsonb,
  'a poison row whose own event id is a hex UUID but not an RFC UUID is recorded too [P2-S11-AC-113]');

select is(
  (select count(*)::integer from platform_private.consumer_dead_letters
    where consumer = 'platform.outbox.sweep' and reason_code = 'INVALID_QUEUE_PAYLOAD'
      and event_id::text like 'a1140000-0000-4000-%'),
  3,
  'three dead letters carry the relay consumer name and the closed reason INVALID_QUEUE_PAYLOAD [P2-S11-AC-113]');
select is(
  (select string_agg(right(event_id::text, 3) || ':' || event_type || ':' || aggregate_type || ':' || aggregate_version,
                     ',' order by event_id)
     from platform_private.consumer_dead_letters where event_id::text like 'a1140000-0000-4000-%'),
  '001:cms.localization.changed.v1:cms_content_entry:2,002:job.requested:job:1,004:cms.schema.activated.v1:cms_content_type_version:3',
  'each dead letter keeps the identifiers of its own row and nothing else [P2-S11-AC-113]');

select is(pg_temp.relay_dead_letter('a1140000-0000-4000-8000-000000000001'), '{"accepted": true}'::jsonb,
  'recording the same poison row again is accepted [P2-S11-AC-113]');
select is(
  (select count(*)::integer from platform_private.consumer_dead_letters
    where event_id = 'a1140000-0000-4000-8000-000000000001'),
  1,
  'and it is idempotent: one dead letter per (consumer, event) [P2-S11-AC-113]');

-- Acknowledging the poison rows completes their claims.
select is(
  (select string_agg(right(claim.event_id::text, 3) || '=' ||
            platform_api.complete_outbox_event(claim.event_id, claim.lease_token)::text, ',' order by claim.event_id)
     from poison_claim claim
    where right(claim.event_id::text, 3) in ('001', '002', '004')),
  '001=true,002=true,004=true',
  'completing each acknowledged poison claim succeeds under its own lease [P2-S11-AC-113]');

-- Expire the leases that are still held (valid row 3, control row 5) and claim again.
update platform_private.outbox_events
   set dispatch_lease_until = clock_timestamp() - interval '1 second'
 where id in ('a1140000-0000-4000-8000-000000000003', 'a1140000-0000-4000-8000-000000000005');
create temp table poison_reclaim on commit drop as
select * from platform_api.claim_outbox_batch('a1140000-0000-4000-8000-0000000000e2', 60, 100)
 where event_id::text like 'a1140000-0000-4000-%';

select is(
  (select string_agg(right(event_id::text, 3), ',' order by occurred_at, event_id) from poison_reclaim),
  '005,003',
  'after the leases expire the acknowledged poison rows are gone from the claim set; the valid row and the unacknowledged control are claimed [P2-S11-AC-113]');
select is(
  (select right(event_id::text, 3) from poison_reclaim order by occurred_at, event_id limit 1),
  '005',
  'control: a poison row that is only skipped is claimed FIRST again, so skipping without acknowledging would starve every later row [P2-S11-AC-113]');
select is(
  (select count(*)::integer from platform_private.outbox_events
    where id::text like 'a1140000-0000-4000-%' and dispatched_at is not null),
  3,
  'exactly the three acknowledged rows are finalized; the evidence stays on the outbox row, nothing is deleted [P2-S11-AC-113]');
select is(
  (select count(*)::integer from platform_private.outbox_events where id::text like 'a1140000-0000-4000-%'),
  5,
  'no outbox row was deleted to hide the failure [P2-S11-AC-113]');

-- The dead-letter table still refuses what is not an identifier or a closed reason.
select throws_ok(
  $$select platform_api.consumer_dead_letter_event(jsonb_build_object(
      'consumer', 'platform.outbox.sweep', 'eventId', 'a1140000-0000-4000-8000-000000000009',
      'eventType', null, 'schemaVersion', 1, 'aggregateType', 'Not A Key', 'aggregateId', null,
      'aggregateVersion', null, 'reasonCode', 'INVALID_QUEUE_PAYLOAD'))$$,
  'P0001', 'INVALID_REQUEST',
  'an aggregate type outside the table grammar is refused, which is why the Worker nulls every identifier that does not match it [P2-S11-AC-113]');

select * from finish();
rollback;
