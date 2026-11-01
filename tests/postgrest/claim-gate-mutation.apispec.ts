/**
 * SEC-1 mutation test: removing the claims gate from ANY listed function MUST make
 * the manifest checks fail for that entry. (Codex R14 and R14c2: the first oracle
 * derived its targets from the function bodies, so a function that lost its gate
 * silently left the test set; the second mutation test covered two functions.)
 *
 * Two kinds of mutation, both committed to the live database (PostgREST serves
 * it from other connections, so a rolled-back transaction would be invisible to
 * it):
 *
 *  - ENTRY mutation, for EVERY manifest entry: the function is replaced by a
 *    gate-less stub of the same signature that reads no claim and acts for
 *    anyone. The drift check must name the entry and its own behaviour probes
 *    must fail. An entry no API role may execute (`ungranted`) has no claim gate
 *    an API caller can reach, so its mutation is the grant it must never have
 *    (EXECUTE for anon), which the denial probes must catch.
 *  - HELPER mutation, for each helper that resolves the caller: the shared gate
 *    is weakened in place (forged context accepted, existence check dropped, role
 *    check dropped or reading the legacy claim GUC PostgREST never sets) and
 *    EXACTLY the entries that rely on it must fail, no more and no fewer.
 *
 * Restoration does not depend on how a test ends (support/claim-gate-restore.ts).
 * Every function is snapshotted into a journal BEFORE it is mutated; the `finally`
 * of `withMutation` restores and verifies it; a body past its own deadline or whose
 * test timed out stops at its next checkpoint instead of mutating further (vitest
 * does not cancel a timed-out body); and `afterEach` waits for the body to unwind,
 * restores anything still journaled and then compares a fingerprint of EVERY
 * function of the gate schemas with the baseline taken before the first mutation.
 *
 * If the process is killed between mutate and restore, run `pnpm db:reset`
 * (every suite in this directory requires a reset anyway).
 *
 * Run right after `pnpm db:reset`; it shares the fixtures of
 * claim-gate-manifest.apispec.ts.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  driftFindings,
  gateBehaviourFailures,
  manifestDrift,
} from './support/claim-gate-check';
import {
  CLAIM_ACTOR_FAMILY,
  CLAIM_GATED_API_FUNCTIONS,
  type ActorFamily,
} from './support/claim-gate-manifest';
import {
  HELPER_MUTANTS,
  type HelperMutant,
} from './support/claim-gate-mutants';
import {
  apiTarget,
  catalogFingerprint,
  MutationGuard,
  withMutation,
} from './support/claim-gate-restore';
import { type GateWorld, prepareGateWorld } from './support/claim-gate-world';
import { listApiFunctions, psql } from './support/stack';

let world: GateWorld;
let baseline = '';
const guard = new MutationGuard();

/** Test budgets (ms). A body stops itself `DEADLINE_MARGIN_MS` before vitest's own timeout fires. */
const ENTRIES_TIMEOUT_MS = 900_000;
const HELPER_TIMEOUT_MS = 300_000;
const ACL_TIMEOUT_MS = 120_000;
const DEADLINE_MARGIN_MS = 30_000;
const SETTLE_TIMEOUT_MS = 180_000;

beforeAll(() => {
  world = prepareGateWorld();
  baseline = guard.baseline();
});

// Whatever ended the test (pass, assertion, throw, timeout): nothing stays mutated.
afterEach(async () => {
  await guard.settle();
}, SETTLE_TIMEOUT_MS);

afterAll(async () => {
  await guard.settle();
  expect(catalogFingerprint()).toBe(baseline);
}, SETTLE_TIMEOUT_MS);

const failuresFor = (
  failures: readonly string[],
  names: readonly string[],
): readonly string[] =>
  failures.filter((line) => names.some((name) => line.startsWith(`${name}: `)));

const entriesOf = (families: readonly ActorFamily[]): string[] =>
  Object.keys(CLAIM_GATED_API_FUNCTIONS).filter((name) => {
    const family = CLAIM_ACTOR_FAMILY[name];
    return family !== undefined && families.includes(family);
  });

const mutateEntry = (
  name: string,
): Promise<
  Readonly<{ drift: readonly string[]; behaviour: readonly string[] }>
> => {
  const ungranted = CLAIM_GATED_API_FUNCTIONS[name] === 'ungranted';
  const { target, signature } = apiTarget(name);
  return withMutation(
    guard.journal,
    target,
    () => {
      if (ungranted)
        psql(`grant execute on function platform_api.${name} to anon`);
      else
        // A gate-less stub of the same signature: it reads no claim and acts for anyone.
        psql(`create or replace function platform_api.${name}(${signature})
              returns jsonb language sql security definer set search_path = ''
              as $stub$ select '{}'::jsonb $stub$`);
    },
    async () => {
      const mutated = listApiFunctions();
      return {
        drift: driftFindings(manifestDrift(mutated)),
        behaviour: await gateBehaviourFailures(mutated, world, [name]),
      };
    },
  );
};

const runHelperMutant = (mutant: HelperMutant): Promise<readonly string[]> =>
  withMutation(
    guard.journal,
    mutant.target,
    (original) => {
      const mutated = mutant.mutate(original.definition);
      expect(mutated, `${mutant.name} must change the definition`).not.toBe(
        original.definition,
      );
      psql(mutated);
    },
    () => gateBehaviourFailures(listApiFunctions(), world),
  );

