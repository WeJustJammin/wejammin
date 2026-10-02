import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CONTENT_SCHEMA_REGISTRY_ACTING_PARTY_ID_HEADER,
  CONTENT_SCHEMA_REGISTRY_ACTOR_ID_HEADER,
  CONTENT_SCHEMA_REGISTRY_CAPABILITY_HEADER,
  CONTENT_SCHEMA_REGISTRY_STEP_UP_FRESH_UNTIL_HEADER,
} from '@wejammin/contracts';

import ContentSchemaRegistryWorkbenchIsland from './ContentSchemaRegistryWorkbenchIsland';
import { resolveContentSchemaRegistryPage } from '../../server/content-schema-registry-context';
import { createContentSchemaRegistryPlatformPorts } from '../../server/content-schema-registry-platform-api';
import {
  ACTOR_ID,
  PARTY_ID,
  TYPE_ID,
  VERSION_ID,
  detail,
  list,
} from './content-schema-registry-server-test-values';

const ACTING_CONTEXTS_PATH = '/api/v1/me/acting-contexts';
const LABEL = 'Northwind Collective';
const NOW = Date.parse('2026-10-01T12:00:00.000Z');
const STEP_UP_FRESH_UNTIL = new Date(NOW + 5 * 60 * 1000).toISOString();

afterEach(() => {
  vi.restoreAllMocks();
});

interface BindingOptions {
  readonly actingContexts?: Response | (() => Promise<Response>);
  readonly omitStepUp?: boolean;
  readonly capability?: string;
  readonly resourceStatus?: number;
}

const binding = (options: BindingOptions = {}) => {
  const requests: Request[] = [];
  return {
    requests,
    binding: {
      fetch: vi.fn(async (input: RequestInfo | URL) => {
        const request = input instanceof Request ? input : new Request(input);
        requests.push(request);
        if (request.url.includes(ACTING_CONTEXTS_PATH))
          return options.actingContexts === undefined
            ? Response.json({ items: 'unexpected' })
            : typeof options.actingContexts === 'function'
              ? await options.actingContexts()
              : options.actingContexts;
        const status = options.resourceStatus ?? 200;
        if (status !== 200)
          return Response.json(
            {
              code: 'FORBIDDEN',
              message: 'no',
              requestId: ACTOR_ID,
              details: {},
            },
            { status },
          );
        return Response.json(
          request.url.includes('/versions/') ? detail : list,
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
              [CONTENT_SCHEMA_REGISTRY_CAPABILITY_HEADER]:
                options.capability ?? 'cms.schema_designer',
              [CONTENT_SCHEMA_REGISTRY_ACTOR_ID_HEADER]: ACTOR_ID,
              [CONTENT_SCHEMA_REGISTRY_ACTING_PARTY_ID_HEADER]: PARTY_ID,
              ...(options.omitStepUp === true
                ? {}
                : {
                    [CONTENT_SCHEMA_REGISTRY_STEP_UP_FRESH_UNTIL_HEADER]:
                      STEP_UP_FRESH_UNTIL,
                  }),
            },
          },
        );
      }),
    },
  };
};

const actingContextsResponse = () =>
  Response.json({
    projectionVersion: '1',
    items: [
      {
        contextId: PARTY_ID,
        partyId: PARTY_ID,
        kind: 'organization',
        label: LABEL,
        avatarRef: null,
        selectable: true,
        authorityFreshUntil: new Date(NOW + 60 * 60 * 1000).toISOString(),
      },
    ],
    nextCursor: null,
    hasMore: false,
  });

const loadDetailPage = async (options: BindingOptions = {}) => {
  const bound = binding(options);
  return {
    bound,
    result: await resolveContentSchemaRegistryPage({
      request: new Request(
        `https://app.example.test/app/cms-content-modeling/${TYPE_ID}/versions/${VERSION_ID}`,
        { headers: { cookie: 'wj_access=opaque' } },
      ),
      route: 'detail',
      contentTypeId: TYPE_ID,
      versionId: VERSION_ID,
      ports: createContentSchemaRegistryPlatformPorts(bound.binding),
      requestId: ACTOR_ID,
      now: () => NOW,
    }),
  };
};

