import { describe, expect, it, vi } from 'vitest';

import {
  WRITES,
  apiError,
  bindingWith,
  idempotencyKey,
  uuid,
  write,
  revisionBody,
} from './cms-editorial-platform-hardening.test-support';
import { forwardCmsEditorialRevisionMutation } from './cms-editorial-platform-revision';

/**
 * The outcome-unknown contract of the four command proxies: a transport loss, a
 * post-dispatch 5xx or an unverifiable 2xx may hide a committed write, so the
 * response is marked and the browser replays the same request with the same
 * Idempotency-Key. A definite refusal never carries the marker.
 */

describe('outcome-unknown writes (reconcile by same-key replay)', () => {
  it.each(WRITES)(
    '$name: transport loss is an unknown outcome the client must replay with the same key',
    async ({ call }) => {
      const response = await call(
        bindingWith(async () => {
          throw new Error('socket closed');
        }),
      );
      expect(response.status).toBe(503);
      expect(response.headers.get('x-cms-editorial-outcome')).toBe('unknown');
      expect(response.headers.get('cache-control')).toBe('no-store');
    },
  );

  it.each(WRITES)(
    '$name: a post-dispatch 5xx is unknown, a definite refusal is not',
    async ({ call }) => {
      for (const [status, code] of [
        [500, 'INTERNAL_ERROR'],
        [502, 'BAD_GATEWAY'],
        [503, 'DEPENDENCY_UNAVAILABLE'],
        [504, 'GATEWAY_TIMEOUT'],
      ] as const) {
        const response = await call(
          bindingWith(async () => apiError(status, code)),
        );
        expect(response.status).toBe(status);
        expect(response.headers.get('x-cms-editorial-outcome')).toBe('unknown');
      }
      for (const [status, code] of [
        [409, 'CONFLICT'],
        [422, 'VALIDATION_FAILED'],
        [403, 'FORBIDDEN'],
        [429, 'RATE_LIMITED'],
      ] as const) {
        const response = await call(
          bindingWith(async () => apiError(status, code)),
        );
        expect(response.status).toBe(status);
        expect(response.headers.has('x-cms-editorial-outcome')).toBe(false);
      }
    },
  );

  it.each(WRITES)(
    '$name: an unverifiable 2xx is an unknown outcome, never a success',
    async ({ call }) => {
      const response = await call(
        bindingWith(async () =>
          Response.json({ not: 'a resource' }, { status: 201 }),
        ),
      );
      expect(response.status).toBe(502);
      expect(response.headers.get('x-cms-editorial-outcome')).toBe('unknown');
    },
  );

  it.each(WRITES)(
    '$name: the Idempotency-Key reaches the Worker byte-for-byte on every replay',
    async ({ call }) => {
      const binding = bindingWith(async () =>
        apiError(503, 'DEPENDENCY_UNAVAILABLE'),
      );
      await call(binding);
      await call(binding);
      const keys = vi
        .mocked(binding.fetch)
        .mock.calls.map(([upstream]) =>
          upstream.headers.get('idempotency-key'),
        );
      expect(keys).toEqual([idempotencyKey, idempotencyKey]);
    },
  );

  it('a request refused before dispatch carries no outcome marker', async () => {
    const response = await forwardCmsEditorialRevisionMutation(
      write(`/api/v1/cms/entries/${uuid}/revisions`, revisionBody, {
        'x-csrf-token': 'wrong-token-0000000001',
        'if-match': '"1"',
      }),
      uuid,
      { fetch: vi.fn() },
    );
    expect(response.status).toBe(403);
    expect(response.headers.has('x-cms-editorial-outcome')).toBe(false);
  });
});
