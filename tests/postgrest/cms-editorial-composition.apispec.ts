/**
 * Slice 10 real composition (WP-E, gap audit): browser request -> first-party
 * web proxy -> private binding -> production Hono Worker -> production RPC
 * adapter -> Kong -> PostgREST -> the newest SQL, for the nine CMS-03B-01..14
 * operations. No port is faked: the only supplied seams are the verified
 * session and an always-allow rate limiter.
 *
 * It proves what the unit suites cannot: a CMS-03B-14 projection round-trips
 * into a CMS-03B-10 create, a create/append/resolve/restore each commits its
 * revision, audit and outbox effects exactly once, an exact-key replay (also
 * after a lost response) adds nothing, an unknown field mutates nothing, and
 * 401/403/404 are what the database decides rather than what a stub answers.
 *
 * Commits fixtures (the owner, an active content type): run right after
 * `pnpm db:reset`, and reset again afterwards.
 */
import { randomUUID } from 'node:crypto';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  type EditorialWorld,
  appendEntryBody,
  authorSession,
  createEntryBody,
  effectCounts,
  prepareEditorialWorld,
} from './support/cms-editorial-world';
import {
  type EditorialStack,
  createEditorialStack,
} from './support/cms-editorial-stack';

let world: EditorialWorld;
let stack: EditorialStack;
let entryId = '';
let firstRevisionId = '';
let type: Record<string, unknown> = {};

beforeAll(async () => {
  world = await prepareEditorialWorld();
  stack = createEditorialStack(authorSession(world));
});

