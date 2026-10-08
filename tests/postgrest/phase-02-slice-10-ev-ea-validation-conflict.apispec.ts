/**
 * Slice 10 evidence lane EA (AC-011, AC-034), CMS-03B-02: the request-value matrix through the real
 * stack (browser request -> first-party proxy -> production Worker -> production adapter -> Kong ->
 * PostgREST -> newest SQL). Every case names the exact pointer and stable code the Worker or the
 * database publishes, the fixed safe message, and the database-wide `snapshot` (entries, revisions,
 * values, relations, conflicts, manifests, reservations, outbox, audit) before and after is equal.
 * Complements `phase-02-slice-10-ev-ea-conflict.apispec.ts`, which holds the headline cases.
 *
 * Commits fixtures; run right after `pnpm db:reset` and reset again afterwards.
 */
import { randomUUID } from 'node:crypto';

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
  violation,
  violationsOf,
} from './support/ev-ea-support';

let world: EditorialWorld;
let stack: EditorialStack;
let entryId = '';
let conflictId = '';
let path = '';

const body = (overrides: Readonly<Record<string, unknown>> = {}) => ({
  entryId,
  conflictId,
  baseRevision: '1',
  choices: [{ path, choice: 'theirs' }],
  expectedVersion: '3',
  ...overrides,
});

const without = (member: string): Record<string, unknown> => {
  const { [member]: _removed, ...rest } = body();
  void _removed;
  return rest;
};

beforeAll(async () => {
  world = await prepareEditorialWorld(createIsolatedCmsOwner());
  stack = createEditorialStack(authorSession(world));
  path = `/fields/${world.titleFieldId}`;
  ({ entryId } = await seedEditorialEntry(stack, world));
  conflictId = await openConflictOn(stack, world, entryId, '3', 'Clash');
});

type Case = Readonly<{
  label: string;
  payload: () => unknown;
  code: string;
  pointer: string;
  status?: number;
}>;

const cases = (): readonly Case[] => {
  const kinds: ReadonlyArray<readonly [string, () => unknown, string, string]> =
    [
      [
        'a baseRevision with a leading zero',
        () => body({ baseRevision: '01' }),
        '/baseRevision',
        'version_invalid',
      ],
      [
        'a baseRevision above the signed 64-bit range',
        () => body({ baseRevision: '9223372036854775808' }),
        '/baseRevision',
        'version_out_of_range',
      ],
      [
        'a missing baseRevision',
        () => without('baseRevision'),
        '/baseRevision',
        'invalid_value',
      ],
      [
        'an expectedVersion with a leading zero',
        () => body({ expectedVersion: '01' }),
        '/expectedVersion',
        'version_invalid',
      ],
      [
        'an expectedVersion above the signed 64-bit range',
        () => body({ expectedVersion: '9223372036854775808' }),
        '/expectedVersion',
        'version_out_of_range',
      ],
      [
        'a negative expectedVersion',
        () => body({ expectedVersion: '-1' }),
        '/expectedVersion',
        'version_invalid',
      ],
      [
        'a fractional expectedVersion',
        () => body({ expectedVersion: '1.5' }),
        '/expectedVersion',
        'version_invalid',
      ],
      [
        'a numeric expectedVersion',
        () => body({ expectedVersion: 3 }),
        '/expectedVersion',
        'invalid_value',
      ],
      [
        'a missing entryId',
        () => without('entryId'),
        '/entryId',
        'invalid_value',
      ],
      [
        'a choices member that is a string',
        () => body({ choices: 'x' }),
        '/choices',
        'invalid_value',
      ],
      [
        'a choices member that is an object',
        () => body({ choices: {} }),
        '/choices',
        'invalid_value',
      ],
      [
        'a missing choices member',
        () => without('choices'),
        '/choices',
        'invalid_value',
      ],
      [
        'a null choice entry',
        () => body({ choices: [null] }),
        '/choices/0',
        'invalid_value',
      ],
      [
        'a choice without a path',
        () => body({ choices: [{ choice: 'theirs' }] }),
        '/choices/0/path',
        'invalid_value',
      ],
      [
        'a choice without a choice kind',
        () => body({ choices: [{ path }] }),
        '/choices/0/choice',
        'invalid_value',
      ],
      [
        'a numeric choice path',
        () => body({ choices: [{ path: 5, choice: 'theirs' }] }),
        '/choices/0/path',
        'invalid_value',
      ],
      [
        'an empty choice path',
        () => body({ choices: [{ path: '', choice: 'theirs' }] }),
        '/choices/0/path',
        'field_pointer_invalid',
      ],
      [
        'a choice path with an uppercase field id',
        () =>
          body({
            choices: [
              {
                path: `/fields/${world.titleFieldId.toUpperCase()}`,
                choice: 'theirs',
              },
            ],
          }),
        '/choices/0/path',
        'field_pointer_invalid',
      ],
      [
        'a choice path that is a field key rather than a field id',
        () => body({ choices: [{ path: '/fields/title', choice: 'theirs' }] }),
        '/choices/0/path',
        'field_pointer_invalid',
      ],
      [
        'a choice path nested below a field',
        () => body({ choices: [{ path: `${path}/x`, choice: 'theirs' }] }),
        '/choices/0/path',
        'field_pointer_invalid',
      ],
      [
        'an unknown member of a choice',
        () => body({ choices: [{ path, choice: 'theirs', extra: 1 }] }),
        '/choices/0/extra',
        'unknown_field',
      ],
      [
        'an explicit boolean for a short_text field',
        () => body({ choices: [{ path, choice: 'explicit', value: true }] }),
        'FIELD',
        'invalid',
      ],
      [
        'an explicit object for a short_text field',
        () =>
          body({ choices: [{ path, choice: 'explicit', value: { a: 1 } }] }),
        'FIELD',
        'invalid',
      ],
      [
        'an explicit array for a short_text field',
        () => body({ choices: [{ path, choice: 'explicit', value: ['a'] }] }),
        'FIELD',
        'invalid',
      ],
      ['a request body that is an array', () => [], '/', 'invalid_value'],
      ['a request body that is null', () => null, '/', 'invalid_value'],
    ];
  return kinds.map(([label, payload, pointer, code]) => ({
    label,
    payload,
    pointer,
    code,
  }));
};

