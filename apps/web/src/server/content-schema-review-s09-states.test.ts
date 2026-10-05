import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import ContentSchemaRegistryWorkbenchIsland from '../components/content-schema-registry/ContentSchemaRegistryWorkbenchIsland';
import { REQUEST_ID } from '../components/content-schema-registry/content-schema-review-dec108.test-support';

import { resolveReview } from './content-schema-review-dec108.test-support';

/**
 * FE03 `reviewState` error class (CMS-03A-13): the retry affordance is offered
 * only for 429 and 502/503/504. Every other typed failure is a terminal error
 * with no retry, and every failure hands the island the ApiError request ID the user quotes to support.
 */

type Retryable = {
  readonly status: string;
  readonly retryable?: boolean;
  readonly httpStatus?: number;
};

const reviewStateFor = async (
  status: number,
  errorCode: string,
): Promise<{ readonly kind: string; readonly state: Retryable }> => {
  const { result } = await resolveReview({ status, errorCode });
  if (result.kind !== 'error' && result.kind !== 'degraded')
    throw new Error(`expected an error or degraded page, got ${result.kind}`);
  return { kind: result.kind, state: result.page.initialReview as Retryable };
};

describe('[DEC-108] review read failure retry policy', () => {
  it('[P2-S09-AC-953] marks 429 as a retryable error', async () => {
    const { kind, state } = await reviewStateFor(429, 'RATE_LIMITED');
    expect(kind).toBe('error');
    expect(state).toMatchObject({ status: 'error', retryable: true });
  });

  it.each([
    [502, 'DEPENDENCY_INVALID_RESPONSE'],
    [503, 'DEPENDENCY_UNAVAILABLE'],
    [504, 'DEPENDENCY_DEADLINE_EXCEEDED'],
  ] as const)(
    '[P2-S09-AC-953] answers %i as a degraded state the panel retries from',
    async (status, code) => {
      const { kind, state } = await reviewStateFor(status, code);
      expect(kind).toBe('degraded');
      expect(state).toMatchObject({ status: 'degraded', httpStatus: status });
    },
  );

  it.each([
    [500, 'INTERNAL_ERROR'],
    [400, 'INVALID_REQUEST'],
  ] as const)(
    '[P2-S09-AC-953] never marks %i as retryable',
    async (status, code) => {
      const { state } = await reviewStateFor(status, code);
      expect(state.retryable).toBe(false);
    },
  );

  it('[P2-S09-AC-953] carries the ApiError request ID in the island review error state', async () => {
    const { result } = await resolveReview({
      status: 429,
      errorCode: 'RATE_LIMITED',
    });
    if (result.kind !== 'error') throw new Error('expected an error page');
    expect(result.page.initialReview).toMatchObject({
      status: 'error',
      error: { code: 'RATE_LIMITED', requestId: REQUEST_ID },
    });
  });

  it.each([
    [502, 'DEPENDENCY_INVALID_RESPONSE'],
    [503, 'DEPENDENCY_UNAVAILABLE'],
    [504, 'DEPENDENCY_DEADLINE_EXCEEDED'],
  ] as const)(
    '[P2-S09-AC-953] carries the request ID in the island degraded state for %i',
    async (status, code) => {
      const { result } = await resolveReview({ status, errorCode: code });
      if (result.kind !== 'degraded')
        throw new Error('expected a degraded page');
      expect(result.page.initialReview).toMatchObject({
        status: 'degraded',
        requestId: REQUEST_ID,
      });
    },
  );

  it('[P2-S09-AC-953] renders that request ID in the hydrated island for a rate-limited review read', async () => {
    const { result } = await resolveReview({
      status: 429,
      errorCode: 'RATE_LIMITED',
    });
    if (result.kind !== 'error') throw new Error('expected an error page');
    const markup = renderToStaticMarkup(
      React.createElement(ContentSchemaRegistryWorkbenchIsland, {
        ...(result.page as unknown as React.ComponentProps<
          typeof ContentSchemaRegistryWorkbenchIsland
        >),
        canonicalRefetchUrl: result.page.retryUrl,
      }),
    );
    expect(markup).toContain(REQUEST_ID);
  });
});
