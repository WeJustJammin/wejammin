import { describe, expect, it } from 'vitest';

import {
  FOREIGN,
  ID,
  TOKEN,
  fixture,
  retry,
  same,
} from './consumer-cms-lease-control-test-support.ts';

/*
 * Review finding B-08 (BE00 `platform.job.execute`, "retryable pre-effect failure returns job to queued"): once the
 * claim has succeeded the job is `running` under a lease this delivery holds. When the private CMS lease session
 * cannot be opened (no fresh clock, no heartbeat port, a receipt whose own expiry is unusable) NOTHING has run, so the
 * failure is a retryable pre-effect one: the consumer hands the job back to `queued` through the ordinary outcome CAS
 * at the claim's version, instead of leaving it `running` under a lease nobody renews until the lease expires. A
 * receipt the consumer cannot attribute to this claim (foreign job or token, a version that does not descend from the
 * pre-claim one) proves nothing about the row, so no write is made for it. Nothing here runs an effect, records a
 * processed event or acknowledges the message.
 */

const RELEASE_CODE = 'LEASE_CONTROL_UNAVAILABLE';
const release = (version = '19') => ({
  currentState: 'running',
  currentVersion: `"${version}"`,
  expectedVersion: `"${version}"`,
  jobId: ID,
  leaseToken: TOKEN,
  nextState: 'queued',
  retryable: true,
  resultRef: null,
  errorCode: RELEASE_CODE,
  nextVersion: `"${BigInt(version) + 1n}"`,
});
const queuedDecision = (version = '19') => ({
  kind: 'completed',
  outcome: {
    kind: 'applied',
    jobId: ID,
    nextState: 'queued',
    nextVersion: `"${BigInt(version) + 1n}"`,
  },
  processed: null,
});

describe('a claimed CMS delivery whose lease session cannot open', () => {
  it.each([
    ['fresh clock', { clock: false }],
    ['heartbeat port', { hb: false }],
    ['readable clock', { now: NaN }],
    ['unexpired lease at the clock', { now: 301_000 }],
    ['finite receipt expiry', { receipt: { leaseUntilMs: NaN } }],
  ])(
    'returns the job to queued at the claim version when there is no %s, before any effect',
    async (_missing, options) => {
      const f = fixture(options);
      same(await f.run(), queuedDecision());
      same(f.calls, [...f.prefix, ['apply', release()]]);
      same(f.execute.mock.calls, []);
      same(f.processed.mock.calls, []);
      expect(f.write.mock.calls[0]?.[0].leaseToken === TOKEN).toBe(true);
    },
  );

  it.each([
    ['a foreign job id', { receipt: { jobId: FOREIGN } }],
    ['a foreign lease token', { receipt: { leaseToken: FOREIGN } }],
    ['another pre-claim version', { receipt: { expectedVersion: '8' } }],
    ['a version that does not advance', { receipt: { version: '7' } }],
    ['a version below the pre-claim one', { receipt: { version: '6' } }],
    ['a non-decimal version', { receipt: { version: '1e3' } }],
  ])(
    'makes no write for a receipt it cannot attribute to the claim (%s) and retries',
    async (_why, options) => {
      const f = fixture({ ...options, clock: false });
      same(await f.run(), retry);
      same(f.calls, f.prefix);
      same(f.write.mock.calls, []);
      same(f.execute.mock.calls, []);
      same(f.processed.mock.calls, []);
    },
  );

  it('stays a retry with no processed marker when the release CAS finds the lease already gone', async () => {
    const f = fixture({ clock: false });
    f.write.mockImplementation(async (...args) => {
      f.calls.push(['apply', ...args]);
      return false;
    });
    same(await f.run(), {
      kind: 'completed',
      outcome: {
        kind: 'conflict',
        reason: 'VERSION_MISMATCH',
        canonicalWrite: false,
      },
      processed: null,
    });
    same(f.calls, [...f.prefix, ['apply', release()]]);
    same(f.processed.mock.calls, []);
    same(f.execute.mock.calls, []);
  });

  it('stays the plain lease-conflict retry when the release CAS itself fails', async () => {
    const f = fixture({ clock: false });
    f.write.mockImplementation(async (...args) => {
      f.calls.push(['apply', ...args]);
      throw new Error('Persistence unavailable');
    });
    same(await f.run(), retry);
    same(f.calls, [...f.prefix, ['apply', release()]]);
    same(f.processed.mock.calls, []);
    same(f.execute.mock.calls, []);
  });

  it('leaves ordinary and unverified deliveries untouched: no session, no release', async () => {
    for (const options of [
      { type: 'object.verify' },
      { verified: false },
    ] as const) {
      const f = fixture({ ...options, clock: false, hb: false });
      await f.run();
      same(
        f.write.mock.calls.filter(
          ([request]) => request.errorCode === RELEASE_CODE,
        ),
        [],
      );
    }
  });
});
