import type {
  EntryWorkflowPublication,
  EntryWorkflowResource,
  EntryWorkflowSchedule,
} from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  entryId,
  hash2,
  instant,
  publicationVersionId,
  revisionId,
  scheduleId,
  workflowResource,
} from './workflow-fixtures.test-support';
import { getJson, workflowHarness } from './workflow-harness.test-support';

/*
 * P2-S11-AC-052: the CMS-03B-15 strong ETag is composite. It binds the entry
 * and revision (and the latest review) in its readable prefix and the exact
 * representation, schedules and publications included, in its caller-scoped
 * digest. A schedule or publication change therefore moves it, and a change
 * that does not alter the representation (key order, request id) does not.
 */

const path = `/api/v1/cms/entries/${entryId}/workflow`;

const schedule: EntryWorkflowSchedule = {
  id: scheduleId,
  version: '1',
  state: 'pending',
  action: 'publish',
  audience: 'members',
  resolvedUtc: '2026-11-01T14:30:00Z',
  reasonCode: null,
};

const publication: EntryWorkflowPublication = {
  publicationId: scheduleId,
  publicationVersionId,
  version: '3',
  state: 'active',
  action: 'publish',
  revisionId,
  locale: 'en-US',
  audience: 'members',
  publicationHash: hash2,
  projectionState: 'pending',
  createdAt: instant,
};

const withLists = (
  schedules: readonly EntryWorkflowSchedule[],
  publications: readonly EntryWorkflowPublication[],
): EntryWorkflowResource => ({ ...workflowResource, schedules, publications });

/** The ETag the route publishes for a port that answers `resource`. */
const etagOf = async (
  resource: EntryWorkflowResource,
  headers: Record<string, string> = {},
  options: Parameters<typeof workflowHarness>[0] = {},
): Promise<string> => {
  const { app } = workflowHarness({
    ...options,
    port: {
      getEntryWorkflow: async () => ({ ok: true as const, value: resource }),
    },
  });
  const response = await getJson(app, path, headers);
  expect(response.status).toBe(200);
  const etag = response.headers.get('etag');
  expect(etag).toMatch(/^"[^"]+"$/u);
  return etag as string;
};

describe('CMS-03B-15 composite ETag', () => {
  it('moves when a schedule version changes', async () => {
    const first = await etagOf(withLists([schedule], []));
    const bumped = await etagOf(withLists([{ ...schedule, version: '2' }], []));
    expect(bumped).not.toBe(first);
  });

  it('moves when a schedule changes state and when one appears or disappears', async () => {
    const pending = await etagOf(withLists([schedule], []));
    const completed = await etagOf(
      withLists([{ ...schedule, version: '2', state: 'completed' }], []),
    );
    const none = await etagOf(withLists([], []));
    const two = await etagOf(
      withLists(
        [schedule, { ...schedule, id: publicationVersionId, version: '1' }],
        [],
      ),
    );
    expect(new Set([pending, completed, none, two]).size).toBe(4);
  });

  it('moves when a publication version changes', async () => {
    const first = await etagOf(withLists([], [publication]));
    const bumped = await etagOf(
      withLists([], [{ ...publication, version: '4' }]),
    );
    expect(bumped).not.toBe(first);
  });

  it('moves when a publication projection state or lineage row changes', async () => {
    const pending = await etagOf(withLists([], [publication]));
    const converged = await etagOf(
      withLists([], [{ ...publication, projectionState: 'converged' }]),
    );
    const tombstone = await etagOf(
      withLists(
        [],
        [
          { ...publication, state: 'superseded' },
          {
            ...publication,
            publicationVersionId: scheduleId,
            version: '4',
            state: 'revoked',
            action: 'unpublish',
          },
        ],
      ),
    );
    expect(new Set([pending, converged, tombstone]).size).toBe(3);
  });

  it('keeps the entry, revision and review prefix readable beside the digest', async () => {
    const etag = await etagOf(withLists([schedule], [publication]));
    expect(etag).toMatch(
      new RegExp(
        `^"${entryId}:7:${workflowResource.revision.id}:0:0:[0-9a-f]{64}"$`,
        'u',
      ),
    );
    const bumped = await etagOf(withLists([{ ...schedule, version: '9' }], []));
    // The prefix is identical, so only the digest carried the schedule change.
    expect(bumped.split(':').slice(0, 5)).toEqual(etag.split(':').slice(0, 5));
  });

  it('does not move for a change that leaves the representation alone', async () => {
    const resource = withLists([schedule], [publication]);
    const first = await etagOf(resource);
    // The same bytes under another request id and another Accept header.
    const again = await etagOf(resource, {
      'x-request-id': 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      accept: 'application/json',
    });
    expect(again).toBe(first);
    // The same members delivered in a different key order.
    const reordered = Object.fromEntries(
      Object.entries(resource).reverse(),
    ) as unknown as EntryWorkflowResource;
    expect(await etagOf(reordered)).toBe(first);
    const reorderedSchedule = {
      ...withLists(
        [
          Object.fromEntries(
            Object.entries(schedule).reverse(),
          ) as unknown as EntryWorkflowSchedule,
        ],
        [publication],
      ),
    };
    expect(await etagOf(reorderedSchedule)).toBe(first);
  });

  it('never shares a validator across callers whose scope differs', async () => {
    const resource = withLists([schedule], [publication]);
    expect(await etagOf(resource, {}, { actingPartyId: null })).not.toBe(
      await etagOf(resource),
    );
  });
});
