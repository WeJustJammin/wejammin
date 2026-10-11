/** Settlement edges of private CMS lease control beyond the frozen checkpoint contract. */
import { describe, expect, it } from 'vitest';

import {
  beat,
  completed,
  current,
  fixture,
  heartbeat,
  need,
  observe,
  outcome,
  renewedCalls,
  retry,
  running,
  same,
  type Control,
} from './consumer-cms-lease-control-test-support.ts';
import type { CanonicalJob } from './runtime-types.ts';

describe('private CMS lease settlement', () => {
  it('hands the effect a frozen control that exposes only checkpoint', async () => {
    const f = fixture();
    let retained: Control | undefined;
    f.execute.mockImplementation(async (_input, control) => {
      retained = need(control);
      return outcome();
    });
    same(await f.run(), completed('19'));
    const seen = need(retained);
    same(Reflect.ownKeys(seen), ['checkpoint']);
    expect(Object.isFrozen(seen)).toBe(true);
  });

  it('calls the heartbeat port as a method of the supplied persistence', async () => {
    const f = fixture();
    f.execute.mockImplementation(async (_input, control) => {
      await need(control).checkpoint();
      return outcome();
    });
    await f.run();
    expect(f.hb.mock.contexts[0] === f.input.persistence).toBe(true);
  });

  it.each(['invalid', 'throwing'])(
    'a %s final clock overrides a healthy checkpoint',
    async (mode) => {
      const f = fixture();
      f.execute.mockImplementation(async (_input, control) => {
        same(await need(control).checkpoint(), current());
        if (mode === 'throwing')
          f.clock.mockImplementation(() => {
            throw new Error('Clock failed');
          });
        else f.time.value = NaN;
        return outcome();
      });
      same(await f.run(), retry);
      same(f.calls, [...f.prefix, ...renewedCalls()]);
      same(f.write.mock.calls, []);
      same(f.processed.mock.calls, []);
      f.assertEffect();
    },
  );

  it('settles a synchronously throwing effect as manual review while the lease is healthy', async () => {
    const f = fixture();
    f.execute.mockImplementation(() => {
      throw new Error('Controlled effect failure');
    });
    same(await f.run(), {
      kind: 'manual_review',
      canonicalWrite: false,
      replayable: false,
    });
    same(f.calls, f.prefix);
    f.assertEffect();
  });

  it('lets lease loss win over a synchronously throwing effect', async () => {
    const f = fixture();
    beat(f, async () => false);
    f.execute.mockImplementation((_input, control) => {
      void need(control).checkpoint();
      throw new Error('Controlled effect failure');
    });
    same(await f.run(), retry);
    same(f.calls, [...f.prefix, ['restore'], ['heartbeat', heartbeat()]]);
    f.assertEffect();
  });

  it('treats an observed version that is not a decimal string as lost', async () => {
    const f = fixture();
    // The wire may deliver a number; JSON round-trips it past the static type.
    const numeric: CanonicalJob = JSON.parse(
      JSON.stringify({ ...running(), version: 37 }),
    );
    observe(f, async () => numeric);
    f.execute.mockImplementation(async (_input, control) => {
      same(await need(control).checkpoint(), { kind: 'lost' });
      return outcome();
    });
    same(await f.run(), retry);
    same(f.calls, [...f.prefix, ...renewedCalls()]);
    f.assertEffect();
  });
});
