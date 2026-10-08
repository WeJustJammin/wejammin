/**
 * Slice 10 evidence lane EA, CMS-03B-04 (restore revision) through the real stack: browser request
 * -> first-party proxy -> production Worker -> production RPC adapter -> Kong -> PostgREST ->
 * newest SQL. Only the verified session and an always-allow rate limiter are supplied.
 *
 * Every rejected request is asserted for its exact stable pointer and code and an unchanged
 * durable state; the chain id the compare read names must equal the chain the command re-derives
 * (a different id is the typed migration_chain_mismatch); a source revision the caller cannot read
 * is the same empty 404 whether it is absent, hidden or belongs to another entry; the idempotency
 * key binds the whole request including the chain and CAS version; and a lost response is
 * reconciled by the same-key replay without a second revision, audit row or outbox event.
 *
 * Commits fixtures; run right after `pnpm db:reset` and reset again afterwards.
 */
import { randomUUID } from 'node:crypto';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  type EditorialWorld,
  appendEntryBody,
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
  type Violation,
  expectRefusal,
  memberWithoutGrant,
  outsider,
  violation,
  violationsOf,
  snapshot,
} from './support/ev-ea-support';

let world: EditorialWorld;
let stack: EditorialStack;
let entryId = '';
let sourceRevisionId = '';
let otherEntryRevisionId = '';
let chainId = '';
let version = '3';

const body = (overrides: Readonly<Record<string, unknown>> = {}) => ({
  entryId,
  revisionId: sourceRevisionId,
  migrationChainId: chainId,
  expectedVersion: version,
  ...overrides,
});

const restore = (
  payload: unknown,
  options: Readonly<{ ifMatch?: string; idempotencyKey?: string }> = {},
  revision: string = sourceRevisionId,
) =>
  stack.restore(entryId, revision, payload, {
    ifMatch: options.ifMatch ?? version,
    ...(options.idempotencyKey === undefined
      ? {}
      : { idempotencyKey: options.idempotencyKey }),
  });

beforeAll(async () => {
  world = await prepareEditorialWorld(createIsolatedCmsOwner());
  stack = createEditorialStack(authorSession(world));
  ({ entryId, firstRevisionId: sourceRevisionId } = await seedEditorialEntry(
    stack,
    world,
  ));
  const other = await seedEditorialEntry(stack, world);
  otherEntryRevisionId = other.firstRevisionId;
  const history = await stack.history(
    entryId,
    `?compareRevisionId=${sourceRevisionId}`,
  );
  expect(history.status, history.text).toBe(200);
  const compare = history.body.compare as {
    leftRevisionId: string;
    restore: { migrationChainId: string };
  };
  expect(compare.leftRevisionId).toBe(sourceRevisionId);
  chainId = compare.restore.migrationChainId;
});

type InvalidCase = Readonly<{
  label: string;
  payload: () => unknown;
  expected: () => readonly Violation[];
}>;

const invalidCases: readonly InvalidCase[] = [
  {
    label: 'an unknown request member',
    payload: () => body({ unexpected: 1 }),
    expected: () => [violation('/unexpected', 'unknown_field')],
  },
  {
    label: 'a migrationChainId that is not a UUID',
    payload: () => body({ migrationChainId: 'nope' }),
    expected: () => [violation('/migrationChainId', 'invalid_value')],
  },
  {
    label: 'a zero expectedVersion',
    payload: () => body({ expectedVersion: '0' }),
    expected: () => [violation('/expectedVersion', 'version_invalid')],
  },
  {
    label: 'a body revisionId that differs from the path revision',
    payload: () => body({ revisionId: randomUUID() }),
    expected: () => [violation('/revisionId', 'mismatch')],
  },
  {
    label: 'a body entryId that differs from the path entry',
    payload: () => body({ entryId: randomUUID() }),
    expected: () => [violation('/entryId', 'mismatch')],
  },
];

