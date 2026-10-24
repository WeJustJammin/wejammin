import { describe, expect, it, vi } from 'vitest';

import type { AsyncWorkerBindings } from './async-entrypoint';
import type { AsyncRpcClient } from './async-runtime-rpc-types';
import {
  claimDueGovernedActivations,
  CmsGovernedActivationResponseError,
  executeClaimedGovernedActivation,
} from './cms-governed-activation-rpc';

/*
 * The CMS-03C-19 port validates both replies against the strict contract, so a malformed or oversized claim
 * list and a result for another schedule are contract faults, never partial work. The execute operand is the
 * IMMUTABLE REVIEW version the claim carries (`expectedVersion`), not CMS-03B-20's advancing `scheduleVersion`
 * (governed-b `## RPC boundary` item 3).
 */

const env = {} as unknown as AsyncWorkerBindings;
const claim = {
  scheduleId: '123e4567-e89b-42d3-a456-426614174000',
  reviewId: '123e4567-e89b-42d3-a456-426614174001',
  subjectKind: 'template_version',
  subjectId: '123e4567-e89b-42d3-a456-426614174005',
  scheduleVersion: '4',
  expectedVersion: '2',
  leaseId: '123e4567-e89b-42d3-a456-426614174002',
  correlationId: '123e4567-e89b-42d3-a456-426614174003',
} as const;
const rpcReturning = (reply: unknown) =>
  vi.fn(async () => reply) as unknown as AsyncRpcClient &
    ReturnType<typeof vi.fn>;

describe('claimDueGovernedActivations', () => {
  it('posts the bounded batch as one JSON request and returns the strict claims', async () => {
    const rpc = rpcReturning([claim]);
    expect(await claimDueGovernedActivations(rpc, env, 25)).toEqual([claim]);
    expect(rpc).toHaveBeenCalledWith(
      env,
      'cms_claim_due_governed_activations',
      { p_request: { batch: 25 } },
      undefined,
    );
  });

  it('accepts an empty claim and forwards the abort signal', async () => {
    const rpc = rpcReturning([]);
    const signal = new AbortController().signal;
    expect(await claimDueGovernedActivations(rpc, env, 1, signal)).toEqual([]);
    expect(rpc.mock.calls[0]![3]).toBe(signal);
  });

  it.each([1, 100])('accepts the batch bound %i', async (batch) => {
    const rpc = rpcReturning([]);
    await claimDueGovernedActivations(rpc, env, batch);
    expect(
      (rpc.mock.calls[0]![2] as { p_request: { batch: number } }).p_request,
    ).toEqual({ batch });
  });

  it.each([0, 101, 2.5, -1, Number.NaN])(
    'refuses the batch %s before any RPC',
    async (batch) => {
      const rpc = rpcReturning([]);
      await expect(
        claimDueGovernedActivations(rpc, env, batch),
      ).rejects.toBeInstanceOf(RangeError);
      expect(rpc).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['a non-list reply', { rows: [] }],
    ['a claim with an extra member', [{ ...claim, content: 'x' }]],
    ['a claim missing its lease', [{ ...claim, leaseId: undefined }]],
    ['a claim of an unknown subject kind', [{ ...claim, subjectKind: 'page' }]],
    [
      'a 03b claim (revision, hashes)',
      [{ ...claim, revisionId: claim.reviewId }],
    ],
    ['a repeated schedule', [claim, claim]],
    [
      'more claims than requested',
      [claim, { ...claim, scheduleId: '123e4567-e89b-42d3-a456-426614174009' }],
    ],
  ])('refuses %s as a contract fault', async (_name, reply) => {
    await expect(
      claimDueGovernedActivations(rpcReturning(reply), env, 1),
    ).rejects.toBeInstanceOf(CmsGovernedActivationResponseError);
  });
});

describe('executeClaimedGovernedActivation', () => {
  const completed = {
    scheduleId: claim.scheduleId,
    outcome: 'completed',
    reasonCode: null,
    actualUtc: '2026-11-01T14:30:01Z',
    deviationSeconds: 1,
  };

  it('executes with the claimed REVIEW version and the lease, and no other member', async () => {
    const rpc = rpcReturning(completed);
    expect(await executeClaimedGovernedActivation(rpc, env, claim)).toEqual(
      completed,
    );
    expect(rpc).toHaveBeenCalledWith(
      env,
      'cms_execute_governed_activation',
      {
        p_request: {
          scheduleId: claim.scheduleId,
          expectedVersion: '2',
          leaseId: claim.leaseId,
        },
      },
      undefined,
    );
  });

  it('never sends the schedule row version (03b operand) as the expected version', async () => {
    const rpc = rpcReturning(completed);
    await executeClaimedGovernedActivation(rpc, env, {
      ...claim,
      scheduleVersion: '99',
      expectedVersion: '7',
    });
    const request = (
      rpc.mock.calls[0]![2] as { p_request: Record<string, unknown> }
    ).p_request;
    expect(request.expectedVersion).toBe('7');
    expect(JSON.stringify(request)).not.toContain('99');
  });

  it.each([
    ['completed', completed],
    ['already_completed', { ...completed, outcome: 'already_completed' }],
    [
      'failed_retryable',
      {
        ...completed,
        outcome: 'failed_retryable',
        actualUtc: null,
        deviationSeconds: null,
      },
    ],
    [
      'blocked',
      {
        ...completed,
        outcome: 'blocked',
        reasonCode: 'retries_exhausted',
        actualUtc: null,
        deviationSeconds: null,
      },
    ],
  ])('accepts the %s outcome', async (_outcome, reply) => {
    expect(
      await executeClaimedGovernedActivation(rpcReturning(reply), env, claim),
    ).toEqual(reply);
  });

  it.each([
    [
      'a result for another schedule',
      { ...completed, scheduleId: claim.leaseId },
    ],
    ['an unknown outcome', { ...completed, outcome: 'cancelled' }],
    ['a blocked result without a reason', { ...completed, outcome: 'blocked' }],
    [
      'a blocked result with a reason outside the closed set',
      { ...completed, outcome: 'blocked', reasonCode: 'preflight_failed' },
    ],
    [
      'a completed result without its instant',
      { ...completed, actualUtc: null },
    ],
    [
      'a publication-style member',
      { ...completed, publicationVersionId: null },
    ],
    ['a non-object reply', null],
  ])('refuses %s as a contract fault', async (_name, reply) => {
    await expect(
      executeClaimedGovernedActivation(rpcReturning(reply), env, claim),
    ).rejects.toBeInstanceOf(CmsGovernedActivationResponseError);
  });
});
