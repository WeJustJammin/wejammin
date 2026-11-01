import { describe, expect, it } from 'vitest';

import {
  CMS_GOVERNED_RECHECK_BATCH_MAX,
  CMS_GOVERNED_RECHECK_JOB_TYPE,
  GovernedRecheckMessageSchema,
  GovernedRecheckRunRequestSchema,
  GovernedRecheckRunResultSchema,
} from './contract';
import {
  CURSOR,
  governedJobBody,
  governedRunResult,
  IDS,
  REF,
} from './governed-recheck.test-support';
import { isGovernedRecheckJobMessage } from './message';

describe('[P2-S12-AC-202] the typed cms.governed_review.recheck message', () => {
  it('names the job and the 500-review bound of BE03c Job transport', () => {
    expect(CMS_GOVERNED_RECHECK_JOB_TYPE).toBe('cms.governed_review.recheck');
    expect(CMS_GOVERNED_RECHECK_BATCH_MAX).toBe(500);
  });

  it('accepts the strict message with a null or a uuid continuation cursor', () => {
    expect(
      GovernedRecheckMessageSchema.safeParse(governedJobBody()).success,
    ).toBe(true);
    expect(
      GovernedRecheckMessageSchema.safeParse(
        governedJobBody({ cursor: CURSOR }),
      ).success,
    ).toBe(true);
  });

  it.each(['block', 'pattern', 'content_type', 'canonical_domain'] as const)(
    'accepts the governed dependency kind %s',
    (kind) => {
      expect(
        GovernedRecheckMessageSchema.safeParse(
          governedJobBody({
            payload: { eventId: IDS.event, kind, refId: REF },
          }),
        ).success,
      ).toBe(true);
    },
  );

  it.each([
    [
      'an editorial dependency kind',
      {
        ...governedJobBody(),
        payload: { eventId: IDS.event, kind: 'schema', refId: REF },
      },
    ],
    [
      'another job type',
      { ...governedJobBody(), jobType: 'cms.review.dependency_recheck' },
    ],
    [
      'a caller-named review',
      {
        ...governedJobBody(),
        payload: { ...governedJobBody().payload, reviewId: IDS.person },
      },
    ],
    [
      'a person or capability member',
      {
        ...governedJobBody(),
        payload: { ...governedJobBody().payload, personId: IDS.person },
      },
    ],
    [
      'a payload member that is not a uuid',
      {
        ...governedJobBody(),
        payload: { ...governedJobBody().payload, refId: 'ref' },
      },
    ],
    ['schema version 2', { ...governedJobBody(), schemaVersion: 2 }],
    ['no cursor member', { ...governedJobBody(), cursor: undefined }],
    ['a stray top-level member', { ...governedJobBody(), content: 'x' }],
  ])('rejects %s', (_name, body) => {
    expect(GovernedRecheckMessageSchema.safeParse(body).success).toBe(false);
  });

  it('recognises exactly its own job message for the queue entrypoint', () => {
    expect(isGovernedRecheckJobMessage(governedJobBody())).toBe(true);
    expect(
      isGovernedRecheckJobMessage({ jobType: 'cms.review.dependency_recheck' }),
    ).toBe(false);
    expect(
      isGovernedRecheckJobMessage({ eventType: 'cms.schema.activated.v1' }),
    ).toBe(false);
    expect(isGovernedRecheckJobMessage(null)).toBe(false);
    expect(isGovernedRecheckJobMessage('cms.governed_review.recheck')).toBe(
      false,
    );
    expect(isGovernedRecheckJobMessage([governedJobBody()])).toBe(false);
  });
});

describe('[P2-S12-AC-203] the run request and result', () => {
  it('is the strict job payload plus its cursor', () => {
    const request = {
      eventId: IDS.event,
      kind: 'block',
      refId: REF,
      cursor: null,
    };
    expect(GovernedRecheckRunRequestSchema.safeParse(request).success).toBe(
      true,
    );
    expect(
      GovernedRecheckRunRequestSchema.safeParse({ ...request, batch: 5 })
        .success,
    ).toBe(false);
    expect(
      GovernedRecheckRunRequestSchema.safeParse({
        ...request,
        kind: 'template',
      }).success,
    ).toBe(false);
  });

  it('accepts a consistent result and a continuation only after a full run', () => {
    expect(
      GovernedRecheckRunResultSchema.safeParse(governedRunResult()).success,
    ).toBe(true);
    expect(
      GovernedRecheckRunResultSchema.safeParse(
        governedRunResult({
          examined: 500,
          invalidated: 0,
          dependencyChanged: 0,
          reviewerAuthorityChanged: 0,
          nextCursor: CURSOR,
        }),
      ).success,
    ).toBe(true);
  });

  it('accepts the unavailable count and the boundary invalidated + unavailable = examined (DEC-218)', () => {
    // two reviews left live, one invalidated, nothing else examined
    expect(
      GovernedRecheckRunResultSchema.safeParse(
        governedRunResult({
          examined: 3,
          invalidated: 1,
          dependencyChanged: 1,
          reviewerAuthorityChanged: 0,
          unavailable: 2,
        }),
      ).success,
    ).toBe(true);
    // every outcome accounts for exactly one examined review: invalidated + unavailable = examined
    expect(
      GovernedRecheckRunResultSchema.safeParse(
        governedRunResult({
          examined: 4,
          invalidated: 2,
          dependencyChanged: 1,
          reviewerAuthorityChanged: 1,
          unavailable: 2,
        }),
      ).success,
    ).toBe(true);
    // a systemic fault: all 500 reviews of a full run unavailable, a continuation cursor handed back
    expect(
      GovernedRecheckRunResultSchema.safeParse(
        governedRunResult({
          examined: 500,
          invalidated: 0,
          dependencyChanged: 0,
          reviewerAuthorityChanged: 0,
          unavailable: 500,
          nextCursor: CURSOR,
        }),
      ).success,
    ).toBe(true);
  });

  it.each([
    [
      'one outcome more than examined reviews (invalidated + unavailable = examined + 1)',
      governedRunResult({
        examined: 3,
        invalidated: 2,
        dependencyChanged: 1,
        reviewerAuthorityChanged: 1,
        unavailable: 2,
      }),
    ],
    [
      'more than 500 unavailable',
      governedRunResult({
        examined: 500,
        invalidated: 0,
        dependencyChanged: 0,
        reviewerAuthorityChanged: 0,
        unavailable: 501,
      }),
    ],
    ['more than 500 examined', governedRunResult({ examined: 501 })],
    [
      'invalidated that is not the sum of the two closed reasons',
      governedRunResult({ invalidated: 3 }),
    ],
    [
      'more outcomes than examined reviews',
      governedRunResult({ examined: 2, invalidated: 2, unavailable: 1 }),
    ],
    ['a cursor after a short run', governedRunResult({ nextCursor: CURSOR })],
    ['a negative count', governedRunResult({ unavailable: -1 })],
    ['a stray member', { ...governedRunResult(), reviewIds: [REF] }],
  ])('rejects %s', (_name, result) => {
    expect(GovernedRecheckRunResultSchema.safeParse(result).success).toBe(
      false,
    );
  });
});