describe('CMS-03B-02 request-value matrix through the real stack', () => {
  it.each(cases().map((c) => [c.label, c] as const))(
    '%s is a 422 at its stable pointer with its stable code and the database-wide snapshot is unchanged',
    async (_label, { payload, pointer, code }) => {
      const before = snapshot(entryId);
      const response = await stack.resolve(entryId, conflictId, payload(), {
        ifMatch: '3',
      });
      expectRefusal(
        response,
        {
          status: 422,
          code: 'VALIDATION_FAILED',
          violations: [violation(pointer === 'FIELD' ? path : pointer, code)],
        },
        entryId,
        before,
      );
    },
  );

  it('a 300 000-character explicit value exceeds the body ceiling and is a 400 INVALID_REQUEST with the snapshot unchanged', async () => {
    const before = snapshot(entryId);
    const response = await stack.resolve(
      entryId,
      conflictId,
      body({
        choices: [{ path, choice: 'explicit', value: 'a'.repeat(300_000) }],
      }),
      { ifMatch: '3' },
    );
    expectRefusal(
      response,
      { status: 400, code: 'INVALID_REQUEST' },
      entryId,
      before,
    );
  });

  it('a request body that is a JSON string is a 422 at the root pointer and the snapshot is unchanged', async () => {
    const before = snapshot(entryId);
    const response = await stack.resolve(entryId, conflictId, '"x"', {
      ifMatch: '3',
    });
    expectRefusal(
      response,
      {
        status: 422,
        code: 'VALIDATION_FAILED',
        violations: [violation('/', 'invalid_value')],
      },
      entryId,
      before,
    );
  });

  it('a request body that is not parseable JSON is a 400 INVALID_REQUEST and the snapshot is unchanged', async () => {
    const before = snapshot(entryId);
    const response = await stack.resolve(entryId, conflictId, '{not json', {
      ifMatch: '3',
    });
    expectRefusal(
      response,
      { status: 400, code: 'INVALID_REQUEST' },
      entryId,
      before,
    );
  });

  it('exactly 128 distinct choices pass the count bound: the database then refuses the 127 paths the conflict does not carry', async () => {
    const choices = [
      { path, choice: 'theirs' },
      ...Array.from({ length: 127 }, () => ({
        path: `/fields/${randomUUID()}`,
        choice: 'theirs',
      })),
    ];
    const before = snapshot(entryId);
    const response = await stack.resolve(
      entryId,
      conflictId,
      body({ choices }),
      {
        ifMatch: '3',
      },
    );
    expect(response.status, response.text).toBe(422);
    expect(violationsOf(response).every((v) => v.code === 'invalid')).toBe(
      true,
    );
    expect(snapshot(entryId)).toEqual(before);
  });
});
