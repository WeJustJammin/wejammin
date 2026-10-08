/**
 * Slice 10 evidence lane EA, CMS-03B-02 (resolve conflict) through the real stack: browser request
 * -> first-party proxy -> production Worker -> production RPC adapter -> Kong -> PostgREST ->
 * newest SQL. Only the verified session and an always-allow rate limiter are supplied.
 *
 * Every rejected request is asserted for its exact stable pointer and code, the fixed safe
 * message and an unchanged durable state (entry, revisions, audit, outbox, conflicts); the 401,
 * 403 and 404 boundary is the database's decision for three different principals; the CAS, the
 * request admission (CMS-03B-02 request validation) is exercised here; the CAS, idempotency and
 * reconciliation half of the contract lives in `phase-02-slice-10-ev-ea-conflict-commit.apispec.ts`.
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
  type Violation,
  expectRefusal,
  memberWithoutGrant,
  openConflictOn,
  outsider,
  violation,
  violationsOf,
  snapshot,
} from './support/ev-ea-support';

let world: EditorialWorld;
let stack: EditorialStack;
let entryId = '';
let conflictId = '';
let otherConflictId = '';
const version = '3';
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
  const other = await seedEditorialEntry(stack, world);
  otherConflictId = await openConflictOn(
    stack,
    world,
    other.entryId,
    '3',
    'Other clash',
  );
});

type InvalidCase = Readonly<{
  label: string;
  payload: () => unknown;
  expected: () => readonly Violation[];
}>;

const invalidCases = (): readonly InvalidCase[] => [
  {
    label: 'an empty choices list',
    payload: () => body({ choices: [] }),
    expected: () => [violation('/choices', 'invalid_value')],
  },
  {
    label: 'a 129-entry choices list',
    payload: () =>
      body({
        choices: Array.from({ length: 129 }, () => ({
          path: `/fields/${randomUUID()}`,
          choice: 'theirs',
        })),
      }),
    expected: () => [violation('/choices', 'invalid_value')],
  },
  {
    label: 'two choices for one path',
    payload: () =>
      body({
        choices: [
          { path: titlePath, choice: 'theirs' },
          { path: titlePath, choice: 'yours' },
        ],
      }),
    expected: () => [
      violation('/choices', 'conflict_choice_paths_must_be_unique'),
    ],
  },
  {
    label: 'a named choice that smuggles a value',
    payload: () =>
      body({ choices: [{ path: titlePath, choice: 'theirs', value: 'x' }] }),
    expected: () => [
      violation('/choices/0/value', 'named_choice_forbids_value'),
    ],
  },
  {
    label: 'an explicit choice without a value',
    payload: () => body({ choices: [{ path: titlePath, choice: 'explicit' }] }),
    expected: () => [
      violation('/choices/0/value', 'explicit_choice_requires_value'),
    ],
  },
  {
    label: 'a choice kind outside base, theirs, yours and explicit',
    payload: () => body({ choices: [{ path: titlePath, choice: 'mine' }] }),
    expected: () => [violation('/choices/0/choice', 'invalid_value')],
  },
  {
    label: 'a /blocks choice path',
    payload: () => body({ choices: [{ path: '/blocks/0', choice: 'theirs' }] }),
    expected: () => [violation('/choices/0/path', 'field_pointer_invalid')],
  },
  {
    label: 'an explicit value the field kind refuses',
    payload: () =>
      body({ choices: [{ path: titlePath, choice: 'explicit', value: 12 }] }),
    expected: () => [violation(titlePath, 'invalid')],
  },
  {
    label: 'a choice for a path the conflict does not carry',
    payload: () =>
      body({
        choices: [{ path: `/fields/${randomUUID()}`, choice: 'theirs' }],
      }),
    expected: () => [violation(titlePath, 'invalid')],
  },
  {
    label: 'an unknown request member',
    payload: () => body({ unexpected: 1 }),
    expected: () => [violation('/unexpected', 'unknown_field')],
  },
  {
    label: 'a zero baseRevision',
    payload: () => body({ baseRevision: '0' }),
    expected: () => [violation('/baseRevision', 'version_invalid')],
  },
  {
    label: 'a non-numeric expectedVersion',
    payload: () => body({ expectedVersion: 'x' }),
    expected: () => [violation('/expectedVersion', 'version_invalid')],
  },
  {
    label: 'a body conflictId that differs from the path conflict',
    payload: () => body({ conflictId: randomUUID() }),
    expected: () => [violation('/conflictId', 'mismatch')],
  },
  {
    label: 'a body entryId that differs from the path entry',
    payload: () => body({ entryId: randomUUID() }),
    expected: () => [violation('/entryId', 'mismatch')],
  },
];

describe('CMS-03B-02 request validation through the real stack', () => {
  it.each(invalidCases().map((c) => [c.label, c] as const))(
    '%s is a 422 with its stable pointer and code and nothing is written',
    async (_label, { payload, expected }) => {
      const before = snapshot(entryId);
      const response = await resolve(payload());
      expectRefusal(
        response,
        { status: 422, code: 'VALIDATION_FAILED', violations: expected() },
        entryId,
        before,
      );
      expect(
        violationsOf(response).every(
          (v) => v.message === 'The value is invalid.',
        ),
      ).toBe(true);
    },
  );

  it('a malformed conflict id in the path is a structural 400 naming /conflictId and nothing is written', async () => {
    const before = snapshot(entryId);
    const response = await resolve(body(), {}, 'not-a-uuid');
    expectRefusal(
      response,
      {
        status: 400,
        code: 'INVALID_REQUEST',
        violations: [violation('/conflictId', 'invalid_value')],
      },
      entryId,
      before,
    );
  });
});

describe('CMS-03B-02 401, 403 and 404 through the real stack', () => {
  it('no session is a 401 with a reauthenticate hint and nothing is written', async () => {
    const before = snapshot(entryId);
    stack.as(null);
    try {
      const response = await resolve(body());
      expectRefusal(
        response,
        {
          status: 401,
          code: 'UNAUTHENTICATED',
          details: { recoveryAction: 'reauthenticate' },
        },
        entryId,
        before,
      );
    } finally {
      stack.as(authorSession(world));
    }
  });

  it('a confirmed member holding no CMS grant is a 403 and nothing is written', async () => {
    const principal = memberWithoutGrant(world);
    const before = snapshot(entryId);
    stack.as(principal);
    try {
      const response = await resolve(body());
      expectRefusal(
        response,
        { status: 403, code: 'FORBIDDEN' },
        entryId,
        before,
      );
    } finally {
      stack.as(authorSession(world));
    }
  });

  it('a person outside the owning organization gets the same empty 404 as for an absent conflict', async () => {
    const principal = outsider(world);
    const before = snapshot(entryId);
    stack.as(principal);
    try {
      const response = await resolve(body());
      expectRefusal(
        response,
        { status: 404, code: 'NOT_FOUND' },
        entryId,
        before,
      );
      expect(response.body.details).toEqual({});
    } finally {
      stack.as(authorSession(world));
    }
  });

  it('an absent conflict id is an empty 404 and nothing is written', async () => {
    const absent = randomUUID();
    const before = snapshot(entryId);
    const response = await resolve(body({ conflictId: absent }), {}, absent);
    expectRefusal(
      response,
      { status: 404, code: 'NOT_FOUND' },
      entryId,
      before,
    );
    expect(response.body.details).toEqual({});
  });

  it('a conflict that belongs to another entry is the same empty 404 and nothing is written', async () => {
    const before = snapshot(entryId);
    const response = await resolve(
      body({ conflictId: otherConflictId }),
      {},
      otherConflictId,
    );
    expectRefusal(
      response,
      { status: 404, code: 'NOT_FOUND' },
      entryId,
      before,
    );
    expect(response.body.details).toEqual({});
  });
});
