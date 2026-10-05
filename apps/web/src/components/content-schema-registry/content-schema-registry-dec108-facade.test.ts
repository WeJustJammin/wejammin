import { describe, expect, it } from 'vitest';

import {
  APPROVE_A_ID,
  ASSIGNMENT_ID,
  DRY_RUN_ID,
  REVIEWER_PERSON_ID,
  REVIEW_ID,
  TYPE_ID,
  VERSION_ID,
  assignmentResource,
  callFacade,
  decisionResource,
  draftDetail,
  dryRunResource,
  reviewResource,
  reviewTarget,
  versionTarget,
} from './content-schema-review-dec108.test-support';

/**
 * FE03 "DEC-108 activation-producer coverage" and BE03a CMS-03A-09..14: the
 * first-party browser facade forwards each human command as the exact
 * generated request body with Idempotency-Key and If-Match as headers.
 */

const versionPath = `/api/v1/cms/content-types/${TYPE_ID}/versions/${VERSION_ID}`;
const reviewPath = `/api/v1/cms/schema-reviews/${REVIEW_ID}`;
const clone = {
  supportedLocales: null,
  fallbackChains: null,
  defaultTemplateVersionId: null,
  templateBindings: null,
} as const;
const transportKeys = ['csrf', 'idempotency-key', 'if-match', 'operationId'];

