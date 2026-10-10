/** Controlled candidate metadata only: token-blind reads do not prove ownership. */
import { describe, expect, it } from 'vitest';

import { executeJobDispatch } from './consumer.ts';
import { decideJobDispatch } from './dispatch.ts';
import {
  ID,
  TOKEN,
  apply,
  beat,
  completed,
  current,
  fixture,
  gate,
  heartbeat,
  need,
  observe,
  outcome,
  reached,
  record,
  renewedCalls,
  retry,
  running,
  same,
  type Checkpoint,
  type Control,
} from './consumer-cms-lease-control-test-support.ts';
import type { DispatchInput } from './types.ts';

describe('private CMS candidate lease control through the actual consumer', () => {
  it.each([
    {
      version: '11',
      incoming: '7',
      kind: 'skip',
      reason: 'stale',
      acknowledge: true,
    },
    {
      version: '3',
      incoming: '23',
      kind: 'retry',
      reason: 'future_version',
      acknowledge: false,
    },
  ])(
    'ordinary private-true origin keeps $reason core and consumer admission',
    async (row) => {
      const f = fixture({ type: 'object.verify' });
      const expected = {
        kind: row.kind,
        reason: row.reason,
        acknowledge: row.acknowledge,
      };
      const canonical = Object.freeze({ ...f.canonical, version: row.version });
      const core = Object.freeze({
        canonicalJob: canonical,
        canonicalState: canonical.state,
        canonicalVersion: canonical.version,
        envelope: f.envelope,
        processedEventIds: [],
        restoreFenceOpen: true,
        eventJobType: canonical.type,
        verifiedImmutableJobOrigin: true,
      } satisfies DispatchInput & { verifiedImmutableJobOrigin: boolean });
      same(decideJobDispatch(core), expected);
      f.read.mockImplementation(async (...args) => {
        f.calls.push(['read', ...args]);
        return Object.freeze({ ...f.canonical, version: '13' });
      });
      const input = Object.freeze({
        ...f.input,
        envelope: Object.freeze({
          ...f.envelope,
          aggregateVersion: row.incoming,
        }),
      });
      same(await executeJobDispatch(input), expected);
      same(f.calls, [['read', ID], ['restore']]);
      same(f.execute.mock.calls, []);
      same(f.clock.mock.calls, []);
    },
  );

  it('renews 19 to actual 37 and closes retained control without poisoning CAS', async () => {
    const f = fixture();
    let retained: Control | undefined;
    f.execute.mockImplementation(async (_input, control) => {
      retained = need(control);
      same(await retained.checkpoint(), current());
      return outcome();
    });
    same(await f.run(), completed());
    same(f.calls, [
      ...f.prefix,
      ...renewedCalls(),
      ['apply', apply()],
      ['processed', record],
    ]);
    f.assertEffect();
    const beforeLate = f.calls.slice();
    same(await need(retained).checkpoint(), { kind: 'lost' });
    same(f.calls, beforeLate);
  });

  it('serializes two sequential renewals using each actual read version and expiry', async () => {
    const f = fixture();
    let reads = 0;
    observe(f, async () =>
      ++reads === 1 ? running() : running('59', 801_000),
    );
    f.execute.mockImplementation(async (_input, control) => {
      same(await need(control).checkpoint(), current());
      f.time.value = 401_000;
      same(await need(control).checkpoint(), current('59', 801_000));
      return outcome();
    });
    same(await f.run(), completed('59'));
    same(f.calls, [
      ...f.prefix,
      ...renewedCalls(),
      ...renewedCalls('37', 501_000, 401_000),
      ['apply', apply('59')],
      ['processed', record],
    ]);
    f.assertEffect();
  });

  it('drains two overlapping accepted checkpoints after close and does not let late calls poison CAS', async () => {
    const f = fixture();
    const hbGate = gate(),
      readGate = gate(),
      returned = gate();
    let beats = 0,
      reads = 0;
    let retained: Control | undefined;
    const snapshots: Promise<Checkpoint>[] = [];
    beat(f, async () => {
      if (++beats === 1) await hbGate.hold();
      return true;
    });
    observe(f, async () => {
      if (++reads === 1) {
        await readGate.hold();
        f.time.value = 401_000;
        return running();
      }
      return running('59', 801_000);
    });
    f.execute.mockImplementation((_input, control) => {
      retained = need(control);
      snapshots.push(retained.checkpoint(), retained.checkpoint());
      const result = Promise.resolve(outcome());
      void result.then(returned.release);
      return result;
    });
    const delivery = f.run();
    let late: Promise<Checkpoint> | undefined;
    try {
      await reached(hbGate.entered, delivery);
      await reached(returned.resolved, delivery);
      same(f.calls, [...f.prefix, ['restore'], ['heartbeat', heartbeat()]]);
      late = need(retained).checkpoint();
      hbGate.release();
      await reached(readGate.entered, delivery);
      same(f.calls, [...f.prefix, ...renewedCalls()]);
    } finally {
      hbGate.release();
      readGate.release();
    }
    same(await delivery, completed('59'));
    same(await late, { kind: 'lost' });
    const actual = await Promise.all(snapshots);
    same(actual, [current(), current('59', 801_000)]);
    expect(actual[0] !== actual[1] && actual.every(Object.isFrozen)).toBe(true);
    same(f.calls, [
      ...f.prefix,
      ...renewedCalls(),
      ...renewedCalls('37', 501_000, 401_000),
      ['apply', apply('59')],
      ['processed', record],
    ]);
    f.assertEffect();
  });

  it('not_due still rereads exact version and expiry with zero heartbeat', async () => {
    const f = fixture({ now: 1_000 });
    observe(f, async () => running('19', 301_000));
    f.execute.mockImplementation(async (_input, control) => {
      same(await need(control).checkpoint(), current('19', 301_000));
      return outcome();
    });
    same(await f.run(), completed('19'));
    same(f.calls, [
      ...f.prefix,
      ['restore'],
      ['read', ID],
      ['apply', apply('19')],
      ['processed', record],
    ]);
    f.assertEffect();
  });

  it.each(
    ['false', 'throw', 'nonBoolean'].flatMap((failure) =>
      ['succeeded', 'pending_manual_review', 'throw'].map((mode) => ({
        failure,
        mode,
      })),
    ),
  )(
    '$failure heartbeat loss overrides $mode and latches without more I/O',
    async ({ failure, mode }) => {
      const f = fixture();
      beat(f, async () => {
        if (failure === 'throw') throw new Error('Heartbeat failed');
        return failure === 'false' ? false : 'true';
      });
      f.execute.mockImplementation(async (_input, control) => {
        same(await need(control).checkpoint(), { kind: 'lost' });
        const before = f.calls.slice();
        same(await need(control).checkpoint(), { kind: 'lost' });
        same(f.calls, before);
        if (mode === 'throw') throw new Error('Effect failed');
        return outcome(
          mode === 'succeeded' ? 'succeeded' : 'pending_manual_review',
        );
      });
      same(await f.run(), retry);
      same(f.calls, [...f.prefix, ['restore'], ['heartbeat', heartbeat()]]);
      f.assertEffect();
    },
  );

  it.each([
    'read throws',
    'clock throws',
    'clock invalid',
    'clock expired',
    'restore closed',
    'restore throws',
    'final expiry',
  ])(
    '%s independently prevents an outcome after deferred renewal',
    async (mode) => {
      const f = fixture();
      const held = gate();
      beat(f, async () => {
        await held.hold();
        return true;
      });
      if (mode === 'read throws')
        observe(f, async () => {
          throw new Error('Read failed');
        });
      f.execute.mockImplementation(async (_input, control) => {
        const result = await need(control).checkpoint();
        if (mode === 'final expiry') {
          same(result, current());
          f.time.value = 501_000;
        } else same(result, { kind: 'lost' });
        return outcome();
      });
      if (mode.startsWith('restore'))
        f.restore.mockImplementation(async () => {
          f.calls.push(['restore']);
          if (f.restore.mock.calls.length < 3) return f.open;
          await held.hold();
          if (mode === 'restore throws') throw new Error('Restore failed');
          return { ...f.open, integrityVerified: false };
        });
      const delivery = f.run();
      try {
        await reached(held.entered, delivery);
        same(f.write.mock.calls, []);
        same(f.processed.mock.calls, []);
        if (mode === 'clock throws')
          f.clock.mockImplementation(() => {
            throw new Error('Clock failed');
          });
        if (mode === 'clock invalid') f.time.value = NaN;
        if (mode === 'clock expired') f.time.value = 501_000;
      } finally {
        held.release();
      }
      same(await delivery, retry);
      same(f.write.mock.calls, []);
      same(f.processed.mock.calls, []);
      const io = mode.startsWith('restore')
        ? [['restore']]
        : mode === 'clock throws' || mode === 'clock invalid'
          ? renewedCalls().slice(0, 2)
          : renewedCalls();
      same(f.calls, [...f.prefix, ...io]);
      f.assertEffect();
    },
  );

  it.each([running('37', 301_000), running('19', 501_000)])(
    'rejects changed not_due canonical facts %#',
    async (value) => {
      const f = fixture({ now: 1_000 });
      observe(f, async () => value);
      f.execute.mockImplementation(async (_input, control) => {
        await need(control).checkpoint();
        return outcome();
      });
      same(await f.run(), retry);
      same(f.calls, [...f.prefix, ['restore'], ['read', ID]]);
      f.assertEffect();
    },
  );

  it.each([
    { type: 'object.verify' },
    { type: 'platform.object.verify' },
    { verified: false },
  ])(
    'retains ordinary or unverified one-argument behavior %#',
    async (options) => {
      const f = fixture(options);
      same(await f.run(), completed('19'));
      same(f.calls, [
        ...f.prefix,
        ['apply', apply('19')],
        ['processed', record],
      ]);
      same(f.clock.mock.calls, []);
      f.assertEffect(false);
    },
  );

  it('accepts actual live reread after true heartbeat crosses the OLD expiry', async () => {
    const f = fixture();
    const held = gate();
    beat(f, async () => {
      await held.hold();
      return true;
    });
    observe(f, async () => running('37', 600_000));
    f.execute.mockImplementation(async (_input, control) => {
      same(await need(control).checkpoint(), current('37', 600_000));
      return outcome();
    });
    const delivery = f.run();
    try {
      await reached(held.entered, delivery);
      f.time.value = 401_000;
    } finally {
      held.release();
    }
    same(await delivery, completed());
    same(f.calls, [
      ...f.prefix,
      ...renewedCalls(),
      ['apply', apply()],
      ['processed', record],
    ]);
    f.assertEffect();
  });

  it.each(['expired', 'invalid', 'throw'])(
    'refuses a freshly %s clock before checkpoint I/O',
    async (mode) => {
      const f = fixture();
      f.execute.mockImplementation(async (_input, control) => {
        f.time.value = mode === 'expired' ? 301_000 : NaN;
        if (mode === 'throw')
          f.clock.mockImplementation(() => {
            throw new Error('Clock failed');
          });
        same(await need(control).checkpoint(), { kind: 'lost' });
        return outcome();
      });
      same(await f.run(), retry);
      same(f.calls, f.prefix);
      f.assertEffect();
    },
  );

  it('keeps original token for token-blind foreign candidate metadata and respects false final CAS', async () => {
    const f = fixture();
    f.execute.mockImplementation(async (_input, control) => {
      same(await need(control).checkpoint(), current());
      return outcome();
    });
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
    same(f.calls, [...f.prefix, ...renewedCalls(), ['apply', apply()]]);
    expect(f.write.mock.calls[0]?.[0].leaseToken === TOKEN).toBe(true);
    f.assertEffect();
  });
});
