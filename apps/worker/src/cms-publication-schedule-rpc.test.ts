import { describe, expect, it, vi } from 'vitest';

import type { AsyncWorkerBindings } from './async-entrypoint';
import type { AsyncRpcClient } from './async-runtime-rpc-types';
import {
  CmsScheduleResponseError,
  claimDueSchedules,
  executeClaimedSchedule,
} from './cms-publication-schedule-rpc';
import { evidence } from './cms-editorial/workflow-fixtures.test-support';

/*
 * The CMS-03B-20 port validates both replies against the strict contract, so a
 * malformed or oversized claim list and a result for another schedule are
 * contract faults, never partial work.
 */

const env = {} as unknown as AsyncWorkerBindings;
const claim = {
  scheduleId: '123e4567-e89b-42d3-a456-426614174000',
  revisionId: '123e4567-e89b-42d3-a456-426614174001',
  scheduleVersion: '4',
  expectedVersion: '2',
  leaseId: '123e4567-e89b-42d3-a456-426614174002',
  dependencyHash: 'a'.repeat(64),
  activationEvidenceHash: 'b'.repeat(64),
  correlationId: '123e4567-e89b-42d3-a456-426614174003',
};
const rpcReturning = (reply: unknown) =>
  vi.fn(async () => reply) as unknown as AsyncRpcClient &
    ReturnType<typeof vi.fn>;

describe('claimDueSchedules', () => {
  it('posts the bounded batch as one JSON request and returns the strict claims', async () => {
    const rpc = rpcReturning([claim]);
    expect(await claimDueSchedules(rpc, env, 25)).toEqual([claim]);
    expect(rpc).toHaveBeenCalledWith(
      env,
      'cms_claim_due_publication_schedules',
      { p_request: { batch: 25 } },
      undefined,
    );
  });

  it('accepts an empty claim and forwards the abort signal', async () => {
    const rpc = rpcReturning([]);
    const signal = new AbortController().signal;
    expect(await claimDueSchedules(rpc, env, 1, signal)).toEqual([]);
    expect(rpc.mock.calls[0]![3]).toBe(signal);
  });

  it.each([
    ['a non-list reply', { rows: [] }],
    ['a claim with an extra member', [{ ...claim, content: 'x' }]],
    ['a claim missing its lease', [{ ...claim, leaseId: undefined }]],
    ['a repeated schedule', [claim, claim]],
    [
      'more claims than requested',
      [claim, { ...claim, scheduleId: '123e4567-e89b-42d3-a456-426614174009' }],
    ],
  ])('refuses %s as a contract fault', async (_name, reply) => {
    await expect(
      claimDueSchedules(rpcReturning(reply), env, 1),
    ).rejects.toBeInstanceOf(CmsScheduleResponseError);
  });
});

describe('executeClaimedSchedule', () => {
  const completed = {
    scheduleId: claim.scheduleId,
    outcome: 'completed',
    reasonCode: null,
    publicationVersionId: '123e4567-e89b-42d3-a456-426614174004',
    actualUtc: '2026-11-01T14:30:01Z',
    deviationSeconds: 1,
  };

  it('executes with the claimed schedule version, the lease and the proof', async () => {
    const rpc = rpcReturning(completed);
    expect(await executeClaimedSchedule(rpc, env, claim, evidence)).toEqual(
      completed,
    );
    expect(rpc).toHaveBeenCalledWith(
      env,
      'cms_execute_publication_schedule',
      {
        p_request: {
          scheduleId: claim.scheduleId,
          expectedVersion: '4',
          leaseId: claim.leaseId,
          evidence,
        },
      },
      undefined,
    );
  });

  it('sends a null proof when the checker produced none', async () => {
    const rpc = rpcReturning(completed);
    await executeClaimedSchedule(rpc, env, claim, null);
    expect(
      (rpc.mock.calls[0]![2] as { p_request: { evidence: unknown } }).p_request
        .evidence,
    ).toBeNull();
  });

  it.each([
    [
      'a result for another schedule',
      { ...completed, scheduleId: claim.leaseId },
    ],
    ['an unknown outcome', { ...completed, outcome: 'cancelled' }],
    ['a blocked result without a reason', { ...completed, outcome: 'blocked' }],
    ['a non-object reply', null],
  ])('refuses %s as a contract fault', async (_name, reply) => {
    await expect(
      executeClaimedSchedule(rpcReturning(reply), env, claim, null),
    ).rejects.toBeInstanceOf(CmsScheduleResponseError);
  });
});
