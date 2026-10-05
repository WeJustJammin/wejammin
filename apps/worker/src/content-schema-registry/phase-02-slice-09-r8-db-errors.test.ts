/**
 * R8: CMS-03A-09..18 refusals that originate in the database, produced through
 * the real production RPC adapter and the real Hono app. The fake transport
 * is the database contract (see phase-02-slice-09-r8-db-harness.ts); the
 * Worker is never told which status, code or details to answer.
 *
 * - Idempotency is database-authoritative: no Worker cache short-circuits a
 *   request, a different actor is a different binding, and a mismatch answers
 *   the BE00 `CONFLICT` envelope with `conflict: IDEMPOTENCY_MISMATCH`.
 * - A database FORBIDDEN reaches the wire with a registered BE00 `reasonCode`.
 * - A 409 carries the BE00-required `conflict` and `recoveryAction` plus the
 *   BE03a `expectedVersion` and `currentVersion` when the database discloses
 *   them.
 */
import { describe, expect, it } from 'vitest';

import { json } from './production-test-support';
import { REQUEST_ID } from './phase-02-slice-09-test-values';
import {
  opFor,
  requestFor,
  sessionFor,
  type EvidenceOp,
  type EvidenceOperationId,
} from './phase-02-slice-09-be03a-evidence-support';
import {
  dbRefusal,
  idempotentDb,
  makeDbBackedHarness,
} from './phase-02-slice-09-r8-db-harness';

type Case = readonly [marker: string, operationId: EvidenceOperationId];

const E409: readonly Case[] = [
  ['[P2-S09-AC-308]', 'CMS-03A-09'],
  ['[P2-S09-AC-354]', 'CMS-03A-10'],
  ['[P2-S09-AC-396]', 'CMS-03A-11'],
  ['[P2-S09-AC-433]', 'CMS-03A-12'],
  ['[P2-S09-AC-495]', 'CMS-03A-14'],
  ['[P2-S09-AC-537]', 'CMS-03A-15'],
  ['[P2-S09-AC-566]', 'CMS-03A-16'],
  ['[P2-S09-AC-594]', 'CMS-03A-17'],
];
const E403: readonly Case[] = [
  ['[P2-S09-AC-306]', 'CMS-03A-09'],
  ['[P2-S09-AC-352]', 'CMS-03A-10'],
  ['[P2-S09-AC-394]', 'CMS-03A-11'],
  ['[P2-S09-AC-431]', 'CMS-03A-12'],
  ['[P2-S09-AC-457]', 'CMS-03A-13'],
  ['[P2-S09-AC-493]', 'CMS-03A-14'],
  ['[P2-S09-AC-535]', 'CMS-03A-15'],
  ['[P2-S09-AC-564]', 'CMS-03A-16'],
  ['[P2-S09-AC-592]', 'CMS-03A-17'],
  ['[P2-S09-AC-621]', 'CMS-03A-18'],
];

const OTHER_ACTOR = '10000000-0000-4000-8000-0000000000ff';

/** The same operation with a changed body (or, for a bodyless shape, version). */
const changedRequest = (op: EvidenceOp): Request => {
  const changed: Record<string, unknown> =
    op.operationId === 'CMS-03A-15'
      ? { ...op.body, capability: 'cms.editor' }
      : op.operationId === 'CMS-03A-12'
        ? { expectedVersion: '1', decision: 'reject' }
        : op.operationId === 'CMS-03A-14'
          ? {
              action: 'revoke',
              expectedVersion: '1',
              assignmentId: 'a2000000-0000-4000-8000-0000000000a2',
            }
          : { ...op.body, expectedVersion: '2' };
  return requestFor(op, {
    body: changed,
    ...(op.ifMatch && 'expectedVersion' in changed
      ? { headers: { 'if-match': `"${String(changed.expectedVersion)}"` } }
      : {}),
  });
};

const success = (op: EvidenceOp) => () => json(op.output, 200);

