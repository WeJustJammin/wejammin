import { describe, expect, it, vi } from 'vitest';
import {
  CONTENT_SCHEMA_REGISTRY_ACTING_PARTY_ID_HEADER,
  CONTENT_SCHEMA_REGISTRY_ACTOR_ID_HEADER,
  CONTENT_SCHEMA_REGISTRY_CAPABILITY_HEADER,
  CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANT_HEADER,
} from '@wejammin/contracts';

import {
  ACTOR_ID,
  PARTY_ID,
  REVIEW_ID,
  TYPE_ID,
  VERSION_ID,
  approvedProtectedReview,
  draftDetail,
} from '../components/content-schema-registry/content-schema-review-dec108.test-support';
import { approvedReviewPreparation } from '../components/content-schema-registry/content-schema-registry-activation-preparation.test-support';
import { resolveContentSchemaRegistryPage } from './content-schema-registry-context';
import { createContentSchemaRegistryPorts } from './content-schema-registry-context-support';
import { createContentSchemaRegistryPlatformPorts } from './content-schema-registry-platform-api';
import { parseContentSchemaRegistryCapabilities } from './content-schema-registry-platform-context';

/**
 * FE03 `reviewState` is a separate CMS-03A-13 read keyed by the
 * `activationPreparation.reviewRef` of the CMS-03A-07 detail; the review
 * decisions it returns are the source of the activation `approvalIds`. The
 * `schemaReviewAssigned` human never gains registry-wide read.
 */

const VERSION_URL = `https://app.example.test/app/cms-content-modeling/${TYPE_ID}/versions/${VERSION_ID}`;

const platformHeaders = (capability: string, variant: string) => ({
  'content-type': 'application/json',
  [CONTENT_SCHEMA_REGISTRY_CAPABILITY_HEADER]: capability,
  [CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANT_HEADER]: variant,
  [CONTENT_SCHEMA_REGISTRY_ACTOR_ID_HEADER]: ACTOR_ID,
  [CONTENT_SCHEMA_REGISTRY_ACTING_PARTY_ID_HEADER]: PARTY_ID,
});

const versionBinding = (
  preparation = approvedReviewPreparation,
  review: { status: number; body?: unknown } = {
    status: 200,
    body: approvedProtectedReview(),
  },
) => {
  const requests: Request[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const request = input instanceof Request ? input : new Request(input);
    requests.push(request);
    const headers = platformHeaders('cms.schema_designer', 'ownerFull');
    if (request.url.includes('/schema-reviews/'))
      return review.status === 200
        ? Response.json(review.body, { status: 200, headers })
        : Response.json(
            {
              code:
                review.status === 404 ? 'NOT_FOUND' : 'DEPENDENCY_UNAVAILABLE',
              details: {},
              message: 'Refused.',
              requestId: ACTOR_ID,
            },
            { status: review.status },
          );
    if (request.url.includes('/versions/'))
      return Response.json(draftDetail(preparation), {
        status: 200,
        headers,
      });
    return Response.json({ items: [], nextCursor: null }, { headers });
  });
  return { binding: { fetch }, requests };
};

const resolveVersion = async (bound: ReturnType<typeof versionBinding>) =>
  resolveContentSchemaRegistryPage({
    request: new Request(VERSION_URL, {
      headers: { cookie: 'wj_access=opaque' },
    }),
    route: 'detail',
    contentTypeId: TYPE_ID,
    versionId: VERSION_ID,
    ports: createContentSchemaRegistryPlatformPorts(bound.binding),
    requestId: ACTOR_ID,
  });

const reviewReads = (bound: ReturnType<typeof versionBinding>) =>
  bound.requests.filter((request) => request.url.includes('/schema-reviews/'));

