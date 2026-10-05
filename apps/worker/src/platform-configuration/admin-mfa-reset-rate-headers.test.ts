import { describe, expect, it } from 'vitest';

import { makeResetHarness, resetRequest } from './admin-mfa-reset.test-support';
import { bindings } from './phase-02-slice-08-worker.test-support';

const decision = (limit: number, remaining: number) => ({
  ok: true as const,
  value: {
    allowed: true,
    limit,
    remaining,
    resetAt: Math.floor(Date.now() / 1000) + 3600,
  },
});

const remainingHeader = async (user: number, party: number) => {
  const harness = makeResetHarness({
    rateLimits: [decision(5, user), decision(10, party)],
  });
  const response = await harness.app.fetch(resetRequest(), bindings);
  expect(response.status).toBe(200);
  return response.headers.get('ratelimit-remaining');
};

describe('CFG-05B-06 rate headers report the strictest bucket', () => {
  it('reports the party bucket when it has fewer requests left', async () => {
    expect(await remainingHeader(4, 2)).toBe('2');
  });

  it('reports the user bucket when it has fewer requests left', async () => {
    expect(await remainingHeader(1, 8)).toBe('1');
  });

  it('keeps the user bucket on a tie', async () => {
    expect(await remainingHeader(3, 3)).toBe('3');
  });
});