const wire = async (
  response: Response,
  status: number,
  code: string,
): Promise<Record<string, unknown>> => {
  expect(response.status).toBe(status);
  const body = (await response.json()) as Record<string, unknown>;
  expect(body.code).toBe(code);
  expect(body.requestId).toBe(REQUEST_ID);
  return body;
};

describe('R8 idempotency binding is database-authoritative (CMS-03A-09)', () => {
  const op = opFor('CMS-03A-09');

  it('[P2-S09-AC-300] CMS-03A-09 replays the first response for a same-key exact retry by asking the database both times', async () => {
    const db = idempotentDb(success(op));
    const harness = makeDbBackedHarness(op, db.behaviour);
    const first = await harness.app.request(requestFor(op));
    const second = await harness.app.request(requestFor(op));
    expect(first.status).toBe(op.status);
    expect(second.status).toBe(first.status);
    expect(await second.json()).toEqual(await first.json());
    expect(harness.fetchImpl).toHaveBeenCalledTimes(2);
    expect(db.commits()).toBe(1);
  });

  it('[P2-S09-AC-300] CMS-03A-09 returns 409 CONFLICT when the same actor reuses the key with a changed body', async () => {
    const harness = makeDbBackedHarness(
      op,
      idempotentDb(success(op)).behaviour,
    );
    await harness.app.request(requestFor(op));
    const body = await wire(
      await harness.app.request(
        requestFor(op, {
          body: { ...op.body, supportedLocales: ['en-US'], fallbackChains: {} },
        }),
      ),
      409,
      'CONFLICT',
    );
    expect(body.details).toEqual({
      conflict: 'IDEMPOTENCY_MISMATCH',
      recoveryAction: 'use_new_idempotency_key',
    });
  });

  it('[P2-S09-AC-300] CMS-03A-09 returns 409 CONFLICT when the same actor reuses the key with a changed path', async () => {
    const harness = makeDbBackedHarness(
      op,
      idempotentDb(success(op)).behaviour,
    );
    await harness.app.request(requestFor(op));
    const changedPath = op.path.replace(/4(?=\/|$)/u, '5');
    expect(changedPath).not.toBe(op.path);
    const body = await wire(
      await harness.app.request(requestFor(op, { path: changedPath })),
      409,
      'CONFLICT',
    );
    expect((body.details as { conflict: string }).conflict).toBe(
      'IDEMPOTENCY_MISMATCH',
    );
  });

  it('[P2-S09-AC-300] CMS-03A-09 returns 409 CONFLICT when the same actor reuses the key with a changed version', async () => {
    const harness = makeDbBackedHarness(
      op,
      idempotentDb(success(op)).behaviour,
    );
    await harness.app.request(requestFor(op));
    const body = await wire(
      await harness.app.request(
        requestFor(op, {
          body: { ...op.body, expectedVersion: '2' },
          headers: { 'if-match': '"2"' },
        }),
      ),
      409,
      'CONFLICT',
    );
    expect((body.details as { conflict: string }).conflict).toBe(
      'IDEMPOTENCY_MISMATCH',
    );
  });

  it('[P2-S09-AC-300] CMS-03A-09 treats a different actor as a distinct binding even for the same key and body in one isolate', async () => {
    const db = idempotentDb(success(op));
    const harness = makeDbBackedHarness(op, db.behaviour, {
      session: (call) =>
        call === 1 ? sessionFor(op) : sessionFor(op, { userId: OTHER_ACTOR }),
    });
    const first = await harness.app.request(requestFor(op));
    const second = await harness.app.request(requestFor(op));
    expect(first.status).toBe(op.status);
    expect(second.status).toBe(op.status);
    expect(db.commits()).toBe(2);
    expect(new Set(harness.calls().map((call) => call.actor)).size).toBe(2);
  });
});

