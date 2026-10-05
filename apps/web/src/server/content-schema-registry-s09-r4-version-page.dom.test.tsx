// @vitest-environment jsdom

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  CONTENT_SCHEMA_REGISTRY_ACTING_PARTY_ID_HEADER,
  CONTENT_SCHEMA_REGISTRY_ACTOR_ID_HEADER,
  CONTENT_SCHEMA_REGISTRY_CAPABILITY_HEADER,
} from '@wejammin/contracts';

import ContentSchemaRegistryWorkbenchIsland from '../components/content-schema-registry/ContentSchemaRegistryWorkbenchIsland';
import {
  activationPreparation,
  approvedReviewPreparation,
  passedDryRunPreparation,
  startDryRunPreparation,
} from '../components/content-schema-registry/content-schema-registry-activation-preparation.test-support';
import {
  ACTOR_ID,
  PARTY_ID,
  REVIEW_ID,
  TYPE_ID,
  VERSION_ID,
  approvedProtectedReview,
  draftDetail,
} from '../components/content-schema-registry/content-schema-review-dec108.test-support';
import { resolveContentSchemaRegistryPage } from './content-schema-registry-context';
import { createContentSchemaRegistryPlatformPorts } from './content-schema-registry-platform-api';

/**
 * FE03 version-page mapping, exercised end to end: a scripted PLATFORM_API
 * binding answers the real CMS-03A-07 and CMS-03A-13 reads, the real server
 * resolver turns the answers into page props, and the real island is rendered
 * from those props. Nothing here injects an AsyncState variant or a role: the
 * review state, the access level and the visible forms all come out of the
 * server mapping. The platform answers carry the capability header only, never
 * a presentation variant, so the web server decides ownerFull versus read-only.
 */

const VERSION_URL = `https://app.example.test/app/cms-content-modeling/${TYPE_ID}/versions/${VERSION_ID}`;
const REVIEW_PREPARATION_ID = approvedReviewPreparation.reviewRef?.id ?? '';

interface Scenario {
  readonly preparation?: ReturnType<typeof activationPreparation>;
  readonly capability?: string;
  readonly review?: { readonly status: number };
}

const headersFor = (capability: string): Record<string, string> => ({
  'content-type': 'application/json',
  [CONTENT_SCHEMA_REGISTRY_CAPABILITY_HEADER]: capability,
  [CONTENT_SCHEMA_REGISTRY_ACTOR_ID_HEADER]: ACTOR_ID,
  [CONTENT_SCHEMA_REGISTRY_ACTING_PARTY_ID_HEADER]: PARTY_ID,
});

const bind = (scenario: Scenario = {}) => {
  const requests: Request[] = [];
  const headers = headersFor(scenario.capability ?? 'cms.schema_designer');
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const request = input instanceof Request ? input : new Request(input);
    requests.push(request);
    if (request.url.includes('/schema-reviews/')) {
      const status = scenario.review?.status ?? 200;
      return status === 200
        ? Response.json(approvedProtectedReview(), { status, headers })
        : Response.json(
            { code: 'NOT_FOUND', details: {}, message: 'Refused.' },
            { status },
          );
    }
    if (request.url.includes('/acting-contexts'))
      return Response.json({
        projectionVersion: '1',
        items: [],
        nextCursor: null,
        hasMore: false,
      });
    return Response.json(
      draftDetail(scenario.preparation ?? approvedReviewPreparation),
      { status: 200, headers },
    );
  });
  return { binding: { fetch }, requests };
};

const reviewReads = (bound: ReturnType<typeof bind>): Request[] =>
  bound.requests.filter((request) => request.url.includes('/schema-reviews/'));

const resolveAndRender = async (scenario: Scenario = {}) => {
  const bound = bind(scenario);
  const result = await resolveContentSchemaRegistryPage({
    request: new Request(VERSION_URL, {
      headers: { cookie: 'wj_access=opaque; wj_csrf=csrf-cookie' },
    }),
    route: 'detail',
    contentTypeId: TYPE_ID,
    versionId: VERSION_ID,
    ports: createContentSchemaRegistryPlatformPorts(bound.binding),
    requestId: ACTOR_ID,
  });
  if (result.kind !== 'authorized')
    throw new Error(`expected an authorized page, got ${result.kind}`);
  const page = result.page;
  const markup = renderToStaticMarkup(
    React.createElement(ContentSchemaRegistryWorkbenchIsland, {
      ...(page as unknown as React.ComponentProps<
        typeof ContentSchemaRegistryWorkbenchIsland
      >),
      canonicalRefetchUrl: page.retryUrl,
    }),
  );
  const document = new DOMParser().parseFromString(
    `<body>${markup}</body>`,
    'text/html',
  );
  return { page, markup, document, bound };
};

