import { REVIEW_RECHECK_SOURCES } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import { createAsyncJobDependencies } from './async-runtime';
import { parseOutboxClaim } from './async-runtime-parsing';
import type { AsyncWorkerBindings } from './async-entrypoint';
import { AGGREGATE_FOR } from './cms-editorial/review-recheck/review-recheck.test-support';

const SOURCES = Object.keys(
  REVIEW_RECHECK_SOURCES,
) as (keyof typeof REVIEW_RECHECK_SOURCES)[];

const claimRow = (
  eventType: (typeof SOURCES)[number],
  patch: Readonly<Record<string, unknown>> = {},
) => ({
  event_id: '11111111-1111-4111-8111-111111111111',
  event_type: eventType,
  schema_version: 1,
  aggregate_type: AGGREGATE_FOR[eventType],
  aggregate_id: '22222222-2222-4222-8222-222222222222',
  aggregate_version: 4,
  correlation_id: '33333333-3333-4333-8333-333333333333',
  causation_id: null,
  lease_token: '44444444-4444-4444-8444-444444444444',
  dispatch_attempt_count: 1,
  occurred_at: '2026-10-10T12:00:00.000Z',
  producer: REVIEW_RECHECK_SOURCES[eventType].producer,
  ...patch,
});

describe('[P2-S11-AC-113] the outbox relay claim of the review recheck source events', () => {
  it.each(SOURCES)(
    'parses a claimed %s row to its identifier-only envelope',
    (eventType) => {
      expect(parseOutboxClaim(claimRow(eventType))).toEqual({
        outboxId: '11111111-1111-4111-8111-111111111111',
        leaseToken: '44444444-4444-4444-8444-444444444444',
        envelope: {
          eventId: '11111111-1111-4111-8111-111111111111',
          eventType,
          schemaVersion: 1,
          occurredAt: '2026-10-10T12:00:00.000Z',
          producer: REVIEW_RECHECK_SOURCES[eventType].producer,
          aggregateType: AGGREGATE_FOR[eventType],
          aggregateId: '22222222-2222-4222-8222-222222222222',
          aggregateVersion: '4',
          correlationId: '33333333-3333-4333-8333-333333333333',
          causationId: null,
        },
      });
    },
  );

  it.each([
    ['another producer', { producer: 'cms.editorial' }],
    ['no producer', { producer: null }],
    ['an unregistered producer prefix', { producer: undefined }],
    [
      'an aggregate that is not a registry key',
      { aggregate_type: 'Not A Key' },
    ],
    ['no occurrence instant', { occurred_at: null }],
  ])('refuses a Slice 12 template claim with %s', (_name, patch) => {
    expect(
      parseOutboxClaim(claimRow('cms.template.activated.v1', patch)),
    ).toBeNull();
  });

  it.each([
    ['cms.schema.activated.v1', 'cms_schema'],
    // The former aggregate (Slice 11 content entry) is refused at the relay: a legacy row drains into
    // the poison path, never into the consumer (root ruling 1, aggregate `cms_locale_variant`).
    ['cms.localization.changed.v1', 'cms_content_entry'],
    ['cms.block.lifecycle.changed.v1', 'cms_block'],
  ] as const)(
    'refuses %s on an aggregate other than the producer uses (%s)',
    (eventType, aggregate) => {
      expect(
        parseOutboxClaim(claimRow(eventType, { aggregate_type: aggregate })),
      ).toBeNull();
    },
  );

  it('keeps refusing an event type that is not relayed at all', () => {
    expect(
      parseOutboxClaim({
        ...claimRow('cms.schema.activated.v1'),
        event_type: 'cms.entry.review-changed.v1',
        aggregate_type: 'cms_editorial_review',
      }),
    ).toBeNull();
    expect(
      parseOutboxClaim({
        ...claimRow('cms.schema.activated.v1'),
        event_type: 'constructor',
      }),
    ).toBeNull();
  });

  it('sweeps the six events onto the platform queue and completes each outbox row', async () => {
    const send = vi.fn();
    const rows = SOURCES.map((eventType, index) =>
      claimRow(eventType, {
        event_id: `1111111${index}-1111-4111-8111-111111111111`,
      }),
    );
    const rpc = vi.fn(async (...call: [unknown, string, unknown?]) =>
      call[1] === 'claim_outbox_batch' ? rows : true,
    );
    const { sweepOutbox } = createAsyncJobDependencies({
      rpc: rpc as never,
      outboxLeaseToken: () => '44444444-4444-4444-8444-444444444444',
    });
    if (sweepOutbox === undefined) throw new Error('sweep missing');
    await expect(
      sweepOutbox({
        controller: { cron: '* * * * *', scheduledTime: 0 },
        env: { PLATFORM_JOBS: { send } } as unknown as AsyncWorkerBindings,
        executionContext: { waitUntil: vi.fn() },
      }),
    ).resolves.toBe('completed');
    expect(send.mock.calls.map(([envelope]) => envelope.eventType)).toEqual(
      SOURCES,
    );
    expect(
      rpc.mock.calls
        .filter(([, operation]) => operation === 'complete_outbox_event')
        .map(([, , input]) => (input as { p_event_id: string }).p_event_id),
    ).toEqual(rows.map((row) => row.event_id));
  });
});