describe('[DEC-108] CMS-03A-09 successor facade', () => {
  it('[P2-S09-AC-979] forwards the source version and the locale pair only, as POST .../successors, expecting 201', async () => {
    // BE03a CMS-03A-09: the caller never supplies version, row ids or identities.
    const { response, forwarded, forwardedBody } = await callFacade({
      target: versionTarget('CMS-03A-09'),
      payload: { ...clone, expectedVersion: '4' },
      upstream: { status: 201, body: draftDetail().resource },
    });
    expect(response.status).toBe(201);
    expect(forwarded?.method).toBe('POST');
    expect(new URL(forwarded?.url ?? '').pathname).toBe(
      `${versionPath}/successors`,
    );
    expect(forwardedBody).toStrictEqual({ ...clone, expectedVersion: '4' });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('forwards a replacement pair verbatim', async () => {
    const replacement = {
      expectedVersion: '4',
      supportedLocales: ['fr', 'en-US'],
      fallbackChains: { fr: ['en-US'] },
      defaultTemplateVersionId: null,
      templateBindings: null,
    };
    const { response, forwardedBody } = await callFacade({
      target: versionTarget('CMS-03A-09'),
      payload: replacement,
      upstream: { status: 201, body: draftDetail().resource },
    });
    expect(response.status).toBe(201);
    expect(forwardedBody).toStrictEqual(replacement);
  });

  it('refuses half a pair with the exact BE03a message and no upstream call', async () => {
    const { response, fetch } = await callFacade({
      target: versionTarget('CMS-03A-09'),
      payload: {
        expectedVersion: '4',
        supportedLocales: ['en-US'],
        fallbackChains: null,
        defaultTemplateVersionId: null,
        templateBindings: null,
      },
      upstream: { status: 201, body: draftDetail().resource },
    });
    expect(response.status).toBe(422);
    expect(fetch).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({
      code: 'VALIDATION_FAILED',
      details: {
        violations: [
          {
            path: '/fallbackChains',
            message:
              'supportedLocales and fallbackChains must be both null or both present',
          },
        ],
      },
    });
  });

  it('carries the exact message for an invalid replacement and nothing client-controlled', async () => {
    const { response } = await callFacade({
      target: versionTarget('CMS-03A-09'),
      payload: {
        expectedVersion: '4',
        supportedLocales: ['en-US', 'fr'],
        fallbackChains: { fr: ['secret-locale'] },
        defaultTemplateVersionId: null,
        templateBindings: null,
      },
      upstream: { status: 201, body: draftDetail().resource },
    });
    expect(response.status).toBe(422);
    const text = await response.text();
    expect(text).toContain('fallback chain locale must be a supported locale');
    expect(text).toContain('/fallbackChains/fr/0');
    expect(text).not.toContain('secret-locale');
  });

  it('[P2-S09-AC-979] [P2-S09-AC-980] [P2-S09-AC-981] sends Idempotency-Key and the exact strong If-Match as headers, never in the body', async () => {
    const { forwarded, forwardedBody } = await callFacade({
      target: versionTarget('CMS-03A-09'),
      payload: { ...clone, expectedVersion: '4' },
      upstream: { status: 201, body: draftDetail().resource },
    });
    expect(forwarded?.headers.get('idempotency-key')).toBe(
      'cms-operation-12345',
    );
    expect(forwarded?.headers.get('if-match')).toBe('"4"');
    expect(forwarded?.headers.get('content-type')).toBe('application/json');
    expect(forwarded?.headers.get('x-csrf-token')).toBe('csrf');
    for (const key of transportKeys)
      expect(Object.keys(forwardedBody as object)).not.toContain(key);
  });

  it('[P2-S09-AC-979] rejects a caller-supplied new version number or row identity with 422 and no upstream call', async () => {
    for (const extra of [{ versionNo: '5' }, { stableFieldId: TYPE_ID }]) {
      const { response, fetch } = await callFacade({
        target: versionTarget('CMS-03A-09'),
        payload: { ...clone, expectedVersion: '4', ...extra },
        upstream: { status: 201, body: draftDetail().resource },
      });
      expect(response.status).toBe(422);
      expect(fetch).not.toHaveBeenCalled();
    }
  });
});

describe('[DEC-108] CMS-03A-10 dry-run facade', () => {
  it('[P2-S09-AC-980] serializes the both-null transform pair with no omitted keys and expects 202', async () => {
    // FE03: "strict both-null-or-both-present transform pair serialized with no omitted keys".
    const { response, forwarded, forwardedBody } = await callFacade({
      target: versionTarget('CMS-03A-10'),
      payload: {
        expectedVersion: '4',
        transformKey: null,
        transformVersion: null,
      },
      upstream: { status: 202, body: dryRunResource() },
    });
    expect(response.status).toBe(202);
    expect(new URL(forwarded?.url ?? '').pathname).toBe(
      `${versionPath}/dry-runs`,
    );
    expect(forwardedBody).toStrictEqual({
      expectedVersion: '4',
      transformKey: null,
      transformVersion: null,
    });
  });

  it('[P2-S09-AC-980] forwards a both-present transform pair exactly', async () => {
    const { forwardedBody } = await callFacade({
      target: versionTarget('CMS-03A-10'),
      payload: {
        expectedVersion: '4',
        transformKey: 'article.title_to_headline',
        transformVersion: '1',
      },
      upstream: {
        status: 202,
        body: dryRunResource({
          transformKey: 'article.title_to_headline',
          transformVersion: '1',
        }),
      },
    });
    expect(forwardedBody).toStrictEqual({
      expectedVersion: '4',
      transformKey: 'article.title_to_headline',
      transformVersion: '1',
    });
  });

  it('[P2-S09-AC-980] refuses a half transform pair with 422 and never reaches the upstream', async () => {
    const { response, fetch } = await callFacade({
      target: versionTarget('CMS-03A-10'),
      payload: {
        expectedVersion: '4',
        transformKey: 'article.title_to_headline',
        transformVersion: null,
      },
      upstream: { status: 202, body: dryRunResource() },
    });
    expect(response.status).toBe(422);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('[P2-S09-AC-980] accepts only 202 as success: an upstream 201 is an invalid dependency response', async () => {
    const { response } = await callFacade({
      target: versionTarget('CMS-03A-10'),
      payload: {
        expectedVersion: '4',
        transformKey: null,
        transformVersion: null,
      },
      upstream: { status: 201, body: dryRunResource() },
    });
    expect(response.status).toBe(502);
  });

  it('[P2-S09-AC-980] refuses a caller-supplied classification, counts, hashes or report', async () => {
    const { response, fetch } = await callFacade({
      target: versionTarget('CMS-03A-10'),
      payload: {
        expectedVersion: '4',
        transformKey: null,
        transformVersion: null,
        result: 'passed',
        sourceCount: 0,
      },
      upstream: { status: 202, body: dryRunResource() },
    });
    expect(response.status).toBe(422);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('[DEC-108] CMS-03A-11 submit-review facade', () => {
  it('[P2-S09-AC-981] forwards { expectedVersion, dryRunId } to .../reviews and expects 201', async () => {
    const { response, forwarded, forwardedBody } = await callFacade({
      target: versionTarget('CMS-03A-11'),
      payload: { expectedVersion: '4', dryRunId: DRY_RUN_ID },
      upstream: { status: 201, body: reviewResource() },
    });
    expect(response.status).toBe(201);
    expect(new URL(forwarded?.url ?? '').pathname).toBe(
      `${versionPath}/reviews`,
    );
    expect(forwardedBody).toStrictEqual({
      expectedVersion: '4',
      dryRunId: DRY_RUN_ID,
    });
    expect(forwarded?.headers.get('if-match')).toBe('"4"');
  });

  it('[P2-S09-AC-981] refuses a missing or non-UUID dryRunId with 422', async () => {
    for (const payload of [
      { expectedVersion: '4' },
      { expectedVersion: '4', dryRunId: 'not-a-uuid' },
    ]) {
      const { response, fetch } = await callFacade({
        target: versionTarget('CMS-03A-11'),
        payload,
        upstream: { status: 201, body: reviewResource() },
      });
      expect(response.status).toBe(422);
      expect(fetch).not.toHaveBeenCalled();
    }
  });
});

describe('[DEC-108] CMS-03A-12 record-decision facade', () => {
  it('[P2-S09-AC-982] forwards { expectedVersion, decision } to the review path and expects 201', async () => {
    const { response, forwarded, forwardedBody } = await callFacade({
      target: reviewTarget('CMS-03A-12'),
      payload: { expectedVersion: '3', decision: 'approve' },
      headers: { 'if-match': '"3"' },
      upstream: { status: 201, body: decisionResource() },
    });
    expect(response.status).toBe(201);
    expect(new URL(forwarded?.url ?? '').pathname).toBe(
      `${reviewPath}/decisions`,
    );
    expect(forwardedBody).toStrictEqual({
      expectedVersion: '3',
      decision: 'approve',
    });
    expect(forwarded?.headers.get('if-match')).toBe('"3"');
    expect(forwarded?.headers.get('idempotency-key')).toBe(
      'cms-operation-12345',
    );
  });

  it('[P2-S09-AC-982] derives MFA server-side: no browser step-up token is demanded or forwarded', async () => {
    // BE03a CMS-03A-12: reviewer identity and recent MFA are server-derived.
    const { response, forwarded } = await callFacade({
      target: reviewTarget('CMS-03A-12'),
      payload: { expectedVersion: '3', decision: 'reject' },
      headers: { 'if-match': '"3"' },
      upstream: { status: 201, body: decisionResource('reject') },
    });
    expect(response.status).toBe(201);
    expect(forwarded?.headers.get('x-step-up-token')).toBeNull();
  });

  it('refuses a caller-supplied reviewer identity or decision outside approve/reject', async () => {
    for (const payload of [
      { expectedVersion: '3', decision: 'abstain' },
      { expectedVersion: '3', decision: 'approve', reviewerId: APPROVE_A_ID },
      { expectedVersion: '3', decision: 'approve', capability: 'cms.owner' },
    ]) {
      const { response, fetch } = await callFacade({
        target: reviewTarget('CMS-03A-12'),
        payload,
        headers: { 'if-match': '"3"' },
        upstream: { status: 201, body: decisionResource() },
      });
      expect(response.status).toBe(422);
      expect(fetch).not.toHaveBeenCalled();
    }
  });
});

describe('[DEC-108] CMS-03A-14 assign/revoke facade', () => {
  const create = {
    action: 'create',
    expectedVersion: '3',
    reviewerPersonId: REVIEWER_PERSON_ID,
    expiresAt: '2026-10-05T12:00:00.000Z',
  } as const;

  it('[P2-S09-AC-983] forwards a create request exactly and accepts 201', async () => {
    const { response, forwarded, forwardedBody } = await callFacade({
      target: reviewTarget('CMS-03A-14'),
      payload: create,
      headers: { 'if-match': '"3"' },
      upstream: { status: 201, body: assignmentResource() },
    });
    expect(response.status).toBe(201);
    expect(new URL(forwarded?.url ?? '').pathname).toBe(
      `${reviewPath}/assignments`,
    );
    expect(forwardedBody).toStrictEqual(create);
  });

  it('[P2-S09-AC-983] forwards a revoke request exactly and accepts 200', async () => {
    const revoke = {
      action: 'revoke',
      expectedVersion: '3',
      assignmentId: ASSIGNMENT_ID,
    } as const;
    const { response, forwardedBody } = await callFacade({
      target: reviewTarget('CMS-03A-14'),
      payload: revoke,
      headers: { 'if-match': '"3"' },
      upstream: { status: 200, body: assignmentResource('revoked') },
    });
    expect(response.status).toBe(200);
    expect(forwardedBody).toStrictEqual(revoke);
  });

  it('[P2-S09-AC-978] never echoes the reviewer person id in the browser response', async () => {
    const { response } = await callFacade({
      target: reviewTarget('CMS-03A-14'),
      payload: create,
      headers: { 'if-match': '"3"' },
      upstream: { status: 201, body: assignmentResource() },
    });
    expect(response.status).toBe(201);
    expect(JSON.stringify(await response.json())).not.toContain(
      REVIEWER_PERSON_ID,
    );
  });

  it('refuses an unknown action, a non-UUID reviewer and fields of the other variant', async () => {
    for (const payload of [
      { ...create, action: 'transfer' },
      { ...create, reviewerPersonId: 'not-a-uuid' },
      { ...create, assignmentId: ASSIGNMENT_ID },
      {
        action: 'revoke',
        expectedVersion: '3',
        reviewerPersonId: REVIEWER_PERSON_ID,
      },
    ]) {
      const { response, fetch } = await callFacade({
        target: reviewTarget('CMS-03A-14'),
        payload,
        headers: { 'if-match': '"3"' },
        upstream: { status: 201, body: assignmentResource() },
      });
      expect(response.status).toBe(422);
      expect(fetch).not.toHaveBeenCalled();
    }
  });
});