const actingContextRequests = (requests: readonly Request[]) =>
  requests.filter((request) => request.url.includes(ACTING_CONTEXTS_PATH));

describe('AC250 protected page load resolves the acting-context disclosure', () => {
  it('projects label plus expiry from the authorized acting-context read', async () => {
    const { bound, result } = await loadDetailPage({
      actingContexts: actingContextsResponse(),
    });
    expect(result.kind).toBe('authorized');
    if (result.kind !== 'authorized') return;
    expect(result.page.actingContextLabel).toBe(LABEL);
    expect(result.page.stepUpState).toBe('verified');
    expect(result.page.stepUpFreshUntil).toBe(STEP_UP_FRESH_UNTIL);

    const labelReads = actingContextRequests(bound.requests);
    expect(labelReads).toHaveLength(1);
    expect(labelReads[0]?.headers.get('cookie')).toBe('wj_access=opaque');
  });

  it('renders the real confirmation from the resolved page with schema-designer scope', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const { result } = await loadDetailPage({
      actingContexts: actingContextsResponse(),
    });
    expect(result.kind).toBe('authorized');
    if (result.kind !== 'authorized') return;
    // The activation form is reachable only with full designer scope, so this
    // is the scope that must prove the disclosure reaches the confirmation.
    expect(result.page.access).toBe('full');
    const markup = renderToStaticMarkup(
      React.createElement(ContentSchemaRegistryWorkbenchIsland, {
        ...result.page,
        canonicalRefetchUrl: result.page.retryUrl,
      }),
    );
    expect(markup).toContain('Confirm schema activation');
    expect(markup).toContain(LABEL);
    expect(markup).toContain('Verified until');
    const disclosureStart = markup.indexOf('Acting context');
    expect(
      markup.slice(
        disclosureStart,
        markup.indexOf('<dt>Step-up</dt>', disclosureStart),
      ),
    ).not.toContain(PARTY_ID);
    expect(markup).not.toContain('actingContextId');
    expect(markup).not.toContain('bindingId');
  });

  it('falls back to no label and required step-up when the label read is unavailable', async () => {
    for (const actingContexts of [
      () => Promise.resolve(new Response('nope', { status: 503 })),
      () => Promise.resolve(Response.json({ items: 'invalid' })),
      () =>
        Promise.resolve(
          Response.json({
            projectionVersion: '1',
            items: [],
            nextCursor: null,
            hasMore: false,
          }),
        ),
      () => Promise.reject(new Error('unavailable')),
    ]) {
      const { result } = await loadDetailPage({
        actingContexts,
        omitStepUp: true,
      });
      expect(result.kind).toBe('authorized');
      if (result.kind !== 'authorized') continue;
      expect(result.page.actingContextLabel).toBeUndefined();
      expect(result.page.stepUpState).toBe('required');
    }
  });

  it('does not read labels or render activation on a genuinely forbidden response', async () => {
    const { bound, result } = await loadDetailPage({
      actingContexts: actingContextsResponse(),
      resourceStatus: 403,
    });
    expect(result.kind).toBe('forbidden');
    expect(actingContextRequests(bound.requests)).toHaveLength(0);
  });

  it('does not read labels or render activation on a genuinely degraded response', async () => {
    const { bound, result } = await loadDetailPage({
      actingContexts: actingContextsResponse(),
      resourceStatus: 503,
    });
    expect(result.kind).toBe('degraded');
    if (result.kind !== 'degraded') return;
    expect(result.page.access).not.toBe('full');
    expect(actingContextRequests(bound.requests)).toHaveLength(0);
    const markup = renderToStaticMarkup(
      React.createElement(ContentSchemaRegistryWorkbenchIsland, {
        ...result.page,
        canonicalRefetchUrl: result.page.retryUrl,
      }),
    );
    expect(markup).not.toContain('Confirm schema activation');
  });
});
