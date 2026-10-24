import { describe, expect, it } from 'vitest';

import {
  ASSIGNMENT_ID,
  CSRF,
  KEY,
  LATER,
  REVIEW_ID,
  SUBJECT_ID,
  governedAssignmentFixture,
  governedReviewFixture,
  jsonResponse,
} from '../../server/cms-governed-review-fixtures.test-support';
import {
  GOVERNED_COMMAND_SPECS,
  governedCommandPath,
} from './governed-review-command-specs';
import { sendGovernedCommand } from './governed-review-command-transport';
import {
  createInput,
  decideInput,
  decided,
  environment,
  fetcherFor,
  revokeInput,
  submitInput,
} from './governed-review-transport.test-support';

describe('governedCommandPath', () => {
  it('builds the registry path of each command', () => {
    expect(governedCommandPath('CMS-03C-06', {})).toBe(
      '/api/v1/cms/governed-reviews',
    );
    expect(governedCommandPath('CMS-03C-07', { reviewId: REVIEW_ID })).toBe(
      `/api/v1/cms/governed-reviews/${REVIEW_ID}/decision`,
    );
    expect(governedCommandPath('CMS-03C-08', { reviewId: REVIEW_ID })).toBe(
      `/api/v1/cms/governed-reviews/${REVIEW_ID}/assignments`,
    );
  });
});

