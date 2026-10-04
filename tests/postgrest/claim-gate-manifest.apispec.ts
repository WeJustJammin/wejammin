/**
 * SEC-1 manifest suite: the checked-in list of claim-gated `platform_api`
 * functions equals the catalog exactly, and every listed function is exercised
 * through the real Kong -> PostgREST path whatever its current body says.
 *
 * Replaces the earlier oracle that derived its targets from the function bodies,
 * which let a function drop out of the test set by losing its gate (Codex R14).
 * Reset requirements are those of authority-gate.apispec.ts: run right after
 * `pnpm db:reset` (it commits two auth users and a release principal).
 */
import { randomUUID } from 'node:crypto';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  catalogClaimReaders,
  driftFindings,
  gateBehaviourFailures,
  gateFromGrants,
  manifestDrift,
  type GateContext,
} from './support/claim-gate-check';
import {
  CLAIM_GATED_API_FUNCTIONS,
  type ClaimGate,
} from './support/claim-gate-manifest';
import {
  type ApiFunction,
  bodyFor,
  callRpc,
  createAuthUser,
  listApiFunctions,
  psql,
  userToken,
} from './support/stack';

const RELEASE_KEY = 'apigate-release-key';
let functions: readonly ApiFunction[] = [];
let context: GateContext;

beforeAll(() => {
  const releasePrincipal = createAuthUser(randomUUID());
  psql(`insert into platform_private.cfg_release_principals(principal_id, key_id)
        values ('${releasePrincipal}', '${RELEASE_KEY}') on conflict do nothing`);
  functions = listApiFunctions();
  context = {
    attacker: createAuthUser(randomUUID()),
    victim: createAuthUser(randomUUID()),
    ghost: '00000000-0000-4000-8000-0000000000ff',
    releaseKey: RELEASE_KEY,
  };
});

describe('SEC-1 claim-gate manifest equals the catalog', () => {
  it('lists every claim-reading platform_api function and no other', () => {
    expect(driftFindings(manifestDrift(functions))).toEqual([]);
  });

  it('names a gate class per entry that agrees with the EXECUTE grants', () => {
    const mismatched = Object.entries(CLAIM_GATED_API_FUNCTIONS).filter(
      ([name, gate]) => {
        const fn = functions.find((candidate) => candidate.name === name);
        return fn === undefined || gateFromGrants(fn) !== gate;
      },
    );
    expect(mismatched).toEqual([]);
    const classes = new Set<ClaimGate>(
      Object.values(CLAIM_GATED_API_FUNCTIONS),
    );
    expect([...classes].sort()).toEqual([
      'authenticated-subject',
      'public-subject',
      'service-role',
      'subject-or-service',
      'ungranted',
    ]);
  });

  it('keeps the manifest large enough that a mass deletion cannot pass as equality', () => {
    const names = Object.keys(CLAIM_GATED_API_FUNCTIONS);
    expect(names.length).toBeGreaterThanOrEqual(90);
    expect(
      names.filter(
        (name) => CLAIM_GATED_API_FUNCTIONS[name] === 'service-role',
      ),
    ).not.toHaveLength(0);
  });

  it('reports each kind of drift against a synthetic catalog', () => {
    const real = catalogClaimReaders();
    const dropped = [...real].filter((name) => name !== 'cms_create_entry');
    expect(
      manifestDrift(functions, new Set([...dropped, 'brand_new_reader'])),
    ).toMatchObject({
      unlisted: ['brand_new_reader'],
      noLongerClaimReading: ['cms_create_entry'],
    });
    const absent = functions.filter((fn) => fn.name !== 'cms_create_entry');
    expect(manifestDrift(absent, real).absent).toEqual(['cms_create_entry']);
    const regranted = functions.map((fn) =>
      fn.name === 'cms_create_entry' ? { ...fn, anon: true } : fn,
    );
    expect(manifestDrift(regranted, real).gateMismatch).toHaveLength(1);
  });
});

describe('SEC-1 every manifest entry is exercised through the real API', () => {
  it('each listed function enforces its gate (independent of its current body)', async () => {
    const failures = await gateBehaviourFailures(functions, context);
    expect(failures).toEqual([]);
  });

  it('refuses a ghost subject with UNAUTHENTICATED on at least 25 authenticated entries', async () => {
    const authenticated = Object.entries(CLAIM_GATED_API_FUNCTIONS)
      .filter(
        ([, gate]) =>
          gate === 'authenticated-subject' || gate === 'subject-or-service',
      )
      .map(([name]) => name);
    expect(authenticated.length).toBeGreaterThanOrEqual(25);
    let refused = 0;
    for (const name of authenticated) {
      const fn = functions.find((candidate) => candidate.name === name);
      if (fn === undefined) throw new Error(`${name} is not exposed`);
      const outcome = await callRpc(
        name,
        userToken(context.ghost),
        bodyFor(fn, { authUserId: context.victim }),
      );
      if (outcome.status === 400 && outcome.message === 'UNAUTHENTICATED')
        refused += 1;
    }
    expect(refused).toBeGreaterThanOrEqual(25);
  });
});
