import { describe, expect, it, vi } from 'vitest';

import {
  PATH,
  readRequest,
  ruleRead,
} from './related-content-read.test-support';
import { createCmsRelatedContentApp } from './related-content-routes';
import { dependencies } from './related-content-routes.test-support';

describe('cmsRelatedContentRead request id', () => {
  it('mints a UUID request id when the browser sent none and echoes it on the answer', async () => {
    const response = await createCmsRelatedContentApp(
      dependencies({
        readRelatedContent: async () => ({ ok: true, value: ruleRead() }),
      }),
    ).request(
      new Request(`https://api.example.test${PATH}`, {
        headers: { origin: 'https://cms.example.test' },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,
    );
  });
});

/*
 * cmsRelatedContentRead (DEC-195), BE00 step 3: a resolver result whose identity is not a verified human session
 * (a malformed user id) fails closed as 401 with the reauthentication recovery, before quota and before the port.
 */
describe('cmsRelatedContentRead session proof', () => {
  it('answers 401 with the reauthentication recovery for a malformed session identity, charging no quota', async () => {
    const base = dependencies();
    const rateLimit = vi.fn(base.rateLimit);
    const read = vi.fn(async () => ({ ok: true as const, value: ruleRead() }));
    const response = await createCmsRelatedContentApp(
      dependencies({
        rateLimit,
        readRelatedContent: read,
        resolveSession: async () => ({
          ok: true,
          value: {
            userId: 'not-a-uuid',
            actingPartyId: null,
            capabilities: ['cms.author'],
            mfaFresh: false,
          },
        }),
      }),
    ).request(readRequest());
    expect(response.status).toBe(401);
    expect(
      ((await response.json()) as { details: Record<string, unknown> }).details,
    ).toEqual({ recoveryAction: 'reauthenticate' });
    expect(rateLimit).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });
});
