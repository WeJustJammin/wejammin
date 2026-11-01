import { describe, expect, it } from 'vitest';

import {
  expectError,
  governedHarness,
  jsonReply,
  queuePage,
  queueRequest,
  reviewerSession,
} from './governed-review-ops.test-support';

/**
 * CMS-03C-11 "rejects ... a body and any mutation header" (BE03c row 173, "safe read; no
 * Idempotency-Key or If-Match"; BE00 step 6). The detail read carries the same cases in
 * `governed-review-reads.test.ts`; the queue shares its path with the CMS-03C-06 POST.
 */
const make = () =>
  governedHarness({
    session: reviewerSession,
    reply: () => jsonReply(queuePage()),
  });

describe('CMS-03C-11 review queue rejects a body and any mutation header', () => {
  it('[P2-S12-AC-095] CMS-03C-11 a request carrying a media type is 415 with the empty allowlist before any quota', async () => {
    const harness = make();
    const error = await expectError(
      await harness.send(
        queueRequest({}, { headers: { 'content-type': 'application/json' } }),
      ),
      415,
      'UNSUPPORTED_MEDIA_TYPE',
    );
    expect(error.details).toEqual({ allowedMediaTypes: [] });
    expect(harness.rateLimit).not.toHaveBeenCalled();
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ['a non-zero content-length', { 'content-length': '2' }],
    ['a transfer-encoding', { 'transfer-encoding': 'chunked' }],
    ['an Idempotency-Key', { 'idempotency-key': 'a'.repeat(16) }],
    ['an If-Match', { 'if-match': '"1"' }],
  ])(
    '[P2-S12-AC-095] CMS-03C-11 %s is 400 INVALID_REQUEST before any quota',
    async (_name, headers) => {
      const harness = make();
      await expectError(
        await harness.send(queueRequest({}, { headers })),
        400,
        'INVALID_REQUEST',
      );
      expect(harness.rateLimit).not.toHaveBeenCalled();
      expect(harness.fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('[P2-S12-AC-095] CMS-03C-11 a plain query with none of them is answered 200 and charges the read quota', async () => {
    const harness = make();
    expect((await harness.send(queueRequest())).status).toBe(200);
    expect(harness.rateLimit).toHaveBeenCalled();
  });
});
