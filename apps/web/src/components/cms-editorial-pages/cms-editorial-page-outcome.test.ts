import { describe, expect, it } from 'vitest';

import {
  cmsEditorialNoticeFor,
  cmsEditorialSignInRedirect,
} from './cms-editorial-page-outcome';

const REQUEST_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132e9';

const apiError = (
  status: number,
  code: string,
  headers: Record<string, string> = {},
  message = 'Upstream message that must never be shown.',
): Response =>
  new Response(
    JSON.stringify({ code, message, requestId: REQUEST_ID, details: {} }),
    { status, headers: { 'content-type': 'application/json', ...headers } },
  );

const notice = (
  response: Response,
  subject: 'entry' | 'entries' | 'conflict' | 'history' = 'entry',
) =>
  cmsEditorialNoticeFor(response, {
    subject,
    retryHref: '/app/cms-content-modeling/entries',
    returnTo: '/app/cms-content-modeling/entries/x?locale=en',
  });

describe('cmsEditorialSignInRedirect', () => {
  it('returns an expired session to the same page through the allowlisted sign-in route', () => {
    expect(
      cmsEditorialSignInRedirect(
        '/app/cms-content-modeling/entries?state=draft',
      ),
    ).toEqual({
      kind: 'redirect',
      location:
        '/auth/sign-in?returnTo=%2Fapp%2Fcms-content-modeling%2Fentries%3Fstate%3Ddraft',
    });
  });
});

describe('cmsEditorialNoticeFor', () => {
  it('redirects a 401 to sign-in with the safe return target', async () => {
    const outcome = await notice(apiError(401, 'UNAUTHENTICATED'));
    expect(outcome).toEqual({
      kind: 'redirect',
      location: expect.stringContaining('/auth/sign-in?returnTo='),
    });
  });

  it.each([
    [400, 'INVALID_REQUEST', 'Invalid request'],
    [403, 'FORBIDDEN', 'Access denied'],
    [404, 'NOT_FOUND', 'Not found'],
    [409, 'CONFLICT', 'List position is no longer valid'],
    [422, 'VALIDATION_FAILED', 'Invalid request'],
  ])(
    'renders a %i as the %s state with fixed, non-disclosing copy',
    async (status, code, heading) => {
      const outcome = await notice(apiError(status, code));
      expect(outcome.kind).toBe('notice');
      if (outcome.kind !== 'notice') return;
      expect(outcome.notice.status).toBe(status);
      expect(outcome.notice.heading).toBe(heading);
      expect(outcome.notice.message).not.toContain('Upstream message');
      // A hidden or absent entry is one indistinguishable answer.
      expect(outcome.notice.message).not.toMatch(/exist|hidden|absent/iu);
    },
  );

  it('states a malformed request as an invalid request, never as not found', async () => {
    const outcome = await notice(apiError(400, 'INVALID_REQUEST'));
    expect(outcome.kind === 'notice' && outcome.notice.heading).toBe(
      'Invalid request',
    );
  });

  it('shows a coarse wait for a rate-limited read and keeps the retry target', async () => {
    const outcome = await notice(
      apiError(429, 'RATE_LIMITED', { 'retry-after': '12' }),
    );
    expect(outcome.kind).toBe('notice');
    if (outcome.kind !== 'notice') return;
    expect(outcome.notice.heading).toBe('Too many requests');
    expect(outcome.notice.message).toContain('12 seconds');
    expect(outcome.notice.retryHref).toBe('/app/cms-content-modeling/entries');
  });

  it.each([500, 502, 503, 504])(
    'renders a %i as a scoped degraded state with the request id and no provider detail',
    async (status) => {
      const outcome = await notice(apiError(status, 'DEPENDENCY_UNAVAILABLE'));
      expect(outcome.kind).toBe('notice');
      if (outcome.kind !== 'notice') return;
      expect(outcome.notice.heading).toBe('Temporarily unavailable');
      expect(outcome.notice.requestId).toBe(REQUEST_ID);
      expect(outcome.notice.message).not.toContain('Upstream message');
      expect(outcome.notice.retryHref).not.toBeNull();
    },
  );

  it('ignores a body that is not a verified ApiError instead of echoing it', async () => {
    const outcome = await notice(
      new Response('<html>stack trace</html>', { status: 503 }),
    );
    expect(outcome.kind).toBe('notice');
    if (outcome.kind !== 'notice') return;
    expect(outcome.notice.requestId).toBeNull();
    expect(JSON.stringify(outcome.notice)).not.toContain('stack trace');
  });

  it('names the subject in the not-found copy without confirming existence', async () => {
    const entry = await notice(apiError(404, 'NOT_FOUND'), 'entry');
    const conflict = await notice(apiError(404, 'NOT_FOUND'), 'conflict');
    expect(entry.kind === 'notice' && entry.notice.message).toBe(
      'This entry is not available.',
    );
    expect(conflict.kind === 'notice' && conflict.notice.message).toBe(
      'This conflict is not open.',
    );
  });
});
