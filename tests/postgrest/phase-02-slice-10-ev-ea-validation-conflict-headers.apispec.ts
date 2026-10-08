/**
 * Slice 10 evidence lane EA (AC-011), CMS-03B-02: the header matrix through the real stack. Each
 * case is refused before any persistence with the stated status, closed code and pointer, and the
 * database-wide `snapshot` is unchanged. The request-value matrix lives in
 * `phase-02-slice-10-ev-ea-validation-conflict.apispec.ts`.
 *
 * Commits fixtures; run right after `pnpm db:reset` and reset again afterwards.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import {
  type EditorialWorld,
  authorSession,
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
  violationsOf,
} from './support/ev-ea-support';

let world: EditorialWorld;
let stack: EditorialStack;
let entryId = '';
let conflictId = '';
let path = '';

const body = () => ({
  entryId,
  conflictId,
  baseRevision: '1',
  choices: [{ path, choice: 'theirs' }],
  expectedVersion: '3',
});

beforeAll(async () => {
  world = await prepareEditorialWorld(createIsolatedCmsOwner());
  stack = createEditorialStack(authorSession(world));
  path = `/fields/${world.titleFieldId}`;
  ({ entryId } = await seedEditorialEntry(stack, world));
  conflictId = await openConflictOn(stack, world, entryId, '3', 'Clash');
});

describe('CMS-03B-02 header matrix through the real stack', () => {
  const headerCases: ReadonlyArray<
    readonly [string, Record<string, unknown>, number, string, string]
  > = [
    ['a missing If-Match', { headers: {} }, 400, 'INVALID_REQUEST', '/ifMatch'],
    [
      'a weak If-Match validator',
      { ifMatch: '3', headers: { 'if-match': 'W/"3"' } },
      400,
      'INVALID_REQUEST',
      '/ifMatch',
    ],
    [
      'an Idempotency-Key shorter than 8 characters',
      { ifMatch: '3', idempotencyKey: 'short' },
      400,
      'INVALID_REQUEST',
      '/idempotencyKey',
    ],
    [
      'an Idempotency-Key longer than 128 characters',
      { ifMatch: '3', idempotencyKey: 'k'.repeat(129) },
      400,
      'INVALID_REQUEST',
      '/idempotencyKey',
    ],
    [
      'an If-Match that differs from the body expectedVersion',
      { ifMatch: '2' },
      422,
      'VALIDATION_FAILED',
      '/expectedVersion',
    ],
  ];

  it.each(headerCases)(
    '%s is refused before any persistence and the snapshot is unchanged',
    async (_label, options, status, code, pointer) => {
      const before = snapshot(entryId);
      const response = await stack.resolve(
        entryId,
        conflictId,
        body(),
        options as never,
      );
      expect(response.status, response.text).toBe(status);
      expect(response.body.code).toBe(code);
      expect(violationsOf(response).map((v) => v.path)).toContain(pointer);
      expect(snapshot(entryId)).toEqual(before);
    },
  );

  it('a non-JSON Content-Type is a 415 UNSUPPORTED_MEDIA_TYPE naming the allowed media type and the snapshot is unchanged', async () => {
    const before = snapshot(entryId);
    const response = await stack.resolve(entryId, conflictId, body(), {
      ifMatch: '3',
      headers: { 'content-type': 'text/plain' },
    });
    expectRefusal(
      response,
      {
        status: 415,
        code: 'UNSUPPORTED_MEDIA_TYPE',
        details: { allowedMediaTypes: ['application/json'] },
      },
      entryId,
      before,
    );
  });

  it('an undeclared query parameter on the command route is a 400 and the snapshot is unchanged', async () => {
    const before = snapshot(entryId);
    const response = await stack.worker(
      'POST',
      `/api/v1/cms/entries/${entryId}/conflicts/${conflictId}/resolve?limit=5`,
      body(),
      { ifMatch: '3' },
    );
    expectRefusal(
      response,
      { status: 400, code: 'INVALID_REQUEST' },
      entryId,
      before,
    );
  });
});
