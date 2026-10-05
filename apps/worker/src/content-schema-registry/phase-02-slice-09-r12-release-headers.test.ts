import { describe, expect, it } from 'vitest';

import {
  expectApiError,
  makeHarness,
  mutationPath,
  releaseHeaders,
  releaseRequest,
} from './phase-02-slice-09-worker-test-support';
import {
  NONCE,
  SIGNATURE,
  validBlock,
  validLifecycle,
} from './phase-02-slice-09-test-values';

/**
 * AC026 for both release operations: CMS-03A-05 (register) and CMS-03A-08
 * (lifecycle advance) accept only the four exact release header names and map
 * them to keyId, issuedAt, nonce and signature. Aliases and unknown release
 * headers are refused with 400 before the verifier, the JSON body or the port.
 */
const OPERATIONS = [
  {
    id: 'CMS-03A-05',
    path: '/api/v1/cms/blocks/versions',
    body: validBlock,
    extra: {} as Record<string, string>,
  },
  {
    id: 'CMS-03A-08',
    path: mutationPath.lifecycle,
    body: validLifecycle,
    extra: { 'if-match': '"1"' },
  },
] as const;

const EXACT = [
  'X-WeJammin-Release-Key-Id',
  'X-WeJammin-Release-Issued-At',
  'X-WeJammin-Release-Nonce',
  'X-WeJammin-Release-Signature',
] as const;

const ALIASES: readonly (readonly [string, string])[] = [
  ['x-release-principal', 'forged'],
  ['x-release-key-id', 'release-key-1'],
  ['x-wejammin-release-keyid', 'release-key-1'],
  ['x-wejammin-release-key', 'release-key-1'],
  ['x-wejammin-release-extra', 'surprise'],
  ['keyId', 'release-key-1'],
  ['issuedAt', '2026-09-02T12:00:00.000Z'],
  ['nonce', NONCE],
  ['signature', SIGNATURE],
];

const withoutHeaders = (names: readonly string[]): Record<string, string> => {
  const remaining = { ...releaseHeaders() };
  for (const name of names) delete remaining[name];
  return remaining;
};

const send = async (
  operation: (typeof OPERATIONS)[number],
  headers: Record<string, string>,
  removed: readonly string[] = [],
) => {
  const harness = makeHarness();
  const request = releaseRequest(
    operation.path,
    { invalid: true },
    { ...operation.extra, ...headers },
  );
  for (const name of removed) request.headers.delete(name);
  return { harness, response: await harness.app.request(request) };
};

describe.each(OPERATIONS)('$id release header admission', (operation) => {
  it.each(ALIASES)(
    '[P2-S09-AC-026] refuses the alias or unknown release header %s with 400 before verifier, JSON body and port',
    async (name, value) => {
      const { harness, response } = await send(operation, { [name]: value });
      await expectApiError(response, 400, 'INVALID_REQUEST');
      expect(harness.verifyRelease).not.toHaveBeenCalled();
      expect(harness.ports.registerBlock).not.toHaveBeenCalled();
      expect(harness.ports.advanceBlockLifecycle).not.toHaveBeenCalled();
    },
  );

  it.each(EXACT)(
    '[P2-S09-AC-026] refuses a request missing the exact header %s even when its alias is present',
    async (name) => {
      const alias = name.replace('X-WeJammin-Release-', 'x-release-');
      const { harness, response } = await send(operation, { [alias]: 'copy' }, [
        name,
      ]);
      await expectApiError(response, 400, 'INVALID_REQUEST');
      expect(harness.verifyRelease).not.toHaveBeenCalled();
    },
  );

  it.each(EXACT)(
    '[P2-S09-AC-026] maps the exact header %s to its member and nothing else reaches the verifier',
    async (name) => {
      const member = {
        'X-WeJammin-Release-Key-Id': 'keyId',
        'X-WeJammin-Release-Issued-At': 'issuedAt',
        'X-WeJammin-Release-Nonce': 'nonce',
        'X-WeJammin-Release-Signature': 'signature',
      }[name];
      const harness = makeHarness();
      const headers = withoutHeaders([]);
      const response = await harness.app.request(
        releaseRequest(operation.path, operation.body, {
          ...operation.extra,
          ...headers,
        }),
      );
      expect(response.status).toBeLessThan(300);
      const input = harness.verifyRelease.mock.calls[0]?.[0] as {
        operationId: string;
        headers: Record<string, string>;
      };
      expect(input.operationId).toBe(operation.id);
      expect(Object.keys(input.headers).sort()).toEqual([
        'issuedAt',
        'keyId',
        'nonce',
        'signature',
      ]);
      expect(input.headers[member]).toBe(headers[name]);
      expect(input.headers).toEqual({
        keyId: headers['X-WeJammin-Release-Key-Id'],
        issuedAt: headers['X-WeJammin-Release-Issued-At'],
        nonce: headers['X-WeJammin-Release-Nonce'],
        signature: headers['X-WeJammin-Release-Signature'],
      });
    },
  );
});
