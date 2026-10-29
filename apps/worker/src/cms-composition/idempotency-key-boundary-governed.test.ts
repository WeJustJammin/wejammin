import { describe, expect, it } from 'vitest';

import {
  activationHarness,
  activationRequest,
} from './governed-activation.test-support';
import {
  decisionRequest,
  expectError,
  expectNoWork,
  reviewerHarness,
} from './governed-review-ops.test-support';
import {
  governedHarness,
  submitRequest,
} from './governed-review-submit.test-support';
import {
  expectError as expectPatternError,
  patternHarness,
  writeRequest,
} from './pattern-definition.test-support';

/**
 * BE03c lines 150 and 422: "Idempotency-Key 8-128 printable ASCII" is a 400 header refusal before
 * the capability check and every quota token. The two bounds beyond what the older per-route
 * cases carry (a 129 character key and a control character) for CMS-03C-06, -07, -09 and -12; the
 * cases for CMS-03C-08 and -16 are in `idempotency-key-boundary.test.ts`.
 */
const TOO_LONG = 'a'.repeat(129);
const CONTROL = 'idempotency\u0001key-001';
const JUST_RIGHT = '~'.repeat(128);

describe('CMS-03C-06, -07, -09 and -12 Idempotency-Key bounds', () => {
  it.each([
    ['129 characters', TOO_LONG],
    ['a control character', CONTROL],
  ])(
    '[P2-S12-AC-039] CMS-03C-06 a key of %s is 400 INVALID_REQUEST before any quota or the port',
    async (_name, key) => {
      const harness = governedHarness();
      await expectError(
        await harness.send(
          submitRequest(undefined, { 'idempotency-key': key }),
        ),
        400,
        'INVALID_REQUEST',
      );
      expectNoWork(harness);
    },
  );

  it.each([
    ['129 characters', TOO_LONG],
    ['a control character', CONTROL],
  ])(
    '[P2-S12-AC-039] CMS-03C-07 a key of %s is 400 INVALID_REQUEST before the capability check, any quota or the port',
    async (_name, key) => {
      const harness = reviewerHarness();
      await expectError(
        await harness.send(
          decisionRequest(undefined, { headers: { 'idempotency-key': key } }),
        ),
        400,
        'INVALID_REQUEST',
      );
      expectNoWork(harness);
    },
  );

  it.each([
    ['129 characters', TOO_LONG],
    ['a control character', CONTROL],
  ])(
    '[P2-S12-AC-039] CMS-03C-09 a key of %s is 400 INVALID_REQUEST before the capability check, MFA, any quota or the port',
    async (_name, key) => {
      const harness = activationHarness({ stepUpAt: null });
      await expectError(
        await harness.send(
          activationRequest(undefined, { headers: { 'idempotency-key': key } }),
        ),
        400,
        'INVALID_REQUEST',
      );
      expectNoWork(harness);
    },
  );

  it.each([
    ['129 characters', TOO_LONG],
    ['a control character', CONTROL],
  ])(
    '[P2-S12-AC-039] CMS-03C-12 a key of %s is 400 INVALID_REQUEST before any quota or the port',
    async (_name, key) => {
      const harness = patternHarness();
      await expectPatternError(
        await harness.send(writeRequest(undefined, { 'idempotency-key': key })),
        400,
        'INVALID_REQUEST',
      );
      expect(harness.rateLimit).not.toHaveBeenCalled();
      expect(harness.fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('[P2-S12-AC-039] CMS-03C-07 a 128 character printable key is inside the bound and reaches the port', async () => {
    const harness = reviewerHarness();
    const response = await harness.send(
      decisionRequest(undefined, {
        headers: { 'idempotency-key': JUST_RIGHT },
      }),
    );
    expect(response.status).toBe(200);
    expect(harness.fetchImpl).toHaveBeenCalledTimes(1);
  });
});
