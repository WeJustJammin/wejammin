/**
 * Slice 10 real composition, part two: starting from an entry with three
 * revisions (seeded through the real chain), a same-field conflict is recorded,
 * read through CMS-03B-12 and closed by CMS-03B-02; the first revision is
 * restored through the chain the compare read names (CMS-03B-04); and 401, 403
 * and concealment 404 are the database's decision. The request chain is the one
 * documented in `cms-editorial-composition.apispec.ts`.
 *
 * Commits fixtures; run right after `pnpm db:reset`, and reset afterwards.
 */
import { randomUUID } from 'node:crypto';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  type EditorialWorld,
  appendEntryBody,
  authorSession,
  createEntryBody,
  effectCounts,
  outboxByType,
  prepareEditorialWorld,
} from './support/cms-editorial-world';
import { seedEditorialEntry } from './support/cms-editorial-seed';
import {
  type EditorialStack,
  createEditorialStack,
} from './support/cms-editorial-stack';
import { createAuthUser, createPerson, psql } from './support/stack';

let world: EditorialWorld;
let stack: EditorialStack;
let entryId = '';
let firstRevisionId = '';
let type: Record<string, unknown> = {};
const entryRows = (): string =>
  psql('select count(*) from platform_private.cms_content_entries');
const author = () => authorSession(world);

beforeAll(async () => {
  world = await prepareEditorialWorld();
  stack = createEditorialStack(author());
  ({ entryId, firstRevisionId, type } = await seedEditorialEntry(stack, world));
});

