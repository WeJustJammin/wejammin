/**
 * Slice 10 evidence lane EC: the five safe reads (CMS-03B-11, 12, 13, 14 and the
 * history read they sit beside) through the REAL chain - first-party proxy -> private
 * binding -> production Hono Worker -> production RPC adapter -> Kong -> PostgREST ->
 * the newest SQL. Only the verified session and an always-allow rate limiter are
 * supplied (tests/postgrest/support/cms-editorial-stack.ts); the 403/404/409/400 below
 * are what the database and the Worker decide, never a stub.
 *
 * It proves what the unit and pgTAP suites cannot say together:
 *   - reads are read-only: the durable fingerprint (audit, outbox, entries, revisions,
 *     values, conflicts, idempotency reservations) is identical before and after every
 *     read, every read is no-store with an ETag, and each emits one redacted event;
 *   - CMS-03B-12 conceals hidden/wrong-scope/absent conflicts and tells a visible but
 *     unassigned caller 403, serves a bounded open conflict with no ownership identifier,
 *     and never reaches the database for malformed addressing or an undeclared query;
 *   - CMS-03B-13 pages a keyset window with a signed cursor bound to actor and filter,
 *     lists only what the caller is assigned, and maps a malformed, tampered or foreign
 *     cursor to the declared 400/409;
 *   - CMS-03B-14 never reaches the database for a closed-grammar violation, serves the
 *     creatable types to an author/editor, and an author/editor who holds no
 *     `cms.schema_registry.read` is refused by the registry read.
 *
 * Commits fixtures (the owner, an active content type): run right after `pnpm db:reset`.
 */
import { randomUUID } from 'node:crypto';

import { beforeAll, describe, expect, it } from 'vitest';

import { createCmsApp, ownerSession } from './support/cms-app';
import { createIsolatedCmsOwner } from './support/cms-isolated-owner';
import { seedEditorialEntry } from './support/cms-editorial-seed';
import {
  type EditorialSession,
  type EditorialStack,
  createEditorialStack,
} from './support/cms-editorial-stack';
import {
  type EditorialWorld,
  appendEntryBody,
  authorSession,
  createEntryBody,
  effectCounts,
  prepareEditorialWorld,
} from './support/cms-editorial-world';
import { createAuthUser, createPerson, psql } from './support/stack';

let world: EditorialWorld;
let stack: EditorialStack;
let entryId = '';
let type: Record<string, unknown> = {};
let conflictId = '';
const author = (): EditorialSession => authorSession(world);

const durable = (): string =>
  psql(`
    select (select count(*) from audit_private.audit_events),
           (select count(*) from platform_private.outbox_events),
           (select count(*) from platform_private.cms_content_entries),
           (select count(*) from platform_private.cms_entry_revisions),
           (select count(*) from platform_private.cms_entry_field_values),
           (select count(*) from platform_private.cms_conflict_records),
           (select count(*) from platform_private.idempotency_records),
           (select coalesce(sum(version), 0) from platform_private.cms_content_entries)`);

/** A person with the given CMS grants in the owner organization, optionally a confirmed member. */
const principal = (
  options: Readonly<{ member: boolean; grants: readonly string[] }>,
): Readonly<{
  session: EditorialSession;
  authUserId: string;
  personId: string;
}> => {
  const authUserId = createAuthUser(randomUUID());
  const personId = createPerson(authUserId);
  if (options.member)
    psql(`
      insert into identity_private.membership_tenure(
        id, organization_id, person_id, state, provenance, governance_mode,
        starts_on, accepted_at, actor_id, version)
      values (gen_random_uuid(), '${world.owner.organizationId}', '${personId}',
              'confirmed', 'invitation', 'ungoverned', current_date,
              clock_timestamp(), '${world.owner.personId}', 1)`);
  for (const grant of options.grants)
    psql(`
      insert into identity_private.organization_actor_grant(
        organization_id, person_id, capability_code, valid_from, valid_through, active)
      values ('${world.owner.organizationId}', '${personId}', '${grant}',
              current_date, current_date + 30, true)`);
  return {
    authUserId,
    personId,
    session: {
      userId: authUserId,
      actingPartyId: world.owner.organizationId,
      capabilities: ['cms.author', 'cms.editor'],
      mfaFresh: false,
    },
  };
};

/**
 * Harness-only: right after `supabase db reset` PostgREST can still be reloading its schema cache
 * for the newest functions and answers a transient 500/503; wait (bounded) until the list read is
 * served so the first assertion measures the product, not the reload.
 */
