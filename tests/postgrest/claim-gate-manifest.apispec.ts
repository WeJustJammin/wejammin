/**
 * SEC-1 manifest suite: the checked-in list of claim-gated `platform_api`
 * functions equals the catalog exactly, and every listed function is exercised
 * through the real Kong -> PostgREST path whatever its current body says, with a
 * VALID request that reaches the identity gate (support/claim-gate-fixtures*.ts):
 * exact UNAUTHENTICATED for ghost and forged subjects, exact permission errors for
 * roles that are not granted, and the function's own next outcome (or a success)
 * for a real caller. A request-validation refusal is never accepted as a gate
 * refusal.
 *
 * Replaces the earlier oracle that derived its targets from the function bodies,
 * which let a function drop out of the test set by losing its gate (Codex R14).
 * Reset requirements are those of authority-gate.apispec.ts: run right after
 * `pnpm db:reset` (it commits two auth users and a release principal).
 */
import { beforeAll, describe, expect, it } from 'vitest';

import {
  catalogClaimReaders,
  driftFindings,
  gateBehaviourFailures,
  gateFromGrants,
  manifestDrift,
  probesFor,
} from './support/claim-gate-check';
import {
  CLAIM_GATE_FIXTURES,
  duplicateFixtureNames,
} from './support/claim-gate-fixtures';
import {
  CLAIM_ACTOR_FAMILY,
  CLAIM_GATED_API_FUNCTIONS,
  type ClaimGate,
} from './support/claim-gate-manifest';
import { SUCCESS_CONTROLS } from './support/claim-gate-success';
import { type GateWorld, prepareGateWorld } from './support/claim-gate-world';
import { type ApiFunction, listApiFunctions } from './support/stack';

let functions: readonly ApiFunction[] = [];
let world: GateWorld;

beforeAll(() => {
  functions = listApiFunctions();
  world = prepareGateWorld();
});

const manifestNames = (): string[] => Object.keys(CLAIM_GATED_API_FUNCTIONS);

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
    const names = manifestNames();
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

describe('SEC-1 every manifest entry has a family and a valid request', () => {
  it('has exactly one family and one fixture for every manifest entry, and none for any other name', () => {
    const names = manifestNames().sort();
    expect(Object.keys(CLAIM_ACTOR_FAMILY).sort()).toEqual(names);
    expect(Object.keys(CLAIM_GATE_FIXTURES).sort()).toEqual(names);
    expect(duplicateFixtureNames()).toEqual([]);
  });

  it('lists a success control only for a manifest entry', () => {
    expect(
      Object.keys(SUCCESS_CONTROLS).filter(
        (name) => !manifestNames().includes(name),
      ),
    ).toEqual([]);
    expect(Object.keys(SUCCESS_CONTROLS).length).toBeGreaterThanOrEqual(7);
  });

  it('states a gate refusal (exact UNAUTHENTICATED) for a ghost subject on every entry that resolves a caller, never a validation refusal', () => {
    const missing: string[] = [];
    for (const name of manifestNames()) {
      const fn = functions.find((candidate) => candidate.name === name);
      const family = CLAIM_ACTOR_FAMILY[name];
      const fixture = CLAIM_GATE_FIXTURES[name];
      const gate = CLAIM_GATED_API_FUNCTIONS[name];
      if (
        fn === undefined ||
        family === undefined ||
        fixture === undefined ||
        gate === undefined ||
        gate === 'ungranted' ||
        family === 'release-worker'
      )
        continue;
      const refusals = probesFor(name, fn, gate, family, fixture, world).filter(
        (probe) => probe.expected === '400:UNAUTHENTICATED',
      );
      if (refusals.length === 0) missing.push(name);
      expect(
        probesFor(name, fn, gate, family, fixture, world).filter(
          (probe) =>
            probe.expected.endsWith(':INVALID_REQUEST') &&
            probe.label.includes('ghost'),
        ),
      ).toEqual([]);
    }
    expect(missing).toEqual([]);
  });
});

describe('SEC-1 every manifest entry is exercised through the real API', () => {
  it('each listed function enforces its gate with its valid request (independent of its current body)', async () => {
    const failures = await gateBehaviourFailures(functions, world);
    expect(failures).toEqual([]);
  });

  it('counts the exact refusals, controls and successes it asserted', async () => {
    let refusals = 0;
    let controls = 0;
    let successes = 0;
    for (const name of manifestNames()) {
      const fn = functions.find((candidate) => candidate.name === name);
      const family = CLAIM_ACTOR_FAMILY[name];
      const fixture = CLAIM_GATE_FIXTURES[name];
      const gate = CLAIM_GATED_API_FUNCTIONS[name];
      if (
        fn === undefined ||
        family === undefined ||
        fixture === undefined ||
        gate === undefined
      )
        continue;
      for (const probe of probesFor(name, fn, gate, family, fixture, world)) {
        if (probe.expected === '400:UNAUTHENTICATED') refusals += 1;
        else if (probe.expected === '200:') successes += 1;
        else controls += 1;
      }
    }
    expect(refusals).toBeGreaterThanOrEqual(85);
    expect(controls).toBeGreaterThanOrEqual(270);
    expect(successes).toBeGreaterThanOrEqual(8);
  });
});
