/**
 * Slice 11 CMS-03B-15 read no-effects proof (lane S11-4R read families). The
 * workflow read (and the accessibility checker load it drives) must write and emit
 * NOTHING (BE03b:2070,2134; DEC-159(4)). This exercises a fresh isolated
 * ASSIGNEE organization with one settings snapshot initialized by its ordinary
 * CMS-03B-10 entry write (DEC-163).
 *
 * The isolated org has NO canonical CMS-owner receipt (the receipt is a singleton
 * and a second initialization refuses), so this exercises the entry-assignee branch
 * only, never an owner/publisher read. Normal entry creation initializes one
 * canonical owner publication-settings snapshot before the first workflow read.
 * Owner-scoped counts and the whole unfiltered 14-group effect snapshot must stay
 * unchanged after the read. No preseed, warm, backfill, row deletion or guard bypass.
 *
 * Commits fixtures; run right after `pnpm db:reset`, and reset again afterwards.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { EntryWorkflowResourceSchema } from '@wejammin/contracts';

import { createIsolatedCmsOwner } from './support/cms-isolated-owner';
import { prepareEditorialWorld } from './support/cms-editorial-world';
import {
  expectStatus,
  expectUnchanged,
  snapshotDigest,
} from './support/phase-02-slice-11-assert';
import { workflowPath } from './support/phase-02-slice-11-flow';
import {
  s11EntryOwnerPartyId,
  s11OwnerSettingsSnapshotCount,
} from './support/phase-02-slice-11-read-fixtures';
import {
  type S11Actor,
  type S11Stack,
  createS11Stack,
} from './support/phase-02-slice-11-stack';
import {
  type SeedableWorld,
  seedDraft,
} from './support/phase-02-slice-11-world';

let stack: S11Stack;
let seedable: SeedableWorld;
let owner: S11Actor;
let entryId = '';

beforeAll(async () => {
  // A fresh isolated assignee organization: production identity + organization +
  // standing cms.author/cms.editor grants, and its OWN content type. No owner
  // receipt is created or needed for the entry-assignee read scope.
  const isolated = createIsolatedCmsOwner();
  const editorial = await prepareEditorialWorld(isolated);
  owner = {
    authUserId: isolated.authUserId,
    personId: isolated.personId,
    organizationId: isolated.organizationId,
    capabilities: ['cms.author', 'cms.editor'],
  };
  // `seedDraft` reads only the owner and the content type (SeedableWorld).
  seedable = { owner, editorial };
  stack = createS11Stack(owner);
  const seeded = await seedDraft(stack, seedable, 'No-effects subject');
  entryId = seeded.entryId;
});

describe('CMS-03B-15 read writes nothing', () => {
  it('[CMS-03B-15] a first eligible draft workflow read on a fresh isolated assignee org writes no effect', async () => {
    // The owner party is derived from the ACTUAL entry row, not assumed.
    const ownerPartyId = s11EntryOwnerPartyId(entryId);
    const before = snapshotDigest();
    // The ordinary entry write initialized one snapshot for the actual owner.
    // This read-only count excludes snapshots belonging to another owner.
    expect(
      s11OwnerSettingsSnapshotCount(ownerPartyId),
      'the ordinary entry write must have initialized one owner-party settings snapshot before the first read',
    ).toBe(1);

    stack.as(owner);
    const response = await stack.get(workflowPath(entryId));
    expectStatus(response, 200);
    const parsed = EntryWorkflowResourceSchema.parse(response.body);
    // The eligible draft serves a recomputed preparation (never stored).
    expect(parsed.preparation).not.toBeNull();

    // The read preserves the one snapshot initialized by the ordinary entry write.
    expect(
      s11OwnerSettingsSnapshotCount(ownerPartyId),
      'the CMS-03B-15 read must preserve the single existing owner-party settings snapshot',
    ).toBe(1);
    // A safe read (and its checker load) commits no durable effect anywhere: the
    // whole unfiltered 14-group snapshot, including every existing settings row
    // field, is unchanged.
    expectUnchanged(
      before,
      snapshotDigest(),
      'CMS-03B-15 read + accessibility checker load must write and emit nothing',
    );
  });
});
