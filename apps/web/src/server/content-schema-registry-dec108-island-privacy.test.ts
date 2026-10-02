import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  CONTENT_SCHEMA_REGISTRY_ACTING_PARTY_ID_HEADER,
  CONTENT_SCHEMA_REGISTRY_ACTOR_ID_HEADER,
  CONTENT_SCHEMA_REGISTRY_CAPABILITY_HEADER,
  CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANT_HEADER,
  CONTENT_SCHEMA_REGISTRY_STEP_UP_FRESH_UNTIL_HEADER,
} from '@wejammin/contracts';

import ContentSchemaRegistryWorkbenchIsland from '../components/content-schema-registry/ContentSchemaRegistryWorkbenchIsland';
import {
  ACTOR_ID,
  PARTY_ID,
  REQUEST_ID,
  REVIEW_ID,
  TYPE_ID,
  VERSION_ID,
  approvedProtectedReview,
  draftDetail,
  sha256,
} from '../components/content-schema-registry/content-schema-review-dec108.test-support';
import { approvedReviewPreparation } from '../components/content-schema-registry/content-schema-registry-activation-preparation.test-support';
import { resolveContentSchemaRegistryPage } from './content-schema-registry-context';
import {
  degradedDetailState,
  degradedListState,
  pageFor,
} from './content-schema-registry-context-presentation';
import { createContentSchemaRegistryPlatformPorts } from './content-schema-registry-platform-api';
import { resolveReview } from './content-schema-review-dec108.test-support';

/**
 * FE03 island invariant: the props passed to the bounded client island carry
 * only safe display `contextEvidence` (a human label plus the expiring
 * step-up disclosure). They never carry an actor, person, party or binding
 * identifier, a session value or a correlation token, whether raw, hashed or
 * truncated. The stable projection stays entirely server-side.
 */

const SESSION_SECRET = 'session-secret-value-0a1b2c3d4e5f';
const CORRELATION = 'corr-7f3a9c21-b84d-4e06-a1f5-d2c93b7e0a64';
const BINDING = 'binding.9d4f1c2e:7b3a8e05';
const FORBIDDEN_KEY =
  /(^|[a-z])(actor|actingParty|acting_party|actingContext|person|binding|session|correlation|owner|grantor|submitter|reviewer)(Id|Ref|Token|Hash)?$/u;
/**
 * Diagnostic identifiers in any spelling: requestId, requestID, request_id,
 * x-request-id, traceId, spanId, causationId and the correlation family.
 * Normalized so case and separators cannot dodge the check.
 */
const DIAGNOSTIC_KEY =
  /^(x)?(request|req|trace|span|causation|correlation)(id|ref|token|hash)$/u;
const isDiagnosticKey = (key: string): boolean =>
  DIAGNOSTIC_KEY.test(key.toLowerCase().replaceAll(/[^a-z0-9]/gu, ''));
const ALLOWED_KEYS = new Set(['actingContextLabel']);

/** Raw, compact, hashed and truncated spellings of one private identifier. */
const spellings = (value: string): string[] => {
  const compact = value
    .replaceAll('-', '')
    .replaceAll('.', '')
    .replaceAll(':', '');
  const digest = sha256(value);
  return [
    value,
    compact,
    digest,
    digest.slice(0, 16),
    digest.slice(-16),
    compact.slice(0, 8),
    compact.slice(-8),
  ].filter((spelling) => spelling.length >= 8);
};

const PRIVATE_VALUES = [
  ACTOR_ID,
  PARTY_ID,
  SESSION_SECRET,
  CORRELATION,
  BINDING,
  REQUEST_ID,
];

const keyPaths = (value: unknown, prefix = ''): string[] =>
  typeof value !== 'object' || value === null
    ? []
    : Object.entries(value as Record<string, unknown>).flatMap(
        ([key, child]) => [
          `${prefix}${key}`,
          ...keyPaths(child, `${prefix}${key}.`),
        ],
      );

/** Mimic Astro's serialization of island props into the HTML attribute. */
const serializeIslandProps = (props: unknown): string =>
  JSON.stringify(props).replaceAll('&', '&amp;').replaceAll('"', '&quot;');

const expectNoPrivateIdentifiers = (props: unknown): void => {
  const serialized = serializeIslandProps(props);
  for (const value of PRIVATE_VALUES)
    for (const spelling of spellings(value))
      expect(serialized, `leaked ${spelling.slice(0, 12)}…`).not.toContain(
        spelling,
      );
  const offending = keyPaths(props).filter((path) => {
    const key = path.split('.').at(-1) ?? path;
    return (
      (FORBIDDEN_KEY.test(key) || isDiagnosticKey(key)) &&
      !ALLOWED_KEYS.has(key)
    );
  });
  expect(offending).toStrictEqual([]);
};

const headers = {
  'content-type': 'application/json',
  [CONTENT_SCHEMA_REGISTRY_CAPABILITY_HEADER]: 'cms.schema_designer',
  [CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANT_HEADER]: 'ownerFull',
  [CONTENT_SCHEMA_REGISTRY_ACTOR_ID_HEADER]: ACTOR_ID,
  [CONTENT_SCHEMA_REGISTRY_ACTING_PARTY_ID_HEADER]: PARTY_ID,
  [CONTENT_SCHEMA_REGISTRY_STEP_UP_FRESH_UNTIL_HEADER]: new Date(
    Date.now() + 5 * 60 * 1000,
  ).toISOString(),
};

