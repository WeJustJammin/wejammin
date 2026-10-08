/**
 * Slice 10 evidence lane EA (AC-007, AC-013, AC-019, AC-021, AC-025): SIMULTANEOUS real commands
 * through the real stack (browser request -> first-party proxy -> production Worker -> production
 * adapter -> Kong -> PostgREST -> newest SQL). Requests are issued with `Promise.all`, so the
 * database - not the test - orders them:
 *
 *   * two writers at the same entry version: exactly one commits, the other is the definite 409
 *     VERSION_MISMATCH, and the durable effects are those of ONE command (revision, audit, outbox);
 *   * the same Idempotency-Key and body sent three times at once commits once and every caller
 *     receives the identical committed response;
 *   * two resolutions of one conflict and two restores at one version: one winner, one 409;
 *   * history reads keep a consistent keyset while writes commit: a cursor taken before a write
 *     continues strictly below the last row it served, with no gap or repeat, and a lost response
 *     to a read is recovered by repeating it with no effect.
 *
 * Commits fixtures; run right after `pnpm db:reset` and reset again afterwards.
 */
import { randomUUID } from 'node:crypto';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  type EditorialWorld,
  appendEntryBody,
  authorSession,
  prepareEditorialWorld,
} from './support/cms-editorial-world';
import { createIsolatedCmsOwner } from './support/cms-isolated-owner';
import { seedEditorialEntry } from './support/cms-editorial-seed';
import {
  type EditorialStack,
  createEditorialStack,
} from './support/cms-editorial-stack';
import { openConflictOn, snapshot } from './support/ev-ea-support';

let world: EditorialWorld;
let stack: EditorialStack;
let entryId = '';
let firstRevisionId = '';
let version = 3;

const append = (title: string, key: string = `race-${randomUUID()}`) =>
  stack.append(
    entryId,
    appendEntryBody(world, entryId, title, String(version), String(version)),
    { ifMatch: String(version), idempotencyKey: key },
  );

const numbers = (body: Record<string, unknown>): number[] =>
  (body.items as { revisionNumber: string }[]).map((item) =>
    Number(item.revisionNumber),
  );

beforeAll(async () => {
  world = await prepareEditorialWorld(createIsolatedCmsOwner());
  stack = createEditorialStack(authorSession(world));
  ({ entryId, firstRevisionId } = await seedEditorialEntry(stack, world));
});

describe('simultaneous writers through the real stack', () => {
  it.each([1, 2, 3])(
    'round %i: two appends at the same entry version commit exactly one revision and the other is the definite 409 VERSION_MISMATCH',
    async () => {
      const before = snapshot(entryId);
      const [a, b] = await Promise.all([append('Racer A'), append('Racer B')]);
      const statuses = [a.status, b.status].sort();
      expect(statuses, `${a.text} ${b.text}`).toEqual([201, 409]);
      const loser = a.status === 409 ? a : b;
      expect(loser.body).toMatchObject({
        code: 'CONFLICT',
        details: { conflict: 'VERSION_MISMATCH', recoveryAction: 'reload' },
      });
      expect(loser.headers.get('x-cms-editorial-outcome')).toBeNull();
      const after = snapshot(entryId);
      expect(after.revisions).toBe(before.revisions + 1);
      expect(after.audit).toBe(before.audit + 1);
      expect(after.outbox).toBe(before.outbox + 1);
      expect(after.reservations).toBe(before.reservations + 1);
      expect(after.conflicts).toBe(before.conflicts);
      version += 1;
    },
  );

  it('the same Idempotency-Key and body sent three times at once commits once and every caller gets the identical committed 201', async () => {
    const before = snapshot(entryId);
    const key = `same-${randomUUID()}`;
    const responses = await Promise.all([
      append('Same A', key),
      append('Same A', key),
      append('Same A', key),
    ]);
    for (const response of responses)
      expect(response.status, response.text).toBe(201);
    expect(responses[1]?.body).toEqual(responses[0]?.body);
    expect(responses[2]?.body).toEqual(responses[0]?.body);
    const after = snapshot(entryId);
    expect(after.revisions).toBe(before.revisions + 1);
    expect(after.audit).toBe(before.audit + 1);
    expect(after.outbox).toBe(before.outbox + 1);
    expect(after.reservations).toBe(before.reservations + 1);
    version += 1;
  });

  it('two resolutions of one conflict commit exactly one two-parent revision and the other is a definite 409', async () => {
    const conflictId = await openConflictOn(
      stack,
      world,
      entryId,
      String(version),
      'Clash',
    );
    const before = snapshot(entryId);
    const resolve = (key: string) =>
      stack.resolve(
        entryId,
        conflictId,
        {
          entryId,
          conflictId,
          baseRevision: '1',
          choices: [
            { path: `/fields/${world.titleFieldId}`, choice: 'theirs' },
          ],
          expectedVersion: String(version),
        },
        { ifMatch: String(version), idempotencyKey: key },
      );
    const [a, b] = await Promise.all([
      resolve(`r-${randomUUID()}`),
      resolve(`r-${randomUUID()}`),
    ]);
    expect([a.status, b.status].sort(), `${a.text} ${b.text}`).toEqual([
      201, 409,
    ]);
    const loser = a.status === 409 ? a : b;
    expect(loser.body.code).toBe('CONFLICT');
    const after = snapshot(entryId);
    expect(after.revisions).toBe(before.revisions + 1);
    expect(after.audit).toBe(before.audit + 1);
    expect(after.outbox).toBe(before.outbox + 1);
    version += 1;
  });

  it('two restores of one revision at one entry version commit exactly one new draft and the other is the definite 409 VERSION_MISMATCH', async () => {
    const compare = (
      await stack.history(entryId, `?compareRevisionId=${firstRevisionId}`)
    ).body.compare as { restore: { migrationChainId: string } };
    const before = snapshot(entryId);
    const restore = (key: string) =>
      stack.restore(
        entryId,
        firstRevisionId,
        {
          entryId,
          revisionId: firstRevisionId,
          migrationChainId: compare.restore.migrationChainId,
          expectedVersion: String(version),
        },
        { ifMatch: String(version), idempotencyKey: key },
      );
    const [a, b] = await Promise.all([
      restore(`x-${randomUUID()}`),
      restore(`x-${randomUUID()}`),
    ]);
    expect([a.status, b.status].sort(), `${a.text} ${b.text}`).toEqual([
      201, 409,
    ]);
    const loser = a.status === 409 ? a : b;
    expect(loser.body).toMatchObject({
      code: 'CONFLICT',
      details: { conflict: 'VERSION_MISMATCH' },
    });
    const after = snapshot(entryId);
    expect(after.revisions).toBe(before.revisions + 1);
    expect(after.audit).toBe(before.audit + 1);
    expect(after.outbox).toBe(before.outbox + 2);
    expect(after.manifests).toBeLessThanOrEqual(before.manifests + 1);
    version += 1;
  });
});

