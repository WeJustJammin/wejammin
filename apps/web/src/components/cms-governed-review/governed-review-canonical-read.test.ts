import { describe, expect, it, vi } from 'vitest';

import {
  REVIEW_ID,
  SUBJECT_ID,
  apiError,
  governedDetailFixture,
  jsonResponse,
} from '../../server/cms-governed-review-fixtures.test-support';
import { readCanonicalGovernedReview } from './governed-review-canonical-read';

const fetcherFor = (response: Response | Error) =>
  vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });

const read = (response: Response | Error) =>
  readCanonicalGovernedReview(REVIEW_ID, fetcherFor(response));

const detail = (overrides: Record<string, unknown> = {}, etag = '"2"') =>
  jsonResponse(200, governedDetailFixture(overrides), { etag });

describe('readCanonicalGovernedReview', () => {
  it('reads the review through the first-party proxy as a no-store same-origin GET', async () => {
    const fetcher = fetcherFor(detail());
    await readCanonicalGovernedReview(REVIEW_ID, fetcher);
    const [path, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(path).toBe(`/api/v1/cms/governed-reviews/${REVIEW_ID}`);
    expect(init.method).toBe('GET');
    expect(init.cache).toBe('no-store');
    expect(init.credentials).toBe('same-origin');
    expect(init.redirect).toBe('manual');
  });

  it('verifies a bound review with its strong validator', async () => {
    const result = await read(detail());
    expect(result.kind).toBe('ok');
    expect(result.kind === 'ok' && result.resource.id).toBe(REVIEW_ID);
  });

  it.each([
    null,
    { state: 'pending', reasonCode: null },
    { state: 'completed', reasonCode: null },
    { state: 'blocked', reasonCode: 'canonical_source_unavailable' },
    { state: 'cancelled', reasonCode: 'approval_invalidated' },
  ])('verifies a review whose activation schedule is %j', async (schedule) => {
    const result = await read(detail({ activationSchedule: schedule }));
    expect(result.kind).toBe('ok');
    expect(result.kind === 'ok' && result.resource.activationSchedule).toEqual(
      schedule,
    );
  });

  it('reads a 401 as a sign-out and a 403 or 404 as one identical gone state', async () => {
    expect(
      (await read(jsonResponse(401, apiError('UNAUTHENTICATED')))).kind,
    ).toBe('signed-out');
    expect((await read(jsonResponse(403, apiError('X')))).kind).toBe('gone');
    expect((await read(jsonResponse(404, apiError('X')))).kind).toBe('gone');
  });

  it.each([
    ['a lost connection', new Error('offline')],
    ['a 503', jsonResponse(503, apiError('DEPENDENCY_UNAVAILABLE'))],
    ['a body for another review', detail({ id: SUBJECT_ID })],
    ['a validator that is not the version', detail({}, '"9"')],
    ['a missing validator', jsonResponse(200, governedDetailFixture())],
    ['a weak validator', detail({}, 'W/"2"')],
    [
      'a body that is not JSON',
      new Response('x', { status: 200, headers: { etag: '"2"' } }),
    ],
    [
      'a body without its decision list',
      jsonResponse(
        200,
        { ...governedDetailFixture(), decisions: 'x' },
        { etag: '"2"' },
      ),
    ],
    [
      'a state the page cannot name',
      jsonResponse(
        200,
        { ...governedDetailFixture(), state: 'mystery' },
        { etag: '"2"' },
      ),
    ],
    ...[
      ['a body without its activation schedule member', undefined],
      ['an activation schedule that is a string', 'blocked'],
      [
        'an activation schedule with a state the page cannot name',
        { state: 'mystery', reasonCode: null },
      ],
      [
        'an activation schedule with a reason the page cannot name',
        { state: 'blocked', reasonCode: 'mystery' },
      ],
      [
        'a blocked schedule without its reason',
        { state: 'blocked', reasonCode: null },
      ],
      [
        'a cancelled schedule without its reason',
        { state: 'cancelled', reasonCode: null },
      ],
      [
        'a reason on a schedule that is not closed',
        { state: 'pending', reasonCode: 'retries_exhausted' },
      ],
      ['a schedule without a reasonCode member', { state: 'pending' }],
      [
        'a schedule with a member beyond state and reasonCode',
        { state: 'pending', reasonCode: null, attemptCount: 1 },
      ],
    ].map(
      ([name, activationSchedule]) =>
        [
          name as string,
          jsonResponse(
            200,
            { ...governedDetailFixture(), activationSchedule },
            { etag: '"2"' },
          ),
        ] as const,
    ),
    [
      'a subject lifecycle the page cannot name',
      jsonResponse(
        200,
        { ...governedDetailFixture(), subjectState: 'mystery' },
        { etag: '"2"' },
      ),
    ],
  ] as const)(
    'degrades for %s and keeps the last verified review',
    async (_name, response) => {
      expect((await read(response)).kind).toBe('degraded');
    },
  );

  it('carries a safe request id of a degraded answer', async () => {
    const result = await read(
      jsonResponse(503, apiError('DEPENDENCY_UNAVAILABLE')),
    );
    expect(result.kind === 'degraded' && result.requestId).toBe(
      '0195b6f0-0000-7000-8000-000000000001',
    );
  });
});
