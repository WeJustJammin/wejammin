/** API15 reader scopes and preparation, independent of the parent cold-read RED. */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  EntryWorkflowResourceSchema,
  EditorialReviewDetailResourceSchema,
} from '@wejammin/contracts';

import {
  assignReviewer,
  decide,
  submitForReview,
  workflowPath,
} from './support/phase-02-slice-11-flow';
import {
  expectEvidenceNull,
  expectSafeEqual,
  expectSafeError,
  expectStatus,
  expectUnchanged,
  snapshotDigest,
} from './support/phase-02-slice-11-assert';
import {
  expectReadHeaders,
  expectReadIdentity,
} from './support/phase-02-slice-11-read-support';
import {
  createS11Stack,
  type S11Stack,
} from './support/phase-02-slice-11-stack';
import {
  addMember,
  prepareS11World,
  seedDraft,
  type S11World,
} from './support/phase-02-slice-11-world';

const CATEGORIES = [
  'contract',
  'schema',
  'template',
  'block',
  'pattern',
  'taxonomy',
  'settings',
  'relation',
  'privacy',
  'security',
  'accessibility',
  'media',
  'route',
  'locale',
  'migration',
  'domain_binding',
  'revocation',
] as const;
let world: S11World;
let stack: S11Stack;

beforeAll(async () => {
  world = await prepareS11World();
  stack = createS11Stack(world.owner);
});

describe('CMS-03B-15 scoped preparation', () => {
  it('[CMS-03B-15] eligible preparation has seventeen ordered checks and checker outage remains an unavailable result inside HTTP200', async () => {
    const draft = await seedDraft(stack, world, 'Preparation semantics');
    const healthy = await stack.get(workflowPath(draft.entryId));
    expectStatus(healthy, 200);
    expectReadHeaders(healthy);
    const resource = EntryWorkflowResourceSchema.parse(healthy.body);
    expect(resource.preparation !== null).toBe(true);
    expectSafeEqual(
      resource.preparation?.preflight.results.map((item) => item.category),
      CATEGORIES,
      'independent registry category order',
    );
    expectSafeEqual(
      resource.preparation?.frozenHash,
      resource.revision.contentHash,
      'frozen content hash',
    );
    expect(resource.preparation?.preflight.passed).toBe(true);
    expectSafeEqual(resource.schedules, [], 'new draft schedules');
    expectSafeEqual(resource.publications, [], 'new draft publications');
    stack.breakRpc('cms_load_quality_gate_input');
    stack.clearRpcs();
    try {
      const degraded = await stack.get(workflowPath(draft.entryId));
      expectStatus(degraded, 200);
      expectReadHeaders(degraded);
      const parsed = EntryWorkflowResourceSchema.parse(degraded.body);
      expectSafeEqual(
        parsed.preparation?.preflight.results.map((item) => item.category),
        CATEGORIES,
        'degraded registry category order',
      );
      expect(parsed.preparation?.preflight.passed).toBe(false);
      expectSafeEqual(
        parsed.preparation?.preflight.results[10],
        {
          category: 'accessibility',
          outcome: 'unavailable',
          reasonCode: 'checker_failed',
          providerKey: 'cms.a11y.structural',
          providerVersion: '1',
          blockingCount: 0,
        },
        'checker outage is a bounded result',
      );
      expectSafeEqual(
        parsed.preparation?.dependencyManifest,
        resource.preparation?.dependencyManifest,
        'checker outage preserves canonical manifest',
      );
      expectSafeEqual(
        parsed.preparation?.versionSet,
        resource.preparation?.versionSet,
        'checker outage preserves canonical version set',
      );
      const calls = stack
        .rpcs()
        .filter((call) => call.rpc === 'cms_get_entry_workflow');
      expect(calls.length).toBeGreaterThan(0);
      expectEvidenceNull(calls.at(-1)!.request);
    } finally {
      stack.breakRpc(null);
    }
    // Deliberately no first-read no-effects claim here: the parent-owned cold
    // fixture demonstrates the settings-snapshot producer defect independently.
  });

  it('[CMS-03B-15] assignee publisher and reviewer scopes read the same frozen candidate and submission moves the composite ETag', async () => {
    const author = addMember(world.organizationId, world.owner.personId, [
      'cms.author',
      'cms.editor',
    ]);
    const authorWorld = { ...world, owner: author };
    const draft = await seedDraft(stack, authorWorld, 'Workflow scopes');
    const initial = await stack.get(workflowPath(draft.entryId));
    expectStatus(initial, 200);
    const preparation = EntryWorkflowResourceSchema.parse(
      initial.body,
    ).preparation;
    expect(preparation !== null).toBe(true);
    stack.as(world.publisher);
    const publisherDraft = await stack.get(workflowPath(draft.entryId));
    expectStatus(publisherDraft, 200);
    expect(
      EntryWorkflowResourceSchema.parse(publisherDraft.body).preparation,
    ).toBeNull();
    const review = await submitForReview(stack, authorWorld, draft);
    await assignReviewer(stack, world, review.id, String(review.version));
    const before = snapshotDigest();
    for (const actor of [author, world.publisher, world.reviewer]) {
      stack.as(actor);
      const requestId = '55555555-5555-4555-8555-555555555555';
      const correlationId = '66666666-6666-4666-8666-666666666666';
      stack.clearRpcs();
      const response = await stack.get(workflowPath(draft.entryId), {
        headers: {
          'x-request-id': requestId,
          'x-correlation-id': correlationId,
        },
      });
      expectStatus(response, 200);
      expectReadHeaders(response);
      expectReadIdentity(stack, response, requestId, correlationId);
      const parsed = EntryWorkflowResourceSchema.parse(response.body);
      expect(parsed.preparation).toBeNull();
      expect(parsed.revision.state).toBe('submitted');
      expectSafeEqual(parsed.review?.id, review.id, 'reader review identity');
      expectSafeEqual(
        parsed.review?.frozen.dependencyManifest,
        preparation?.dependencyManifest,
        'frozen manifest equals served preparation',
      );
      expectSafeEqual(
        parsed.review?.frozen.versionSet,
        preparation?.versionSet,
        'frozen version set equals served preparation',
      );
      expect(response.headers.get('etag') !== initial.headers.get('etag')).toBe(
        true,
      );
    }
    expectUnchanged(
      before,
      snapshotDigest(),
      'post-submission scoped reads write nothing',
    );
    await decide(stack, world, review.id, String(review.version));
    stack.as(world.publisher);
    const approved = await stack.get(`/api/v1/cms/reviews/${review.id}`);
    expectStatus(approved, 200);
    expectSafeEqual(
      EditorialReviewDetailResourceSchema.parse(approved.body)
        .permittedNextActions,
      ['schedule', 'publish'],
      'publisher approved next actions',
    );
  });

  it('[CMS-03B-15] a foreign revision and absent revision are concealed equally with no effects', async () => {
    const first = await seedDraft(stack, world, 'Revision concealment one');
    const second = await seedDraft(stack, world, 'Revision concealment two');
    const before = snapshotDigest();
    for (const revisionId of [
      second.revisionId,
      '00000000-0000-4000-8000-000000000001',
    ]) {
      const response = await stack.get(
        `${workflowPath(first.entryId)}?revisionId=${revisionId}`,
      );
      expectSafeError(response, {
        status: 404,
        code: 'NOT_FOUND',
        details: {},
      });
    }
    expectUnchanged(
      before,
      snapshotDigest(),
      'concealed revision reads write nothing',
    );
  });
});