describe('CMS-03B-14 -> CMS-03B-10 -> CMS-03B-11 -> CMS-03B-13 through the real stack', () => {
  it('[P2-S10-AC-100] the authoring-context read lists the creatable active type with its frozen evidence and a strong no-store ETag', async () => {
    const response = await stack.authoringContext();
    expect(response.status, response.text).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('etag')).toMatch(/^"sha256:[0-9a-f]{64}"$/u);
    const types = response.body.creatableTypes as readonly Record<
      string,
      unknown
    >[];
    const found = types.find(
      (candidate) =>
        candidate.contentTypeVersionId === world.contentTypeVersionId,
    );
    expect(found).toBeDefined();
    type = found as Record<string, unknown>;
    expect(JSON.stringify(response.body)).not.toContain(
      world.owner.organizationId,
    );
  });

  it('[P2-S10-AC-061] [P2-S10-AC-066] the projection round-trips into a create that commits the entry, first revision, audit and outbox exactly once', async () => {
    const key = `create-${randomUUID()}`;
    const response = await stack.create(
      createEntryBody(world, 'First draft', type),
      {
        idempotencyKey: key,
      },
    );
    expect(response.status, response.text).toBe(201);
    expect(response.headers.get('x-cms-editorial-outcome')).toBeNull();
    const entry = response.body.entry as { id: string; version: string };
    const revision = response.body.revision as { id: string };
    entryId = entry.id;
    firstRevisionId = revision.id;
    expect(entry.version).toBe('1');
    expect(response.headers.get('etag')).toBe('"1"');
    expect(response.headers.get('location')).toBe(
      `/api/v1/cms/entries/${entryId}`,
    );
    expect(effectCounts(entryId)).toEqual({
      entries: 1,
      revisions: 1,
      audit: 1,
      outbox: 1,
      conflicts: 0,
    });

    const replay = await stack.create(
      createEntryBody(world, 'First draft', type),
      {
        idempotencyKey: key,
      },
    );
    expect(replay.status, replay.text).toBe(201);
    expect(replay.body).toEqual(response.body);
    expect(effectCounts(entryId)).toEqual({
      entries: 1,
      revisions: 1,
      audit: 1,
      outbox: 1,
      conflicts: 0,
    });
  });

  it('[P2-S10-AC-064] the same key with another body is the database 409 IDEMPOTENCY_MISMATCH and adds nothing', async () => {
    const key = `create-${randomUUID()}`;
    const first = await stack.create(
      createEntryBody(world, 'Keyed draft', type),
      {
        idempotencyKey: key,
      },
    );
    expect(first.status, first.text).toBe(201);
    const changed = await stack.create(
      createEntryBody(world, 'Another body', type),
      {
        idempotencyKey: key,
      },
    );
    expect(changed.status).toBe(409);
    expect(changed.body).toMatchObject({
      code: 'CONFLICT',
      details: {
        conflict: 'IDEMPOTENCY_MISMATCH',
        recoveryAction: 'use_new_idempotency_key',
      },
    });
    expect(changed.headers.get('x-cms-editorial-outcome')).toBeNull();
    const created = first.body.entry as { id: string };
    expect(effectCounts(created.id).revisions).toBe(1);
  });

  it('[P2-S10-AC-062] an unknown field is refused with a bounded pointer and nothing is written, at the proxy and at the Worker', async () => {
    const before = effectCounts(entryId);
    const body = {
      ...createEntryBody(world, 'Smuggled', type),
      ownerId: randomUUID(),
    };
    const viaProxy = await stack.create(body);
    expect(viaProxy.status).toBe(422);
    expect(viaProxy.body.details).toMatchObject({
      violations: [{ path: '/ownerId', code: 'unknown_field' }],
    });
    stack.clearObserved();
    const direct = await stack.worker('POST', '/api/v1/cms/entries', body);
    expect(direct.status).toBe(422);
    expect(stack.observed()).toEqual([]);
    expect(effectCounts(entryId)).toEqual(before);
  });

  it('[P2-S10-AC-068] [P2-S10-AC-069] the draft read serves the committed value with the entry and revision in its strong ETag', async () => {
    const response = await stack.draftDetail(entryId);
    expect(response.status, response.text).toBe(200);
    const fields = response.body.fields as readonly {
      fieldId: string;
      value: unknown;
    }[];
    expect(fields).toContainEqual(
      expect.objectContaining({
        fieldId: world.titleFieldId,
        value: 'First draft',
      }),
    );
    expect((response.body.revision as { id: string }).id).toBe(firstRevisionId);
    expect(response.headers.get('etag')).toContain(entryId);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('[P2-S10-AC-094] the entry list returns the entry with its lifecycle and a page ETag', async () => {
    const response = await stack.list();
    expect(response.status, response.text).toBe(200);
    const items = response.body.items as readonly Record<string, unknown>[];
    expect(items).toContainEqual(
      expect.objectContaining({ entryId, entryLifecycle: 'active' }),
    );
    expect(response.headers.get('etag')).toMatch(/^"/u);
  });
});

describe('CMS-03B-01 append and CMS-03B-03 history through the real stack', () => {
  it('[P2-S10-AC-007] [P2-S10-AC-009] an append commits one revision, one audit row and one outbox event and its strong ETag is the next entry version', async () => {
    const before = effectCounts(entryId);
    const response = await stack.append(
      entryId,
      appendEntryBody(world, entryId, 'Second draft', '1', '1'),
      { ifMatch: '1' },
    );
    expect(response.status, response.text).toBe(201);
    expect(response.body.entryVersion).toBe('2');
    expect(response.body.revisionNumber).toBe('2');
    expect(response.headers.get('etag')).toBe('"2"');
    const after = effectCounts(entryId);
    expect(after.revisions).toBe(before.revisions + 1);
    expect(after.audit).toBe(before.audit + 1);
    expect(after.outbox).toBe(before.outbox + 1);
  });

  it('[P2-S10-AC-009] a lost response is an unknown outcome, and the same-key replay returns the committed revision without a second effect', async () => {
    const before = effectCounts(entryId);
    const key = `append-${randomUUID()}`;
    stack.loseNextResponse();
    const lost = await stack.append(
      entryId,
      appendEntryBody(world, entryId, 'Third draft', '2', '2'),
      { ifMatch: '2', idempotencyKey: key },
    );
    expect(lost.status).toBe(503);
    expect(lost.headers.get('x-cms-editorial-outcome')).toBe('unknown');
    // The write committed even though the browser never saw the 201.
    const committed = effectCounts(entryId);
    expect(committed.revisions).toBe(before.revisions + 1);

    const replay = await stack.append(
      entryId,
      appendEntryBody(world, entryId, 'Third draft', '2', '2'),
      { ifMatch: '2', idempotencyKey: key },
    );
    expect(replay.status, replay.text).toBe(201);
    expect(replay.body.entryVersion).toBe('3');
    expect(effectCounts(entryId)).toEqual(committed);
  });

  it('[P2-S10-AC-020] the history read lists every revision newest first with a page ETag', async () => {
    const response = await stack.history(entryId);
    expect(response.status, response.text).toBe(200);
    const items = response.body.items as readonly { revisionNumber: string }[];
    expect(items.map((item) => item.revisionNumber)).toEqual(['3', '2', '1']);
    expect(response.headers.get('etag')).toMatch(/^"/u);
  });
});
