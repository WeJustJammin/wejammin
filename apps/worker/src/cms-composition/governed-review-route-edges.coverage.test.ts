import { describe, expect, it, vi } from 'vitest';

import { abortAfterQuota } from './coverage-abort.test-support';
import {
  activatedResource,
  activationHarness,
  activationRequest,
  scheduleBody,
  scheduleHarness,
} from './governed-activation.test-support';
import {
  assignmentRequest,
  assignmentResource,
  decidedReview,
  decisionRequest,
  detailRequest,
  detailResource,
  expectError,
  governedHarness,
  OTHER_REVIEW_ID,
  ownerHarness,
  queuePage,
  queueRequest,
  reviewerHarness,
  reviewerSession,
} from './governed-review-ops.test-support';
import {
  jsonReply,
  reviewResource,
  submitBody,
  submitRequest,
} from './governed-review-submit.test-support';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

type Harness = ReturnType<typeof governedHarness>;
type Row = Readonly<{
  name: string;
  harness: (dependencies: Record<string, unknown>) => Harness;
  request: () => Request;
  port: string;
  /** A successful port answer that does not honour the request that asked. */
  mismatched: unknown;
}>;

const ROWS: readonly Row[] = [
  {
    name: 'CMS-03C-06 submit',
    harness: (dependencies) => governedHarness({ dependencies }),
    request: () => submitRequest(submitBody()),
    port: 'submitReview',
    mismatched: reviewResource('template_version', {
      subjectId: OTHER_REVIEW_ID,
    }),
  },
  {
    name: 'CMS-03C-07 decision',
    harness: (dependencies) => reviewerHarness({ dependencies }),
    request: () => decisionRequest(),
    port: 'recordDecision',
    mismatched: decidedReview('rejected'),
  },
  {
    name: 'CMS-03C-08 assignment',
    harness: (dependencies) => ownerHarness({ dependencies }),
    request: () => assignmentRequest(),
    port: 'assignReviewer',
    mismatched: assignmentResource({ reviewId: OTHER_REVIEW_ID }),
  },
  {
    name: 'CMS-03C-09 activation',
    harness: (dependencies) => activationHarness({ dependencies }),
    request: () => activationRequest(),
    port: 'activateReview',
    mismatched: activatedResource({ reviewId: OTHER_REVIEW_ID }),
  },
  {
    name: 'CMS-03C-10 detail',
    harness: (dependencies) =>
      governedHarness({ session: reviewerSession, dependencies }),
    request: () => detailRequest(),
    port: 'readReview',
    mismatched: detailResource({ id: OTHER_REVIEW_ID }),
  },
  {
    name: 'CMS-03C-11 queue',
    harness: (dependencies) =>
      governedHarness({ session: reviewerSession, dependencies }),
    request: () => queueRequest({ limit: '1' }),
    port: 'listReviews',
    mismatched: queuePage(),
  },
];

describe.each(ROWS)('$name route edges', (row) => {
  it('mints a request id when the caller names none', async () => {
    const original = row.request();
    const headers = new Headers(original.headers);
    headers.delete('x-request-id');
    const harness = governedHarness({ anonymous: true });
    const response = await harness.send(
      new Request(original.url, {
        method: original.method,
        headers,
        ...(original.method === 'POST' ? { body: await original.text() } : {}),
      }),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get('x-request-id')).toMatch(UUID);
  });

  it('answers 503 with the first backoff when the port throws', async () => {
    const harness = row.harness({
      [row.port]: async () => {
        throw new Error('port fault');
      },
    });
    const response = await harness.send(row.request());
    await expectError(response, 503, 'DEPENDENCY_UNAVAILABLE');
    expect(response.headers.get('retry-after')).toBe('15');
  });

  it('answers 502 for a port answer that is not a result envelope', async () => {
    const harness = row.harness({ [row.port]: async () => 'created' });
    await expectError(
      await harness.send(row.request()),
      502,
      'DEPENDENCY_UNAVAILABLE',
    );
  });

  it('answers 502 for a successful answer that does not honour the request', async () => {
    const harness = row.harness({
      [row.port]: async () => ({ ok: true, value: row.mismatched }),
    });
    await expectError(
      await harness.send(row.request()),
      502,
      'DEPENDENCY_UNAVAILABLE',
    );
  });
});

describe.each(ROWS)('$name abort after admission', (row) => {
  it('answers 504 and never calls the port when the caller aborts after the quotas', async () => {
    const controller = new AbortController();
    const port = vi.fn();
    const harness = row.harness({
      [row.port]: port,
      rateLimit: abortAfterQuota(controller),
    });
    const built = row.request();
    const response = await harness.send(
      new Request(built, { signal: controller.signal }),
    );
    await expectError(response, 504, 'DEPENDENCY_UNAVAILABLE');
    expect(response.headers.get('retry-after')).toBe('15');
    expect(port).not.toHaveBeenCalled();
  });
});

describe('CMS-03C-09 schedule authority fault', () => {
  it('answers a retryable 503 when the pinned Time authority throws', async () => {
    const activateReview = vi.fn();
    const harness = scheduleHarness({
      dependencies: {
        activateReview,
        timeAuthority: async () => {
          throw new Error('tz database unreadable');
        },
      },
    });
    const response = await harness.send(activationRequest(scheduleBody()));
    await expectError(response, 503, 'DEPENDENCY_UNAVAILABLE');
    expect(response.headers.get('retry-after')).toBe('15');
    expect(activateReview).not.toHaveBeenCalled();
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it('is a plain RPC answer for a non-schedule action (no authority consulted)', async () => {
    const timeAuthority = vi.fn();
    const harness = activationHarness({ dependencies: { timeAuthority } }, () =>
      jsonReply(activatedResource()),
    );
    expect((await harness.send(activationRequest())).status).toBe(200);
    expect(timeAuthority).not.toHaveBeenCalled();
  });
});
