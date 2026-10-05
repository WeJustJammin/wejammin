import { describe, expect, it } from 'vitest';

import { ok } from './phase-02-slice-09-test-values';
import {
  grantRequestFor,
  grantSpecFor,
  makeGrantHarness,
  ownerSession,
} from './phase-02-slice-09-grants-test-support';

/**
 * AC1031 worker half for CMS-03A-15, -16 and -17: the 401 STEP_UP_REQUIRED is
 * produced before any rate charge, idempotency reservation or port work, so
 * the draft is retried with its ORIGINAL Idempotency-Key, and the first
 * committed attempt is the only one that reaches the port.
 */
const KEY = 'cms-grant-original-key-0001';

describe.each(['CMS-03A-15', 'CMS-03A-16', 'CMS-03A-17'] as const)(
  '%s step-up then retry with the original key',
  (operationId) => {
    it('[P2-S09-AC-1031] refuses a stale proof with no side effect, then the same key succeeds exactly once', async () => {
      const spec = grantSpecFor(operationId);
      const harness = makeGrantHarness();
      harness.resolveSession.mockResolvedValueOnce(
        ok(ownerSession({ mfaFresh: false })),
      );
      const refused = await harness.app.request(
        grantRequestFor(spec, { headers: { 'idempotency-key': KEY } }),
      );
      expect(refused.status).toBe(401);
      const body = (await refused.json()) as Record<string, unknown>;
      expect(body.code).toBe('STEP_UP_REQUIRED');
      expect(body.details).toEqual({
        recoveryAction: 'step_up',
        allowedMethods: ['totp'],
      });
      expect(harness.rateLimit).not.toHaveBeenCalled();
      expect(harness.ports[spec.portName]).not.toHaveBeenCalled();

      const retried = await harness.app.request(
        grantRequestFor(spec, { headers: { 'idempotency-key': KEY } }),
      );
      expect(retried.status).toBe(spec.status);
      expect(harness.ports[spec.portName]).toHaveBeenCalledTimes(1);
      const input = harness.ports[spec.portName]?.mock.calls[0]?.[0] as {
        idempotencyKey: string;
      };
      expect(input.idempotencyKey).toBe(KEY);
    });
  },
);
