import { describe, expect, it } from 'vitest';

import { executeCmsEditorialConflictDetailRead } from './cms-editorial-conflict-detail-transport';
import { conflictDetailBody } from './cms-editorial-conflict-fixtures.test-support';
import {
  CONFLICT_ID,
  ENTRY_ID,
  apiError,
  json,
} from './cms-editorial-editor-fixtures.test-support';

const read = (response: Response | Error) => {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  return {
    calls,
    result: executeCmsEditorialConflictDetailRead({
      basePath: '/api/v1/cms/entries',
      entryId: ENTRY_ID,
      conflictId: CONFLICT_ID,
      fetcher: async (input, init) => {
        calls.push({ url: String(input), init });
        if (response instanceof Error) throw response;
        return response;
      },
    }),
  };
};

describe('executeCmsEditorialConflictDetailRead', () => {
  it('reads the conflict by its two ids as a no-store GET with no body, key or If-Match', async () => {
    const { calls, result } = read(
      json(200, conflictDetailBody(), { 'cache-control': 'no-store' }),
    );
    const outcome = await result;
    expect(calls[0]?.url).toBe(
      `/api/v1/cms/entries/${ENTRY_ID}/conflicts/${CONFLICT_ID}`,
    );
    expect(calls[0]?.init?.method).toBe('GET');
    expect(calls[0]?.init?.cache).toBe('no-store');
    expect(calls[0]?.init?.body).toBeUndefined();
    const headers = new Headers(calls[0]?.init?.headers);
    expect(headers.has('idempotency-key')).toBe(false);
    expect(headers.has('if-match')).toBe(false);
    expect(outcome.outcome).toBe('success');
    expect(outcome.resource?.conflict.id).toBe(CONFLICT_ID);
  });

  it('refuses a 200 for another conflict or entry, or one that is not the strict contract', async () => {
    const other = await read(
      json(
        200,
        conflictDetailBody({
          conflictId: '018f0c45-73fe-7dc2-9c09-68f7ecf13200',
        }),
      ),
    ).result;
    expect(other.outcome).toBe('unknown');
    expect(other.resource).toBeNull();
    const malformed = await read(json(200, { conflict: 'x' })).result;
    expect(malformed.outcome).toBe('unknown');
  });

  it.each([
    [401, 'unauthenticated'],
    [403, 'forbidden'],
    [404, 'not-found'],
    [429, 'rate-limited'],
    [503, 'degraded'],
  ])('maps a %i to %s without trusting the body', async (status, outcome) => {
    const result = await read(apiError(status, 'X')).result;
    expect(result.outcome).toBe(outcome);
    expect(result.resource).toBeNull();
  });

  it('reports a network failure as degraded, never as a conflict state', async () => {
    const result = await read(new TypeError('Failed to fetch')).result;
    expect(result.outcome).toBe('degraded');
  });
});
