import { describe, expect, it } from 'vitest';

import {
  assignmentRequest,
  expectError,
  expectNoWork,
  ownerHarness,
  reviewerSession,
} from './governed-review-ops.test-support';
import {
  createTaxonomyRouteHarness,
  taxonomyDefinitionWriteRequest,
  taxonomySession,
} from './taxonomy-definition.test-support';

/**
 * BE03c line 150 and line 422 (All / headers/body): "Idempotency-Key 8-128 printable ASCII", a
 * 400 header refusal. BE03c 1502 and BE00 step 6: the header parse precedes the capability check
 * and every quota token. The ten other POST operations carry their key cases in
 * `write-header-order*.test.ts`, `governed-review-headers.test.ts` and `governed-activation-*.test.ts`;
 * this file carries the same four malformed values and both inclusive bounds for CMS-03C-08 and
 * CMS-03C-16, whose route tests assert the key only at the contract.
 */
const MALFORMED: readonly (readonly [string, string | null])[] = [
  ['missing', null],
  ['7 characters', 'a'.repeat(7)],
  ['129 characters', 'a'.repeat(129)],
  ['a control character', 'idempotency\u0001key-001'],
  ['a DEL character', 'idempotency\u007fkey-001'],
  ['a non-ASCII character', 'idempotency-kéy-001'],
];

const PATH_16 = '/api/v1/cms/taxonomies/versions';

const withKey = (key: string | null): RequestInit => {
  const init = taxonomyDefinitionWriteRequest();
  const headers = new Headers(init.headers);
  if (key === null) headers.delete('idempotency-key');
  else headers.set('idempotency-key', key);
  return { ...init, headers };
};

describe('CMS-03C-08 Idempotency-Key 8-128 printable ASCII (BE03c 150, 422)', () => {
  it.each(MALFORMED)(
    '[P2-S12-AC-039] CMS-03C-08 %s Idempotency-Key is 400 INVALID_REQUEST before the capability check, any quota token or the port',
    async (_name, key) => {
      const harness = ownerHarness();
      await expectError(
        await harness.send(
          assignmentRequest(undefined, { headers: { 'idempotency-key': key } }),
        ),
        400,
        'INVALID_REQUEST',
      );
      expectNoWork(harness);
    },
  );

  it('[P2-S12-AC-039] CMS-03C-08 a malformed Idempotency-Key from a caller without the capability is the 400, not the 403', async () => {
    const harness = ownerHarness({ session: reviewerSession });
    await expectError(
      await harness.send(
        assignmentRequest(undefined, {
          headers: { 'idempotency-key': 'short' },
        }),
      ),
      400,
      'INVALID_REQUEST',
    );
    expectNoWork(harness);
  });

  it.each([8, 128])(
    '[P2-S12-AC-039] CMS-03C-08 a %i character printable key is inside the bound and reaches the port',
    async (length) => {
      const harness = ownerHarness();
      const response = await harness.send(
        assignmentRequest(undefined, {
          headers: { 'idempotency-key': '~'.repeat(length) },
        }),
      );
      expect(response.status).toBe(201);
      expect(harness.fetchImpl).toHaveBeenCalledTimes(1);
    },
  );
});

describe('CMS-03C-16 Idempotency-Key 8-128 printable ASCII (BE03c 150, 408, 422)', () => {
  it.each(MALFORMED)(
    '[P2-S12-AC-039] CMS-03C-16 %s Idempotency-Key is 400 INVALID_REQUEST before any quota token or the port',
    async (_name, key) => {
      const harness = createTaxonomyRouteHarness();
      const response = await harness.request(PATH_16, withKey(key));
      expect(response.status).toBe(400);
      expect(((await response.json()) as { code: string }).code).toBe(
        'INVALID_REQUEST',
      );
      expect(harness.rateLimit).not.toHaveBeenCalled();
      expect(harness.createVersion).not.toHaveBeenCalled();
    },
  );

  it('[P2-S12-AC-039] CMS-03C-16 a malformed Idempotency-Key from a caller without the capability is the 400, not the 403', async () => {
    const harness = createTaxonomyRouteHarness();
    harness.resolveSession.mockResolvedValue({
      ok: true,
      value: { ...taxonomySession, capabilities: ['cms.author'] },
    });
    const response = await harness.request(PATH_16, withKey('short'));
    expect(response.status).toBe(400);
    expect(harness.rateLimit).not.toHaveBeenCalled();
    expect(harness.createVersion).not.toHaveBeenCalled();
  });

  it.each([8, 128])(
    '[P2-S12-AC-039] CMS-03C-16 a %i character printable key is inside the bound and reaches the port',
    async (length) => {
      const harness = createTaxonomyRouteHarness();
      const response = await harness.request(
        PATH_16,
        withKey('~'.repeat(length)),
      );
      expect(response.status).toBe(201);
      expect(harness.createVersion).toHaveBeenCalledTimes(1);
    },
  );
});