describe('[DEC-108] version page reads the review named by reviewRef', () => {
  it('issues one CMS-03A-13 GET for the exact reviewRef id and projects initialReview', async () => {
    const bound = versionBinding();
    const result = await resolveVersion(bound);
    if (result.kind !== 'authorized')
      throw new Error(`expected authorized, got ${result.kind}`);
    const reads = reviewReads(bound);
    expect(reads).toHaveLength(1);
    expect(reads[0]?.method).toBe('GET');
    expect(new URL(reads[0]?.url ?? '').pathname).toBe(
      `/api/v1/cms/schema-reviews/${REVIEW_ID}`,
    );
    const page = result.page as unknown as {
      initialReview?: {
        status: string;
        data?: { id: string; decisions: { id: string }[] };
      };
    };
    expect(page.initialReview?.status).toBe('success');
    expect(page.initialReview?.data?.decisions).toHaveLength(2);
  });

  it('reads no review when the preparation has no reviewRef', async () => {
    const bound = versionBinding();
    await resolveVersion(bound);
    expect(reviewReads(bound)).toHaveLength(1);
    const none = versionBinding({
      ...approvedReviewPreparation,
      reviewRef: null,
      permittedNextActions: [],
    });
    const result = await resolveVersion(none);
    expect(result.kind).toBe('authorized');
    expect(reviewReads(none)).toHaveLength(0);
  });

  it('conceals a 404 review as not-disclosed without failing the version page', async () => {
    const bound = versionBinding(approvedReviewPreparation, { status: 404 });
    const result = await resolveVersion(bound);
    if (result.kind !== 'authorized')
      throw new Error(`expected authorized, got ${result.kind}`);
    const page = result.page as unknown as {
      initialReview?: { status: string; reason?: string };
      initialDetail: { status: string };
    };
    expect(page.initialReview).toMatchObject({
      status: 'empty',
      reason: 'not-disclosed',
    });
    expect(page.initialDetail.status).toBe('success');
  });

  it('degrades only the review state when the review read is unavailable', async () => {
    const bound = versionBinding(approvedReviewPreparation, { status: 503 });
    const result = await resolveVersion(bound);
    if (result.kind !== 'authorized')
      throw new Error(`expected authorized, got ${result.kind}`);
    const page = result.page as unknown as {
      initialReview?: { status: string };
      initialDetail: { status: string };
    };
    expect(page.initialReview?.status).toBe('degraded');
    expect(page.initialDetail.status).toBe('success');
  });
});

describe('[DEC-108] review-only scope never implies registry-wide read', () => {
  const portsFor = (capabilities: readonly string[], variant: string) =>
    createContentSchemaRegistryPorts({
      verifySession: () => ({ userId: ACTOR_ID, expiresAt: 200 }),
      now: () => 100,
      resolveAuthority: () => ({
        actingPartyId: PARTY_ID,
        capabilities: [...capabilities],
        presentationVariant: variant as 'ownerFull',
      }),
      loadList: () => ({ items: [], nextCursor: null }),
      loadDetail: () => draftDetail(),
    });

  const resolveWith = (capabilities: readonly string[], variant: string) =>
    resolveContentSchemaRegistryPage({
      request: new Request(VERSION_URL),
      route: 'detail',
      contentTypeId: TYPE_ID,
      versionId: VERSION_ID,
      ports: portsFor(capabilities, variant),
      requestId: ACTOR_ID,
    });

  it('refuses the version detail to a human holding only cms.schema_review', async () => {
    expect((await resolveWith(['cms.schema_designer'], 'ownerFull')).kind).toBe(
      'authorized',
    );
    expect(
      (await resolveWith(['cms.schema_review'], 'schemaReviewAssigned')).kind,
    ).toBe('forbidden');
  });

  it('refuses the registry list to a human holding only cms.schema_review', async () => {
    const result = await resolveContentSchemaRegistryPage({
      request: new Request('https://app.example.test/app/cms-content-modeling'),
      route: 'list',
      ports: portsFor(['cms.schema_review'], 'schemaReviewAssigned'),
      requestId: ACTOR_ID,
    });
    expect(result.kind).toBe('forbidden');
  });
});

describe('[DEC-108] private boundary capability allowlist', () => {
  it('projects cms.schema_review across the private web/API boundary', () => {
    expect(
      parseContentSchemaRegistryCapabilities(
        'cms.schema_designer,cms.schema_review,cms.schema_registry.read',
      ),
    ).toStrictEqual([
      'cms.schema_designer',
      'cms.schema_review',
      'cms.schema_registry.read',
    ]);
  });

  it('still drops capabilities outside the allowlist', () => {
    expect(
      parseContentSchemaRegistryCapabilities(
        'cms.schema_review,cms.owner.everything',
      ),
    ).toStrictEqual(['cms.schema_review']);
  });
});
