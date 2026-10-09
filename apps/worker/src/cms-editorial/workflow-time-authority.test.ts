import { afterEach, describe, expect, it, vi } from 'vitest';

import { CMS_TZDB_VERSION } from '@wejammin/contracts';

/*
 * The Worker verifies the pinned snapshot hash at module load. A failed check
 * yields no authority (every schedule command is then 503) and a good one is
 * the committed 2026e snapshot; a composed authority always wins.
 */

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('@wejammin/contracts/time-authority');
});

describe('pinned snapshot verification', () => {
  it('serves the committed snapshot of the pinned release', async () => {
    const { timeAuthorityOf } = await import('./workflow-time-authority');
    const authority = await timeAuthorityOf({});
    expect(authority?.release).toBe(CMS_TZDB_VERSION);
    expect(authority?.hasZone('America/New_York')).toBe(true);
    expect(await timeAuthorityOf({})).toBe(authority);
  });

  it('yields no authority when the snapshot fails its integrity check', async () => {
    vi.doMock('@wejammin/contracts/time-authority', () => ({
      loadPinnedTimeAuthority: () =>
        Promise.reject(new Error('The tz snapshot hash differs.')),
    }));
    const { timeAuthorityOf } = await import('./workflow-time-authority');
    expect(await timeAuthorityOf({})).toBeNull();
  });

  it('prefers a composed authority over the pinned one', async () => {
    const { timeAuthorityOf } = await import('./workflow-time-authority');
    const composed = { release: 'composed' };
    expect(
      await timeAuthorityOf({ timeAuthority: async () => composed as never }),
    ).toBe(composed);
  });
});

describe('time refusal envelope', () => {
  it('publishes the token, its members and the request pointer', async () => {
    const { timeRefusal } = await import('./workflow-time-authority');
    expect(
      timeRefusal({
        pointer: '/resolvedUtc',
        details: { reasonCode: 'resolved_utc_mismatch', expectedUtc: 'x' },
      }),
    ).toEqual({
      ok: false,
      status: 422,
      code: 'VALIDATION_FAILED',
      message: 'The publication schedule time is invalid.',
      details: {
        reasonCode: 'resolved_utc_mismatch',
        expectedUtc: 'x',
        violations: [
          {
            path: '/resolvedUtc',
            code: 'resolved_utc_mismatch',
            message: 'The value is invalid.',
          },
        ],
      },
    });
  });
});
