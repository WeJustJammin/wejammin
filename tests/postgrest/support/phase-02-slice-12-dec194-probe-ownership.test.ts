import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createUnitHarness,
  type Binding,
  type UnitHarness,
} from './phase-02-slice-12-dec194-unit-test-support';

vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));
let harness: UnitHarness;
const foreign = (): Binding => ({
  oid: 9001,
  functionOid: 9002,
  functionSchema: 'unrelated_test_owner',
  functionName: 'preserved_job_hook',
});
const cleanup = (): unknown => {
  try {
    harness.stack.cleanupProbe();
    return undefined;
  } catch (error) {
    return error;
  }
};
beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      'Date',
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
    ],
  });
  vi.setSystemTime(new Date('2026-10-16T12:00:00Z'));
  harness = createUnitHarness(false);
});
afterEach(async () => {
  await harness?.drain();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('DEC194 private probe cleanup owns the exact catalog objects it deletes', () => {
  it('OWN-001 failed CREATE must not authorize deleting a pre-existing same-name jobs trigger', () => {
    const name = `${harness.stack.schema}_jobs`;
    const existing = foreign();
    harness.triggers.set(name, existing);
    harness.schemas.add(existing.functionSchema);
    expect(() => harness.stack.activateProbe()).toThrow(
      'DEC194 ALT command failed',
    );
    expect(harness.triggers.get(name)).toEqual(existing);
    cleanup();
    expect(
      harness.triggers.get(name),
      'failed acquisition is not trigger ownership',
    ).toEqual(existing);
    expect(harness.schemas.has(existing.functionSchema)).toBe(true);
    expect(harness.fetchBoundary).not.toHaveBeenCalled();
  });

  it('OWN-002 successful creation is insufficient after its actual function binding is replaced', () => {
    harness.stack.activateProbe();
    const name = `${harness.stack.schema}_jobs`;
    const created = harness.triggers.get(name)!;
    expect(created).toMatchObject({
      functionSchema: harness.stack.schema,
      functionName: 'observe_job',
    });
    const replacement = { ...foreign(), oid: created.oid };
    harness.triggers.set(name, replacement);
    harness.schemas.add(replacement.functionSchema);
    cleanup();
    expect(
      harness.triggers.get(name),
      'same trigger name/OID with foreign function must survive',
    ).toEqual(replacement);
    expect(harness.schemas.has(replacement.functionSchema)).toBe(true);
    expect(harness.fetchBoundary).not.toHaveBeenCalled();
  });

  it('OWN-003 schema cleanup must not CASCADE through an unowned trigger dependency', () => {
    harness.stack.activateProbe();
    const dependentName = 'unowned_other_jobs_observer';
    const dependency = {
      oid: 9101,
      functionOid: 42,
      functionSchema: harness.stack.schema,
      functionName: 'observe_job',
    };
    harness.triggers.set(dependentName, dependency);
    const failure = cleanup();
    expect(
      harness.triggers.get(dependentName),
      'an owned function does not confer ownership of its users',
    ).toEqual(dependency);
    expect(harness.schemas.has(harness.stack.schema)).toBe(true);
    expect(
      failure,
      'unsafe schema removal must fail closed and preserve the dependent object',
    ).toBeInstanceOf(Error);
    expect(harness.fetchBoundary).not.toHaveBeenCalled();
  });

  it('CONTROL successful CREATE permits deleting that unchanged owned trigger and schema only', () => {
    const neighbor = foreign();
    harness.triggers.set('other_owner_jobs_hook', neighbor);
    harness.schemas.add(neighbor.functionSchema);
    harness.stack.activateProbe();
    const name = `${harness.stack.schema}_jobs`;
    expect(harness.triggers.get(name)).toMatchObject({
      functionSchema: harness.stack.schema,
      functionName: 'observe_job',
    });
    expect(cleanup()).toBeUndefined();
    expect([...harness.triggers]).toEqual([
      ['other_owner_jobs_hook', neighbor],
    ]);
    expect([...harness.schemas]).toEqual([neighbor.functionSchema]);
    expect(
      harness.events.filter((event) => /^(create|drop)-/u.test(event)),
    ).toEqual(['create-trigger', 'drop-trigger', 'drop-schema']);
    expect(harness.fetchBoundary).not.toHaveBeenCalled();
  });

  it('CONTROL fixture-only teardown without activation preserves unrelated catalog objects', () => {
    const neighbor = foreign();
    harness.triggers.set('other_owner_jobs_hook', neighbor);
    harness.schemas.add(neighbor.functionSchema);
    expect(cleanup()).toBeUndefined();
    expect([...harness.triggers]).toEqual([
      ['other_owner_jobs_hook', neighbor],
    ]);
    expect([...harness.schemas]).toEqual([neighbor.functionSchema]);
    expect(harness.fetchBoundary).not.toHaveBeenCalled();
  });
});
