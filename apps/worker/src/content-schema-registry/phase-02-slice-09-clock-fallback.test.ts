import { describe, expect, it, vi } from 'vitest';

import {
  createContentSchemaRegistryApp,
  type ContentSchemaRegistryDependencies,
} from './index';
import {
  expectError,
  readRequest,
} from './phase-02-slice-09-adversarial-test-support';
import {
  CMS_ORIGIN,
  RELEASE_ORIGIN,
  error,
} from './phase-02-slice-09-test-values';

/*
 * `now` is an optional dependency: production wires none and the routes read
 * the system clock. A refusal still reports its duration, from that clock.
 */
describe('content schema registry routes without an injected clock', () => {
  it('reports a refusal event whose duration is measured on the system clock', async () => {
    const telemetry = vi.fn();
    const ports = {} as unknown as ContentSchemaRegistryDependencies['ports'];
    const app = createContentSchemaRegistryApp({
      ports,
      resolveSession: vi.fn(async () =>
        error(401, 'UNAUTHENTICATED', 'No session.', {
          recoveryAction: 'reauthenticate',
        }),
      ),
      verifyRelease: vi.fn(),
      rateLimit: vi.fn(),
      humanOrigins: [CMS_ORIGIN],
      releaseOrigins: [RELEASE_ORIGIN],
      telemetry,
    });

    await expectError(await app.request(readRequest()), 401, 'UNAUTHENTICATED');

    expect(telemetry).toHaveBeenCalledTimes(1);
    const event = telemetry.mock.calls[0]?.[0] as {
      status: number;
      errorCode: string;
      durationMs: number;
    };
    expect(event.status).toBe(401);
    expect(event.errorCode).toBe('UNAUTHENTICATED');
    expect(Number.isSafeInteger(event.durationMs)).toBe(true);
    expect(event.durationMs).toBeGreaterThanOrEqual(0);
  });
});