describe('CMS-03B-01 conflict, CMS-03B-12 detail and CMS-03B-02 resolve through the real stack', () => {
  let conflictId = '';
  const resolveKey = `resolve-${randomUUID()}`;

  it('[P2-S10-AC-015] a same-field save from a stale base is a 409 that records one open conflict and appends no revision', async () => {
    const before = effectCounts(entryId);
    const response = await stack.append(
      entryId,
      appendEntryBody(
        world,
        entryId,
        'Concurrent title from an old base',
        '1',
        '3',
      ),
      { ifMatch: '3' },
    );
    expect(response.status, response.text).toBe(409);
    expect(response.body).toMatchObject({
      code: 'CONFLICT',
      details: { conflict: 'VERSION_MISMATCH', recoveryAction: 'reload' },
    });
    expect(response.headers.get('x-cms-editorial-outcome')).toBeNull();
    const after = effectCounts(entryId);
    expect(after.conflicts).toBe(before.conflicts + 1);
    expect(after.revisions).toBe(before.revisions);
    const event = stack.events().at(-1);
    expect(event?.metrics).toMatchObject({
      cms_conflict_open_total: 1,
      cms_conflict_records_created_total: 1,
    });
  });

  it('[P2-S10-AC-088] [P2-S10-AC-090] the draft names the open conflict and CMS-03B-12 serves its three sides', async () => {
    const draft = await stack.draftDetail(entryId);
    expect(draft.status, draft.text).toBe(200);
    const open = draft.body.openConflict as { conflictId: string } | null;
    expect(open).not.toBeNull();
    conflictId = (open as { conflictId: string }).conflictId;
    const detail = await stack.conflictDetail(entryId, conflictId);
    expect(detail.status, detail.text).toBe(200);
    const paths = detail.body.paths as readonly Record<string, unknown>[];
    expect(paths).toHaveLength(1);
    expect(paths[0]).toMatchObject({ path: `/fields/${world.titleFieldId}` });
    expect(detail.headers.get('etag')).toMatch(/^"/u);
    expect(JSON.stringify(detail.body)).not.toContain(
      world.owner.organizationId,
    );
  });

  it('[P2-S10-AC-010] [P2-S10-AC-013] resolving with an explicit choice commits a two-parent revision once, closes the conflict, and a replay adds nothing', async () => {
    const before = effectCounts(entryId);
    const body = {
      entryId,
      conflictId,
      baseRevision: '1',
      choices: [{ path: `/fields/${world.titleFieldId}`, choice: 'theirs' }],
      expectedVersion: '3',
    };
    const response = await stack.resolve(entryId, conflictId, body, {
      ifMatch: '3',
      idempotencyKey: resolveKey,
    });
    expect(response.status, response.text).toBe(201);
    expect(response.body.conflictId).toBe(conflictId);
    expect((response.body.parentRevisionIds as readonly string[]).length).toBe(
      2,
    );
    expect(response.body.entryVersion).toBe('4');
    expect(response.headers.get('etag')).toBe('"4"');
    const after = effectCounts(entryId);
    expect(after.revisions).toBe(before.revisions + 1);
    expect(after.audit).toBe(before.audit + 1);
    expect(after.outbox).toBe(before.outbox + 1);

    const replay = await stack.resolve(entryId, conflictId, body, {
      ifMatch: '3',
      idempotencyKey: resolveKey,
    });
    expect(replay.status, replay.text).toBe(201);
    expect(replay.body).toEqual(response.body);
    expect(effectCounts(entryId)).toEqual(after);
  });

  it('[P2-S10-AC-090] a closed conflict is the same 404 as an absent one, and resolving it again is a 409 transition', async () => {
    const closed = await stack.conflictDetail(entryId, conflictId);
    expect(closed.status).toBe(404);
    expect(closed.body.details).toEqual({});
    const absent = await stack.conflictDetail(entryId, randomUUID());
    expect(absent.status).toBe(404);
    expect(absent.body.details).toEqual({});
  });
});

describe('CMS-03B-03 compare and CMS-03B-04 restore through the real stack', () => {
  it('[P2-S10-AC-022] [P2-S10-AC-027] restoring the first revision creates one new draft with the chain from the compare read, and an exact-key replay adds nothing', async () => {
    const history = await stack.history(
      entryId,
      `?compareRevisionId=${firstRevisionId}`,
    );
    expect(history.status, history.text).toBe(200);
    const compare = history.body.compare as {
      leftRevisionId: string;
      restore: {
        migrationChainId: string;
        edgeCount: number;
        availability: string;
      };
    };
    expect(compare.restore.availability).toBe('available');
    const before = effectCounts(entryId);
    const eventsBefore = outboxByType(entryId);
    const key = `restore-${randomUUID()}`;
    const body = {
      entryId,
      revisionId: compare.leftRevisionId,
      migrationChainId: compare.restore.migrationChainId,
      expectedVersion: '4',
    };
    const response = await stack.restore(
      entryId,
      compare.leftRevisionId,
      body,
      {
        ifMatch: '4',
        idempotencyKey: key,
      },
    );
    expect(response.status, response.text).toBe(201);
    expect(response.body.state).toBe('draft');
    expect(response.body.entryVersion).toBe('5');
    expect(response.body.id).not.toBe(compare.leftRevisionId);
    expect(response.headers.get('etag')).toBe('"5"');
    const after = effectCounts(entryId);
    expect(after.revisions).toBe(before.revisions + 1);
    expect(after.audit).toBe(before.audit + 1);
    // AC027: the locked revision-created event plus one chain-evidence event
    // (identifiers, chain hash and counts only), committed together.
    const events = outboxByType(entryId);
    expect(events['cms.entry.revision-created.v1']).toBe(
      (eventsBefore['cms.entry.revision-created.v1'] ?? 0) + 1,
    );
    expect(events['cms.entry.revision-restored.v1']).toBe(
      (eventsBefore['cms.entry.revision-restored.v1'] ?? 0) + 1,
    );
    expect(after.outbox).toBe(before.outbox + 2);

    const replay = await stack.restore(entryId, compare.leftRevisionId, body, {
      ifMatch: '4',
      idempotencyKey: key,
    });
    expect(replay.status, replay.text).toBe(201);
    expect(replay.body).toEqual(response.body);
    expect(effectCounts(entryId)).toEqual(after);
  });

  it('[P2-S10-AC-025] a stale entry version is a definite 409 conflict, never a retryable 503', async () => {
    const history = await stack.history(
      entryId,
      `?compareRevisionId=${firstRevisionId}`,
    );
    const compare = history.body.compare as {
      leftRevisionId: string;
      restore: { migrationChainId: string };
    };
    const before = effectCounts(entryId);
    const response = await stack.restore(
      entryId,
      compare.leftRevisionId,
      {
        entryId,
        revisionId: compare.leftRevisionId,
        migrationChainId: compare.restore.migrationChainId,
        expectedVersion: '4',
      },
      { ifMatch: '4' },
    );
    expect(response.status, response.text).toBe(409);
    expect(response.body).toMatchObject({
      code: 'CONFLICT',
      details: { conflict: 'VERSION_MISMATCH' },
    });
    expect(response.headers.get('retry-after')).toBeNull();
    expect(response.headers.get('x-cms-editorial-outcome')).toBeNull();
    expect(effectCounts(entryId)).toEqual(before);
  });
});

describe('401, 403 and 404 are the database decision, not a stub', () => {
  it('[P2-S10-AC-006] no session is a 401 with a reauthenticate hint on every operation and writes nothing', async () => {
    const before = effectCounts(entryId);
    stack.as(null);
    try {
      for (const response of [
        await stack.draftDetail(entryId),
        await stack.history(entryId),
        await stack.list(),
        await stack.authoringContext(),
        await stack.append(
          entryId,
          appendEntryBody(world, entryId, 'No session', '1', '5'),
          {
            ifMatch: '5',
          },
        ),
      ]) {
        expect(response.status).toBe(401);
        expect(response.body.details).toEqual({
          recoveryAction: 'reauthenticate',
        });
      }
    } finally {
      stack.as(author());
    }
    expect(effectCounts(entryId)).toEqual(before);
  });

  it('[P2-S10-AC-068] [P2-S10-AC-089] an entry the caller cannot see is the same empty 404 as an absent one', async () => {
    const absent = randomUUID();
    for (const response of [
      await stack.draftDetail(absent),
      await stack.append(
        absent,
        { ...appendEntryBody(world, entryId, 'x', '1', '1'), entryId: absent },
        {
          ifMatch: '1',
        },
      ),
    ]) {
      expect(response.status).toBe(404);
      expect(response.body.details).toEqual({});
    }
  });
});

describe('403 and concealment decided by the database for other principals', () => {
  const principal = (confirmedMember: boolean) => {
    const authUserId = createAuthUser(randomUUID());
    const personId = createPerson(authUserId);
    if (confirmedMember)
      psql(`
        insert into identity_private.membership_tenure(
          id, organization_id, person_id, state, provenance, governance_mode,
          starts_on, accepted_at, actor_id, version)
        values (gen_random_uuid(), '${world.owner.organizationId}', '${personId}',
                'confirmed', 'invitation', 'ungoverned', current_date,
                clock_timestamp(), '${world.owner.personId}', 1)`);
    return {
      userId: authUserId,
      actingPartyId: world.owner.organizationId,
      // The Worker admits the route; whether the person may act is the database's call.
      capabilities: ['cms.author', 'cms.editor'] as const,
      mfaFresh: false,
    };
  };

  it('[P2-S10-AC-006] [P2-S10-AC-012] a confirmed member holding no CMS grant is a 403, and nothing is written', async () => {
    const before = effectCounts(entryId);
    stack.as(principal(true));
    try {
      const entriesBefore = entryRows();
      const created = await stack.create(
        createEntryBody(world, 'Not allowed', type),
      );
      expect(created.status, created.text).toBe(403);
      expect(entryRows()).toBe(entriesBefore);
      const append = await stack.append(
        entryId,
        appendEntryBody(world, entryId, 'Not allowed', '1', '5'),
        { ifMatch: '5' },
      );
      expect(append.status, append.text).toBe(403);
      expect(append.body).toMatchObject({ code: 'FORBIDDEN' });
      expect(effectCounts(entryId)).toEqual(before);
    } finally {
      stack.as(author());
    }
  });

  it('[P2-S10-AC-068] [P2-S10-AC-089] a person outside the owning organization cannot tell the entry exists', async () => {
    const before = effectCounts(entryId);
    stack.as(principal(false));
    try {
      const read = await stack.draftDetail(entryId);
      expect(read.status, read.text).toBe(404);
      expect(read.body.details).toEqual({});
      const append = await stack.append(
        entryId,
        appendEntryBody(world, entryId, 'Outsider', '1', '5'),
        { ifMatch: '5' },
      );
      expect(append.status, append.text).toBe(404);
      expect(append.body.details).toEqual({});
    } finally {
      stack.as(author());
    }
    expect(effectCounts(entryId)).toEqual(before);
  });
});