const formIds = (document: Document): string[] =>
  [...document.querySelectorAll('form[data-operation-id]')].map(
    (form) => form.getAttribute('data-operation-id') ?? '',
  );

const reviewRegion = (document: Document): HTMLElement | null =>
  [...document.querySelectorAll<HTMLElement>('section')].find((section) =>
    /schema review/iu.test(section.querySelector('h3')?.textContent ?? ''),
  ) ?? null;

describe('review detail idle state comes from the server reviewRef rule', () => {
  it('[P2-S09-AC-949] a detail with no reviewRef issues no CMS-03A-13 read and the page renders no review panel', async () => {
    const { page, document, markup, bound } = await resolveAndRender({
      preparation: startDryRunPreparation,
    });
    // The platform would answer a review read; the server must not ask for one.
    expect(reviewReads(bound)).toHaveLength(0);
    expect((page as { initialReview?: unknown }).initialReview).toBeNull();
    expect(reviewRegion(document)).toBeNull();
    expect(markup).not.toContain('Schema review');
  });

  it('[P2-S09-AC-949] the same page with a reviewRef reads the review once and renders the panel (control)', async () => {
    const { page, document, bound } = await resolveAndRender();
    expect(reviewReads(bound)).toHaveLength(1);
    expect(
      (page as { initialReview?: { status: string } }).initialReview?.status,
    ).toBe('success');
    expect(reviewRegion(document)).not.toBeNull();
  });
});

describe('review detail empty state comes from the server 404 mapping', () => {
  it.each([404, 403])(
    '[P2-S09-AC-952] a CMS-03A-13 %i maps to not-disclosed and renders only that the review is not available',
    async (status) => {
      const { page, document, markup } = await resolveAndRender({
        review: { status },
      });
      expect((page as { initialReview?: unknown }).initialReview).toStrictEqual(
        { status: 'empty', reason: 'not-disclosed' },
      );
      const region = reviewRegion(document);
      expect(region?.textContent).toContain(
        'This review is not available to you.',
      );
      // Only that sentence: no id, no facts, no decision form, no retry link.
      expect(region?.textContent).not.toContain(REVIEW_ID);
      expect(region?.textContent).not.toContain(REVIEW_PREPARATION_ID);
      expect(region?.querySelector('dl, form, a[data-cms-retry-control]')).toBe(
        null,
      );
      expect(formIds(document)).not.toContain('CMS-03A-12');
      expect(markup).not.toContain(REVIEW_PREPARATION_ID);
    },
  );
});

describe('designer ownership of the version forms comes from the capability', () => {
  const PREPARATIONS = [
    [
      'CMS-03A-09',
      activationPreparation({ permittedNextActions: ['create_successor'] }),
    ],
    ['CMS-03A-10', startDryRunPreparation],
    ['CMS-03A-11', passedDryRunPreparation],
  ] as const;

  it.each(PREPARATIONS)(
    '[P2-S09-AC-985] cms.schema_designer alone maps to ownerFull and renders the %s form',
    async (operationId, preparation) => {
      const { page, document } = await resolveAndRender({ preparation });
      expect(page.variant).toBe('ownerFull');
      expect(page.access).toBe('full');
      expect(formIds(document)).toContain(operationId);
    },
  );

  it.each(PREPARATIONS)(
    '[P2-S09-AC-985] cms.schema_registry.read alone maps to a read-only page that renders no %s form',
    async (operationId, preparation) => {
      const { page, document } = await resolveAndRender({
        preparation,
        capability: 'cms.schema_registry.read',
      });
      expect(page.access).toBe('read-only');
      expect(page.variant).not.toBe('ownerFull');
      expect(formIds(document)).not.toContain(operationId);
      expect(formIds(document)).toStrictEqual([]);
    },
  );

  it('[P2-S09-AC-985] a designer who also reads the registry keeps the forms (capability union)', async () => {
    const { page, document } = await resolveAndRender({
      preparation: startDryRunPreparation,
      capability: 'cms.schema_registry.read,cms.schema_designer',
    });
    expect(page.access).toBe('full');
    expect(formIds(document)).toContain('CMS-03A-10');
  });
});
