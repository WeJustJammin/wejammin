/**
 * CMS-03B-05 production command composition; parent owns execution.
 * Shared world's synthetic activation/session setup does not prove fixture authority.
 */
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  EditorialReviewResourceSchema,
  EntryDraftDetailResourceSchema,
} from '@wejammin/contracts';
import {
  expectAbsent,
  expectSafeEqual,
  expectSafeError,
  expectStatus,
  expectUnchanged,
  snapshotDigest,
} from './support/phase-02-slice-11-assert';
import {
  type S11Stack,
  createS11Stack,
} from './support/phase-02-slice-11-stack';
import {
  type S11World,
  prepareS11World,
} from './support/phase-02-slice-11-world';
import {
  SUBMIT_CATEGORIES,
  SUBMIT_EFFECTS,
  expectCommandEffects,
  submitAndReplay,
  submitFixture,
} from './support/phase-02-slice-11-submit-support';
import { appendEntryBody } from './support/cms-editorial-world';
import { psql } from './support/stack';

let world: S11World;
let stack: S11Stack;
beforeAll(async () => {
  world = await prepareS11World();
  stack = createS11Stack(world.owner);
});

describe('CMS-03B-05 frozen submission and admission contracts', () => {
  it('[CMS-03B-05] freezes exact hashes, manifest, version set, policy and dependency rows with six atomic effect groups; fresh-evidence replay changes none', async () => {
    const fixture = await submitAndReplay(stack, world);
    expect(fixture.review.state).toBe('open');
    expect(fixture.review.requiredDecisionCount).toBe(1);
    expect(fixture.review.recordedDecisionCount).toBe(0);
    expect(fixture.review.riskClass).toBe('ordinary');
    expect(fixture.review.decidedAt).toBeNull();
    expect(fixture.review.invalidatedReason).toBeNull();
  });

  it('[CMS-03B-05] reference-free preparation passes every submit category in exact registry order and commits through the real command', async () => {
    const fixture = await submitFixture(stack, world);
    expectSafeEqual(
      fixture.preparation.preflight.results.map(
        ({ category, outcome, reasonCode }) => ({
          category,
          outcome,
          reasonCode,
        }),
      ),
      SUBMIT_CATEGORIES.map((category) => ({
        category,
        outcome: 'passed',
        reasonCode: null,
      })),
      'all seventeen ordered outcomes, including every D19 no-reference positive',
    );
    const before = snapshotDigest();
    const response = await stack.post(fixture.path, {
      body: fixture.body,
      ifMatch: fixture.draft.entryVersion,
    });
    expectStatus(response, 201);
    EditorialReviewResourceSchema.parse(response.body);
    expectCommandEffects(before, SUBMIT_EFFECTS);
  });

  for (const field of [
    'frozenHash',
    'dependencyManifest',
    'version',
    'path',
  ] as const) {
    it(`[CMS-03B-05] completed idempotency binds ${field} and retains all fourteen effect fingerprints`, async () => {
      const first = await submitAndReplay(stack, world);
      const other =
        field === 'path' ? await submitFixture(stack, world) : first;
      const body =
        field === 'frozenHash'
          ? { ...first.body, frozenHash: 'f'.repeat(64) }
          : field === 'dependencyManifest'
            ? {
                ...first.body,
                dependencyManifest: {
                  ...first.body.dependencyManifest,
                  checker: {
                    ...first.body.dependencyManifest.checker,
                    version: '2',
                  },
                },
              }
            : other.body;
      const before = snapshotDigest();
      const response = await stack.post(other.path, {
        body,
        idempotencyKey: first.key,
        ifMatch: field === 'version' ? '9' : other.draft.entryVersion,
      });
      expectSafeError(response, {
        status: 409,
        code: 'CONFLICT',
        details: {
          conflict: 'IDEMPOTENCY_MISMATCH',
          recoveryAction: 'use_new_idempotency_key',
        },
      });
      expectUnchanged(
        before,
        snapshotDigest(),
        'mismatched replay has no effects',
      );
    });
  }

  it('[CMS-03B-05] superseded revisions refuse revision_not_submittable using the current entry operand', async () => {
    const fixture = await submitFixture(stack, world);
    const detail = await stack.get(
      `/api/v1/cms/entries/${fixture.draft.entryId}`,
    );
    expectStatus(detail, 200);
    const currentDraft = EntryDraftDetailResourceSchema.parse(detail.body);
    const appended = await stack.post(
      `/api/v1/cms/entries/${fixture.draft.entryId}/revisions`,
      {
        body: appendEntryBody(
          world.editorial,
          fixture.draft.entryId,
          'New current revision',
          currentDraft.revisionNumber,
          fixture.draft.entryVersion,
        ),
        ifMatch: fixture.draft.entryVersion,
      },
    );
    expectStatus(appended, 201);
    const version = psql(
      `select version from platform_private.cms_content_entries where id = '${fixture.draft.entryId}'`,
    );
    const before = snapshotDigest();
    const response = await stack.post(fixture.path, {
      body: fixture.body,
      ifMatch: version,
    });
    expectSafeError(response, {
      status: 409,
      code: 'CONFLICT',
      details: { reasonCode: 'revision_not_submittable' },
    });
    expectUnchanged(
      before,
      snapshotDigest(),
      'superseded submit has no effects',
    );
  });

  it('[CMS-03B-05] a nonmember target and absent entry have identical safe 404 semantics with their own request identities', async () => {
    const fixture = await submitFixture(stack, world);
    stack.as(world.stranger);
    const before = snapshotDigest();
    const responses = [];
    for (const entryId of [fixture.draft.entryId, randomUUID()]) {
      const requestId = randomUUID();
      const response = await stack.post(
        `/api/v1/cms/entries/${entryId}/reviews`,
        {
          body: { ...fixture.body, entryId },
          ifMatch: fixture.draft.entryVersion,
          headers: { 'x-request-id': requestId },
        },
      );
      expectSafeError(response, {
        status: 404,
        code: 'NOT_FOUND',
        details: {},
        requestId,
      });
      expectAbsent(response, fixture.draft.entryId, 'hidden entry');
      expectAbsent(response, fixture.draft.revisionId, 'hidden revision');
      responses.push({
        code: response.body.code,
        message: response.body.message,
        details: response.body.details,
      });
    }
    expectSafeEqual(responses[0], responses[1], 'hidden and absent semantics');
    expectUnchanged(
      before,
      snapshotDigest(),
      'concealed submit writes nothing',
    );
  });

  for (const fault of [
    'json',
    'media',
    'anonymous',
    'weak-etag',
    'missing-key',
    'path-body',
    'forged-evidence',
  ] as const) {
    it(`[CMS-03B-05] ${fault} is refused before RPC and before every durable effect`, async () => {
      const fixture = await submitFixture(stack, world);
      if (fault === 'anonymous') stack.as(null);
      stack.clearRpcs();
      const before = snapshotDigest();
      const response = await stack.post(fixture.path, {
        body:
          fault === 'json'
            ? '{'
            : fault === 'path-body'
              ? { ...fixture.body, entryId: randomUUID() }
              : fault === 'forged-evidence'
                ? { ...fixture.body, evidence: null }
                : fixture.body,
        ifMatch: fixture.draft.entryVersion,
        ...(fault === 'missing-key' ? { idempotencyKey: null } : {}),
        headers:
          fault === 'media'
            ? { 'content-type': 'text/plain' }
            : fault === 'weak-etag'
              ? { 'if-match': 'W/"1"' }
              : {},
      });
      const status =
        fault === 'media'
          ? 415
          : fault === 'anonymous'
            ? 401
            : fault === 'path-body' || fault === 'forged-evidence'
              ? 422
              : 400;
      const code =
        status === 415
          ? 'UNSUPPORTED_MEDIA_TYPE'
          : status === 401
            ? 'UNAUTHENTICATED'
            : status === 422
              ? 'VALIDATION_FAILED'
              : 'INVALID_REQUEST';
      const details =
        fault === 'media'
          ? { allowedMediaTypes: ['application/json'] }
          : fault === 'anonymous'
            ? { recoveryAction: 'reauthenticate' }
            : fault === 'json'
              ? {}
              : undefined;
      expectSafeError(response, {
        status,
        code,
        ...(details === undefined
          ? { detailsKeys: ['violations'] }
          : { details }),
      });
      if (details === undefined)
        expectSafeEqual(
          response.body.details,
          {
            violations: [
              {
                path:
                  fault === 'path-body'
                    ? '/entryId'
                    : fault === 'forged-evidence'
                      ? '/evidence'
                      : fault === 'weak-etag'
                        ? '/ifMatch'
                        : '/idempotencyKey',
                code:
                  fault === 'path-body'
                    ? 'mismatch'
                    : fault === 'forged-evidence'
                      ? 'unknown_field'
                      : 'invalid_value',
                message: 'The value is invalid.',
              },
              ...(fault === 'weak-etag'
                ? [
                    {
                      path: '/ifMatch',
                      code: 'invalid_value',
                      message: 'The value is invalid.',
                    },
                  ]
                : []),
            ],
          },
          'exact admission violation semantics',
        );
      expect(stack.rpcs()).toEqual([]);
      expectUnchanged(
        before,
        snapshotDigest(),
        'admission refusal has zero effects',
      );
    });
  }

  it('[CMS-03B-05] command transport outage is exact retryable 503 with numeric retry and rate headers, no effects', async () => {
    const fixture = await submitFixture(stack, world);
    const before = snapshotDigest();
    stack.breakRpc('cms_submit_review');
    try {
      const response = await stack.post(fixture.path, {
        body: fixture.body,
        ifMatch: fixture.draft.entryVersion,
      });
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
        expect(/^\d+$/u.test(response.headers.get(header) ?? ''), header).toBe(
          true,
        );
      expectUnchanged(
        before,
        snapshotDigest(),
        'command transport outage writes nothing',
      );
    } finally {
      stack.breakRpc(null);
    }
  });
});
