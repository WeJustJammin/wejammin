import { describe, expect, it, vi } from 'vitest';

import type {
  AsyncExecutionContext,
  AsyncWorkerBindings,
  PlatformJobsQueue,
} from './async-entrypoint';
import {
  createAsyncJobDependencies,
  type AsyncRpcClient,
  type AsyncRpcOperation,
} from './async-runtime';
import { parsePoisonedOutboxRow } from './async-runtime-outbox-poison';
import { AGGREGATE_FOR } from './cms-editorial/review-recheck/review-recheck.test-support';

/*
 * BE00 relay: an outbox row the Worker cannot turn into its queue envelope is POISON. It must
 * never stop the rows behind it (review B-05): migration 20261010164000 widened the claim to
 * six event families and the first sweep relays their never-relayed history, so one row that
 * does not satisfy the envelope grammar would otherwise be re-claimed first, every sweep,
 * after every lease expiry, and starve `job.requested` and every other family.
 *
 * The rule is the one every Queue consumer already follows (event-consumers/admit.ts): a message
 * that is not exactly the envelope is recorded durably (`consumer_dead_letter_event`, identifiers
 * and the closed reason INVALID_QUEUE_PAYLOAD only) and acknowledged; if the record cannot be
 * written it is retried, never dropped. For the relay, "acknowledged" is completing the outbox
 * claim, which takes the row out of the claim set.
 */

const LEASE = '44444444-4444-4444-8444-444444444444';
const OTHER_LEASE = '55555555-5555-4555-8555-555555555555';
const CORRELATION = '33333333-3333-4333-8333-333333333333';
const NIL = '00000000-0000-0000-0000-000000000000';
/** Hex, but neither a version 1-8 nor an RFC variant UUID: Postgres stores it, the envelope refuses it. */
const NON_RFC = '00000000-0000-4000-c000-00000000000a';
const RELAY = 'platform.outbox.sweep';

