/**
 * The mutation suite's restoration guarantee, proven against the real catalog
 * (support/claim-gate-restore.ts): whatever ends a mutation test, no function is
 * left mutated, and a catalog that DID drift is reported instead of trusted.
 *
 * The diagnostic run of 2026-10-10 timed out inside the entry loop of
 * claim-gate-mutation.apispec.ts; vitest failed the test but the body kept running,
 * the next tests ran beside it, and every later file saw a mutated catalog. The
 * scenarios here reproduce each way a test can end (return, throw, throw halfway
 * through the mutation, timeout of a body that is still running, and a mutation made
 * behind the journal's back) and assert the catalog fingerprint equals the baseline
 * taken before the first mutation.
 *
 * Run right after `pnpm db:reset`, like every suite in this directory.
 */
import { afterEach, describe, expect, it } from 'vitest';

import {
  apiTarget,
  catalogFingerprint,
  MutationAborted,
  MutationGuard,
  restoreFunction,
  snapshotFunction,
  withMutation,
} from './support/claim-gate-restore';
import { psql } from './support/stack';

/** Three service-role manifest entries nothing else in this file depends on. */
const ENTRIES = [
  'cms_template_latest',
  'cms_template_context',
  'cms_define_template',
] as const;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** Polls until `condition` holds (the host may be slow; no fixed sleep decides an outcome). */
const until = async (
  condition: () => boolean,
  limitMs = 60_000,
): Promise<void> => {
  const started = Date.now();
  while (!condition()) {
    if (Date.now() - started > limitMs)
      throw new Error('timed out waiting for the condition');
    await sleep(25);
  }
};

/** A gate-less stub of the entry's own signature, committed to the live catalog. */
const stub = (name: string): void => {
  const { signature } = apiTarget(name);
  psql(`create or replace function platform_api.${name}(${signature})
        returns jsonb language sql security definer set search_path = ''
        as $stub$ select '{}'::jsonb $stub$`);
};

const isStubbed = (name: string): boolean =>
  psql(`select prosrc like '%select ''{}''::jsonb%' from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'platform_api' and p.proname = '${name}'`) === 't';

const guard = new MutationGuard();
const baseline = guard.baseline();

// The guard's own safety net, exactly as the mutation suite uses it.
afterEach(async () => {
  await guard.settle();
}, 120_000);

describe('SEC-1 mutation restoration does not depend on how a test ends', () => {
  const [first = '', second = '', third = ''] = ENTRIES;

  it('records a baseline fingerprint and sees a one-function change in it', () => {
    expect(baseline).toMatch(/^[0-9a-f]{32}$/u);
    const snapshot = snapshotFunction(apiTarget(first).target);
    stub(first);
    try {
      expect(isStubbed(first)).toBe(true);
      expect(catalogFingerprint()).not.toBe(baseline);
    } finally {
      expect(restoreFunction(snapshot)).toBe(true);
    }
    expect(isStubbed(first)).toBe(false);
    expect(catalogFingerprint()).toBe(baseline);
  });

  it('restores after a body that returns', async () => {
    const seen = await withMutation(
      guard.journal,
      apiTarget(first).target,
      () => {
        stub(first);
      },
      () => Promise.resolve(isStubbed(first)),
    );
    expect(seen).toBe(true);
    expect(guard.journal.open).toEqual([]);
    expect(catalogFingerprint()).toBe(baseline);
  });

  it('restores after a body that throws', async () => {
    await expect(
      withMutation(
        guard.journal,
        apiTarget(first).target,
        () => {
          stub(first);
        },
        () => Promise.reject(new Error('boom')),
      ),
    ).rejects.toThrow('boom');
    expect(guard.journal.open).toEqual([]);
    expect(catalogFingerprint()).toBe(baseline);
  });

  it('restores a mutation that failed halfway through being applied', async () => {
    await expect(
      withMutation(
        guard.journal,
        apiTarget(first).target,
        () => {
          stub(first);
          psql(
            `grant execute on function ${apiTarget(first).target} to authenticated`,
          );
          throw new Error('apply failed after the stub and the grant');
        },
        () => Promise.resolve(),
      ),
    ).rejects.toThrow('apply failed');
    expect(catalogFingerprint()).toBe(baseline);
    expect(
      psql(
        `select has_function_privilege('authenticated', '${apiTarget(first).target}'::regprocedure, 'execute')`,
      ),
    ).toBe('f');
  });

  it('restores an ACL-only mutation exactly (the grant, not the body)', async () => {
    await withMutation(
      guard.journal,
      apiTarget(second).target,
      () => {
        psql(
          `grant execute on function ${apiTarget(second).target} to authenticated, anon`,
        );
      },
      () => Promise.resolve(),
    );
    expect(catalogFingerprint()).toBe(baseline);
  });

  it('stops a body whose test timed out before it mutates again, and restores what it held', async () => {
    let mutations = 0;
    const running = guard.run(60_000, async () => {
      for (const name of ENTRIES) {
        guard.checkpoint(name);
        await withMutation(
          guard.journal,
          apiTarget(name).target,
          () => {
            stub(name);
          },
          async () => {
            mutations += 1;
            await sleep(1_500);
          },
        );
      }
    });
    const outcome = running.then(
      () => 'finished',
      (error: unknown) => error,
    );
    await until(() => mutations === 1);
    // The test "times out" here: nothing awaits `running`. This is the afterEach hook.
    expect(guard.journal.open).toEqual([apiTarget(first).target]);
    await guard.settle(30_000);
    expect(mutations).toBe(1);
    expect(await outcome).toBeInstanceOf(MutationAborted);
    expect(guard.journal.open).toEqual([]);
    expect(catalogFingerprint()).toBe(baseline);
    expect([isStubbed(first), isStubbed(second), isStubbed(third)]).toEqual([
      false,
      false,
      false,
    ]);
  });

  it('stops a body that is past its own deadline at the next checkpoint', async () => {
    let mutations = 0;
    await expect(
      guard.run(200, async () => {
        for (const name of ENTRIES) {
          guard.checkpoint(name);
          await withMutation(
            guard.journal,
            apiTarget(name).target,
            () => {
              stub(name);
            },
            async () => {
              mutations += 1;
              await sleep(400);
            },
          );
        }
      }),
    ).rejects.toBeInstanceOf(MutationAborted);
    expect(mutations).toBe(1);
    expect(catalogFingerprint()).toBe(baseline);
  });

  it('reports a catalog that changed behind the journal instead of trusting it', async () => {
    const snapshot = snapshotFunction(apiTarget(third).target);
    stub(third);
    try {
      await expect(guard.settle()).rejects.toThrow(
        /differs from the baseline/u,
      );
    } finally {
      expect(restoreFunction(snapshot)).toBe(true);
    }
    expect(catalogFingerprint()).toBe(baseline);
  });
});