describe('SEC-1 deleting a claims gate fails the manifest checks, for every entry', () => {
  const names = Object.keys(CLAIM_GATED_API_FUNCTIONS).sort();

  it('starts from a clean baseline', async () => {
    const functions = listApiFunctions();
    expect(driftFindings(manifestDrift(functions))).toEqual([]);
    expect(await gateBehaviourFailures(functions, world)).toEqual([]);
  });

  it(
    `mutates all ${String(names.length)} manifest entries and each one is caught by drift and by its own behaviour probes`,
    async () => {
      await guard.run(ENTRIES_TIMEOUT_MS - DEADLINE_MARGIN_MS, async () => {
        const uncaught: string[] = [];
        let caught = 0;
        for (const name of names) {
          guard.checkpoint(name);
          const mutated = await mutateEntry(name);
          const named = mutated.drift.some((line) =>
            line.startsWith(`${name}: `),
          );
          const failing = mutated.behaviour.length > 0;
          const ownOnly = mutated.behaviour.every((line) =>
            line.startsWith(`${name}: `),
          );
          if (named && failing && ownOnly) caught += 1;
          else
            uncaught.push(
              `${name}: drift=${String(named)} behaviour=${String(mutated.behaviour.length)} ownOnly=${String(ownOnly)}`,
            );
        }
        expect(uncaught).toEqual([]);
        expect(caught).toBe(names.length);
        // Every restore is real: the original gates are back, so both checks are clean.
        expect(guard.journal.open).toEqual([]);
        expect(catalogFingerprint()).toBe(baseline);
        const restored = listApiFunctions();
        expect(driftFindings(manifestDrift(restored))).toEqual([]);
        expect(await gateBehaviourFailures(restored, world)).toEqual([]);
      });
    },
    ENTRIES_TIMEOUT_MS,
  );
});

describe('SEC-1 weakening a shared gate fails exactly the entries that rely on it', () => {
  it.each(HELPER_MUTANTS.map((mutant) => [mutant.name, mutant] as const))(
    '%s',
    async (_name, mutant) => {
      await guard.run(HELPER_TIMEOUT_MS - DEADLINE_MARGIN_MS, async () => {
        guard.checkpoint(mutant.name);
        const failures = await runHelperMutant(mutant);
        const expected = [...mutant.expected()].sort();
        const failing = [
          ...new Set(failures.map((line) => line.split(': ')[0] ?? '')),
        ].sort();
        expect(failing).toEqual(expected);
        expect(failuresFor(failures, expected).length).toBe(failures.length);
        // The restore is real.
        expect(guard.journal.open).toEqual([]);
        expect(catalogFingerprint()).toBe(baseline);
        expect(await gateBehaviourFailures(listApiFunctions(), world)).toEqual(
          [],
        );
      });
    },
    HELPER_TIMEOUT_MS,
  );

  it('covers every actor family with at least one helper mutation', () => {
    const covered = new Set(
      HELPER_MUTANTS.flatMap((mutant) => mutant.families),
    );
    // An actorless service-principal entry resolves no caller, so no shared caller
    // helper can be weakened for it; its boundary is the service_role EXECUTE grant,
    // covered by the ACL mutants below (DEC-156).
    expect([...covered].sort()).toEqual(
      [...new Set(Object.values(CLAIM_ACTOR_FAMILY))]
        .filter((family) => family !== 'service-principal')
        .sort(),
    );
    expect(entriesOf([...covered]).length).toBe(
      Object.keys(CLAIM_GATED_API_FUNCTIONS).length -
        entriesOf(['service-principal']).length,
    );
  });
});

describe('SEC-1 the actorless service-principal boundary is the EXECUTE grant (DEC-156)', () => {
  it.each(entriesOf(['service-principal']).sort())(
    'widening the actorless execute grant of %s to authenticated fails exactly that entry, then the ACL and every catalog body are restored',
    async (name) => {
      await guard.run(ACL_TIMEOUT_MS - DEADLINE_MARGIN_MS, async () => {
        guard.checkpoint(name);
        const before = listApiFunctions().find(
          (candidate) => candidate.name === name,
        );
        // Exact precondition: the function is service_role-only (anon and authenticated denied).
        expect(before).toMatchObject({
          anon: false,
          authenticated: false,
          serviceRole: true,
        });
        const failures = await withMutation(
          guard.journal,
          apiTarget(name).target,
          () => {
            psql(
              `grant execute on function platform_api.${name}(jsonb) to authenticated`,
            );
          },
          () => gateBehaviourFailures(listApiFunctions(), world, [name]),
        );
        expect(failures.length).toBeGreaterThan(0);
        expect(failures.every((line) => line.startsWith(`${name}: `))).toBe(
          true,
        );
        // The restore is real: the grant is back and both checks are clean again, so no
        // catalog body and no ACL entry is left mutated.
        expect(guard.journal.open).toEqual([]);
        expect(catalogFingerprint()).toBe(baseline);
        const restored = listApiFunctions();
        expect(
          restored.find((candidate) => candidate.name === name),
        ).toMatchObject({
          anon: false,
          authenticated: false,
          serviceRole: true,
        });
        expect(driftFindings(manifestDrift(restored))).toEqual([]);
        expect(await gateBehaviourFailures(restored, world)).toEqual([]);
      });
    },
    ACL_TIMEOUT_MS,
  );
});
