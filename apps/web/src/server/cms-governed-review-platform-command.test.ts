import { describe, expect, it } from 'vitest';

import { CSRF, KEY, LATER } from './cms-governed-review-fixtures.test-support';
import {
  CASES,
  catalogError,
  request,
  run,
  success,
} from './cms-governed-review-platform-command.test-support';
import {
  bindingFor,
  ORIGIN,
} from './cms-workflow-platform-command.test-support';

describe.each(CASES)('$name proxy', (testCase) => {
  it('forwards the strict body with the transport headers and relays the verified commit', async () => {
    const binding = bindingFor(success(testCase));
    const response = await run(testCase, request(testCase), binding);
    expect(response.status).toBe(testCase.status);
    expect(response.headers.get('etag')).toBe(testCase.etag);
    expect(response.headers.get('location')).toBe(testCase.location);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(
      JSON.parse(JSON.stringify(testCase.resource)),
    );
    const [upstream] = binding.requests();
    expect(upstream?.method).toBe('POST');
    expect(new URL(upstream?.url ?? '').pathname).toBe(testCase.path);
    expect(new URL(upstream?.url ?? '').search).toBe('');
    expect(upstream?.headers.get('content-type')).toBe('application/json');
    expect(upstream?.headers.get('x-csrf-token')).toBe(CSRF);
    expect(upstream?.headers.get('idempotency-key')).toBe(KEY);
    expect(upstream?.headers.get('if-match')).toBe(testCase.ifMatch);
    expect(upstream?.headers.get('cookie')).toContain('wj_access=a');
    expect(JSON.parse(await (upstream as Request).text())).toEqual(
      testCase.body,
    );
  });

  it('answers 503 without a binding or for a non-POST method', async () => {
    expect((await run(testCase, request(testCase), null)).status).toBe(503);
    const get = request(testCase, { method: 'PUT' });
    expect((await run(testCase, get, bindingFor())).status).toBe(503);
  });

  it('refuses a cross-origin or CSRF-less request before any upstream call', async () => {
    const binding = bindingFor();
    expect(
      (
        await run(
          testCase,
          request(testCase, { headers: { origin: 'https://evil.test' } }),
          binding,
        )
      ).status,
    ).toBe(403);
    for (const headers of [
      { 'x-csrf-token': null },
      { 'x-csrf-token': 'csrf-token-other-00000' },
    ])
      expect(
        (await run(testCase, request(testCase, { headers }), binding)).status,
      ).toBe(403);
    expect(binding.fetch).not.toHaveBeenCalled();
  });

  it('refuses a query string, a media type other than JSON and an unusable body', async () => {
    const binding = bindingFor();
    expect(
      (
        await run(
          testCase,
          request(testCase, { url: `${ORIGIN}${testCase.path}?x=1` }),
          binding,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await run(
          testCase,
          request(testCase, { headers: { 'content-type': 'text/plain' } }),
          binding,
        )
      ).status,
    ).toBe(415);
    for (const body of ['{', 'x'.repeat(262_145)])
      expect(
        (await run(testCase, request(testCase, { body }), binding)).status,
      ).toBe(400);
    expect(binding.fetch).not.toHaveBeenCalled();
  });

  it('refuses a missing, short or padded Idempotency-Key', async () => {
    const binding = bindingFor();
    for (const key of [null, 'short', 'k'.repeat(129)])
      expect(
        (
          await run(
            testCase,
            request(testCase, { headers: { 'idempotency-key': key } }),
            binding,
          )
        ).status,
      ).toBe(400);
    expect(binding.fetch).not.toHaveBeenCalled();
  });

  it('refuses a body that is not the strict request with a pointer-only 422', async () => {
    const binding = bindingFor();
    const response = await run(
      testCase,
      request(testCase, {
        body: JSON.stringify({
          ...testCase.body,
          capability: 'cms.reviewer',
          stepUpAt: LATER,
        }),
      }),
      binding,
    );
    expect(response.status).toBe(422);
    const text = await response.text();
    expect(text).not.toContain('stepUpAt');
    expect(text).not.toContain('cms.reviewer');
    expect(binding.fetch).not.toHaveBeenCalled();
  });

  it('answers 502 and marks the outcome unknown for a commit it cannot verify', async () => {
    for (const upstream of [
      success(testCase, { resource: testCase.mismatched }),
      success(testCase, { etag: null }),
      success(testCase, { etag: '"99"' }),
      success(testCase, {
        status: testCase.status === 201 ? 200 : 201,
      }),
      ...(testCase.location === null
        ? []
        : [
            success(testCase, { location: null }),
            success(testCase, { location: '/api/v1/cms/governed-reviews/x' }),
          ]),
      new Response('nope', { status: testCase.status }),
    ]) {
      const response = await run(
        testCase,
        request(testCase),
        bindingFor(upstream),
      );
      expect(response.status).toBe(502);
      expect(response.headers.get('x-cms-editorial-outcome')).toBe('unknown');
    }
  });

  it('answers 503 with the outcome unknown when the binding throws', async () => {
    const response = await run(
      testCase,
      request(testCase),
      bindingFor(new Error('boom')),
    );
    expect(response.status).toBe(503);
    expect(response.headers.get('x-cms-editorial-outcome')).toBe('unknown');
  });

  it('relays a definite refusal without the unknown-outcome marker and a 5xx with it', async () => {
    const refused = await run(
      testCase,
      request(testCase),
      bindingFor(
        catalogError(403, 'GOVERNED_REVIEW_FORBIDDEN', {
          reasonCode: 'capability_missing',
        }),
      ),
    );
    expect(refused.status).toBe(403);
    expect(refused.headers.has('x-cms-editorial-outcome')).toBe(false);
    const failed = await run(
      testCase,
      request(testCase),
      bindingFor(catalogError(500, 'INTERNAL_ERROR')),
    );
    expect(failed.status).toBe(500);
    expect(failed.headers.get('x-cms-editorial-outcome')).toBe('unknown');
  });
});
