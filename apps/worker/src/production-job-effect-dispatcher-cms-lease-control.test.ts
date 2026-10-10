/** Private callback forwarding and controlled metadata; no production preparation wiring. */
import type { JobEffectInput, JobEffectResult } from '@wejammin/application';
import { describe, expect, it, vi } from 'vitest';

import {
  ID,
  FOREIGN,
  TOKEN,
  apply,
  beat,
  completed,
  current,
  fixture,
  gate,
  heartbeat,
  healthyPolicy,
  metadata,
  need,
  observe,
  outcome,
  reached,
  record,
  renewedCalls,
  retry,
  running,
  same,
  type Control,
  type Checkpoint,
  type Effect,
} from '../../../packages/application/src/infrastructure/jobs/consumer-cms-lease-control-test-support';
import { heartbeatJobLease } from '../../../packages/application/src/infrastructure/jobs/execution';
import { executeJobDispatch } from '../../../packages/application/src/infrastructure/jobs/consumer';
import type { CanonicalJob } from '../../../packages/application/src/infrastructure/jobs/runtime-types';
import { buildCmsSchemaDryRunClaimRequest } from './content-schema-registry/schema-dry-run-claim-input';
import { createProductionJobEffectDispatcher } from './production-job-effect-dispatcher';

const callbackInput = (type = 'cms.schema.dry_run'): JobEffectInput => {
  const f = fixture({ type });
  return Object.freeze({
    job: f.canonical,
    envelope: f.envelope,
    claimedLease: f.receipt,
    leaseToken: f.receipt.leaseToken,
  });
};

