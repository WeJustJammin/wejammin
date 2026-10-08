/**
 * Slice 10 evidence lane EA, CMS-03B-01 (append revision) through the real stack: browser request
 * -> first-party proxy -> production Worker -> production RPC adapter -> Kong -> PostgREST ->
 * newest SQL. No response is faked; the only supplied seams are the verified session and an
 * always-allow rate limiter (see support/cms-editorial-stack.ts).
 *
 * It proves what the route and SQL suites cannot show together: every rejected request carries
 * the exact stable pointer and code, the fixed safe message, no echoed caller value and leaves no
 * durable row behind; the entry-version CAS, the idempotency key binding and the lifecycle guard
 * are the database's typed answers mapped by the Worker. The `rich_text.v1` boundary lives in
 * `phase-02-slice-10-ev-ea-rich-text.apispec.ts`.
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
import {
  type Violation,
  expectRefusal,
  setEntryLifecycle,
  violation,
  violationsOf,
  snapshot,
} from './support/ev-ea-support';

let world: EditorialWorld;
let stack: EditorialStack;
let entryId = '';
let version = '3';

const body = (overrides: Readonly<Record<string, unknown>> = {}) => ({
  ...appendEntryBody(world, entryId, 'Evidence title', version, version),
  ...overrides,
});

beforeAll(async () => {
  world = await prepareEditorialWorld(createIsolatedCmsOwner());
  stack = createEditorialStack(authorSession(world));
  ({ entryId } = await seedEditorialEntry(stack, world));
});

type InvalidCase = Readonly<{
  label: string;
  mutate: () => Record<string, unknown>;
  expected: readonly Violation[];
}>;

const invalidCases = (): readonly InvalidCase[] => [
  {
    label: 'a zero baseRevision',
    mutate: () => body({ baseRevision: '0' }),
    expected: [violation('/baseRevision', 'version_invalid')],
  },
  {
    label: 'a zero expectedVersion',
    mutate: () => body({ expectedVersion: '0' }),
    expected: [violation('/expectedVersion', 'version_invalid')],
  },
  {
    label: 'an empty changedPaths list',
    mutate: () => body({ changedPaths: [] }),
    expected: [violation('/changedPaths', 'changed_paths_min')],
  },
  {
    label: 'a repeated changed path',
    mutate: () => {
      const pointer = `/fields/${world.titleFieldId}`;
      return body({ changedPaths: [pointer, pointer] });
    },
    expected: [violation('/changedPaths', 'changed_paths_must_be_unique')],
  },
  {
    label: 'a 129-pointer changedPaths list',
    mutate: () =>
      body({
        changedPaths: Array.from(
          { length: 129 },
          () => `/fields/${randomUUID()}`,
        ),
      }),
    expected: [violation('/changedPaths', 'changed_paths_max')],
  },
  {
    label: 'a /blocks changed path',
    mutate: () => body({ changedPaths: ['/blocks/0'] }),
    expected: [violation('/changedPaths/0', 'field_pointer_invalid')],
  },
  {
    label: 'a values key that is not a stable field UUID',
    mutate: () => body({ values: { 'not-a-uuid': 'x' } }),
    expected: [violation('/values/not-a-uuid', 'invalid_value')],
  },
  {
    label: 'a 129-key values object',
    mutate: () =>
      body({
        values: Object.fromEntries(
          Array.from({ length: 129 }, () => [randomUUID(), 1]),
        ),
      }),
    expected: [violation('/values', 'entry_values_max_keys')],
  },
  {
    label: 'a values object nested nine levels deep',
    mutate: () => {
      let nested: unknown = 1;
      for (let level = 0; level < 8; level += 1) nested = { a: nested };
      return body({ values: { [world.titleFieldId]: nested } });
    },
    expected: [violation('/values', 'entry_values_json_depth')],
  },
  {
    label: 'a one-character locale',
    mutate: () => body({ locale: 'e' }),
    expected: [violation('/locale', 'locale_invalid')],
  },
  {
    label: 'a 36-character locale',
    mutate: () => body({ locale: 'a'.repeat(36) }),
    expected: [
      violation('/locale', 'locale_invalid'),
      violation('/locale', 'invalid_value'),
    ],
  },
  {
    label: 'a body entryId that differs from the path entry',
    mutate: () => body({ entryId: randomUUID() }),
    expected: [violation('/entryId', 'mismatch')],
  },
];

describe('CMS-03B-01 request validation through the real stack', () => {
  it('an unknown request member is a 422 naming that member and nothing is written', async () => {
    const before = snapshot(entryId);
    const response = await stack.append(
      entryId,
      body({ unexpected: true, ownerId: 'attacker' }),
      { ifMatch: version },
    );
    expectRefusal(
      response,
      {
        status: 422,
        code: 'VALIDATION_FAILED',
        violations: [violation('/unexpected', 'unknown_field')].concat(
          violation('/ownerId', 'unknown_field'),
        ),
      },
      entryId,
      before,
    );
    expect(response.text).not.toContain('attacker');
  });

  it.each(invalidCases().map((c) => [c.label, c] as const))(
    '%s is a 422 with its stable pointer and code and nothing is written',
    async (_label, { mutate, expected }) => {
      const before = snapshot(entryId);
      const response = await stack.append(entryId, mutate(), {
        ifMatch: version,
      });
      expectRefusal(
        response,
        { status: 422, code: 'VALIDATION_FAILED', violations: expected },
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

  it('a malformed entry id in the path is a structural 400 naming /entryId and nothing is written', async () => {
    const before = snapshot(entryId);
    const response = await stack.append('not-a-uuid', body(), {
      ifMatch: version,
    });
    expect(response.status, response.text).toBe(400);
    expect(response.body.code).toBe('INVALID_REQUEST');
    expect(violationsOf(response)).toEqual([
      violation('/entryId', 'invalid_value'),
    ]);
    expect(snapshot(entryId)).toEqual(before);
  });

  it('a request body over the 256 KiB ceiling is a 400 INVALID_REQUEST and nothing is written', async () => {
    const before = snapshot(entryId);
    const response = await stack.append(
      entryId,
      body({ values: { [world.titleFieldId]: 'a'.repeat(300_000) } }),
      { ifMatch: version },
    );
    expectRefusal(
      response,
      { status: 400, code: 'INVALID_REQUEST' },
      entryId,
      before,
    );
  });
});

describe('CMS-03B-01 concurrency and idempotency through the real stack', () => {
  it('a stale expectedVersion is a definite 409 VERSION_MISMATCH with reload recovery and nothing is written', async () => {
    const before = snapshot(entryId);
    const stale = String(Number(version) - 1);
    const response = await stack.append(
      entryId,
      appendEntryBody(world, entryId, 'Stale', version, stale),
      { ifMatch: stale },
    );
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
    expect(response.headers.get('retry-after')).toBeNull();
  });

  it('the same Idempotency-Key with a different body is a 409 IDEMPOTENCY_MISMATCH and adds nothing', async () => {
    const key = `ev-ea-${randomUUID()}`;
    const sent = version;
    const first = await stack.append(
      entryId,
      appendEntryBody(world, entryId, 'Keyed', sent, sent),
      { ifMatch: sent, idempotencyKey: key },
    );
    expect(first.status, first.text).toBe(201);
    version = String(first.body.entryVersion);
    const before = snapshot(entryId);
    const second = await stack.append(
      entryId,
      appendEntryBody(world, entryId, 'Keyed differently', sent, sent),
      { ifMatch: sent, idempotencyKey: key },
    );
    expectRefusal(
      second,
      {
        status: 409,
        code: 'CONFLICT',
        details: {
          conflict: 'IDEMPOTENCY_MISMATCH',
          recoveryAction: 'use_new_idempotency_key',
        },
      },
      entryId,
      before,
    );
  });

  it('an append to an entry that is not active is the policy-safe 404 NOT_FOUND and nothing is written', async () => {
    setEntryLifecycle(entryId, 'archived');
    try {
      const before = snapshot(entryId);
      const response = await stack.append(entryId, body(), {
        ifMatch: version,
      });
      expectRefusal(
        response,
        { status: 404, code: 'NOT_FOUND' },
        entryId,
        before,
      );
      expect(response.body.details ?? {}).toEqual({});
    } finally {
      setEntryLifecycle(entryId, 'active');
    }
  });

  it('a well-formed baseRevision that names no readable revision is a 422 at /baseRevision and nothing is written', async () => {
    const before = snapshot(entryId);
    const response = await stack.append(
      entryId,
      body({ baseRevision: '999999' }),
      { ifMatch: version },
    );
    expectRefusal(
      response,
      {
        status: 422,
        code: 'VALIDATION_FAILED',
        violations: [violation('/baseRevision', 'invalid')],
      },
      entryId,
      before,
    );
  });
});
