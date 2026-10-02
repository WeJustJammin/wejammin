import { describe, expect, it } from 'vitest';

import {
  checkOrigin,
  csrfErrorIfCookie,
  parseEditorialHeaders,
} from './admission-headers';

describe('CMS editorial browser admission headers', () => {
  it('rejects a missing strong If-Match without inferring a version', () => {
    const request = new Request('https://api.example.test/cms', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'idempotency-key-0001',
      },
    });
    expect(parseEditorialHeaders(request)).toMatchObject({
      ok: false,
      status: 400,
      code: 'INVALID_REQUEST',
    });
  });

  it('does not require a CSRF pair for a cookie without the session reference', () => {
    const request = new Request('https://api.example.test/cms', {
      headers: { cookie: 'wj_csrf=abc; unrelated=visible' },
    });
    expect(csrfErrorIfCookie(request)).toBeNull();
    expect(checkOrigin(request, ['https://cms.example.test'])).toBeNull();
  });
});