describe('R8 409 CONFLICT family through the real RPC adapter', () => {
  it.each(E409)(
    '%s %s returns 409 CONFLICT for an idempotency mismatch with conflict IDEMPOTENCY_MISMATCH and a recoveryAction and nothing else',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const harness = makeDbBackedHarness(
        op,
        idempotentDb(success(op)).behaviour,
      );
      const first = await harness.app.request(requestFor(op));
      expect(first.status).toBe(op.status);
      const body = await wire(
        await harness.app.request(changedRequest(op)),
        409,
        'CONFLICT',
      );
      expect(body.details).toEqual({
        conflict: 'IDEMPOTENCY_MISMATCH',
        recoveryAction: 'use_new_idempotency_key',
      });
    },
  );

  it.each(E409)(
    '%s %s returns 409 CONFLICT for a stale version with conflict VERSION_MISMATCH, recoveryAction, expectedVersion and currentVersion',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const harness = makeDbBackedHarness(op, () =>
        dbRefusal('VERSION_MISMATCH', {
          expectedVersion: '1',
          currentVersion: '2',
          secret: 'leak',
        }),
      );
      const response = await harness.app.request(requestFor(op));
      const text = await response.clone().text();
      const body = await wire(response, 409, 'CONFLICT');
      expect(body.details).toEqual({
        conflict: 'VERSION_MISMATCH',
        recoveryAction: 'reload',
        expectedVersion: '1',
        currentVersion: '2',
      });
      expect(text).not.toContain('leak');
    },
  );

  it.each(E409)(
    '%s %s returns 409 CONFLICT for a state conflict with conflict INVALID_TRANSITION and a recoveryAction',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const harness = makeDbBackedHarness(op, () => dbRefusal('CONFLICT'));
      const body = await wire(
        await harness.app.request(requestFor(op)),
        409,
        'CONFLICT',
      );
      expect(body.details).toEqual({
        conflict: 'INVALID_TRANSITION',
        recoveryAction: 'refresh',
      });
    },
  );
});

describe('R8 403 FORBIDDEN from a database refusal carries a registered reasonCode', () => {
  const ownerOnly = new Set<string>([
    'CMS-03A-15',
    'CMS-03A-16',
    'CMS-03A-17',
    'CMS-03A-18',
  ]);

  it.each(E403)(
    '%s %s returns 403 FORBIDDEN with exactly the registered reasonCode for the operation when the database refuses with no detail',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const harness = makeDbBackedHarness(op, () => dbRefusal('FORBIDDEN'));
      const response = await harness.app.request(requestFor(op));
      const body = await wire(response, 403, 'FORBIDDEN');
      expect(body.details).toEqual({
        reasonCode: ownerOnly.has(operationId)
          ? 'OWNER_REQUIRED'
          : 'CAPABILITY_REQUIRED',
      });
      expect(harness.fetchImpl).toHaveBeenCalledTimes(1);
    },
  );

  it.each(E403)(
    '%s %s keeps a registered reasonCode the database discloses and never echoes an unregistered one',
    async (_marker, operationId) => {
      const op = opFor(operationId);
      const disclosed = makeDbBackedHarness(op, () =>
        dbRefusal('FORBIDDEN', { reasonCode: 'POLICY_NOT_MET' }),
      );
      const kept = await wire(
        await disclosed.app.request(requestFor(op)),
        403,
        'FORBIDDEN',
      );
      expect(kept.details).toEqual({ reasonCode: 'POLICY_NOT_MET' });

      const hostile = makeDbBackedHarness(op, () =>
        dbRefusal('FORBIDDEN', { reasonCode: 'cms_owner_grants_exhausted' }),
      );
      const response = await hostile.app.request(requestFor(op));
      const text = await response.clone().text();
      const replaced = await wire(response, 403, 'FORBIDDEN');
      expect(text).not.toContain('cms_owner_grants_exhausted');
      expect(Object.keys(replaced.details as object)).toEqual(['reasonCode']);
    },
  );
});
