/**
 * SEC-1 mutation test: removing the claims gate from ANY listed function MUST make
 * the manifest checks fail for that entry. (Codex R14 and R14c2: the first oracle
 * derived its targets from the function bodies, so a function that lost its gate
 * silently left the test set; the second mutation test covered two functions.)
 *
 * Two kinds of mutation, both committed to the live database (PostgREST serves
 * it from other connections, so a rolled-back transaction would be invisible to
 * it) and restored in a `finally` that is verified:
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
 * If the process is killed between mutate and restore, run `pnpm db:reset`
 * (every suite in this directory requires a reset anyway).
 *
 * Run right after `pnpm db:reset`; it shares the fixtures of
 * claim-gate-manifest.apispec.ts.
 */
import { beforeAll, describe, expect, it } from 'vitest';

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
import { type GateWorld, prepareGateWorld } from './support/claim-gate-world';
import { type ApiFunction, listApiFunctions, psql } from './support/stack';

let world: GateWorld;

beforeAll(() => {
  world = prepareGateWorld();
});

type Original = Readonly<{ definition: string; signature: string }>;

const originalOf = (name: string): Original => {
  const row = psql(`
    select pg_get_function_arguments(p.oid) || chr(31)
           || replace(pg_get_functiondef(p.oid), chr(10), chr(30))
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'platform_api' and p.proname = '${name}'`);
  const [signature = '', definition = ''] = row.split('\u001f');
  return { signature, definition: definition.replaceAll('\u001e', '\n') };
};

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

const mutateEntry = async (
  name: string,
  functions: readonly ApiFunction[],
): Promise<
  Readonly<{ drift: readonly string[]; behaviour: readonly string[] }>
> => {
  const original = originalOf(name);
  const ungranted = CLAIM_GATED_API_FUNCTIONS[name] === 'ungranted';
  if (ungranted) psql(`grant execute on function platform_api.${name} to anon`);
  else
    // A gate-less stub of the same signature: it reads no claim and acts for anyone.
    psql(`create or replace function platform_api.${name}(${original.signature})
          returns jsonb language sql security definer set search_path = ''
          as $stub$ select '{}'::jsonb $stub$`);
  try {
    const mutated = listApiFunctions();
    return {
      drift: driftFindings(manifestDrift(mutated)),
      behaviour: await gateBehaviourFailures(mutated, world, [name]),
    };
  } finally {
    if (ungranted)
      psql(`revoke execute on function platform_api.${name} from anon`);
    else psql(original.definition);
    void functions;
  }
};

const functionDefinition = (qualified: string): string =>
  psql(
    `select replace(pg_get_functiondef('${qualified}'::regprocedure), chr(10), chr(30))`,
  ).replaceAll('\u001e', '\n');

const runHelperMutant = async (
  mutant: HelperMutant,
): Promise<readonly string[]> => {
  const original = functionDefinition(mutant.target);
  const mutated = mutant.mutate(original);
  expect(mutated, `${mutant.name} must change the definition`).not.toBe(
    original,
  );
  psql(mutated);
  try {
    return await gateBehaviourFailures(listApiFunctions(), world);
  } finally {
    psql(original);
  }
};

describe('SEC-1 deleting a claims gate fails the manifest checks, for every entry', () => {
  const names = Object.keys(CLAIM_GATED_API_FUNCTIONS).sort();

  it('starts from a clean baseline', async () => {
    const functions = listApiFunctions();
    expect(driftFindings(manifestDrift(functions))).toEqual([]);
    expect(await gateBehaviourFailures(functions, world)).toEqual([]);
  });

  it(`mutates all ${String(names.length)} manifest entries and each one is caught by drift and by its own behaviour probes`, async () => {
    const functions = listApiFunctions();
    const uncaught: string[] = [];
    let caught = 0;
    for (const name of names) {
      const mutated = await mutateEntry(name, functions);
      const named = mutated.drift.some((line) => line.startsWith(`${name}: `));
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
    const restored = listApiFunctions();
    expect(driftFindings(manifestDrift(restored))).toEqual([]);
    expect(await gateBehaviourFailures(restored, world)).toEqual([]);
  }, 900_000);
});

describe('SEC-1 weakening a shared gate fails exactly the entries that rely on it', () => {
  it.each(HELPER_MUTANTS.map((mutant) => [mutant.name, mutant] as const))(
    '%s',
    async (_name, mutant) => {
      const failures = await runHelperMutant(mutant);
      const expected = [...mutant.expected()].sort();
      const failing = [
        ...new Set(failures.map((line) => line.split(': ')[0] ?? '')),
      ].sort();
      expect(failing).toEqual(expected);
      expect(failuresFor(failures, expected).length).toBe(failures.length);
      // The restore is real.
      expect(await gateBehaviourFailures(listApiFunctions(), world)).toEqual(
        [],
      );
    },
    300_000,
  );

  it('covers every actor family with at least one helper mutation', () => {
    const covered = new Set(
      HELPER_MUTANTS.flatMap((mutant) => mutant.families),
    );
    // The actorless service-principal entry resolves no caller, so no shared caller
    // helper can be weakened for it; its boundary is the service_role EXECUTE grant,
    // covered by the ACL mutant below (DEC-156).
    expect([...covered].sort()).toEqual(
      [...new Set(Object.values(CLAIM_ACTOR_FAMILY))]
        .filter((family) => family !== 'service-principal')
        .sort(),
    );
    expect(entriesOf([...covered]).length).toBe(
      Object.keys(CLAIM_GATED_API_FUNCTIONS).length - 1,
    );
  });
});

describe('SEC-1 the actorless service-principal boundary is the EXECUTE grant (DEC-156)', () => {
  const name = 'cms_execute_publication_schedule';

  it('widening the actorless execute grant to authenticated fails exactly that entry, then the ACL and every catalog body are restored', async () => {
    const before = listApiFunctions().find(
      (candidate) => candidate.name === name,
    );
    // Exact precondition: the function is service_role-only (anon and authenticated denied).
    expect(before).toMatchObject({
      anon: false,
      authenticated: false,
      serviceRole: true,
    });
    psql(
      `grant execute on function platform_api.${name}(jsonb) to authenticated`,
    );
    try {
      const failures = await gateBehaviourFailures(listApiFunctions(), world, [
        name,
      ]);
      expect(failures.length).toBeGreaterThan(0);
      expect(failures.every((line) => line.startsWith(`${name}: `))).toBe(true);
    } finally {
      psql(
        `revoke execute on function platform_api.${name}(jsonb) from authenticated`,
      );
    }
    // The restore is real: the grant is back and both checks are clean again, so no
    // catalog body and no ACL entry is left mutated.
    const restored = listApiFunctions();
    expect(restored.find((candidate) => candidate.name === name)).toMatchObject(
      {
        anon: false,
        authenticated: false,
        serviceRole: true,
      },
    );
    expect(driftFindings(manifestDrift(restored))).toEqual([]);
    expect(await gateBehaviourFailures(restored, world)).toEqual([]);
  }, 120_000);
});
