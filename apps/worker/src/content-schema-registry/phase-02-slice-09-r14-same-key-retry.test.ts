import { describe, expect, it } from 'vitest';

import {
  opFor,
  requestFor,
  harnessFor,
  sessionFor,
  type EvidenceOperationId,
} from './phase-02-slice-09-be03a-evidence-support';
import { makeHarness } from './phase-02-slice-09-worker-test-support';
import { sendHuman } from './phase-02-slice-09-pre-support';
import { ok, session, validActivation } from './phase-02-slice-09-test-values';

/**
 * AC1031 Worker half for CMS-03A-04 (activator), CMS-03A-12 and CMS-03A-14: the
 * draft may reuse its original Idempotency-Key after the step-up. The 401
 * STEP_UP_REQUIRED reserves nothing (no quota, no port). The retry with the
 * same key and the same request reaches the database port with that one key
 * and the identical request, and the port's replay answer is returned
 * unchanged for every further identical request (BE00 step 8: reserve and
 * replay are the port's, atomic with the mutation).
 */
const KEY = 'cms-step-up-retry-key-001';

type Sent = Readonly<{
  send: () => Promise<Response>;
  port: { mock: { calls: unknown[][] } };
  resolveSession: {
    mockResolvedValueOnce: (value: ReturnType<typeof ok>) => unknown;
  };
  quotaCalls: () => number;
  stale: ReturnType<typeof ok>;
}>;

const evidenceCase = (id: EvidenceOperationId): Sent => {
  const op = opFor(id);
  const harness = harnessFor(op);
  return {
    send: async () =>
      harness.app.request(
        requestFor(op, { headers: { 'idempotency-key': KEY } }),
      ),
    port: harness.ports[op.portName] as Sent['port'],
    resolveSession: harness.resolveSession,
    quotaCalls: () => harness.rateLimit.mock.calls.length,
    stale: ok(sessionFor(op, { mfaFresh: false })),
  };
};

const activationCase = (): Sent => {
  const harness = makeHarness();
  return {
    send: () =>
      sendHuman(harness, 'CMS-03A-04', validActivation, {
        'idempotency-key': KEY,
      }),
    port: harness.ports.activateSchema as unknown as Sent['port'],
    resolveSession: harness.resolveSession,
    quotaCalls: () => harness.rateLimit.mock.calls.length,
    stale: ok({ ...session, mfaFresh: false }),
  };
};

const CASES: readonly (readonly [string, () => Sent])[] = [
  ['CMS-03A-04', activationCase],
  ['CMS-03A-12', () => evidenceCase('CMS-03A-12')],
  ['CMS-03A-14', () => evidenceCase('CMS-03A-14')],
];

describe('[P2-S09-AC-1031] same-key retry after the step-up on CMS-03A-04, -12 and -14', () => {
  for (const [label, make] of CASES) {
    it(`[P2-S09-AC-1031] ${label}: the stale proof is 401 STEP_UP_REQUIRED and reserves nothing, then the same Idempotency-Key reaches the port once with the identical request and a repeat replays the same answer`, async () => {
      const sent = make();
      sent.resolveSession.mockResolvedValueOnce(sent.stale);

      const refused = await sent.send();
      expect(refused.status).toBe(401);
      expect(((await refused.json()) as { code: string }).code).toBe(
        'STEP_UP_REQUIRED',
      );
      expect(sent.port.mock.calls).toHaveLength(0);
      expect(sent.quotaCalls()).toBe(0);

      const first = await sent.send();
      expect(first.ok).toBe(true);
      const firstBody = await first.text();
      expect(sent.port.mock.calls).toHaveLength(1);

      const replay = await sent.send();
      expect(replay.status).toBe(first.status);
      expect(await replay.text()).toBe(firstBody);
      expect(sent.port.mock.calls).toHaveLength(2);

      const [firstInput, replayInput] = sent.port.mock.calls.map(
        ([input]) => input as Record<string, unknown>,
      );
      expect(firstInput?.idempotencyKey).toBe(KEY);
      expect(replayInput?.idempotencyKey).toBe(KEY);
      expect(replayInput?.body).toStrictEqual(firstInput?.body);
      expect(replayInput?.ifMatch).toStrictEqual(firstInput?.ifMatch);
    });
  }
});
