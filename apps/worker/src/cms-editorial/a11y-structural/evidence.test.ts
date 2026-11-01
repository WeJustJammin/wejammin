import {
  PreflightEvidenceSchema,
  cmsPreflightEvidenceIsFresh,
  preflightResultForAccessibilityEvidence,
} from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  CLOCK_START,
  REVISION_ID,
  blockingInput,
  checkerInput,
  cleanInput,
  fieldNode,
  heading,
  hashOf,
  manualClock,
  richText,
  span,
} from './a11y-structural.test-support';
import { auditRecordOf, toPreflightEvidence } from './evidence';
import { evaluateAccessibilityGate, type AccessibilityGateRun } from './gate';
import { accessibilityBindingHash, accessibilityInputHash } from './hashes';
import type { AccessibilityCheckerInput } from './input-schema';

/** PreflightEvidence (BE03b) and the command audit record built from a gate run. */

const gateRun = (
  input: unknown,
  clock = manualClock(),
  signal?: AbortSignal,
): Promise<AccessibilityGateRun> =>
  evaluateAccessibilityGate({
    load: async () => ({ ok: true, input }),
    now: clock.now,
    ...(signal === undefined ? {} : { signal }),
  });

const completed = async (input: AccessibilityCheckerInput) => {
  const run = await gateRun(input);
  if (run.state === 'failed') throw new Error('expected a completed gate run');
  return run;
};

/** `fields` fields of 128 empty headings each: one heading.empty per block. */
const manyBlockers = (fields: number) =>
  checkerInput(
    Array.from({ length: fields }, (_u, index) =>
      fieldNode(
        index + 1,
        richText(...Array.from({ length: 128 }, () => heading(2, span(' ')))),
      ),
    ),
  );

describe('toPreflightEvidence', () => {
  it('builds healthy evidence bound to the revision and the dependency set', async () => {
    const input = cleanInput();
    const run = await gateRun(input);
    const evidence = await toPreflightEvidence(run);
    expect(evidence).toEqual({
      category: 'accessibility',
      providerKey: 'cms.a11y.structural',
      providerVersion: '1',
      outcome: 'healthy',
      blockingCount: 0,
      inputHash: await accessibilityInputHash(input),
      bindingHash: await accessibilityBindingHash({
        revisionId: REVISION_ID,
        revisionContentHash: hashOf(1),
        dependencyHash: hashOf(2),
      }),
      evaluatedAt: new Date(CLOCK_START).toISOString(),
    });
    expect(PreflightEvidenceSchema.safeParse(evidence).success).toBe(true);
  });

  it('maps healthy evidence to a passed result (DEC-150)', async () => {
    const evidence = await toPreflightEvidence(await gateRun(cleanInput()));
    expect(preflightResultForAccessibilityEvidence(evidence!)).toEqual({
      category: 'accessibility',
      outcome: 'passed',
      providerKey: 'cms.a11y.structural',
      providerVersion: '1',
      reasonCode: null,
      blockingCount: 0,
    });
  });

  it('builds blocked evidence and maps it to a failed blocking_finding result', async () => {
    const evidence = await toPreflightEvidence(await gateRun(blockingInput()));
    expect(evidence).toMatchObject({ outcome: 'blocked', blockingCount: 1 });
    expect(preflightResultForAccessibilityEvidence(evidence!)).toMatchObject({
      outcome: 'failed',
      reasonCode: 'blocking_finding',
      blockingCount: 1,
    });
  });

  it('binds to the dependency hash: a different manifest gives a different binding', async () => {
    const first = await toPreflightEvidence(await gateRun(cleanInput()));
    const second = await toPreflightEvidence(
      await gateRun({ ...cleanInput(), dependencyHash: hashOf(9) }),
    );
    expect(second?.bindingHash).not.toBe(first?.bindingHash);
    expect(second?.inputHash).toBe(first?.inputHash);
  });

  it.each([
    [
      'CHECKER_TIMEOUT',
      () => gateRun(cleanInput(), manualClock(), AbortSignal.abort()),
    ],
    [
      'CHECKER_DEPENDENCY_UNAVAILABLE',
      () =>
        evaluateAccessibilityGate({
          load: async () => ({
            ok: false,
            retryable: false,
            reason: 'dependency_unavailable',
          }),
          now: manualClock().now,
        }),
    ],
    ['TARGET_UNREADABLE', () => gateRun({ nodes: 'not an array' })],
  ] as const)(
    'returns null for a failed %s run: no binding to prove',
    async (code, make) => {
      const run = await make();
      expect(run).toMatchObject({ state: 'failed', failureCode: code });
      expect(await toPreflightEvidence(run)).toBeNull();
    },
  );

  it('is fresh enough for the RPC 60-second window when handed over at once', async () => {
    const clock = manualClock();
    const evidence = await toPreflightEvidence(
      await gateRun(cleanInput(), clock),
    );
    expect(
      cmsPreflightEvidenceIsFresh(evidence!.evaluatedAt, clock.now() + 59_000),
    ).toBe(true);
    expect(
      cmsPreflightEvidenceIsFresh(evidence!.evaluatedAt, clock.now() + 61_000),
    ).toBe(false);
  });

  it('bounds blockingCount at the contract maximum of 1000 while the run keeps the true total', async () => {
    const run = await completed(manyBlockers(10));
    expect(run.result).toMatchObject({ blockingCount: 1280, truncated: true });
    const evidence = await toPreflightEvidence(run);
    expect(evidence).toMatchObject({ outcome: 'blocked', blockingCount: 1000 });
    expect(PreflightEvidenceSchema.safeParse(evidence).success).toBe(true);
  });

  it('refuses to build evidence from an inconsistent run', async () => {
    const run = await completed(blockingInput());
    const inconsistent = { ...run, state: 'healthy' } as AccessibilityGateRun;
    await expect(toPreflightEvidence(inconsistent)).rejects.toThrow();
  });
});

describe('auditRecordOf', () => {
  it('stores exactly the checker key and version, outcome, blocking count and input hash', async () => {
    const run = await completed(blockingInput());
    expect(auditRecordOf(run)).toEqual({
      checkerKey: 'cms.a11y.structural',
      checkerVersion: '1',
      outcome: 'blocked',
      blockingCount: 1,
      inputHash: run.result.inputHash,
    });
    expect(Object.keys(auditRecordOf(run))).toEqual([
      'checkerKey',
      'checkerVersion',
      'outcome',
      'blockingCount',
      'inputHash',
    ]);
  });

  it('describes a healthy run with a zero count and no content', async () => {
    const run = await completed(cleanInput());
    const record = auditRecordOf(run);
    expect(record).toMatchObject({ outcome: 'healthy', blockingCount: 0 });
    expect(JSON.stringify(record)).not.toContain('Plan');
  });

  it('agrees with the evidence on the bounded blocking count', async () => {
    const run = await completed(manyBlockers(10));
    expect(auditRecordOf(run).blockingCount).toBe(1000);
  });
});
