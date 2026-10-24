import { describe, expect, it } from 'vitest';

import { COMMANDS, OPERATIONS } from './governed-review-ops-table.test-support';
import { expectError, expectNoWork } from './governed-review-ops.test-support';

describe.each(COMMANDS)('$id command transport admission', (row) => {
  it('refuses non-JSON request media with 415 and the JSON allowlist', async () => {
    const harness = row.harness();
    const request = row.request();
    request.headers.set('content-type', 'text/plain');
    const error = await expectError(
      await harness.send(request),
      415,
      'UNSUPPORTED_MEDIA_TYPE',
    );
    expect(error.details).toEqual({ allowedMediaTypes: ['application/json'] });
    expectNoWork(harness);
  });

  it('refuses a body over 256 KiB with 400 before authentication', async () => {
    const harness = row.harness();
    const request = new Request(row.request().url, {
      method: 'POST',
      headers: row.request().headers,
      body: JSON.stringify({ reason: 'x'.repeat(262_200) }),
    });
    await expectError(await harness.send(request), 400, 'INVALID_REQUEST');
    expectNoWork(harness);
    expect(harness.resolveSession).not.toHaveBeenCalled();
  });

  it('refuses malformed JSON with 400', async () => {
    const harness = row.harness();
    const request = new Request(row.request().url, {
      method: 'POST',
      headers: row.request().headers,
      body: '{"reviewId":',
    });
    await expectError(await harness.send(request), 400, 'INVALID_REQUEST');
    expectNoWork(harness);
  });

  it('refuses a cookie-bearing write without the matching CSRF token before authentication', async () => {
    const harness = row.harness();
    const request = row.request();
    request.headers.set('cookie', 'wj_session_ref=abc; wj_csrf=one');
    request.headers.set('x-csrf-token', 'two');
    await expectError(
      await harness.send(request),
      403,
      'GOVERNED_REVIEW_FORBIDDEN',
    );
    expect(harness.resolveSession).not.toHaveBeenCalled();
    expectNoWork(harness);
  });
});

describe.each(OPERATIONS)(
  '$id never trusts caller-supplied authority',
  (row) => {
    it('forwards no actor, party, capability or step-up claim from headers', async () => {
      const harness = row.harness();
      const request = row.request();
      request.headers.set('x-actor-id', 'caller-controlled');
      request.headers.set('x-owner-party-id', 'caller-controlled');
      request.headers.set('x-capabilities', 'cms.admin');
      request.headers.set('x-step-up-verified', 'true');
      expect((await harness.send(request)).status).toBe(row.status);
      const init = harness.fetchImpl.mock.calls[0]?.[1];
      const sent = JSON.stringify([
        init?.body,
        [...new Headers(init?.headers).values()],
      ]);
      expect(sent).not.toContain('caller-controlled');
      expect(sent).not.toContain('cms.admin');
    });
  },
);
