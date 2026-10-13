import type { PreflightEvidence } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  AsyncRpcDependencyError,
  AsyncRpcRefusalError,
} from './async-runtime-support';
import {
  EVIDENCE_REEXECUTIONS_MAX,
  EVIDENCE_STALE_REFUSAL,
  executeWithFreshEvidence,
  isStaleEvidenceRefusal,
} from './cms-publication-schedule-sweep-evidence';

/*
 * The bounded recomputation policy of the CMS-03B-20 sweep, without any transport: the database's
 * `preflight_evidence_stale` refusal (a rolled-back execution) earns a fresh proof and another execution of the
 * same claim, at most EVIDENCE_REEXECUTIONS_MAX more times and never once the job deadline has passed; everything
 * else is thrown unchanged.
 */

const proof = (label: string): PreflightEvidence =>
  ({ inputHash: label }) as unknown as PreflightEvidence;
const stale = () => new AsyncRpcRefusalError(EVIDENCE_STALE_REFUSAL);

const harness = (signal = new AbortController().signal) => {
  let proofs = 0;
  const prove = vi.fn(async () => proof(`proof-${(proofs += 1)}`));
  const onStale = vi.fn();
  return { signal, prove, onStale };
};

describe('executeWithFreshEvidence', () => {
  it('is three executions in all: the first proof plus at most two recomputations', () => {
    expect(EVIDENCE_REEXECUTIONS_MAX).toBe(2);
  });

  it('executes once with the first proof when the database accepts it', async () => {
    const h = harness();
    const execute = vi.fn(async (evidence: PreflightEvidence | null) => ({
      evidence,
    }));
    await expect(executeWithFreshEvidence({ ...h, execute })).resolves.toEqual({
      evidence: proof('proof-1'),
    });
    expect(h.prove).toHaveBeenCalledTimes(1);
    expect(h.onStale).not.toHaveBeenCalled();
  });

  it('hands each execution its own freshly computed proof and numbers the recomputations from 1', async () => {
    const h = harness();
    const seen: (PreflightEvidence | null)[] = [];
    const execute = vi.fn(async (evidence: PreflightEvidence | null) => {
      seen.push(evidence);
      if (seen.length < 3) throw stale();
      return 'done';
    });
    await expect(executeWithFreshEvidence({ ...h, execute })).resolves.toBe(
      'done',
    );
    expect(seen).toEqual([
      proof('proof-1'),
      proof('proof-2'),
      proof('proof-3'),
    ]);
    expect(h.onStale.mock.calls).toEqual([[1], [2]]);
  });

  it('throws the last stale refusal unchanged once the bound is spent', async () => {
    const h = harness();
    const last = stale();
    let calls = 0;
    const execute = vi.fn(async () => {
      calls += 1;
      throw calls === 3 ? last : stale();
    });
    await expect(executeWithFreshEvidence({ ...h, execute })).rejects.toBe(
      last,
    );
    expect(execute).toHaveBeenCalledTimes(3);
    expect(h.prove).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['another refusal token', () => new AsyncRpcRefusalError('CONFLICT')],
    ['a plain http_error', () => new AsyncRpcDependencyError('http_error')],
    ['a timeout', () => new AsyncRpcDependencyError('timeout')],
    ['a foreign error', () => new Error('boom')],
  ])('throws %s unchanged without recomputing', async (_name, failure) => {
    const h = harness();
    const error = failure();
    const execute = vi.fn(async () => {
      throw error;
    });
    await expect(executeWithFreshEvidence({ ...h, execute })).rejects.toBe(
      error,
    );
    expect(execute).toHaveBeenCalledTimes(1);
    expect(h.prove).toHaveBeenCalledTimes(1);
    expect(h.onStale).not.toHaveBeenCalled();
  });

  it('does not recompute when the job deadline has already passed', async () => {
    const controller = new AbortController();
    const h = harness(controller.signal);
    const refused = stale();
    const execute = vi.fn(async () => {
      controller.abort();
      throw refused;
    });
    await expect(executeWithFreshEvidence({ ...h, execute })).rejects.toBe(
      refused,
    );
    expect(execute).toHaveBeenCalledTimes(1);
    expect(h.prove).toHaveBeenCalledTimes(1);
    expect(h.onStale).not.toHaveBeenCalled();
  });

  it('does not execute again when the deadline passes while the proof is recomputed', async () => {
    const controller = new AbortController();
    let proofs = 0;
    const prove = vi.fn(async () => {
      proofs += 1;
      if (proofs === 2) controller.abort();
      return proof(`proof-${proofs}`);
    });
    const refused = stale();
    const execute = vi.fn(async () => {
      throw refused;
    });
    const onStale = vi.fn();
    await expect(
      executeWithFreshEvidence({
        signal: controller.signal,
        prove,
        execute,
        onStale,
      }),
    ).rejects.toBe(refused);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(onStale).toHaveBeenCalledTimes(1);
  });

  it('sends a null proof through when the checker could not produce one', async () => {
    const execute = vi.fn(async (evidence: PreflightEvidence | null) => {
      if (evidence !== null) throw stale();
      return 'unavailable';
    });
    let proofs = 0;
    const prove = vi.fn(async () => (proofs++ === 0 ? proof('first') : null));
    await expect(
      executeWithFreshEvidence({
        signal: new AbortController().signal,
        prove,
        execute,
        onStale: vi.fn(),
      }),
    ).resolves.toBe('unavailable');
  });

  it('recognises only the stale token on a typed refusal', () => {
    expect(isStaleEvidenceRefusal(stale())).toBe(true);
    expect(isStaleEvidenceRefusal(new AsyncRpcRefusalError('CONFLICT'))).toBe(
      false,
    );
    expect(
      isStaleEvidenceRefusal(new AsyncRpcDependencyError('http_error')),
    ).toBe(false);
    expect(isStaleEvidenceRefusal(null)).toBe(false);
  });
});