describe('CMS-03B-04 request validation through the real stack', () => {
  it.each(invalidCases.map((c) => [c.label, c] as const))(
    '%s is a 422 with its stable pointer and code and nothing is written',
    async (_label, { payload, expected }) => {
      const before = snapshot(entryId);
      const response = await restore(payload());
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

  it('a malformed revision id in the path is a structural 400 naming /revisionId and nothing is written', async () => {
    const before = snapshot(entryId);
    const response = await restore(body(), {}, 'not-a-uuid');
    expectRefusal(
      response,
      {
        status: 400,
        code: 'INVALID_REQUEST',
        violations: [violation('/revisionId', 'invalid_value')],
      },
      entryId,
      before,
    );
  });

  it('a chain id that is not the chain the command re-derives is the typed 409 migration_chain_mismatch and nothing is written', async () => {
    const before = snapshot(entryId);
    const response = await restore(body({ migrationChainId: randomUUID() }));
    expectRefusal(
      response,
      {
        status: 409,
        code: 'CONFLICT',
        details: {
          reasonCode: 'migration_chain_mismatch',
          recoveryAction: 'refresh',
        },
      },
      entryId,
      before,
    );
  });
});

describe('CMS-03B-04 401, 403 and 404 through the real stack', () => {
  it('no session is a 401 with a reauthenticate hint and nothing is written', async () => {
    const before = snapshot(entryId);
    stack.as(null);
    try {
      expectRefusal(
        await restore(body()),
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
      expectRefusal(
        await restore(body()),
        { status: 403, code: 'FORBIDDEN' },
        entryId,
        before,
      );
    } finally {
      stack.as(authorSession(world));
    }
  });

  it('a person outside the owning organization gets an empty 404 and nothing is written', async () => {
    const principal = outsider(world);
    const before = snapshot(entryId);
    stack.as(principal);
    try {
      const response = await restore(body());
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

  it('a source revision that does not exist is an empty 404 and nothing is written', async () => {
    const absent = randomUUID();
    const before = snapshot(entryId);
    const response = await restore(body({ revisionId: absent }), {}, absent);
    expectRefusal(
      response,
      { status: 404, code: 'NOT_FOUND' },
      entryId,
      before,
    );
    expect(response.body.details).toEqual({});
  });

  it('a source revision that belongs to another entry is the same empty 404 and nothing is written', async () => {
    const before = snapshot(entryId);
    const response = await restore(
      body({ revisionId: otherEntryRevisionId }),
      {},
      otherEntryRevisionId,
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

describe('CMS-03B-04 concurrency, idempotency and reconciliation through the real stack', () => {
  it('a stale expectedVersion is a definite 409 VERSION_MISMATCH and nothing is written', async () => {
    const before = snapshot(entryId);
    const response = await restore(body({ expectedVersion: '2' }), {
      ifMatch: '2',
    });
    expectRefusal(
      response,
      {
        status: 409,
        code: 'CONFLICT',
        details: { conflict: 'VERSION_MISMATCH' },
      },
      entryId,
      before,
    );
    expect(response.headers.get('retry-after')).toBeNull();
  });

  it('a lost response is an unknown outcome and the same-key replay returns the committed restore without a second effect', async () => {
    const before = snapshot(entryId);
    const eventsBefore = outboxByType(entryId);
    const key = `ev-ea-restore-${randomUUID()}`;
    stack.loseNextResponse();
    const lost = await restore(body(), { idempotencyKey: key });
    expect(lost.status).toBe(503);
    expect(lost.headers.get('x-cms-editorial-outcome')).toBe('unknown');
    const committed = snapshot(entryId);
    expect(committed.revisions).toBe(before.revisions + 1);
    expect(committed.audit).toBe(before.audit + 1);
    // Atomic evidence: the revision-created event and the chain-evidence event commit together.
    expect(committed.outbox).toBe(before.outbox + 2);
    const events = outboxByType(entryId);
    expect(events['cms.entry.revision-restored.v1']).toBe(
      (eventsBefore['cms.entry.revision-restored.v1'] ?? 0) + 1,
    );

    const replay = await restore(body(), { idempotencyKey: key });
    expect(replay.status, replay.text).toBe(201);
    expect(replay.body.state).toBe('draft');
    expect(replay.body.entryVersion).toBe('4');
    expect((replay.body.parentRevisionIds as readonly string[])[1]).toBe(
      sourceRevisionId,
    );
    expect(snapshot(entryId)).toEqual(committed);

    // The same key now bound to a request with another CAS version is the typed mismatch.
    const mismatch = await restore(body({ expectedVersion: '4' }), {
      ifMatch: '4',
      idempotencyKey: key,
    });
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
      committed,
    );
    version = '4';
  });

  it('an append after the restore proves the restore is a new draft: the history is append-only', async () => {
    const response = await stack.append(
      entryId,
      appendEntryBody(world, entryId, 'After restore', '4', '4'),
      { ifMatch: '4' },
    );
    expect(response.status, response.text).toBe(201);
    const history = await stack.history(entryId);
    const numbers = (history.body.items as { revisionNumber: string }[]).map(
      (item) => item.revisionNumber,
    );
    expect(numbers).toEqual(['5', '4', '3', '2', '1']);
  });
});
