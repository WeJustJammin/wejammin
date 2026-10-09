import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';

import { EntryWorkflowResourceSchema } from '@wejammin/contracts';
import {
  expectSafeEqual,
  expectStatus,
  expectUnchanged,
  resourceDigest,
  snapshotDigest,
} from './support/phase-02-slice-11-assert';
import { approvedDraft } from './support/phase-02-slice-11-flow';
import {
  canonicalHash,
  expectPublicationAppend,
  expectRpcIdentity,
  parsePublication,
  sendPublication,
} from './support/phase-02-slice-11-publish-support';
import {
  createS11Stack,
  type S11Stack,
} from './support/phase-02-slice-11-stack';
import {
  prepareS11World,
  type S11World,
} from './support/phase-02-slice-11-world';
import { psql } from './support/stack';

let world: S11World;
let stack: S11Stack;

beforeAll(async () => {
  world = await prepareS11World();
  stack = createS11Stack(world.owner);
});

describe('CMS-03B-09 append-only publication lineage', () => {
  it('[CMS-03B-09] first and successor publications independently match JCS hashes and exact fourteen-group append effects', async () => {
    const draft = await approvedDraft(stack, world, 'Independent lineage hash');
    const dependencyHash = psql(`select dependency_hash
      from platform_private.cms_editorial_reviews where id = '${draft.reviewId}'`);
    const rows: ReturnType<typeof parsePublication>[] = [];
    let priorFingerprint: string | null = null;
    for (const version of ['1', '2']) {
      stack.as(world.publisher, 'fresh');
      stack.clearRpcs();
      const requestId = randomUUID();
      const key = `lineage-${randomUUID()}`;
      const before = snapshotDigest();
      const response = await sendPublication(stack, draft, { key, requestId });
      const publication = parsePublication(response);
      expectPublicationAppend(
        before,
        publication,
        requestId,
        stack.rpcs().find((rpc) => rpc.rpc === 'cms_publish_revision')?.request
          .evidence,
      );
      expectRpcIdentity(stack, 'cms_publish_revision', requestId);
      expectSafeEqual(
        {
          entryId: publication.entryId,
          revisionId: publication.revisionId,
          action: publication.action,
          locale: publication.locale,
          audience: publication.audience,
          state: publication.state,
          version: publication.version,
          projectionState: publication.projectionState,
        },
        {
          entryId: draft.entryId,
          revisionId: draft.revisionId,
          action: 'publish',
          locale: 'en-US',
          audience: 'public',
          state: 'active',
          version,
          projectionState: 'pending',
        },
        'complete publication bindings',
      );
      expectSafeEqual(
        publication.publicationHash,
        canonicalHash({
          action: 'publish',
          audience: 'public',
          dependencyHash,
          entryId: draft.entryId,
          locale: 'en-US',
          publicationId: publication.id,
          revisionId: draft.revisionId,
          supersedesId: rows.at(-1)?.publicationVersionId ?? null,
          version: Number(version),
          versionSet: draft.versionSet,
        }),
        'publication hash independently recomputed from canonical JSON',
      );
      if (rows.length === 0)
        expectSafeEqual(
          publication.id,
          publication.publicationVersionId,
          'first row establishes stable lineage',
        );
      else {
        expectSafeEqual(
          publication.id,
          rows[0]?.id,
          'successor retains lineage id',
        );
        expectSafeEqual(
          psql(`select encode(sha256(convert_to(to_jsonb(t)::text, 'utf8')), 'hex')
          from platform_private.cms_publication_versions t
          where id = '${rows[0]?.publicationVersionId}'`),
          priorFingerprint,
          'successor leaves every prior physical column unchanged',
        );
      }
      rows.push(publication);
      priorFingerprint =
        psql(`select encode(sha256(convert_to(to_jsonb(t)::text, 'utf8')), 'hex')
        from platform_private.cms_publication_versions t where id = '${rows[0]?.publicationVersionId}'`);
      const beforeReplay = snapshotDigest();
      stack.clearRpcs();
      const replay = await sendPublication(stack, draft, { key });
      parsePublication(replay);
      expect(resourceDigest(replay.body)).toBe(resourceDigest(response.body));
      expect(
        stack.rpcs().find((rpc) => rpc.rpc === 'cms_publish_revision')
          ?.replayHeader,
      ).toBe('true');
      expectUnchanged(
        beforeReplay,
        snapshotDigest(),
        'publication replay changes none of fourteen groups',
      );
    }
    stack.as(world.publisher);
    const beforeRead = snapshotDigest();
    const response = await stack.get(
      `/api/v1/cms/entries/${draft.entryId}/workflow`,
    );
    expectStatus(response, 200);
    const parsed = EntryWorkflowResourceSchema.safeParse(response.body);
    if (!parsed.success)
      throw new Error('invalid strict workflow lineage resource');
    const observed = [...parsed.data.publications].sort(
      (a, b) => Number(a.version) - Number(b.version),
    );
    expectSafeEqual(
      observed.map((row) => ({
        id: row.publicationVersionId,
        lineage: row.publicationId,
        version: row.version,
        state: row.state,
        action: row.action,
        projection: row.projectionState,
        hash: row.publicationHash,
      })),
      rows.map((row, index) => ({
        id: row.publicationVersionId,
        lineage: row.id,
        version: row.version,
        state: index === 0 ? 'superseded' : 'active',
        action: 'publish',
        projection: 'pending',
        hash: row.publicationHash,
      })),
      'workflow derives old-head supersession without changing persisted rows',
    );
    expectUnchanged(
      beforeRead,
      snapshotDigest(),
      'lineage projection read writes nothing',
    );
  });

  it('[CMS-03B-09] independent audiences start distinct version-one lineages with exact bound hashes', async () => {
    const draft = await approvedDraft(stack, world, 'Audience lineages');
    const dependencyHash = psql(`select dependency_hash
      from platform_private.cms_editorial_reviews where id = '${draft.reviewId}'`);
    const ids: string[] = [];
    for (const audience of ['public', 'members']) {
      stack.as(world.publisher, 'fresh');
      stack.clearRpcs();
      const requestId = randomUUID();
      const before = snapshotDigest();
      const publication = parsePublication(
        await sendPublication(stack, draft, {
          body: { audience },
          requestId,
        }),
      );
      expectPublicationAppend(
        before,
        publication,
        requestId,
        stack.rpcs().find((rpc) => rpc.rpc === 'cms_publish_revision')?.request
          .evidence,
      );
      expect(publication.version).toBe('1');
      expect(publication.audience).toBe(audience);
      expectSafeEqual(
        publication.id,
        publication.publicationVersionId,
        'new audience creates its own lineage',
      );
      expectSafeEqual(
        publication.publicationHash,
        canonicalHash({
          action: 'publish',
          audience,
          dependencyHash,
          entryId: draft.entryId,
          locale: 'en-US',
          publicationId: publication.id,
          revisionId: draft.revisionId,
          supersedesId: null,
          version: 1,
          versionSet: draft.versionSet,
        }),
        'audience-specific hash independently recomputed',
      );
      ids.push(publication.id);
    }
    expect(new Set(ids).size).toBe(2);
  });
});