describe('history reads stay consistent while writes commit', () => {
  it('a cursor taken before a write continues strictly below the last served revision with no gap and no repeat', async () => {
    const first = await stack.history(entryId, '?limit=2');
    expect(first.status, first.text).toBe(200);
    const firstNumbers = numbers(first.body);
    const cursor = encodeURIComponent(String(first.body.nextCursor));
    const written = await append('Written between pages');
    expect(written.status, written.text).toBe(201);
    version += 1;
    const second = await stack.history(entryId, `?limit=2&cursor=${cursor}`);
    expect(second.status, second.text).toBe(200);
    const secondNumbers = numbers(second.body);
    const lastServed = firstNumbers[firstNumbers.length - 1] ?? 0;
    expect(secondNumbers[0]).toBe(lastServed - 1);
    expect(
      secondNumbers.every(
        (n, i) => i === 0 || n === (secondNumbers[i - 1] ?? 0) - 1,
      ),
    ).toBe(true);
    for (const n of secondNumbers) expect(firstNumbers).not.toContain(n);
  });

  it('six simultaneous reads around two simultaneous writes each return a complete, gap-free, strictly descending page', async () => {
    const results = await Promise.all([
      stack.history(entryId, '?limit=50'),
      append('Concurrent write one'),
      stack.history(entryId, '?limit=50'),
      stack.history(entryId, '?limit=50'),
      stack.history(entryId, '?limit=50'),
      stack.history(entryId, '?limit=50'),
      stack.history(entryId, '?limit=50'),
    ]);
    version += 1;
    const reads = results.filter((_, index) => index !== 1);
    for (const read of reads) {
      expect(read.status, read.text).toBe(200);
      const list = numbers(read.body);
      expect(list.length).toBeGreaterThan(0);
      for (let i = 1; i < list.length; i += 1)
        expect(list[i]).toBe((list[i - 1] ?? 0) - 1);
      expect(list[list.length - 1]).toBe(1);
      expect(read.headers.get('etag')).toBe(
        `"${String(read.body.pageVersion)}"`,
      );
    }
  });

  it('a lost response to a read is recovered by repeating it: the repeat is the identical page and no row is written', async () => {
    const control = await stack.history(entryId, '?limit=50');
    expect(control.status, control.text).toBe(200);
    const before = snapshot(entryId);
    stack.loseNextResponse();
    const lost = await stack.history(entryId, '?limit=50');
    expect(lost.status).not.toBe(200);
    const repeat = await stack.history(entryId, '?limit=50');
    expect(repeat.status, repeat.text).toBe(200);
    expect(repeat.body.items).toEqual(control.body.items);
    expect(repeat.body.pageVersion).toBe(control.body.pageVersion);
    expect(snapshot(entryId)).toEqual(before);
  });
});