const waitForPostgrest = async (stack: EditorialStack): Promise<void> => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = await stack.list('?limit=1');
    if (response.status !== 500 && response.status !== 503) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
};

beforeAll(async () => {
  world = await prepareEditorialWorld(createIsolatedCmsOwner());
  stack = createEditorialStack(author());
  await waitForPostgrest(stack);
  ({ entryId, type } = await seedEditorialEntry(stack, world));
  // Two more entries so the keyset list has a window to walk.
  for (const title of ['Walk two', 'Walk three']) {
    const created = await stack.create(createEntryBody(world, title, type));
    expect(created.status, created.text).toBe(201);
  }
  // A stale same-field save records one open conflict on the seeded entry.
  const stale = await stack.append(
    entryId,
    appendEntryBody(world, entryId, 'Stale write', '1', '3'),
    { ifMatch: '3' },
  );
  expect(stale.status, stale.text).toBe(409);
  const draft = await stack.draftDetail(entryId);
  conflictId = (draft.body.openConflict as { conflictId: string }).conflictId;
});

describe('EC reads are read-only, no-store and redacted', () => {
  it('[EC-072][EC-093][EC-099][EC-105] draft, conflict, list, preparation and history reads leave every durable fingerprint unchanged and answer no-store with an ETag', async () => {
    const before = durable();
    const entryBefore = effectCounts(entryId);
    const eventsBefore = stack.events().length;
    const responses = [
      await stack.draftDetail(entryId),
      await stack.conflictDetail(entryId, conflictId),
      await stack.list(),
      await stack.list('?limit=1'),
      await stack.authoringContext(),
      await stack.authoringContext(
        `?contentTypeVersionId=${String(type.contentTypeVersionId)}`,
      ),
      await stack.history(entryId),
    ];
    for (const response of responses) {
      expect(
        response.status,
        `${response.text} ${JSON.stringify(stack.observed().slice(-2))}`,
      ).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('etag')).toMatch(/^"/u);
      expect(response.headers.get('location')).toBeNull();
    }
    expect(durable()).toBe(before);
    expect(effectCounts(entryId)).toEqual(entryBefore);
    const emitted = stack.events().slice(eventsBefore);
    expect(emitted.map((event) => event.operationId)).toEqual([
      'CMS-03B-11',
      'CMS-03B-12',
      'CMS-03B-13',
      'CMS-03B-13',
      'CMS-03B-14',
      'CMS-03B-14',
      'CMS-03B-03',
    ]);
    for (const event of emitted) {
      expect(event.outcome).toBe('success');
      expect(event.status).toBe(200);
      expect(typeof event.durationMs).toBe('number');
      expect(event.requestId).toBeTruthy();
      const text = JSON.stringify(event);
      for (const forbidden of [
        entryId,
        conflictId,
        world.owner.organizationId,
        world.owner.personId,
        world.owner.authUserId,
        'Seed one',
        'Stale write',
      ])
        expect(text).not.toContain(forbidden);
      expect(Object.keys(event.metrics ?? {}).join(' ')).not.toMatch(
        /revision_created|audit|outbox/u,
      );
    }
  });
});