const id = (n: number): string =>
  `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;

const row = (
  n: number,
  patch: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> => ({
  event_id: id(n),
  event_type: 'job.requested',
  schema_version: 1,
  aggregate_type: 'job',
  aggregate_id: id(n + 500),
  aggregate_version: 3,
  correlation_id: CORRELATION,
  causation_id: null,
  lease_token: LEASE,
  dispatch_attempt_count: 1,
  occurred_at: '2026-10-10T12:00:00.000Z',
  producer: null,
  ...patch,
});

/** A never-relayed historical row of a family the widened claim admits, with a bad correlation id. */
const poisonLocalization = (
  n: number,
  patch: Readonly<Record<string, unknown>> = {},
) =>
  row(n, {
    event_type: 'cms.localization.changed.v1',
    aggregate_type: 'cms_content_entry',
    aggregate_version: 2,
    correlation_id: NON_RFC,
    producer: 'cms.composition',
    ...patch,
  });

/** A well-formed localization event under the aggregate the producer uses (`cms_locale_variant`). */
const validLocalization = (n: number) =>
  row(n, {
    event_type: 'cms.localization.changed.v1',
    aggregate_type: AGGREGATE_FOR['cms.localization.changed.v1'],
    producer: 'cms.composition',
  });

/** A legacy Slice 11 row under the former `cms_content_entry` aggregate: the relay now refuses it as poison. */
const legacyLocalization = (n: number) =>
  row(n, {
    event_type: 'cms.localization.changed.v1',
    aggregate_type: 'cms_content_entry',
    producer: 'cms.composition',
  });

type Call = Readonly<{ operation: string; input: Record<string, unknown> }>;

const sweep = async (
  rows: readonly unknown[],
  options: Readonly<{
    deadLetter?: () => unknown;
    complete?: (input: Record<string, unknown>) => unknown;
    leaseToken?: string;
  }> = {},
) => {
  const calls: Call[] = [];
  const sent: unknown[] = [];
  const queue = {
    send: vi.fn(async (body: unknown) => {
      calls.push({ operation: 'send', input: body as Record<string, unknown> });
      sent.push(body);
    }),
  } as unknown as PlatformJobsQueue;
  const rpc = vi.fn(
    async (
      _env: AsyncWorkerBindings,
      operation: AsyncRpcOperation,
      input: Record<string, unknown>,
    ) => {
      calls.push({ operation, input });
      if (operation === 'claim_outbox_batch') return rows;
      if (operation === 'consumer_dead_letter_event')
        return options.deadLetter === undefined
          ? { accepted: true }
          : options.deadLetter();
      if (operation === 'complete_outbox_event')
        return options.complete === undefined ? true : options.complete(input);
      return true;
    },
  ) as unknown as AsyncRpcClient;
  const result = await createAsyncJobDependencies({
    rpc,
    outboxLeaseToken: () => options.leaseToken ?? LEASE,
  }).sweepOutbox?.({
    controller: { cron: '* * * * *', scheduledTime: 100 },
    env: {
      APP_ENVIRONMENT: 'staging',
      APP_RELEASE: 'local',
      PLATFORM_JOBS: queue,
      SUPABASE_SECRET_KEY: 'secret',
      SUPABASE_URL: 'https://staging.example.supabase.co',
    },
    executionContext: { waitUntil: vi.fn() } as AsyncExecutionContext,
  });
  return { result, calls, sent };
};

const names = (calls: readonly Call[]): string[] =>
  calls.map((call) =>
    call.operation === 'send'
      ? `send:${String(call.input.eventId)}`
      : call.operation === 'claim_outbox_batch'
        ? 'claim'
        : `${call.operation}:${String(call.input.p_event_id ?? (call.input.p_request as Record<string, unknown> | undefined)?.eventId)}`,
  );

describe('[P2-S11-AC-113] the outbox relay never lets one unparseable row block the rows behind it', () => {
  it('records the poison row as a dead letter, completes its claim and still relays every later row, job.requested included', async () => {
    const { result, calls, sent } = await sweep([
      poisonLocalization(1),
      row(2, { causation_id: NIL }),
      row(3),
      validLocalization(4),
    ]);
    expect(result).toBe('completed');
    expect(names(calls)).toEqual([
      'claim',
      `consumer_dead_letter_event:${id(1)}`,
      `complete_outbox_event:${id(1)}`,
      `consumer_dead_letter_event:${id(2)}`,
      `complete_outbox_event:${id(2)}`,
      `send:${id(3)}`,
      `complete_outbox_event:${id(3)}`,
      `send:${id(4)}`,
      `complete_outbox_event:${id(4)}`,
    ]);
    expect(sent.map((body) => (body as { eventId: string }).eventId)).toEqual([
      id(3),
      id(4),
    ]);
  });

  it('drains a legacy cms_content_entry localization row through the poison path, never to the queue', async () => {
    const { result, calls, sent } = await sweep([
      legacyLocalization(1),
      validLocalization(2),
    ]);
    expect(result).toBe('completed');
    expect(names(calls)).toEqual([
      'claim',
      `consumer_dead_letter_event:${id(1)}`,
      `complete_outbox_event:${id(1)}`,
      `send:${id(2)}`,
      `complete_outbox_event:${id(2)}`,
    ]);
    expect(sent.map((body) => (body as { eventId: string }).eventId)).toEqual([
      id(2),
    ]);
  });

  it('records identifiers and the closed reason only, under the relay consumer name', async () => {
    const { calls } = await sweep([poisonLocalization(1)]);
    expect(
      calls.filter((call) => call.operation === 'consumer_dead_letter_event'),
    ).toEqual([
      {
        operation: 'consumer_dead_letter_event',
        input: {
          p_request: {
            consumer: RELAY,
            eventId: id(1),
            eventType: 'cms.localization.changed.v1',
            schemaVersion: 1,
            aggregateType: 'cms_content_entry',
            aggregateId: id(501),
            aggregateVersion: '2',
            reasonCode: 'INVALID_QUEUE_PAYLOAD',
          },
        },
      },
    ]);
    expect(calls.at(-1)).toEqual({
      operation: 'complete_outbox_event',
      input: { p_event_id: id(1), p_lease_token: LEASE },
    });
  });

  it('addresses a poison row whose own ids are not RFC UUIDs, and records nothing a hostile row could smuggle', async () => {
    const { result, calls } = await sweep([
      poisonLocalization(1, {
        event_id: NON_RFC,
        aggregate_id: NON_RFC,
        aggregate_type: 'Not A Key; drop table',
        event_type: 'CMS.Hostile\nevent',
        schema_version: 1,
        aggregate_version: 'seven',
      }),
    ]);
    expect(result).toBe('completed');
    expect(
      calls.find((call) => call.operation === 'consumer_dead_letter_event'),
    ).toEqual({
      operation: 'consumer_dead_letter_event',
      input: {
        p_request: {
          consumer: RELAY,
          eventId: NON_RFC,
          eventType: null,
          schemaVersion: 1,
          aggregateType: null,
          aggregateId: NON_RFC,
          aggregateVersion: null,
          reasonCode: 'INVALID_QUEUE_PAYLOAD',
        },
      },
    });
    expect(
      calls.find((call) => call.operation === 'complete_outbox_event')?.input,
    ).toEqual({ p_event_id: NON_RFC, p_lease_token: LEASE });
  });

  it('never drops a poison row it could not record: the dead letter fails, the sweep retries and nothing behind it is relayed', async () => {
    const { result, calls, sent } = await sweep(
      [poisonLocalization(1), row(2)],
      {
        deadLetter: () => {
          throw new Error('dead letter store unavailable');
        },
      },
    );
    expect(result).toBe('retry');
    expect(sent).toEqual([]);
    expect(
      calls.some((call) => call.operation === 'complete_outbox_event'),
    ).toBe(false);
  });

  it('retries when the dead letter is not acknowledged', async () => {
    const { result, calls } = await sweep([poisonLocalization(1), row(2)], {
      deadLetter: () => ({ accepted: false }),
    });
    expect(result).toBe('retry');
    expect(
      calls.some((call) => call.operation === 'complete_outbox_event'),
    ).toBe(false);
  });

  it('retries when the poison claim cannot be completed (its lease was lost)', async () => {
    const { result, sent } = await sweep([poisonLocalization(1), row(2)], {
      complete: () => false,
    });
    expect(result).toBe('retry');
    expect(sent).toEqual([]);
  });

  it('does not touch a row that another sweep leased', async () => {
    const { result, calls } = await sweep([
      poisonLocalization(1, { lease_token: OTHER_LEASE }),
    ]);
    expect(result).toBe('retry');
    expect(names(calls)).toEqual(['claim']);
  });

  it.each([
    ['a row that is not an object', 'junk'],
    ['a row without an addressable event id', { bad: true }],
    [
      'a row whose event id is not a UUID',
      poisonLocalization(1, { event_id: 'not-a-uuid' }),
    ],
    [
      'a row without a lease token',
      poisonLocalization(1, { lease_token: undefined }),
    ],
  ])(
    'keeps retrying %s: nothing can be recorded for it',
    async (_name, bad) => {
      const { result, calls } = await sweep([bad, row(2)]);
      expect(result).toBe('retry');
      expect(names(calls)).toEqual(['claim']);
    },
  );

  it('still retries a well-formed row claimed under another lease token', async () => {
    const { result, sent } = await sweep([
      row(1, { lease_token: OTHER_LEASE }),
    ]);
    expect(result).toBe('retry');
    expect(sent).toEqual([]);
  });

  it('relays a batch with no poison exactly as before', async () => {
    const { result, calls } = await sweep([row(1), validLocalization(2)]);
    expect(result).toBe('completed');
    expect(names(calls)).toEqual([
      'claim',
      `send:${id(1)}`,
      `complete_outbox_event:${id(1)}`,
      `send:${id(2)}`,
      `complete_outbox_event:${id(2)}`,
    ]);
  });
});

describe('[P2-S11-AC-113] parsePoisonedOutboxRow', () => {
  it('reads the camelCase and snake_case claim shapes alike', () => {
    expect(
      parsePoisonedOutboxRow(
        {
          outboxId: id(1),
          leaseToken: LEASE,
          eventType: 'job.requested',
          schemaVersion: 1,
          aggregateType: 'job',
          aggregateId: id(2),
          aggregateVersion: '9',
        },
        LEASE,
      ),
    ).toEqual({
      outboxId: id(1),
      identity: {
        eventId: id(1),
        eventType: 'job.requested',
        schemaVersion: 1,
        aggregateType: 'job',
        aggregateId: id(2),
        aggregateVersion: '9',
      },
    });
  });

  it.each([
    ['a null', null],
    ['a number', 7],
    ['an object without ids', {}],
    ['a foreign lease', { event_id: id(1), lease_token: OTHER_LEASE }],
  ])('refuses %s', (_name, value) => {
    expect(parsePoisonedOutboxRow(value, LEASE)).toBeNull();
  });

  it('nulls identifiers of the wrong type or outside the recordable range', () => {
    expect(
      parsePoisonedOutboxRow(
        {
          event_id: id(1),
          lease_token: LEASE,
          event_type: 7,
          schema_version: '1',
          aggregate_type: null,
          aggregate_id: 5,
          aggregate_version: 1.5,
        },
        LEASE,
      )?.identity,
    ).toEqual({
      eventId: id(1),
      eventType: null,
      schemaVersion: null,
      aggregateType: null,
      aggregateId: null,
      aggregateVersion: null,
    });
    expect(
      parsePoisonedOutboxRow(
        { event_id: id(1), lease_token: LEASE, schema_version: 101 },
        LEASE,
      )?.identity.schemaVersion,
    ).toBeNull();
    expect(
      parsePoisonedOutboxRow(
        { event_id: id(1), lease_token: LEASE, schema_version: 100 },
        LEASE,
      )?.identity.schemaVersion,
    ).toBe(100);
  });

  it('nulls every identifier that is not in the canonical shape', () => {
    expect(
      parsePoisonedOutboxRow(
        {
          event_id: id(1),
          lease_token: LEASE,
          event_type: 'x'.repeat(161),
          schema_version: 0,
          aggregate_type: 'a'.repeat(65),
          aggregate_id: 'nope',
          aggregate_version: -4,
        },
        LEASE,
      ),
    ).toEqual({
      outboxId: id(1),
      identity: {
        eventId: id(1),
        eventType: null,
        schemaVersion: null,
        aggregateType: null,
        aggregateId: null,
        aggregateVersion: null,
      },
    });
  });
});
