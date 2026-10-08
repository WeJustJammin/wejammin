/**
 * Slice 10 evidence lane EA (AC-017, AC-035), CMS-03B-03: the query and cursor matrix through the
 * real stack. Structural faults (bounds, encoding, key set, member types, duplicates, filters) are
 * 400; a cursor that is well formed but expired, forged, bound to another context or signed by
 * another key is the typed 409 restart (DEC-140). The signed cases are re-signed with the test
 * Vault key so each one isolates exactly ONE member of the envelope. Every case also leaves the
 * database-wide snapshot unchanged: a read writes nothing.
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
  decodeCursor,
  encodeCursor,
  expectRefusal,
  snapshot,
  violation,
  violationsOf,
} from './support/ev-ea-support';

let world: EditorialWorld;
let stack: EditorialStack;
let entryId = '';
let envelope: Record<string, unknown> = {};

beforeAll(async () => {
  world = await prepareEditorialWorld(createIsolatedCmsOwner());
  stack = createEditorialStack(authorSession(world));
  ({ entryId } = await seedEditorialEntry(stack, world));
  const first = await stack.history(entryId, '?limit=1');
  envelope = decodeCursor(String(first.body.nextCursor));
});

const omit = (member: string): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(envelope).filter(([key]) => key !== member),
  );

const read = async (query: string) => {
  const before = snapshot(entryId);
  const response = await stack.history(entryId, query);
  return { response, before };
};

describe('CMS-03B-03 limit and filter matrix through the real stack', () => {
  it.each([
    ['a negative limit', '?limit=-1'],
    ['a limit with a plus sign', '?limit=%2B5'],
    ['a limit in exponent notation', '?limit=1e1'],
    ['a limit with a leading space', '?limit=%205'],
    ['a limit with a leading zero', '?limit=05'],
    ['an empty limit', '?limit='],
    ['a limit written as 50.0', '?limit=50.0'],
    ['a limit above the maximum of 50', '?limit=51'],
    ['a limit of zero', '?limit=0'],
    ['a repeated cursor member', '?cursor=a&cursor=b'],
    [
      'a repeated compareRevisionId member',
      '?compareRevisionId=a&compareRevisionId=b',
    ],
    ['an entryId smuggled as a query member', `?entryId=${randomUUID()}`],
    ['an ownerId smuggled as a query member', `?ownerId=${randomUUID()}`],
  ])(
    '%s is a structural 400 INVALID_REQUEST and the snapshot is unchanged',
    async (_label, query) => {
      const { response, before } = await read(query);
      expectRefusal(
        response,
        { status: 400, code: 'INVALID_REQUEST' },
        entryId,
        before,
      );
    },
  );

  it.each([
    ['an uppercase state', '?state=DRAFT', '/state', 'invalid_value'],
    [
      'a compareRevisionId that is empty',
      '?compareRevisionId=',
      '/compareRevisionId',
      'invalid_value',
    ],
    ['a locale ending in a hyphen', '?locale=en-', '/locale', 'locale_invalid'],
    ['a one-character locale', '?locale=e', '/locale', 'locale_invalid'],
  ])(
    '%s is a 400 naming its pointer and code and the snapshot is unchanged',
    async (_label, query, pointer, code) => {
      const { response, before } = await read(query);
      expectRefusal(
        response,
        {
          status: 400,
          code: 'INVALID_REQUEST',
          violations: [violation(pointer, code)],
        },
        entryId,
        before,
      );
    },
  );

  it('a 36-character locale names /locale twice (grammar and length) and the snapshot is unchanged', async () => {
    const { response, before } = await read(`?locale=${'a'.repeat(36)}`);
    expect(response.status, response.text).toBe(400);
    expect(violationsOf(response)).toEqual([
      violation('/locale', 'locale_invalid'),
      violation('/locale', 'invalid_value'),
    ]);
    expect(snapshot(entryId)).toEqual(before);
  });

  it('a compareRevisionId written with uppercase hexadecimal is a structural 400', async () => {
    const { response, before } = await read(
      `?compareRevisionId=${randomUUID().toUpperCase()}`,
    );
    expectRefusal(
      response,
      { status: 400, code: 'INVALID_REQUEST' },
      entryId,
      before,
    );
  });
});

describe('CMS-03B-03 cursor envelope matrix through the real stack', () => {
  const structural: ReadonlyArray<readonly [string, () => string]> = [
    [
      'an unsigned copy with a keyId that is not a UUID',
      () => encodeCursor({ ...envelope, keyId: 'nope' }, { sign: false }),
    ],
    [
      'an unsigned copy with a signature that is not hexadecimal',
      () =>
        encodeCursor(
          {
            ...envelope,
            signature: `zz${String(envelope.signature).slice(2)}`,
          },
          { sign: false },
        ),
    ],
    [
      'an unsigned copy with a truncated signature',
      () =>
        encodeCursor(
          { ...envelope, signature: String(envelope.signature).slice(0, 10) },
          { sign: false },
        ),
    ],
    [
      'an unsigned copy with an extra member',
      () => encodeCursor({ ...envelope, extra: 1 }, { sign: false }),
    ],
    [
      'an unsigned copy without the queryHash member',
      () =>
        encodeCursor(omit('queryHash'), {
          sign: false,
        }),
    ],
    [
      'an unsigned copy whose keyId is a number',
      () => encodeCursor({ ...envelope, keyId: 5 }, { sign: false }),
    ],
    [
      'a correctly signed envelope with an extra member',
      () => encodeCursor({ ...envelope, extra: 'x' }),
    ],
    [
      'a correctly signed envelope without the expiresAt member',
      () => encodeCursor(omit('expiresAt')),
    ],
  ];

  it.each(structural)(
    '%s is a structural 400 INVALID_REQUEST',
    async (_label, make) => {
      const { response, before } = await read(`?limit=1&cursor=${make()}`);
      expectRefusal(
        response,
        { status: 400, code: 'INVALID_REQUEST' },
        entryId,
        before,
      );
    },
  );

  const restart: ReadonlyArray<readonly [string, () => string]> = [
    [
      'an unsigned copy with a malformed expiresAt',
      () =>
        encodeCursor({ ...envelope, expiresAt: 'tomorrow' }, { sign: false }),
    ],
    [
      'a correctly signed cursor that expired in 1970',
      () => encodeCursor({ ...envelope, expiresAt: '1' }),
    ],
    [
      'a correctly signed cursor that expires more than 24 hours from now',
      () =>
        encodeCursor({
          ...envelope,
          expiresAt: String(Math.floor(Date.now() / 1000) + 90_000),
        }),
    ],
    [
      'a correctly signed cursor bound to another query hash',
      () => encodeCursor({ ...envelope, queryHash: 'a'.repeat(64) }),
    ],
    [
      'a correctly signed cursor whose queryHash is not a hash',
      () => encodeCursor({ ...envelope, queryHash: 'zz' }),
    ],
    [
      'a correctly signed cursor whose last revision number is zero',
      () => encodeCursor({ ...envelope, lastRevisionNumber: '0' }),
    ],
    [
      'a correctly signed cursor whose last revision number is not a number',
      () => encodeCursor({ ...envelope, lastRevisionNumber: 'x' }),
    ],
    [
      'a correctly signed cursor whose last revision id is not a UUID',
      () => encodeCursor({ ...envelope, lastRevisionId: 'nope' }),
    ],
    [
      'a correctly signed cursor whose expiresAt is a number',
      () => encodeCursor({ ...envelope, expiresAt: 5 }),
    ],
    [
      'a cursor signed under a key id the Vault does not hold',
      () => encodeCursor({ ...envelope, keyId: randomUUID() }),
    ],
  ];

  it.each(restart)(
    '%s is the typed 409 CONFLICT restart with a refresh recovery',
    async (_label, make) => {
      const { response, before } = await read(`?limit=1&cursor=${make()}`);
      expectRefusal(
        response,
        {
          status: 409,
          code: 'CONFLICT',
          details: { recoveryAction: 'refresh' },
        },
        entryId,
        before,
      );
    },
  );

  it('control: the same envelope re-signed unchanged is accepted and serves the next page', async () => {
    const { response } = await read(
      `?limit=1&cursor=${encodeCursor(envelope)}`,
    );
    expect(response.status, response.text).toBe(200);
    expect((response.body.items as unknown[]).length).toBe(1);
  });
});
