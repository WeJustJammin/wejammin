/**
 * Slice 10 evidence lane EA, CMS-03B-02 (resolve conflict), the commit half, through the real
 * stack: browser request -> first-party proxy -> production Worker -> production RPC adapter ->
 * Kong -> PostgREST -> newest SQL. Only the verified session and an always-allow rate limiter are
 * supplied.
 *
 * The CAS and the idempotency binding are typed 409s and leave the open conflict preserved; a
 * committed resolution writes exactly one revision, one audit row and one outbox event; resolving
 * a closed conflict again is the typed INVALID_TRANSITION; and a lost response is reconciled by the
 * same-key replay without a second effect. Request validation and the 401/403/404 boundary live
 * in `phase-02-slice-10-ev-ea-conflict.apispec.ts`.
 *
 * Commits fixtures; run right after `pnpm db:reset` and reset again afterwards.
 */
import { randomUUID } from 'node:crypto';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  type EditorialWorld,
  authorSession,
  outboxByType,
  prepareEditorialWorld,
} from './support/cms-editorial-world';
import { createIsolatedCmsOwner } from './support/cms-isolated-owner';
import { seedEditorialEntry } from './support/cms-editorial-seed';
import {
  type EditorialStack,
  createEditorialStack,
} from './support/cms-editorial-stack';
import {
  expectRefusal,
  openConflictOn,
  snapshot,
} from './support/ev-ea-support';

let world: EditorialWorld;
let stack: EditorialStack;
let entryId = '';
let conflictId = '';
let version = '3';
let titlePath = '';

const body = (overrides: Readonly<Record<string, unknown>> = {}) => ({
  entryId,
  conflictId,
  baseRevision: '1',
  choices: [{ path: titlePath, choice: 'theirs' }],
  expectedVersion: version,
  ...overrides,
});

const resolve = (
  payload: unknown,
  options: Readonly<{ ifMatch?: string; idempotencyKey?: string }> = {},
  conflict: string = conflictId,
) =>
  stack.resolve(entryId, conflict, payload, {
    ifMatch: options.ifMatch ?? version,
    ...(options.idempotencyKey === undefined
      ? {}
      : { idempotencyKey: options.idempotencyKey }),
  });

beforeAll(async () => {
  world = await prepareEditorialWorld(createIsolatedCmsOwner());
  stack = createEditorialStack(authorSession(world));
  titlePath = `/fields/${world.titleFieldId}`;
  ({ entryId } = await seedEditorialEntry(stack, world));
  conflictId = await openConflictOn(stack, world, entryId, '3', 'First clash');
});

describe('CMS-03B-02 concurrency, idempotency and reconciliation through the real stack', () => {
  it('a stale expectedVersion is a definite 409 VERSION_MISMATCH and the open conflict is preserved', async () => {
    const before = snapshot(entryId);
    const response = await resolve(body({ expectedVersion: '2' }), {
      ifMatch: '2',
    });
    expectRefusal(
      response,
      {
        status: 409,
        code: 'CONFLICT',
        details: { conflict: 'VERSION_MISMATCH', recoveryAction: 'reload' },
      },
      entryId,
      before,
    );
  });

  it('a base revision that is not the conflict base is a definite 409 VERSION_MISMATCH', async () => {
    const before = snapshot(entryId);
    const response = await resolve(body({ baseRevision: '2' }));
    expectRefusal(
      response,
      {
        status: 409,
        code: 'CONFLICT',
        details: { conflict: 'VERSION_MISMATCH', recoveryAction: 'reload' },
      },
      entryId,
      before,
    );
  });

  it('an explicit value that validates is committed once: two parents, one revision, one audit row, one outbox event', async () => {
    const key = `ev-ea-resolve-${randomUUID()}`;
    const before = snapshot(entryId);
    const eventsBefore = outboxByType(entryId);
    const response = await resolve(
      body({
        choices: [
          { path: titlePath, choice: 'explicit', value: 'Merged by hand' },
        ],
      }),
      { idempotencyKey: key },
    );
    expect(response.status, response.text).toBe(201);
    expect((response.body.parentRevisionIds as readonly string[]).length).toBe(
      2,
    );
    expect(response.body.conflictId).toBe(conflictId);
    expect(response.headers.get('etag')).toBe(
      `"${String(response.body.entryVersion)}"`,
    );
    const after = snapshot(entryId);
    expect(after.revisions).toBe(before.revisions + 1);
    expect(after.audit).toBe(before.audit + 1);
    expect(after.outbox).toBe(before.outbox + 1);
    expect(outboxByType(entryId)['cms.entry.revision-created.v1']).toBe(
      (eventsBefore['cms.entry.revision-created.v1'] ?? 0) + 1,
    );

    // The same key and body replays the committed response without a second effect...
    const replay = await resolve(
      body({
        choices: [
          { path: titlePath, choice: 'explicit', value: 'Merged by hand' },
        ],
      }),
      { idempotencyKey: key },
    );
    expect(replay.status, replay.text).toBe(201);
    expect(replay.body).toEqual(response.body);
    expect(snapshot(entryId)).toEqual(after);

    // ...and the same key with another choice is the typed IDEMPOTENCY_MISMATCH.
    const mismatch = await resolve(
      body({ choices: [{ path: titlePath, choice: 'yours' }] }),
      {
        idempotencyKey: key,
      },
    );
    expectRefusal(
      mismatch,
      {
        status: 409,
        code: 'CONFLICT',
        details: {
          conflict: 'IDEMPOTENCY_MISMATCH',
          recoveryAction: 'use_new_idempotency_key',
        },
      },
      entryId,
      after,
    );
    version = String(response.body.entryVersion);
  });

  it('resolving the now-closed conflict again is the typed 409 INVALID_TRANSITION and nothing is written', async () => {
    const before = snapshot(entryId);
    const response = await resolve(body({ expectedVersion: version }), {
      ifMatch: version,
    });
    expectRefusal(
      response,
      {
        status: 409,
        code: 'CONFLICT',
        details: { conflict: 'INVALID_TRANSITION', recoveryAction: 'refresh' },
      },
      entryId,
      before,
    );
  });

  it('a lost response is an unknown outcome and the same-key replay returns the committed resolution without a second effect', async () => {
    const second = await openConflictOn(
      stack,
      world,
      entryId,
      version,
      'Second clash',
    );
    const before = snapshot(entryId);
    const key = `ev-ea-lost-${randomUUID()}`;
    const payload = {
      entryId,
      conflictId: second,
      baseRevision: '1',
      choices: [{ path: titlePath, choice: 'theirs' }],
      expectedVersion: version,
    };
    stack.loseNextResponse();
    const lost = await resolve(payload, { idempotencyKey: key }, second);
    expect(lost.status).toBe(503);
    expect(lost.headers.get('x-cms-editorial-outcome')).toBe('unknown');
    const committed = snapshot(entryId);
    expect(committed.revisions).toBe(before.revisions + 1);
    expect(committed.audit).toBe(before.audit + 1);
    expect(committed.outbox).toBe(before.outbox + 1);
    const replay = await resolve(payload, { idempotencyKey: key }, second);
    expect(replay.status, replay.text).toBe(201);
    expect(replay.body.conflictId).toBe(second);
    expect(snapshot(entryId)).toEqual(committed);
  });
});
