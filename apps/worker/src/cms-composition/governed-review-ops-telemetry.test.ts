import { createLogger } from '@wejammin/observability/logging';
import { describe, expect, it } from 'vitest';

import { OPERATIONS } from './governed-review-ops-table.test-support';
import {
  KEY,
  PARTY_ID,
  REQUEST_ID,
  REVIEW_ID,
  sqlRefusal,
  USER_ID,
} from './governed-review-ops.test-support';

const CORRELATION_ID = 'd1200000-0000-4000-8000-0000000004ff';
const EVENT: Readonly<Record<string, string>> = {
  'CMS-03C-07': 'cms.composition.governed_review.decide',
  'CMS-03C-08': 'cms.composition.governed_review.assign',
  'CMS-03C-09': 'cms.composition.governed_review.activate',
  'CMS-03C-10': 'cms.composition.governed_review.detail',
  'CMS-03C-11': 'cms.composition.governed_review.queue',
};

describe.each(OPERATIONS)('$id correlation and telemetry', (row) => {
  it.each([
    ['a valid x-correlation-id', CORRELATION_ID, CORRELATION_ID],
    ['an invalid x-correlation-id', 'not-a-uuid', REQUEST_ID],
    ['no x-correlation-id', undefined, REQUEST_ID],
  ] as const)(
    'forwards %s as the request correlation',
    async (_n, supplied, expected) => {
      const harness = row.harness();
      const request = row.request();
      if (supplied !== undefined)
        request.headers.set('x-correlation-id', supplied);
      expect((await harness.send(request)).status).toBe(row.status);
      const call = harness.fetchImpl.mock.calls[0];
      expect(new Headers(call?.[1]?.headers).get('x-correlation-id')).toBe(
        expected,
      );
      const wire = JSON.parse(String(call?.[1]?.body)) as {
        p_request: {
          correlationId: string;
          context: { correlationId: string };
        };
      };
      expect(wire.p_request.correlationId).toBe(expected);
      expect(wire.p_request.context.correlationId).toBe(expected);
    },
  );

  it('emits one scrubbed request event with route facts only', async () => {
    const lines: string[] = [];
    const logger = createLogger(
      { environment: 'staging', release: 'slice-12', service: 'wejammin-api' },
      { sink: (line) => lines.push(line) },
    );
    const harness = row.harness({
      tuning: { logger },
      reply: () => sqlRefusal(row.refusal.token, 'private provider'),
    });
    await harness.send(row.request());
    const events = lines
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .filter(
        (line) => line.eventName === 'cms.composition.governed_review.request',
      );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      operation: EVENT[row.id],
      requestId: REQUEST_ID,
      outcome: 'rejected',
      attributes: {
        actor_class: 'human',
        status: row.refusal.status,
        runbook: 'cms-composition',
      },
    });
    const serialized = JSON.stringify(events[0]);
    for (const secret of [KEY, USER_ID, PARTY_ID, REVIEW_ID, 'private'])
      expect(serialized).not.toContain(secret);
  });
});