const versionPage = async () => {
  const binding = {
    fetch: vi.fn(async (input: RequestInfo | URL) => {
      const request = input instanceof Request ? input : new Request(input);
      if (request.url.includes('/schema-reviews/'))
        return Response.json(approvedProtectedReview(), { headers });
      if (request.url.includes('/acting-contexts'))
        return Response.json({
          projectionVersion: '1',
          items: [],
          nextCursor: null,
          hasMore: false,
        });
      return Response.json(draftDetail(approvedReviewPreparation), { headers });
    }),
  };
  const result = await resolveContentSchemaRegistryPage({
    request: new Request(
      `https://app.example.test/app/cms-content-modeling/${TYPE_ID}/versions/${VERSION_ID}`,
      {
        headers: {
          cookie: `wj_access=${SESSION_SECRET}; wj_csrf=csrf-cookie`,
          'x-correlation-id': CORRELATION,
          'x-client-binding-id': BINDING,
        },
      },
    ),
    route: 'detail',
    contentTypeId: TYPE_ID,
    versionId: VERSION_ID,
    ports: createContentSchemaRegistryPlatformPorts(binding),
    requestId: REQUEST_ID,
  });
  if (result.kind !== 'authorized')
    throw new Error(`expected an authorized page, got ${result.kind}`);
  return result.page;
};

describe('[DEC-108] version page island props carry no private identifier', () => {
  it('[P2-S09-AC-974] has neither actorId nor actingPartyId in the page projection', async () => {
    const page = (await versionPage()) as unknown as Record<string, unknown>;
    expect(Object.keys(page)).not.toContain('actorId');
    expect(Object.keys(page)).not.toContain('actingPartyId');
  });

  it('[P2-S09-AC-974] serializes no actor, person, party, binding, session or correlation value in any spelling', async () => {
    expectNoPrivateIdentifiers(await versionPage());
  });

  it('carries a support reference that is not derived from the request id', async () => {
    const first = (await versionPage()) as unknown as Record<string, unknown>;
    const second = (await versionPage()) as unknown as Record<string, unknown>;
    expect(typeof first.supportReference).toBe('string');
    expect(first.supportReference).not.toBe(second.supportReference);
    for (const spelling of spellings(REQUEST_ID))
      expect(String(first.supportReference)).not.toContain(spelling);
  });

  it('[P2-S09-AC-974] keeps the safe display evidence the island is allowed to carry', async () => {
    const page = (await versionPage()) as unknown as Record<string, unknown>;
    expect(page.stepUpState).toBe('verified');
    expect(typeof page.stepUpFreshUntil).toBe('string');
    expect(page.csrfToken).toBe('csrf-cookie');
  });

  it('[P2-S09-AC-974] renders the hydrated island markup without any private identifier', async () => {
    const page = await versionPage();
    const markup = renderToStaticMarkup(
      React.createElement(ContentSchemaRegistryWorkbenchIsland, {
        ...(page as unknown as React.ComponentProps<
          typeof ContentSchemaRegistryWorkbenchIsland
        >),
        canonicalRefetchUrl: page.retryUrl,
      }),
    );
    for (const value of PRIVATE_VALUES)
      for (const spelling of spellings(value))
        expect(markup).not.toContain(spelling);
  });
});

describe('[DEC-108] review page island props carry no private identifier', () => {
  const reviewPage = async () => {
    const { result } = await resolveReview(
      {},
      {
        request: new Request(
          `https://app.example.test/app/cms-content-modeling/schema-reviews/${REVIEW_ID}`,
          {
            headers: {
              cookie: `wj_access=${SESSION_SECRET}; wj_csrf=csrf-cookie`,
              'x-correlation-id': CORRELATION,
              'x-client-binding-id': BINDING,
            },
          },
        ),
      },
    );
    if (result.kind !== 'authorized')
      throw new Error(`expected an authorized page, got ${result.kind}`);
    return result.page;
  };

  it('[P2-S09-AC-974] serializes no actor, person, party, binding, session or correlation value in any spelling', async () => {
    expectNoPrivateIdentifiers(await reviewPage());
  });

  it('[P2-S09-AC-974] has neither actorId nor actingPartyId in the page projection', async () => {
    const page = (await reviewPage()) as unknown as Record<string, unknown>;
    expect(Object.keys(page)).not.toContain('actorId');
    expect(Object.keys(page)).not.toContain('actingPartyId');
  });
});

describe('[DEC-108] diagnostic identifiers never reach hydrated state', () => {
  const page = () =>
    pageFor({
      request: new Request('https://app.example.test/app/cms-content-modeling'),
      requestId: REQUEST_ID,
      query: {} as never,
      list: degradedListState(REQUEST_ID),
      detail: degradedDetailState(REQUEST_ID),
      contentTypeId: null,
      versionId: null,
      state: 'degraded',
    });

  it('strips the request id from the top level and from nested degraded states', () => {
    const serialized = serializeIslandProps(page());
    for (const spelling of spellings(REQUEST_ID))
      expect(serialized).not.toContain(spelling);
    expect(
      keyPaths(page()).filter((path) =>
        isDiagnosticKey(path.split('.').at(-1) ?? path),
      ),
    ).toStrictEqual([]);
  });

  it.each([
    'requestId',
    'requestID',
    'request_id',
    'x-request-id',
    'traceId',
    'traceID',
    'spanId',
    'correlationId',
    'causationId',
  ])('the privacy check rejects a hydrated %s key', (key) => {
    expect(isDiagnosticKey(key)).toBe(true);
    expect(() => expectNoPrivateIdentifiers({ [key]: 'opaque' })).toThrow();
  });
});
