import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';

import { PreflightEvidenceSchema } from '@wejammin/contracts';
import {
  expectAbsent,
  expectEvidenceNull,
  expectSafeEqual,
  expectSafeError,
  expectUnchanged,
  parseApiError,
  snapshotDigest,
} from './support/phase-02-slice-11-assert';
import {
  approvedDraft,
  assignReviewer,
  decide,
  readWorkflow,
  submitForReview,
  type ReviewedDraft,
} from './support/phase-02-slice-11-flow';
import {
  canonicalHash,
  expectRpcIdentity,
  parsePublication,
  publicationBody,
  sendPublication,
} from './support/phase-02-slice-11-publish-support';
import {
  createS11Stack,
  type S11Stack,
} from './support/phase-02-slice-11-stack';
import {
  prepareS11World,
  seedDraft,
  type S11World,
} from './support/phase-02-slice-11-world';
import { psql } from './support/stack';

let world: S11World;
let stack: S11Stack;
let draft: ReviewedDraft;

beforeAll(async () => {
  world = await prepareS11World();
  stack = createS11Stack(world.owner);
  draft = await approvedDraft(stack, world, 'Publication boundary matrix');
});

describe('CMS-03B-09 publication admission and preflight composition', () => {
  it('[CMS-03B-09] missing session is strict 401 before any RPC or persisted effect', async () => {
    stack.as(null);
    stack.clearRpcs();
    const before = snapshotDigest();
    const response = await sendPublication(stack, draft);
    expectSafeError(response, {
      status: 401,
      code: 'UNAUTHENTICATED',
      details: { recoveryAction: 'reauthenticate' },
    });
    expect(stack.rpcs()).toEqual([]);
    expectUnchanged(
      before,
      snapshotDigest(),
      'unauthenticated publication has no effects',
    );
  });

  it('[CMS-03B-09] hidden and absent targets share the exact safe 404 with distinct request and RPC identities', async () => {
    stack.as(world.stranger, 'fresh');
    const errors = [];
    for (const candidate of [
      draft,
      { ...draft, entryId: randomUUID(), revisionId: randomUUID() },
    ]) {
      stack.clearRpcs();
      const requestId = randomUUID();
      const before = snapshotDigest();
      const response = await sendPublication(stack, candidate, { requestId });
      expectSafeError(response, {
        status: 404,
        code: 'NOT_FOUND',
        details: {},
        requestId,
      });
      expectRpcIdentity(stack, 'cms_publish_revision', requestId);
      expectAbsent(
        response,
        candidate.entryId,
        'concealed publication entry absent',
      );
      expectAbsent(
        response,
        candidate.revisionId,
        'concealed publication revision absent',
      );
      const error = parseApiError(response);
      errors.push({
        code: error.code,
        message: error.message,
        details: error.details,
      });
      expectUnchanged(
        before,
        snapshotDigest(),
        'concealed publication has no effects',
      );
    }
    expectSafeEqual(
      errors[0],
      errors[1],
      'hidden and absent publication semantics',
    );
  });

  it.each(['open', 'rejected'] as const)(
    '[CMS-03B-09] %s review cannot publish and leaves all fourteen groups unchanged',
    async (state) => {
      const seeded = await seedDraft(stack, world, `Nonapproved ${state}`);
      const review = await submitForReview(stack, world, seeded);
      let currentVersion = review.version;
      if (state === 'rejected') {
        await assignReviewer(stack, world, review.id, currentVersion);
        currentVersion = (
          await decide(stack, world, review.id, currentVersion, 'reject')
        ).version;
      }
      stack.as(world.owner);
      const workflow = await readWorkflow(stack, seeded.entryId);
      if (workflow.review === null)
        throw new Error('nonapproved fixture has no review');
      expect(workflow.review.state).toBe(state);
      const candidate: ReviewedDraft = {
        entryId: seeded.entryId,
        revisionId: seeded.revisionId,
        reviewId: review.id,
        reviewVersion: currentVersion,
        frozenHash: workflow.review.frozen.frozenHash,
        versionSet: workflow.review.frozen.versionSet,
      };
      stack.as(world.publisher, 'fresh');
      const before = snapshotDigest();
      const response = await sendPublication(stack, candidate);
      expectSafeError(response, {
        status: 409,
        code: 'CONFLICT',
        details: { conflict: 'INVALID_TRANSITION', recoveryAction: 'refresh' },
      });
      expectUnchanged(
        before,
        snapshotDigest(),
        'nonapproved publication has no effects',
      );
    },
  );

  it('[CMS-03B-09] conflicting body/header operands are strict 400 before the accessibility load', async () => {
    stack.as(world.publisher, 'fresh');
    stack.clearRpcs();
    const before = snapshotDigest();
    const response = await sendPublication(stack, draft, {
      ifMatch: String(Number(draft.reviewVersion) + 1),
    });
    expectSafeError(response, {
      status: 400,
      code: 'INVALID_REQUEST',
      details: {
        violations: [
          {
            path: '/expectedVersion',
            code: 'mismatch',
            message: 'The value is invalid.',
          },
        ],
      },
    });
    expect(stack.rpcs()).toEqual([]);
    expectUnchanged(
      before,
      snapshotDigest(),
      'disagreeing publication operands have no effects',
    );
  });

  it.each([
    ['unpublish action', { action: 'unpublish' }, '/action', 'unknown_field'],
    ['caller owner', { ownerId: 'caller-owned' }, '/ownerId', 'unknown_field'],
    ['caller evidence', { evidence: null }, '/evidence', 'unknown_field'],
    [
      'uppercase audience',
      { audience: 'PUBLIC' },
      '/audience',
      'audience_invalid',
    ],
    [
      'padded audience',
      { audience: ' public' },
      '/audience',
      'audience_invalid',
    ],
    [
      'oversized audience',
      { audience: 'a'.repeat(49) },
      '/audience',
      'audience_invalid',
    ],
  ] as const)(
    '[CMS-03B-09] %s is rejected before RPC with a closed field violation',
    async (_name, body, path, code) => {
      stack.as(world.publisher, 'fresh');
      stack.clearRpcs();
      const before = snapshotDigest();
      const response = await sendPublication(stack, draft, { body });
      expectSafeError(response, {
        status: 422,
        code: 'VALIDATION_FAILED',
        details: {
          violations: [{ path, code, message: 'The value is invalid.' }],
        },
      });
      expect(stack.rpcs()).toEqual([]);
      expectUnchanged(
        before,
        snapshotDigest(),
        'invalid publication body has no effects',
      );
    },
  );

  it.each([
    ['malformed JSON', { body: '{' }, 400, 'INVALID_REQUEST', {}],
    [
      'non-JSON media',
      { headers: { 'content-type': 'text/plain' } },
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      { allowedMediaTypes: ['application/json'] },
    ],
  ] as const)(
    '[CMS-03B-09] %s is a strict transport refusal with no effects',
    async (_name, options, status, code, details) => {
      stack.as(world.publisher, 'fresh');
      stack.clearRpcs();
      const before = snapshotDigest();
      const response = await stack.post('/api/v1/cms/publications', {
        body: publicationBody(draft),
        ifMatch: draft.reviewVersion,
        ...options,
      });
      expectSafeError(response, { status, code, details });
      expect(stack.rpcs()).toEqual([]);
      expectUnchanged(
        before,
        snapshotDigest(),
        'publication transport refusal has no effects',
      );
    },
  );

  it('[CMS-03B-09] healthy Worker evidence is bound to the approved revision and real publish command', async () => {
    stack.as(world.publisher, 'fresh');
    stack.clearRpcs();
    const requestId = randomUUID();
    parsePublication(await sendPublication(stack, draft, { requestId }));
    expect(stack.rpcs().map((rpc) => rpc.rpc)).toEqual([
      'cms_load_quality_gate_input',
      'cms_publish_revision',
    ]);
    expectRpcIdentity(stack, 'cms_load_quality_gate_input', requestId);
    expectRpcIdentity(stack, 'cms_publish_revision', requestId);
    const load = stack.rpcs()[0];
    expectSafeEqual(
      {
        phase: load?.request.phase,
        entryId: load?.request.entryId,
        revisionId: load?.request.revisionId,
      },
      {
        phase: 'publish',
        entryId: draft.entryId,
        revisionId: draft.revisionId,
      },
      'quality gate canonical target',
    );
    const evidence = PreflightEvidenceSchema.safeParse(
      stack.rpcs()[1]?.request.evidence,
    );
    if (!evidence.success)
      throw new Error('invalid strict healthy publication evidence');
    expect(evidence.data.outcome).toBe('healthy');
    expect(evidence.data.blockingCount).toBe(0);
    const dependencyHash = psql(
      `select dependency_hash from platform_private.cms_editorial_reviews where id = '${draft.reviewId}'`,
    );
    expectSafeEqual(
      evidence.data.bindingHash,
      canonicalHash({
        checkerKey: 'cms.a11y.structural',
        checkerVersion: '1',
        revisionId: draft.revisionId,
        revisionContentHash: draft.frozenHash,
        dependencyHash,
      }),
      'independently recomputed publication accessibility binding',
    );
  });

  it('[CMS-03B-09] command transport outage preserves every group and carries retry and quota headers', async () => {
    stack.as(world.publisher, 'fresh');
    stack.breakRpc('cms_publish_revision');
    try {
      const before = snapshotDigest();
      const response = await sendPublication(stack, draft);
      expectSafeError(response, {
        status: 503,
        code: 'DEPENDENCY_UNAVAILABLE',
        details: { dependencyClass: 'cms_editorial', retryable: true },
        retryAfter: true,
      });
      for (const header of [
        'ratelimit-limit',
        'ratelimit-remaining',
        'ratelimit-reset',
      ])
        expect(
          /^\d+$/u.test(response.headers.get(header) ?? ''),
          'quota header is numeric',
        ).toBe(true);
      expectUnchanged(
        before,
        snapshotDigest(),
        'unavailable publication transport has no effects',
      );
    } finally {
      stack.breakRpc(null);
    }
  });

  it('[CMS-03B-09] failed input load sends an own null proof and a strict preflight refusal without effects', async () => {
    stack.as(world.publisher, 'fresh');
    stack.breakRpc('cms_load_quality_gate_input');
    try {
      stack.clearRpcs();
      const before = snapshotDigest();
      const response = await sendPublication(stack, draft);
      expectSafeError(response, {
        status: 503,
        code: 'DEPENDENCY_UNAVAILABLE',
        details: { dependencyClass: 'preflight', retryable: true },
        retryAfter: true,
      });
      const command = stack
        .rpcs()
        .find((rpc) => rpc.rpc === 'cms_publish_revision');
      expect(command !== undefined, 'publish executes real refusal path').toBe(
        true,
      );
      expectEvidenceNull(command?.request ?? {});
      expectUnchanged(
        before,
        snapshotDigest(),
        'null accessibility evidence retains no effect',
      );
    } finally {
      stack.breakRpc(null);
    }
  });
});
