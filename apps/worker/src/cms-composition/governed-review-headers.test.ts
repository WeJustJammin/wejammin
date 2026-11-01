import { describe, expect, it } from 'vitest';

import {
  curatorSession,
  designerSession,
  expectError,
  governedHarness,
  jsonReply,
  reviewResource,
  submitBody,
  submitRequest,
} from './governed-review-submit.test-support';

describe('CMS-03C-06 capability, header and preflight admission (BE03c row 168)', () => {
  it('requires an owner capability (designer or curator) before rate admission', async () => {
    const harness = governedHarness({
      session: { ...designerSession, capabilities: ['cms.author'] },
    });
    const error = await expectError(
      await harness.send(submitRequest()),
      403,
      'GOVERNED_REVIEW_FORBIDDEN',
    );
    expect(error.details).toEqual({ reasonCode: 'capability_missing' });
    expect(harness.rateLimit).not.toHaveBeenCalled();
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ['template_version', designerSession],
    ['pattern_version', designerSession],
    ['taxonomy_version', curatorSession],
    ['taxonomy_version', designerSession],
    ['template_version', curatorSession],
  ] as const)(
    'admits %s for any_of holder %j and leaves per-kind authority to SQL',
    async (kind, session) => {
      const harness = governedHarness({
        session,
        reply: () => jsonReply(reviewResource(kind)),
      });
      const response = await harness.send(submitRequest(submitBody(kind)));
      expect(response.status).toBe(201);
      expect(harness.fetchImpl).toHaveBeenCalledTimes(1);
    },
  );

  it('accepts no If-Match: a present validator is refused before the RPC', async () => {
    for (const value of ['"1"', '*', 'W/"1"']) {
      const harness = governedHarness();
      await expectError(
        await harness.send(submitRequest(submitBody(), { 'if-match': value })),
        400,
        'INVALID_REQUEST',
      );
      // BE03c 1502 parse precedes capability and quota: a header refusal burns no token.
      expect(harness.rateLimit).not.toHaveBeenCalled();
      expect(harness.fetchImpl).not.toHaveBeenCalled();
    }
  });

  it.each([undefined, 'bad key', 'x'])(
    'rejects a missing or invalid idempotency key: %s',
    async (key) => {
      const harness = governedHarness();
      const request = submitRequest();
      if (key === undefined) request.headers.delete('idempotency-key');
      else request.headers.set('idempotency-key', key);
      await expectError(await harness.send(request), 400, 'INVALID_REQUEST');
      expect(harness.rateLimit).not.toHaveBeenCalled();
      expect(harness.fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('rejects a query string on the command route', async () => {
    const base = submitRequest();
    const request = new Request(base.url + '?subjectKind=template_version', {
      method: 'POST',
      headers: base.headers,
      body: JSON.stringify(submitBody()),
    });
    const harness = governedHarness();
    await expectError(await harness.send(request), 400, 'INVALID_REQUEST');
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it('answers a preflight with no If-Match allowance and a foreign origin with 403', async () => {
    const harness = governedHarness();
    const ok = await harness.send(
      new Request('https://api.example.test/api/v1/cms/governed-reviews', {
        method: 'OPTIONS',
        headers: { origin: 'https://cms.example.test' },
      }),
    );
    expect(ok.status).toBe(204);
    // CMS-03C-06 (POST) and CMS-03C-11 (GET) share this path: one merged preflight advertises both
    // methods (03b precedent `cms-editorial/routes.ts:71`), and neither allows If-Match.
    expect(ok.headers.get('access-control-allow-methods')).toBe(
      'GET, POST, OPTIONS',
    );
    expect(ok.headers.get('access-control-allow-headers')).not.toMatch(
      /if-match/iu,
    );
    const allowed = (ok.headers.get('access-control-allow-headers') ?? '')
      .split(',')
      .map((name) => name.trim().toLowerCase());
    expect(allowed).toEqual(
      expect.arrayContaining([
        'authorization',
        'content-type',
        'idempotency-key',
        'x-csrf-token',
        'x-request-id',
      ]),
    );
    const foreign = await harness.send(
      new Request('https://api.example.test/api/v1/cms/governed-reviews', {
        method: 'OPTIONS',
        headers: { origin: 'https://foreign.example.test' },
      }),
    );
    expect(foreign.status).toBe(403);
  });
});