describe('sendGovernedCommand request', () => {
  it('sends the strict body with the CSRF token, the key and the If-Match of a versioned command', async () => {
    const fetcher = fetcherFor(jsonResponse(200, decided, { etag: '"3"' }));
    await sendGovernedCommand(
      GOVERNED_COMMAND_SPECS['CMS-03C-07'],
      decideInput,
      environment(fetcher),
    );
    const [path, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(path).toBe(`/api/v1/cms/governed-reviews/${REVIEW_ID}/decision`);
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('same-origin');
    expect(init.redirect).toBe('manual');
    const headers = new Headers(init.headers);
    expect(headers.get('x-csrf-token')).toBe(CSRF);
    expect(headers.get('idempotency-key')).toBe(KEY);
    expect(headers.get('if-match')).toBe('"2"');
    expect(headers.get('content-type')).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual(decideInput.body);
  });

  it('sends no If-Match for a submission', async () => {
    const fetcher = fetcherFor(
      jsonResponse(201, governedReviewFixture(), { etag: '"1"' }),
    );
    await sendGovernedCommand(
      GOVERNED_COMMAND_SPECS['CMS-03C-06'],
      submitInput,
      environment(fetcher),
    );
    const [, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).has('if-match')).toBe(false);
  });

  it('sends nothing without the CSRF cookie', async () => {
    const fetcher = fetcherFor();
    const result = await sendGovernedCommand(
      GOVERNED_COMMAND_SPECS['CMS-03C-07'],
      decideInput,
      { fetcher, documentRef: { cookie: 'other=1' } },
    );
    expect(result).toEqual({ kind: 'local', reason: 'csrf_missing' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    ['an If-Match that is not the expectedVersion', { ifMatch: '"9"' }],
    ['a weak If-Match', { ifMatch: 'W/"2"' }],
    ['an unusable key', { idempotencyKey: 'short' }],
  ] as const)('sends nothing for %s', async (_name, override) => {
    const fetcher = fetcherFor();
    const result = await sendGovernedCommand(
      GOVERNED_COMMAND_SPECS['CMS-03C-07'],
      { ...decideInput, ...override },
      environment(fetcher),
    );
    expect(result).toEqual({ kind: 'local', reason: 'request_invalid' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('sends nothing for a submission whose subject is not a version id and hash', async () => {
    const fetcher = fetcherFor();
    for (const body of [
      { ...submitInput.body, subjectId: 'x' },
      { ...submitInput.body, subjectHash: 'x' },
      { ...submitInput.body, subjectKind: 'block_version' },
    ]) {
      const result = await sendGovernedCommand(
        GOVERNED_COMMAND_SPECS['CMS-03C-06'],
        { ...submitInput, body } as never,
        environment(fetcher),
      );
      expect(result).toEqual({ kind: 'local', reason: 'request_invalid' });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('sendGovernedCommand commit verification', () => {
  it.each([
    [
      'submit',
      'CMS-03C-06',
      submitInput,
      jsonResponse(201, governedReviewFixture(), { etag: '"1"' }),
      201,
    ],
    [
      'decision',
      'CMS-03C-07',
      decideInput,
      jsonResponse(200, decided, { etag: '"3"' }),
      200,
    ],
    [
      'assignment create',
      'CMS-03C-08',
      createInput,
      jsonResponse(201, governedAssignmentFixture(), {
        etag: '"1"',
        location: `/api/v1/cms/governed-reviews/${REVIEW_ID}/assignments/${ASSIGNMENT_ID}`,
      }),
      201,
    ],
    [
      'assignment revoke',
      'CMS-03C-08',
      revokeInput,
      jsonResponse(200, governedAssignmentFixture({ state: 'revoked' }), {
        etag: '"1"',
      }),
      200,
    ],
  ] as const)(
    'commits a verified %s',
    async (_name, operation, input, response, status) => {
      const result = await sendGovernedCommand(
        GOVERNED_COMMAND_SPECS[operation] as never,
        input as never,
        environment(fetcherFor(response)),
      );
      expect(result.kind).toBe('committed');
      expect(result.kind === 'committed' && result.status).toBe(status);
    },
  );

  it.each([
    [
      'a submission that names another hash',
      'CMS-03C-06',
      submitInput,
      jsonResponse(
        201,
        governedReviewFixture({ subjectHash: 'b'.repeat(64) }),
        {
          etag: '"1"',
        },
      ),
    ],
    [
      'a submission that is not open',
      'CMS-03C-06',
      submitInput,
      jsonResponse(
        201,
        governedReviewFixture({ state: 'approved', decidedAt: LATER }),
        {
          etag: '"1"',
        },
      ),
    ],
    [
      'a submission answer that omits the required decision count',
      'CMS-03C-06',
      submitInput,
      jsonResponse(
        201,
        Object.fromEntries(
          Object.entries(governedReviewFixture()).filter(
            ([member]) => member !== 'requiredDecisionCount',
          ),
        ),
        { etag: '"1"' },
      ),
    ],
    [
      'a decision for another review',
      'CMS-03C-07',
      decideInput,
      jsonResponse(200, { ...decided, id: SUBJECT_ID }, { etag: '"3"' }),
    ],
    [
      'a decision that did not advance the version by one',
      'CMS-03C-07',
      decideInput,
      jsonResponse(200, { ...decided, version: '5' }, { etag: '"5"' }),
    ],
    [
      'a rejection answered as approved',
      'CMS-03C-07',
      { ...decideInput, body: { ...decideInput.body, decision: 'reject' } },
      jsonResponse(200, decided, { etag: '"3"' }),
    ],
    [
      'a validator that is not the version',
      'CMS-03C-07',
      decideInput,
      jsonResponse(200, decided, { etag: '"9"' }),
    ],
    [
      'a missing validator',
      'CMS-03C-07',
      decideInput,
      jsonResponse(200, decided),
    ],
    [
      'a wrong status',
      'CMS-03C-07',
      decideInput,
      jsonResponse(201, decided, { etag: '"3"' }),
    ],
    [
      'an assignment of another review',
      'CMS-03C-08',
      createInput,
      jsonResponse(201, governedAssignmentFixture({ reviewId: SUBJECT_ID }), {
        etag: '"1"',
        location: `/api/v1/cms/governed-reviews/${REVIEW_ID}/assignments/${ASSIGNMENT_ID}`,
      }),
    ],
    [
      'a create without its Location',
      'CMS-03C-08',
      createInput,
      jsonResponse(201, governedAssignmentFixture(), { etag: '"1"' }),
    ],
    [
      'a revoke of another assignment',
      'CMS-03C-08',
      revokeInput,
      jsonResponse(
        200,
        governedAssignmentFixture({ id: SUBJECT_ID, state: 'revoked' }),
        { etag: '"1"' },
      ),
    ],
    [
      'a body that is not JSON',
      'CMS-03C-07',
      decideInput,
      new Response('nope', { status: 200, headers: { etag: '"3"' } }),
    ],
  ] as const)(
    'treats %s as an unknown outcome, never a guessed success',
    async (_name, operation, input, response) => {
      const result = await sendGovernedCommand(
        GOVERNED_COMMAND_SPECS[operation] as never,
        input as never,
        environment(fetcherFor(response)),
      );
      expect(result.kind).toBe('unknown');
    },
  );
});
