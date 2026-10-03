import { describe, expect, it } from 'vitest';

import {
  bodyOf,
  freshAccepted,
  freshInvalid,
  makeHarness,
  sendHuman,
} from './phase-02-slice-09-pre-support';
import {
  DRY_RUN_ID,
  activation,
  ok,
  validActivation,
} from './phase-02-slice-09-test-values';

const A04 = 'CMS-03A-04' as const;
const APPROVAL = 'f0000000-0000-4000-8000-000000000012';
const act = (patch: Record<string, unknown>) => ({
  ...validActivation,
  ...patch,
});
const without = (member: string): Record<string, unknown> => {
  const rest: Record<string, unknown> = { ...validActivation };
  delete rest[member];
  return rest;
};
const uuids = (count: number): string[] =>
  Array.from(
    { length: count },
    (_, i) => `f0000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
  );

describe('CMS-03A-04 schema activation request through the real route', () => {
  it('[P2-S09-AC-085] is a strict object of expectedVersion, dryRunId, approvalIds, migrationPlanId and an optional expectedActivationEvidenceHash', async () => {
    const body = await freshAccepted(A04, validActivation);
    expect(Object.keys(body).sort()).toEqual([
      'approvalIds',
      'dryRunId',
      'expectedVersion',
      'migrationPlanId',
    ]);
    const hashed = await freshAccepted(
      A04,
      act({ expectedActivationEvidenceHash: 'a'.repeat(64) }),
    );
    expect(hashed.expectedActivationEvidenceHash).toBe('a'.repeat(64));
    for (const member of Object.keys(validActivation))
      await freshInvalid(A04, without(member), `/${member}`);
    await freshInvalid(A04, act({ extra: true }), '/extra');
    await freshInvalid(
      A04,
      act({ activate: true, policy: { requiredDecisionCount: 1 } }),
      '/activate',
    );
    await freshInvalid(
      A04,
      act({ migrationPlanId: undefined }),
      '/migrationPlanId',
    );
  });

  it('[P2-S09-AC-086] requires expectedVersion as a positive decimal string equal to the exact strong If-Match', async () => {
    for (const expectedVersion of ['1', '42', '9223372036854775807']) {
      const harness = makeHarness();
      const response = await sendHuman(harness, A04, act({ expectedVersion }), {
        'if-match': `"${expectedVersion}"`,
      });
      expect(response.status).toBe(200);
      expect(
        (harness.ports.activateSchema.mock.calls[0]?.[0] as { ifMatch: string })
          .ifMatch,
      ).toBe(expectedVersion);
    }
    for (const expectedVersion of [
      '0',
      '01',
      '-1',
      '1.5',
      'v1',
      '',
      1,
      null,
      '9223372036854775808',
    ])
      await freshInvalid(A04, act({ expectedVersion }), '/expectedVersion');
    const mismatch = makeHarness();
    const refused = await sendHuman(
      mismatch,
      A04,
      act({ expectedVersion: '2' }),
      { 'if-match': '"1"' },
    );
    expect(refused.status).toBe(400);
    expect((await bodyOf(refused)).code).toBe('INVALID_REQUEST');
    expect(mismatch.ports.activateSchema).not.toHaveBeenCalled();
    for (const header of ['W/"1"', '1', '"0"', '']) {
      const weak = makeHarness();
      expect(
        (await sendHuman(weak, A04, validActivation, { 'if-match': header }))
          .status,
        header,
      ).toBe(400);
      expect(weak.ports.activateSchema).not.toHaveBeenCalled();
    }
  });

  it('[P2-S09-AC-088] requires approvalIds as an array of 1-8 distinct UUID references', async () => {
    for (const count of [1, 2, 8]) {
      const body = await freshAccepted(A04, act({ approvalIds: uuids(count) }));
      expect((body.approvalIds as string[]).length).toBe(count);
    }
    await freshInvalid(A04, act({ approvalIds: [] }), '/approvalIds');
    await freshInvalid(A04, act({ approvalIds: uuids(9) }), '/approvalIds');
    await freshInvalid(
      A04,
      act({ approvalIds: [APPROVAL, APPROVAL] }),
      '/approvalIds',
    );
    for (const approvalIds of [
      APPROVAL,
      ['approval'],
      [1],
      null,
      [APPROVAL, ''],
    ])
      await freshInvalid(A04, act({ approvalIds }), '/approvalIds');
  });

  it('[P2-S09-AC-094] accepts expectedActivationEvidenceHash only as lowercase 64-hex and answers a mismatch with a typed conflict that changes no policy', async () => {
    for (const hash of ['a'.repeat(64), '0123456789abcdef'.repeat(4)])
      expect(
        (
          await freshAccepted(
            A04,
            act({ expectedActivationEvidenceHash: hash }),
          )
        ).expectedActivationEvidenceHash,
      ).toBe(hash);
    for (const hash of [
      'A'.repeat(64),
      'a'.repeat(63),
      'a'.repeat(65),
      'g'.repeat(64),
      '',
      null,
      7,
    ])
      await freshInvalid(
        A04,
        act({ expectedActivationEvidenceHash: hash }),
        '/expectedActivationEvidenceHash',
      );
    const harness = makeHarness();
    harness.ports.activateSchema.mockResolvedValueOnce({
      ok: false,
      status: 409,
      code: 'CONFLICT',
      message: 'evidence hash differs',
      details: {
        conflict: 'INVALID_TRANSITION',
        policy: { requiredDecisionCount: 0 },
        expectedActivationEvidenceHash: 'a'.repeat(64),
      },
    });
    const response = await sendHuman(
      harness,
      A04,
      act({ expectedActivationEvidenceHash: 'b'.repeat(64) }),
    );
    expect(response.status).toBe(409);
    const body = await bodyOf(response);
    expect(body.code).toBe('CONFLICT');
    expect(body.details.conflict).toBe('INVALID_TRANSITION');
    expect(JSON.stringify(body.details)).not.toMatch(
      /requiredDecisionCount|policy|a{64}/u,
    );
    expect(harness.ports.activateSchema).toHaveBeenCalledTimes(1);
  });

  it('[P2-S09-AC-010] [P2-S09-AC-189] activates only through an exact dry run, approvals and a migration plan reference and answers a stale candidate with a conflict, never a success', async () => {
    for (const member of ['dryRunId', 'approvalIds', 'migrationPlanId'])
      await freshInvalid(A04, without(member), `/${member}`);
    const ready = makeHarness();
    const accepted = await sendHuman(ready, A04, validActivation);
    expect(accepted.status).toBe(200);
    expect(ready.ports.activateSchema).toHaveBeenCalledTimes(1);
    const input = ready.ports.activateSchema.mock.calls[0]?.[0] as {
      body: Record<string, unknown>;
    };
    expect(input.body).toMatchObject({
      dryRunId: DRY_RUN_ID,
      migrationPlanId: null,
    });
    const queued = makeHarness();
    queued.ports.activateSchema.mockResolvedValueOnce(
      ok({ ...activation, jobId: DRY_RUN_ID }),
    );
    expect((await sendHuman(queued, A04, validActivation)).status).toBe(202);
    for (const conflict of ['VERSION_MISMATCH', 'INVALID_TRANSITION']) {
      const stale = makeHarness();
      stale.ports.activateSchema.mockResolvedValueOnce({
        ok: false,
        status: 409,
        code: 'CONFLICT',
        message: 'candidate invalidated',
        details: { conflict, expectedVersion: '1', currentVersion: '2' },
      });
      const response = await sendHuman(stale, A04, validActivation);
      expect(response.status).toBe(409);
      expect(response.headers.get('etag')).toBeNull();
      expect((await bodyOf(response)).details).toMatchObject({
        conflict,
        expectedVersion: '1',
        currentVersion: '2',
      });
    }
  });
});
