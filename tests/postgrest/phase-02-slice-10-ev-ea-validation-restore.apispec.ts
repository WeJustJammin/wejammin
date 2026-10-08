/**
 * Slice 10 evidence lane EA (AC-023, AC-025), CMS-03B-04: the request-value, header and path matrix
 * through the real stack. Every case names the exact pointer and stable code the Worker or the
 * database publishes and leaves the database-wide `snapshot` (entries, revisions, values,
 * relations, conflicts, manifests, reservations, outbox, audit) unchanged. Complements
 * `phase-02-slice-10-ev-ea-restore.apispec.ts`, which holds the headline cases.
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
  snapshot,
  violation,
  violationsOf,
} from './support/ev-ea-support';

let stack: EditorialStack;
let world: EditorialWorld;
let entryId = '';
let sourceId = '';
let chainId = '';

const body = (overrides: Readonly<Record<string, unknown>> = {}) => ({
  entryId,
  revisionId: sourceId,
  migrationChainId: chainId,
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
  ({ entryId, firstRevisionId: sourceId } = await seedEditorialEntry(
    stack,
    world,
  ));
  const history = await stack.history(
    entryId,
    `?compareRevisionId=${sourceId}`,
  );
  expect(history.status, history.text).toBe(200);
  chainId = (history.body.compare as { restore: { migrationChainId: string } })
    .restore.migrationChainId;
});

const restore = (
  payload: unknown,
  options: Record<string, unknown> = { ifMatch: '3' },
  revision: string = sourceId,
  entry: string = entryId,
) => stack.restore(entry, revision, payload, options as never);

describe('CMS-03B-04 request-value matrix through the real stack', () => {
  const cases: ReadonlyArray<readonly [string, () => unknown, string, string]> =
    [
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
        'a numeric expectedVersion',
        () => body({ expectedVersion: 3 }),
        '/expectedVersion',
        'invalid_value',
      ],
      [
        'a missing expectedVersion',
        () => without('expectedVersion'),
        '/expectedVersion',
        'invalid_value',
      ],
      [
        'a migrationChainId with uppercase hexadecimal',
        () => body({ migrationChainId: chainId.toUpperCase() }),
        '/migrationChainId',
        'invalid',
      ],
      [
        'an empty migrationChainId',
        () => body({ migrationChainId: '' }),
        '/migrationChainId',
        'invalid_value',
      ],
      [
        'a numeric migrationChainId',
        () => body({ migrationChainId: 5 }),
        '/migrationChainId',
        'invalid_value',
      ],
      [
        'a missing migrationChainId',
        () => without('migrationChainId'),
        '/migrationChainId',
        'invalid_value',
      ],
      [
        'a body revisionId written with uppercase hexadecimal',
        () => body({ revisionId: sourceId.toUpperCase() }),
        '/revisionId',
        'mismatch',
      ],
      [
        'a missing revisionId',
        () => without('revisionId'),
        '/revisionId',
        'invalid_value',
      ],
      [
        'a body entryId that is not a UUID',
        () => body({ entryId: 'nope' }),
        '/entryId',
        'invalid_value',
      ],
      [
        'a missing entryId',
        () => without('entryId'),
        '/entryId',
        'invalid_value',
      ],
      [
        'a forged ownerId member',
        () => body({ ownerId: randomUUID() }),
        '/ownerId',
        'unknown_field',
      ],
      [
        'a forged context member',
        () => body({ context: { actingPartyId: randomUUID() } }),
        '/context',
        'unknown_field',
      ],
      [
        'a forged actorId member',
        () => body({ actorId: randomUUID() }),
        '/actorId',
        'unknown_field',
      ],
      ['a request body that is an array', () => [], '/', 'invalid_value'],
      ['a request body that is null', () => null, '/', 'invalid_value'],
    ];

  it.each(cases.map((c) => [c[0], c] as const))(
    '%s is a 422 at its stable pointer with its stable code and the snapshot is unchanged',
    async (_label, [, payload, pointer, code]) => {
      const before = snapshot(entryId);
      const response = await restore(payload());
      expectRefusal(
        response,
        {
          status: 422,
          code: 'VALIDATION_FAILED',
          violations: [violation(pointer, code)],
        },
        entryId,
        before,
      );
    },
  );

  it('a request body that is a JSON string is a 422 at the root pointer and the snapshot is unchanged', async () => {
    const before = snapshot(entryId);
    const response = await restore('"x"');
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
    const response = await restore('{not json');
    expectRefusal(
      response,
      { status: 400, code: 'INVALID_REQUEST' },
      entryId,
      before,
    );
  });
});

describe('CMS-03B-04 header and path matrix through the real stack', () => {
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
      const response = await restore(body(), options);
      expect(response.status, response.text).toBe(status);
      expect(response.body.code).toBe(code);
      expect(violationsOf(response).map((v) => v.path)).toContain(pointer);
      expect(snapshot(entryId)).toEqual(before);
    },
  );

  it('a non-JSON Content-Type is a 415 UNSUPPORTED_MEDIA_TYPE naming the allowed media type and the snapshot is unchanged', async () => {
    const before = snapshot(entryId);
    const response = await restore(body(), {
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

  it('a malformed entry id in the path is a structural 400 naming /entryId and the snapshot is unchanged', async () => {
    const before = snapshot(entryId);
    const response = await restore(body(), { ifMatch: '3' }, sourceId, 'nope');
    expectRefusal(
      response,
      {
        status: 400,
        code: 'INVALID_REQUEST',
        violations: [violation('/entryId', 'invalid_value')],
      },
      entryId,
      before,
    );
  });

  it('an entry id written with uppercase hexadecimal in the path never matches the body entry and is a 422 mismatch', async () => {
    const before = snapshot(entryId);
    const response = await restore(
      body(),
      { ifMatch: '3' },
      sourceId,
      entryId.toUpperCase(),
    );
    expectRefusal(
      response,
      {
        status: 422,
        code: 'VALIDATION_FAILED',
        violations: [violation('/entryId', 'mismatch')],
      },
      entryId,
      before,
    );
  });

  it('an undeclared query parameter on the command route is a 400 and the snapshot is unchanged', async () => {
    const before = snapshot(entryId);
    const response = await stack.worker(
      'POST',
      `/api/v1/cms/entries/${entryId}/revisions/${sourceId}/restore?x=1`,
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