describe('EC CMS-03B-12 conflict detail through the real stack', () => {
  it('[EC-088][EC-092] serves the open conflict with typed preimages, a strong ETag and no ownership identifier', async () => {
    const response = await stack.conflictDetail(entryId, conflictId);
    expect(response.status, response.text).toBe(200);
    const paths = response.body.paths as readonly Record<string, unknown>[];
    expect(paths).toHaveLength(1);
    expect(paths[0]).toMatchObject({
      path: `/fields/${world.titleFieldId}`,
      base: { provenance: 'authored' },
      theirs: { provenance: 'authored' },
      yours: { provenance: 'authored' },
    });
    expect((response.body.conflict as { state: string }).state).toBe('open');
    expect(response.headers.get('etag')).toMatch(/^"[^"]+"$/u);
    expect(response.headers.get('etag')).not.toMatch(/^W\//u);
    const text = response.text;
    for (const forbidden of [
      world.owner.organizationId,
      world.owner.personId,
      world.owner.authUserId,
      'ownerId',
      'resolvedBy',
      'assignee',
    ])
      expect(text).not.toContain(forbidden);
  });

  it('[EC-089] never reaches the database for malformed addressing or an undeclared query', async () => {
    stack.clearObserved();
    const badEntry = await stack.conflictDetail('not-a-uuid', conflictId);
    expect(badEntry.status).toBe(400);
    const badConflict = await stack.conflictDetail(entryId, 'not-a-uuid');
    expect(badConflict.status).toBe(400);
    const query = await stack.worker(
      'GET',
      `/api/v1/cms/entries/${entryId}/conflicts/${conflictId}?state=open`,
    );
    expect(query.status).toBe(400);
    expect(stack.observed()).toEqual([]);
  });

  it('[EC-090] conceals an absent, foreign or outsider-read conflict as one empty 404 and tells a visible but unassigned member 403', async () => {
    const absent = await stack.conflictDetail(entryId, randomUUID());
    expect(absent.status).toBe(404);
    expect(absent.body.details).toEqual({});
    const otherEntry = await stack.conflictDetail(randomUUID(), conflictId);
    expect(otherEntry.status).toBe(404);
    expect(otherEntry.body.details).toEqual({});

    const outsider = principal({ member: false, grants: [] });
    const member = principal({
      member: true,
      grants: ['cms.author', 'cms.editor'],
    });
    try {
      stack.as(outsider.session);
      const hidden = await stack.conflictDetail(entryId, conflictId);
      expect(hidden.status, hidden.text).toBe(404);
      expect(hidden.body.details).toEqual({});
      stack.as(member.session);
      const unassigned = await stack.conflictDetail(entryId, conflictId);
      expect(unassigned.status, unassigned.text).toBe(403);
      expect(JSON.stringify(unassigned.body)).not.toContain(conflictId);
      expect(unassigned.text).not.toContain('Stale write');
    } finally {
      stack.as(author());
    }
  });
});

describe('EC CMS-03B-13 entry list through the real stack', () => {
  const walk = async (query: string) => {
    const seen: string[] = [];
    let cursor: string | null = null;
    for (let guard = 0; guard < 200; guard += 1) {
      const response = await stack.list(
        `${query}${cursor === null ? '' : `&cursor=${encodeURIComponent(cursor)}`}`,
      );
      expect(response.status, response.text).toBe(200);
      for (const item of response.body.items as readonly { entryId: string }[])
        seen.push(item.entryId);
      cursor = response.body.nextCursor as string | null;
      if (cursor === null) break;
    }
    return seen;
  };

  it('[EC-094] pages every assigned entry exactly once with a signed next cursor that ends the walk', async () => {
    const first = await stack.list('?limit=1');
    expect(first.status, first.text).toBe(200);
    expect((first.body.items as unknown[]).length).toBe(1);
    const cursor = first.body.nextCursor as string;
    expect(typeof cursor).toBe('string');
    expect(cursor.length).toBeLessThanOrEqual(512);
    const seen = await walk('?limit=1');
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toContain(entryId);
    expect(seen.length).toBeGreaterThanOrEqual(3);
    const full = await stack.list('?limit=50');
    expect(full.body.nextCursor === null).toBe(seen.length <= 50);
    expect((full.body.items as unknown[]).length).toBe(
      Math.min(seen.length, 50),
    );
  });

  it('[EC-095] rejects a closed-grammar violation before any database read', async () => {
    stack.clearObserved();
    for (const query of [
      '?ownerId=x',
      '?sort=asc',
      '?limit=0',
      '?limit=51',
      '?limit=1.5',
      '?state=nonsense',
      '?contentTypeId=not-a-uuid',
      `?cursor=${'c'.repeat(513)}`,
    ]) {
      const response = await stack.list(query);
      expect(response.status, query).toBe(400);
    }
    expect(stack.observed()).toEqual([]);
  });

  it('[EC-096] lists only the entries the caller is assigned and never an owner or assignee identifier', async () => {
    const ownList = await stack.list('?limit=50');
    const text = ownList.text;
    for (const forbidden of [
      world.owner.organizationId,
      world.owner.personId,
      world.owner.authUserId,
      'ownerId',
      'assigneeId',
    ])
      expect(text).not.toContain(forbidden);
    const other = principal({
      member: true,
      grants: ['cms.author', 'cms.editor'],
    });
    try {
      stack.as(other.session);
      const none = await stack.list('?limit=50');
      expect(none.status, none.text).toBe(200);
      expect(none.body.items).toEqual([]);
      expect(none.body.nextCursor).toBeNull();
    } finally {
      stack.as(author());
    }
  });

  it('[EC-097][EC-098] binds a cursor to its actor and filter, and maps a malformed, tampered or foreign cursor to the declared 400 or 409 with a safe restart', async () => {
    const first = await stack.list('?limit=1&state=draft');
    const cursor = first.body.nextCursor as string;
    expect(typeof cursor).toBe('string');
    const encoded = encodeURIComponent(cursor);

    // the same actor and the same filter: accepted
    const next = await stack.list(`?limit=1&state=draft&cursor=${encoded}`);
    expect(next.status, next.text).toBe(200);

    // another filter, another limit-independent scope: the cursor is bound to the filter
    const refiltered = await stack.list(
      `?limit=1&state=published&cursor=${encoded}`,
    );
    expect(refiltered.status, refiltered.text).toBe(409);
    expect(refiltered.body.code).toBe('CONFLICT');
    expect(JSON.stringify(refiltered.body.details)).not.toContain('signature');

    // tampered
    const tampered = `${cursor.slice(0, -2)}${cursor.endsWith('AA') ? 'BB' : 'AA'}`;
    const forged = await stack.list(
      `?limit=1&state=draft&cursor=${encodeURIComponent(tampered)}`,
    );
    expect([400, 409]).toContain(forged.status);
    expect(
      forged.status === 409 || forged.body.code === 'INVALID_REQUEST',
    ).toBe(true);

    // structurally malformed
    const malformed = await stack.list('?limit=1&cursor=%25%25');
    expect([400, 409]).toContain(malformed.status);

    // a different actor presenting the first actor's cursor
    const other = principal({
      member: true,
      grants: ['cms.author', 'cms.editor'],
    });
    try {
      stack.as(other.session);
      const replayed = await stack.list(
        `?limit=1&state=draft&cursor=${encoded}`,
      );
      expect(replayed.status, replayed.text).toBe(409);
      expect(replayed.body.code).toBe('CONFLICT');
      expect(replayed.text).not.toContain(world.owner.personId);
    } finally {
      stack.as(author());
    }
  });
});

describe('EC CMS-03B-14 authoring context through the real stack', () => {
  it('[EC-101] rejects a closed-grammar violation before any database read', async () => {
    stack.clearObserved();
    for (const query of [
      '?ownerId=x',
      '?schemaArtifactId=x',
      '?contentTypeVersionId=not-a-uuid',
      `?contentTypeVersionId=${randomUUID()}&contentTypeVersionId=${randomUUID()}`,
    ]) {
      const response = await stack.authoringContext(query);
      expect(response.status, query).toBe(400);
    }
    expect(stack.observed()).toEqual([]);
  });

  it('[EC-102] conceals an off-registry version as one empty 404', async () => {
    const response = await stack.authoringContext(
      `?contentTypeVersionId=${randomUUID()}`,
    );
    expect(response.status, response.text).toBe(404);
    expect(response.body.details).toEqual({});
  });

  it('[EC-102] serves an author/editor the creatable types, and the same person is refused by the schema registry read', async () => {
    const authorOnly = principal({
      member: true,
      grants: ['cms.author', 'cms.editor'],
    });
    try {
      stack.as(authorOnly.session);
      const context = await stack.authoringContext();
      expect(context.status, context.text).toBe(200);
      const types = context.body.creatableTypes as readonly Record<
        string,
        unknown
      >[];
      expect(
        types.some(
          (candidate) =>
            candidate.contentTypeVersionId === type.contentTypeVersionId,
        ),
      ).toBe(true);
      expect(context.text).not.toContain('schema_registry');
      // The preparation read did not make this person a registry reader: with the
      // registry-read claim the Worker admits, the database still refuses.
      const registry = createCmsApp(
        ownerSession(authorOnly.authUserId, world.owner.organizationId, [
          'cms.schema_registry.read',
        ]),
      );
      const list = await registry.send('GET', '/api/v1/cms/content-types');
      expect([403, 404]).toContain(list.status);
      expect(JSON.stringify(list.body)).not.toContain(
        String(type.contentTypeId),
      );
    } finally {
      stack.as(author());
    }
  });

  it('[EC-102] refuses a caller holding no author or editor grant before it reveals a type', async () => {
    const outsider = principal({ member: false, grants: [] });
    const member = principal({ member: true, grants: [] });
    try {
      for (const caller of [outsider, member]) {
        stack.as(caller.session);
        const response = await stack.authoringContext();
        expect([403, 404], response.text).toContain(response.status);
        expect(response.text).not.toContain(String(type.contentTypeVersionId));
      }
    } finally {
      stack.as(author());
    }
  });
});
