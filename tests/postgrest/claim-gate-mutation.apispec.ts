/**
 * SEC-1 mutation test: removing the claims gate from a listed function MUST make
 * the manifest checks fail. (Codex R14: the previous oracle derived its targets
 * from the function bodies, so a function that lost its gate silently left the
 * test set.)
 *
 * Each case replaces one listed function with a gate-less stub of the same
 * signature in the live database (the committed catalog, because PostgREST
 * serves it from other connections), proves `manifestDrift` and
 * `gateBehaviourFailures` both name that function, and restores the original
 * definition in a `finally`. The restore is verified: afterwards both checks
 * are clean again. If the process is killed between mutate and restore, run
 * `pnpm db:reset` (every suite in this directory requires a reset anyway).
 *
 * Run right after `pnpm db:reset`; it shares the fixtures of
 * claim-gate-manifest.apispec.ts.
 */
import { randomUUID } from 'node:crypto';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  driftFindings,
  gateBehaviourFailures,
  manifestDrift,
  type GateContext,
} from './support/claim-gate-check';
import { CLAIM_GATED_API_FUNCTIONS } from './support/claim-gate-manifest';
import {
  type ApiFunction,
  createAuthUser,
  listApiFunctions,
  psql,
} from './support/stack';

const RELEASE_KEY = 'apigate-release-key';
let context: GateContext;

beforeAll(() => {
  const principal = createAuthUser(randomUUID());
  psql(`insert into platform_private.cfg_release_principals(principal_id, key_id)
        values ('${principal}', '${RELEASE_KEY}') on conflict do nothing`);
  context = {
    attacker: createAuthUser(randomUUID()),
    victim: createAuthUser(randomUUID()),
    ghost: '00000000-0000-4000-8000-0000000000ff',
    releaseKey: RELEASE_KEY,
  };
});

type Original = Readonly<{
  definition: string;
  signature: string;
  result: string;
}>;

const originalOf = (name: string): Original => {
  const row = psql(`
    select pg_get_function_arguments(p.oid) || chr(31) || pg_get_function_result(p.oid)
           || chr(31) || replace(pg_get_functiondef(p.oid), chr(10), chr(30))
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'platform_api' and p.proname = '${name}'`);
  const [signature = '', result = '', definition = ''] = row.split('\u001f');
  return {
    signature,
    result,
    definition: definition.replaceAll('\u001e', '\n'),
  };
};

/** First manifest entry of the gate class that returns jsonb (a stub can mimic it). */
const target = (gate: string): string => {
  const candidate = Object.entries(CLAIM_GATED_API_FUNCTIONS)
    .filter(([, entryGate]) => entryGate === gate)
    .map(([name]) => name)
    .sort()
    .find((name) => originalOf(name).result === 'jsonb');
  if (candidate === undefined) throw new Error(`no jsonb ${gate} entry`);
  return candidate;
};

const mutateAndRestore = async (
  name: string,
  functions: readonly ApiFunction[],
): Promise<
  Readonly<{ drift: readonly string[]; behaviour: readonly string[] }>
> => {
  const original = originalOf(name);
  // A gate-less stub of the same signature: it reads no claim and acts for anyone.
  psql(`create or replace function platform_api.${name}(${original.signature})
        returns jsonb language sql security definer set search_path = ''
        as $stub$ select '{}'::jsonb $stub$`);
  try {
    return {
      drift: driftFindings(manifestDrift(functions)),
      behaviour: await gateBehaviourFailures(functions, context, [name]),
    };
  } finally {
    psql(original.definition);
  }
};

describe('SEC-1 deleting a claims gate fails the manifest checks', () => {
  it.each([['authenticated-subject'], ['service-role']])(
    'a %s function replaced by a gate-less stub is named by drift and by behaviour',
    async (gate) => {
      const functions = listApiFunctions();
      const name = target(gate);
      expect(driftFindings(manifestDrift(functions))).toEqual([]);
      expect(await gateBehaviourFailures(functions, context, [name])).toEqual(
        [],
      );

      const mutated = await mutateAndRestore(name, functions);
      expect(mutated.drift).toContain(
        `${name}: listed but no longer reads claims`,
      );
      expect(mutated.behaviour.length).toBeGreaterThan(0);
      expect(
        mutated.behaviour.every((line) => line.startsWith(`${name}: `)),
      ).toBe(true);

      // The restore is real: the original gate is back, so both checks are clean.
      expect(driftFindings(manifestDrift(listApiFunctions()))).toEqual([]);
      expect(
        await gateBehaviourFailures(listApiFunctions(), context, [name]),
      ).toEqual([]);
    },
  );
});
