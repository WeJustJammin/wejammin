import { describe, expect, it } from 'vitest';

import {
  applyProjection,
  initialProjectionState,
  type ContentSchemaRegistryProjectionState,
} from './content-schema-registry-canonical-projection-state';
import type { ContentSchemaRegistryWorkbenchProjection } from './content-schema-registry-canonical-state-validate';
import { passedDryRunPreparation } from './content-schema-registry-activation-preparation.test-support';
import {
  draftDetail,
  reviewResource,
} from './content-schema-review-dec108.test-support';

const T0 = '2026-10-02T12:00:00.000Z';
const T1 = '2026-10-02T12:01:00.000Z';
const T2 = '2026-10-02T12:02:00.000Z';

const DETAIL = draftDetail(passedDryRunPreparation);
const REVIEW = reviewResource();

const projectionOf = (
  overrides: Partial<ContentSchemaRegistryWorkbenchProjection> = {},
): ContentSchemaRegistryWorkbenchProjection => ({
  access: 'full',
  variant: 'ownerFull',
  initialList: { status: 'empty', reason: 'no-records' },
  initialDetail: null,
  initialReview: null,
  ...overrides,
});

const verified = (): ContentSchemaRegistryProjectionState =>
  initialProjectionState(
    {
      access: 'full',
      variant: 'ownerFull',
      initialList: { status: 'empty', reason: 'no-records' },
      initialDetail: {
        status: 'success',
        data: DETAIL,
        version: '4',
        stale: false,
      },
      initialReview: {
        status: 'success',
        data: REVIEW,
        version: '1',
        stale: false,
      },
    },
    () => T0,
  );

const degradedDetail = {
  status: 'degraded',
  data: null,
  lastVerifiedAt: null,
  retryable: true,
  httpStatus: 503,
} as const;

const degradedReview = {
  status: 'degraded',
  data: null,
  lastVerifiedAt: null,
  retryable: true,
  httpStatus: 503,
} as const;

describe('canonical projection keeps the last verified data when a read degrades (FE03 degraded)', () => {
  it('[P2-S09-AC-966] keeps the verified detail and stamps the instant it was hydrated', () => {
    const next = applyProjection(
      verified(),
      projectionOf({ initialDetail: degradedDetail }),
      () => T1,
    );
    expect(next.initialDetail).toMatchObject({
      status: 'degraded',
      data: DETAIL,
      lastVerifiedAt: T0,
    });
  });

  it('[P2-S09-AC-954] keeps the verified review and stamps the instant it was hydrated', () => {
    const next = applyProjection(
      verified(),
      projectionOf({ initialReview: degradedReview }),
      () => T1,
    );
    expect(next.initialReview).toMatchObject({
      status: 'degraded',
      data: REVIEW,
      lastVerifiedAt: T0,
    });
  });

  it('[P2-S09-AC-966] stamps the detail with the later canonical read that verified it', () => {
    const reread = applyProjection(
      verified(),
      projectionOf({
        initialDetail: {
          status: 'success',
          data: DETAIL,
          version: '4',
          stale: false,
        },
      }),
      () => T1,
    );
    const next = applyProjection(
      reread,
      projectionOf({ initialDetail: degradedDetail }),
      () => T2,
    );
    expect(next.initialDetail).toMatchObject({ lastVerifiedAt: T1 });
  });

  it('[P2-S09-AC-966] keeps the first verification instant across repeated degraded reads', () => {
    const first = applyProjection(
      verified(),
      projectionOf({ initialDetail: degradedDetail }),
      () => T1,
    );
    const second = applyProjection(
      first,
      projectionOf({ initialDetail: degradedDetail }),
      () => T2,
    );
    expect(second.initialDetail).toMatchObject({
      status: 'degraded',
      data: DETAIL,
      lastVerifiedAt: T0,
    });
  });

  it('[P2-S09-AC-966] keeps nothing for a slot that never held verified data', () => {
    const empty = initialProjectionState(
      {
        access: 'full',
        variant: 'ownerFull',
        initialList: { status: 'empty', reason: 'no-records' },
        initialDetail: null,
      },
      () => T0,
    );
    const next = applyProjection(
      empty,
      projectionOf({ initialDetail: degradedDetail }),
      () => T1,
    );
    expect(next.initialDetail).toMatchObject({ data: null });
  });

  it('[P2-S09-AC-966] does not overwrite data a degraded read carries itself', () => {
    const next = applyProjection(
      verified(),
      projectionOf({
        initialDetail: {
          status: 'degraded',
          data: draftDetail(),
          lastVerifiedAt: T1,
        },
      }),
      () => T2,
    );
    expect(next.initialDetail).toMatchObject({ lastVerifiedAt: T1 });
  });

  it('[P2-S09-AC-966] keeps a verified list page while only the list degrades', () => {
    const base = verified();
    const withList: ContentSchemaRegistryProjectionState = {
      ...base,
      initialList: {
        status: 'success',
        data: { items: [], nextCursor: null, hasMore: false } as never,
        version: '1',
        stale: false,
      },
    };
    const next = applyProjection(
      withList,
      projectionOf({
        initialList: {
          status: 'degraded',
          data: null,
          lastVerifiedAt: null,
        },
      }),
      () => T1,
    );
    expect(next.initialList).toMatchObject({
      status: 'degraded',
      lastVerifiedAt: T0,
    });
  });
});