describe('production private CMS lease-control forwarding', () => {
  it.each(['succeeded', 'pending_manual_review', 'throw'])(
    'drains unawaited false heartbeat before immediate %s disposition',
    async (mode) => {
      const f = fixture();
      const held = gate(),
        effectDone = gate();
      let pending: Promise<Checkpoint> | undefined;
      beat(f, async () => {
        await held.hold();
        return false;
      });
      f.execute.mockImplementation((_input, control) => {
        pending = need(control).checkpoint();
        const result =
          mode === 'throw'
            ? Promise.reject<JobEffectResult>(
                new Error('Controlled effect failure'),
              )
            : Promise.resolve(
                outcome(
                  mode === 'succeeded' ? 'succeeded' : 'pending_manual_review',
                ),
              );
        void result.then(effectDone.release, effectDone.release);
        return result;
      });
      let settled = false;
      const delivery = f.run().then((result) => {
        settled = true;
        return result;
      });
      try {
        await reached(held.entered, delivery);
        await reached(effectDone.resolved, delivery);
        expect(settled).toBe(false);
        same(f.calls, [...f.prefix, ['restore'], ['heartbeat', heartbeat()]]);
      } finally {
        held.release();
      }
      same(await delivery, retry);
      same(await pending, { kind: 'lost' });
      same(f.calls, [...f.prefix, ['restore'], ['heartbeat', heartbeat()]]);
      f.assertEffect();
    },
  );

  it.each(['pending_manual_review', 'throw'])(
    'final expiry overrides healthy checkpoint then %s',
    async (mode) => {
      const f = fixture();
      f.execute.mockImplementation(async (_input, control) => {
        same(await need(control).checkpoint(), current());
        f.time.value = 501_000;
        if (mode === 'throw') throw new Error('Controlled effect failure');
        return outcome('pending_manual_review');
      });
      same(await f.run(), retry);
      same(f.calls, [...f.prefix, ...renewedCalls()]);
      f.assertEffect();
    },
  );

  it('omitted eventJobType retains verified CMS legacy one-argument dispatch', async () => {
    const f = fixture();
    const { eventJobType, ...withoutType } = f.input;
    expect(eventJobType === 'cms.schema.dry_run').toBe(true);
    expect(withoutType.verifiedImmutableJobOrigin).toBe(true);
    same(await executeJobDispatch(Object.freeze(withoutType)), completed('19'));
    same(f.calls, [...f.prefix, ['apply', apply('19')], ['processed', record]]);
    same(f.clock.mock.calls, []);
    f.assertEffect(false);
  });

  it.each([
    ['absent', null],
    ['foreign id', { ...running(), id: FOREIGN }],
    ['wrong type', { ...running(), type: 'object.verify' }],
    ['wrong state', { ...running(), state: 'queued' }],
    ['malformed version', { ...running(), version: '1e3' }],
    ['overflow version', { ...running(), version: '9223372036854775808' }],
    ['unchanged version', running('19')],
    ['regressed version', running('18')],
    ['null expiry', { ...running(), leaseUntilMs: null }],
    ['expired expiry', running('37', 201_000)],
    ['invalid expiry', running('37', NaN)],
  ] satisfies [string, CanonicalJob | null][])(
    'rejects independent canonical %s after true heartbeat',
    async (_label, value) => {
      const f = fixture();
      observe(f, async () => value);
      f.execute.mockImplementation(async (_input, control) => {
        same(await need(control).checkpoint(), { kind: 'lost' });
        const before = f.calls.slice();
        same(await need(control).checkpoint(), { kind: 'lost' });
        same(f.calls, before);
        return outcome();
      });
      same(await f.run(), retry);
      same(f.calls, [...f.prefix, ...renewedCalls()]);
      f.assertEffect();
    },
  );

  it('pins the existing heartbeat helper one-third boundary and exact request', async () => {
    const f = fixture();
    same(
      await heartbeatJobLease({
        persistence: { heartbeatJobLease: f.hb },
        request: heartbeat('19', 301_000, 200_999),
      }),
      { kind: 'skip', reason: 'not_due' },
    );
    same(
      await heartbeatJobLease({
        persistence: { heartbeatJobLease: f.hb },
        request: heartbeat(),
      }),
      { kind: 'renewed', jobId: ID },
    );
    same(f.calls, [['heartbeat', heartbeat()]]);
  });

  it('renews queued continuation without a processed marker', async () => {
    const f = fixture();
    f.execute.mockImplementation(async (_input, control) => {
      await need(control).checkpoint();
      return outcome('queued');
    });
    same(await f.run(), completed('37', 'queued'));
    same(f.calls, [
      ...f.prefix,
      ...renewedCalls(),
      ['apply', apply('37', 'queued')],
    ]);
    f.assertEffect();
  });

  it('waits for renewed terminal processed write before completing', async () => {
    const f = fixture();
    const held = gate();
    f.execute.mockImplementation(async (_input, control) => {
      await need(control).checkpoint();
      return outcome();
    });
    f.processed.mockImplementation(async (...args) => {
      f.calls.push(['processed', ...args]);
      await held.hold();
      return 'recorded';
    });
    let settled = false;
    const delivery = f.run().then((result) => {
      settled = true;
      return result;
    });
    try {
      await reached(held.entered, delivery);
      expect(settled).toBe(false);
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

  it.each(['cms.schema.dry_run', 'object.verify', 'platform.object.verify'])(
    '%s forwards only its allowed exact argument tuple and keeps the receiver',
    async (type) => {
      const input = callbackInput(type);
      const checkpoint = vi.fn<Control['checkpoint']>(async () => ({
        kind: 'lost',
      }));
      const control: Control = Object.freeze({ checkpoint });
      const prepareSchemaDryRun = vi.fn<Effect>(async () => outcome());
      const verifyObject = vi.fn<Effect>(async () => outcome());
      const dependencies = { prepareSchemaDryRun, verifyObject };
      // Optional structural widening compiles against the current one-argument producer.
      const dispatch: (
        input: JobEffectInput,
        control?: Control,
      ) => Promise<JobEffectResult> =
        createProductionJobEffectDispatcher(dependencies);
      same(await dispatch(input, control), outcome());
      const cms = type === 'cms.schema.dry_run';
      const selected = cms ? prepareSchemaDryRun : verifyObject;
      same(selected.mock.calls, [cms ? [input, control] : [input]]);
      expect(selected.mock.calls[0]?.[0] === input).toBe(true);
      if (cms) expect(selected.mock.calls[0]?.[1] === control).toBe(true);
      same(selected.mock.contexts, [dependencies]);
      expect(selected.mock.contexts[0] === dependencies).toBe(true);
      same((cms ? verifyObject : prepareSchemaDryRun).mock.calls, []);
      same(checkpoint.mock.calls, []);
    },
  );

  it('absent CMS control preserves exactly one argument, not an undefined second', async () => {
    const input = callbackInput();
    const prepareSchemaDryRun = vi.fn<Effect>(async () => outcome());
    const dependencies = { prepareSchemaDryRun };
    const dispatch: Effect = createProductionJobEffectDispatcher(dependencies);
    same(await dispatch(input), outcome());
    same(prepareSchemaDryRun.mock.calls, [[input]]);
    expect(prepareSchemaDryRun.mock.calls[0]?.[0] === input).toBe(true);
    expect(prepareSchemaDryRun.mock.contexts[0] === dependencies).toBe(true);
  });

  it('actual consumer renewal preserves the initial builder input and separately frozen checkpoint', async () => {
    const f = fixture();
    const prepareSchemaDryRun = vi.fn<Effect>(async (input, control) => {
      const refs = [input.job, input.envelope, input.claimedLease];
      const before = refs.map((value) =>
        value === undefined ? null : metadata(value),
      );
      const built = buildCmsSchemaDryRunClaimRequest(input);
      expect(built !== null).toBe(true);
      const snapshot = await need(control).checkpoint();
      const expected = current();
      if (expected.kind !== 'current')
        throw new Error('Expected independent snapshot');
      const independentlyFrozen = Object.freeze({
        ...expected,
        claimedJob: Object.freeze({ ...expected.claimedJob }),
      });
      same(snapshot, independentlyFrozen);
      if (snapshot.kind !== 'current')
        throw new Error('Expected current checkpoint');
      expect(
        Object.isFrozen(snapshot) && Object.isFrozen(snapshot.claimedJob),
      ).toBe(true);
      expect(
        snapshot !== independentlyFrozen &&
          snapshot.claimedJob !== input.claimedLease,
      ).toBe(true);
      same(buildCmsSchemaDryRunClaimRequest(input), built);
      same(
        refs.map((value) => (value === undefined ? null : metadata(value))),
        before,
      );
      expect(
        input.job === refs[0] &&
          input.envelope === refs[1] &&
          input.claimedLease === refs[2],
      ).toBe(true);
      return outcome();
    });
    const dependencies = { prepareSchemaDryRun };
    const dispatch: Effect = createProductionJobEffectDispatcher(dependencies);
    f.execute.mockImplementation(dispatch);
    same(await f.run(), completed());
    same(f.calls, [
      ...f.prefix,
      ...renewedCalls(),
      ['apply', apply()],
      ['processed', record],
    ]);
    same(prepareSchemaDryRun.mock.calls, f.execute.mock.calls);
    expect(
      prepareSchemaDryRun.mock.calls[0]?.[0] === f.execute.mock.calls[0]?.[0],
    ).toBe(true);
    expect(
      prepareSchemaDryRun.mock.calls[0]?.[1] === f.execute.mock.calls[0]?.[1],
    ).toBe(true);
    expect(prepareSchemaDryRun.mock.contexts[0] === dependencies).toBe(true);
    f.assertEffect();
  });

  it.each([
    { clock: false },
    { hb: false },
    { now: NaN },
    { now: 301_000 },
    { receipt: { jobId: FOREIGN } },
    { receipt: { leaseToken: FOREIGN } },
    { receipt: { expectedVersion: '8' } },
    { receipt: { version: '7' } },
    { receipt: { version: '1e3' } },
    { receipt: { leaseUntilMs: NaN } },
    { receipt: { version: '6' } },
  ])(
    'refuses unusable capability or initial receipt %# before dispatcher effects',
    async (options) => {
      const f = fixture(options);
      const prepareSchemaDryRun = vi.fn<Effect>(async () => outcome());
      f.execute.mockImplementation(
        createProductionJobEffectDispatcher({ prepareSchemaDryRun }),
      );
      same(await f.run(), retry);
      same(f.calls, f.prefix);
      same(f.execute.mock.calls, []);
      same(prepareSchemaDryRun.mock.calls, []);
      same(f.write.mock.calls, []);
      same(f.processed.mock.calls, []);
    },
  );

  it.each(['manual review', 'throw'])(
    'healthy %s preserves existing policy after closing the control',
    healthyPolicy,
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
