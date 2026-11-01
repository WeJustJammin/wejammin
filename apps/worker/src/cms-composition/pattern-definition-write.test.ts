import { PatternVersionResourceSchema } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  assertWriteContract,
  expectError,
  HASH,
  jsonReply,
  MAX_BYTES,
  patternBody,
  patternHarness,
  patternResource,
  REQUEST_ID,
  writeRequest,
} from './pattern-definition.test-support';

describe('CMS-03C-12 pattern definition write contract', () => {
  it.each(['context', 'versions', 'selector', 'nestable', 'new'])(
    'gives reserved key %s its typed request pointer',
    async (patternKey) => {
      const harness = patternHarness();
      const error = await expectError(
        await harness.send(writeRequest({ ...patternBody(), patternKey })),
        422,
        'COMPOSITION_VALIDATION_FAILED',
      );
      expect(error.details).toEqual({
        reasonCode: 'key_reserved',
        violations: [
          {
            path: '/patternKey',
            code: 'key_reserved',
            message: 'The value is invalid.',
          },
        ],
      });
      expect(harness.fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('gives the SQL reserved-key refusal the same fixed pointer', async () => {
    const harness = patternHarness({
      reply: () =>
        jsonReply(
          {
            code: 'P0001',
            message: 'key_reserved',
            details: 'private provider',
          },
          400,
        ),
    });
    const error = await expectError(
      await harness.send(writeRequest()),
      422,
      'COMPOSITION_VALIDATION_FAILED',
    );
    expect(error.details).toEqual({
      reasonCode: 'key_reserved',
      violations: [
        {
          path: '/patternKey',
          code: 'key_reserved',
          message: 'The value is invalid.',
        },
      ],
    });
  });
  it.each([null, '7'])(
    'creates the next draft from parent %s without requiring step-up',
    async (parent) => {
      const body = patternBody(parent);
      const resource = patternResource(parent === null ? 1 : 8);
      const request = writeRequest(
        body,
        parent === null ? {} : { 'if-match': '"7"' },
      );
      assertWriteContract(request, body);
      const harness = patternHarness({ reply: () => jsonReply(resource) });
      const response = await harness.send(request);
      expect(response.status).toBe(201);
      expect(await response.json()).toEqual(resource);
      expect(response.headers.get('etag')).toBe(`"${resource.version}"`);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('x-request-id')).toBe(REQUEST_ID);
      expect(harness.fetchImpl).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    [null, '"1"'],
    ['7', undefined],
    ['7', '7'],
    ['7', 'W/"7"'],
    ['7', '*'],
    ['7', '"8"'],
    ['7', '"07"'],
    ['7', '"7", "8"'],
  ] as const)(
    'rejects parent %s and If-Match %s before RPC',
    async (parent, ifMatch) => {
      const harness = patternHarness();
      const request = writeRequest(
        patternBody(parent),
        ifMatch === undefined ? {} : { 'if-match': ifMatch },
      );
      await expectError(await harness.send(request), 400, 'INVALID_REQUEST');
      // BE03c 408, 1502: header parse precedes capability and quota.
      expect(harness.rateLimit).not.toHaveBeenCalled();
      expect(harness.fetchImpl).not.toHaveBeenCalled();
    },
  );

  it.each([
    'actorId',
    'actingPartyId',
    'ownerPartyId',
    'capabilities',
    'context',
    'state',
    'lifecycleVersion',
  ])('rejects caller authority or private member %s', async (member) => {
    const harness = patternHarness();
    const body = { ...patternBody(), [member]: 'caller-controlled' };
    await expectError(
      await harness.send(writeRequest(body)),
      422,
      'COMPOSITION_VALIDATION_FAILED',
    );
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON before rate admission', async () => {
    const harness = patternHarness();
    const base = writeRequest();
    const request = new Request(base.url, {
      method: 'POST',
      headers: base.headers,
      body: '{',
    });
    await expectError(await harness.send(request), 400, 'INVALID_REQUEST');
    expect(harness.rateLimit).not.toHaveBeenCalled();
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it('accepts an exact 256 KiB valid JSON request', async () => {
    const harness = patternHarness({
      reply: () => jsonReply(patternResource()),
    });
    const base = writeRequest();
    const json = JSON.stringify(patternBody());
    const request = new Request(base.url, {
      method: 'POST',
      headers: base.headers,
      body:
        json +
        ' '.repeat(MAX_BYTES - new TextEncoder().encode(json).byteLength),
    });
    const response = await harness.send(request);
    expect(response.status).toBe(201);
    expect(harness.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    { patternKey: 'another-pattern' },
    { patternVersion: 2 },
    { version: '2' },
    { state: 'active' },
    { compatibleTypeIds: [] },
    { lifecycleVersion: '2' },
  ])(
    'rejects a draft answer that breaks resource/request binding: %j',
    async (changed) => {
      const harness = patternHarness({
        reply: () => jsonReply({ ...patternResource(), ...changed }),
      });
      await expectError(
        await harness.send(writeRequest()),
        502,
        'DEPENDENCY_UNAVAILABLE',
      );
    },
  );

  it('rejects a successor answer that is not parent plus one', async () => {
    const harness = patternHarness({
      reply: () => jsonReply(patternResource(9)),
    });
    await expectError(
      await harness.send(writeRequest(patternBody('7'), { 'if-match': '"7"' })),
      502,
      'DEPENDENCY_UNAVAILABLE',
    );
  });

  it('binds an explicitly supplied registry digest to the response', async () => {
    const harness = patternHarness({
      reply: () => jsonReply(patternResource()),
    });
    const body = {
      ...patternBody(),
      blockRegistryDigest: 'd'.repeat(HASH.length),
    };
    await expectError(
      await harness.send(writeRequest(body)),
      502,
      'DEPENDENCY_UNAVAILABLE',
    );
  });

  it.each([undefined, 'bad key'])(
    'rejects a missing or invalid idempotency key: %s',
    async (key) => {
      const harness = patternHarness();
      const request = writeRequest();
      if (key === undefined) request.headers.delete('idempotency-key');
      else request.headers.set('idempotency-key', key);
      await expectError(await harness.send(request), 400, 'INVALID_REQUEST');
      // BE03c 408, 1502: header parse precedes capability and quota.
      expect(harness.rateLimit).not.toHaveBeenCalled();
      expect(harness.fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('quotes the successor only in the RPC header and binds idempotency', async () => {
    const harness = patternHarness({
      reply: () => jsonReply(patternResource(8)),
    });
    expect(
      (
        await harness.send(
          writeRequest(patternBody('7'), { 'if-match': '"7"' }),
        )
      ).status,
    ).toBe(201);
    const init = harness.fetchImpl.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).get('if-match')).toBe('"7"');
    expect(new Headers(init?.headers).get('x-idempotency-key')).toBe(
      'pattern-definition-0001',
    );
    expect(JSON.parse(String(init?.body))).toMatchObject({
      p_request: {
        expectedVersion: '7',
        ifMatch: '7',
        idempotencyKey: 'pattern-definition-0001',
        correlationId: REQUEST_ID,
      },
    });
  });

  it('rejects an outbound RPC envelope above 256 KiB before fetch', async () => {
    const body = patternBody();
    const baseLength = new TextEncoder().encode(
      JSON.stringify(body),
    ).byteLength;
    body.blockTree[0] = {
      kind: 'block',
      key: 'header',
      blockKey: 'profile.header',
      blockVersion: 1,
      props: { text: 'x'.repeat(MAX_BYTES - baseLength - 64) },
      children: [],
    };
    const request = writeRequest(body);
    assertWriteContract(request, body);
    expect(
      new TextEncoder().encode(JSON.stringify(body)).byteLength,
    ).toBeLessThan(MAX_BYTES);
    const harness = patternHarness();
    await expectError(await harness.send(request), 400, 'INVALID_REQUEST');
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it.each([MAX_BYTES, MAX_BYTES + 1])(
    'bounds final route serialization at %i bytes, independent of the adapter',
    async (bytes) => {
      const value = {
        ...patternResource(),
        createdAt: '2026-10-13T00:00:00.Z',
      };
      const base = new TextEncoder().encode(JSON.stringify(value)).byteLength;
      value.createdAt = '2026-10-13T00:00:00.' + '0'.repeat(bytes - base) + 'Z';
      PatternVersionResourceSchema.parse(value);
      const harness = patternHarness({
        dependencies: { definePattern: async () => ({ ok: true, value }) },
      });
      const response = await harness.send(writeRequest());
      if (bytes > MAX_BYTES)
        await expectError(response, 502, 'DEPENDENCY_UNAVAILABLE');
      else {
        expect(response.status).toBe(201);
        expect((await response.arrayBuffer()).byteLength).toBe(bytes);
      }
      expect(harness.fetchImpl).not.toHaveBeenCalled();
    },
  );
});
