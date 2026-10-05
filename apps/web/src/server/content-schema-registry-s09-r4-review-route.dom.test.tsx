// @vitest-environment jsdom

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import ContentSchemaRegistryWorkbenchIsland from '../components/content-schema-registry/ContentSchemaRegistryWorkbenchIsland';
import {
  ASSIGNMENT_ID,
  REVIEW_ID,
  assignmentResource,
  reviewResource,
} from '../components/content-schema-registry/content-schema-review-dec108.test-support';
import {
  NOW,
  REVIEW_URL,
  reviewBinding,
  reviewRequest,
} from './content-schema-review-dec108.test-support';
import { resolveContentSchemaReviewPage } from './content-schema-review-context';
import { createContentSchemaReviewPlatformPorts } from './content-schema-review-platform-api';
import { SESSION_TTL_MS } from './content-schema-registry-platform-shared';

/**
 * FE03 review route, exercised end to end: a scripted PLATFORM_API binding
 * answers the CMS-03A-13 read, the real route resolver builds the page props
 * and the real island is rendered from them. The visible command forms and
 * the guard outcomes come out of the server mapping, not out of props set by
 * the test. Only the clock is varied, to produce an expired session.
 */

const resolve = async (
  options: Parameters<typeof reviewBinding>[0] = {},
  input: { readonly request?: Request; readonly now?: () => number } = {},
) => {
  const bound = reviewBinding(options);
  const ports = createContentSchemaReviewPlatformPorts(bound.binding);
  const result = await resolveContentSchemaReviewPage({
    request: input.request ?? reviewRequest(),
    reviewId: REVIEW_ID,
    ports: input.now === undefined ? ports : { ...ports, now: input.now },
    requestId: REVIEW_ID,
    now: () => NOW,
  });
  return { result, bound };
};

const renderedForms = async (
  options: Parameters<typeof reviewBinding>[0],
): Promise<string[]> => {
  const { result } = await resolve(options);
  if (result.kind !== 'authorized')
    throw new Error(`expected authorized, got ${result.kind}`);
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
  return [...document.querySelectorAll('form[data-operation-id]')].map(
    (form) => form.getAttribute('data-operation-id') ?? '',
  );
};

const OWNER = { capability: 'cms.schema_designer', variant: null } as const;
const REVIEWER = { capability: 'cms.schema_review', variant: null } as const;

describe('activationPreparation readiness: review route actions', () => {
  it.each([
    [
      'record_decision',
      'CMS-03A-12',
      REVIEWER,
      ['record_decision'],
      ['CMS-03A-12'],
    ],
    ['record_decision absent', 'CMS-03A-12', REVIEWER, [], []],
    [
      'assign_reviewer',
      'CMS-03A-14',
      OWNER,
      ['assign_reviewer'],
      ['CMS-03A-14'],
    ],
    ['assign_reviewer absent', 'CMS-03A-14', OWNER, [], []],
  ] as const)(
    '[P2-S09-AC-972] %s: the server-read permittedNextActions decide the %s form',
    async (_name, _operationId, who, actions, expected) => {
      const forms = await renderedForms({
        ...who,
        body: reviewResource({
          permittedNextActions: [...actions],
          assignments: [assignmentSummary()],
        }),
      });
      // The assignment form and the revoke forms share CMS-03A-14.
      expect([...new Set(forms)]).toStrictEqual([...expected]);
    },
  );

  it('[P2-S09-AC-972] a reviewer cannot get the assignment form by holding an assign action (owner-only)', async () => {
    const forms = await renderedForms({
      ...REVIEWER,
      body: reviewResource({
        permittedNextActions: ['assign_reviewer'],
        assignments: [assignmentSummary()],
      }),
    });
    expect(forms).toStrictEqual([]);
  });

  it('[P2-S09-AC-972] an open review whose actions are empty renders no command form for the owner either', async () => {
    expect(
      await renderedForms({
        ...OWNER,
        body: reviewResource({ permittedNextActions: [] }),
      }),
    ).toStrictEqual([]);
  });
});

function assignmentSummary() {
  const assignment = assignmentResource('active');
  return {
    assignmentId: ASSIGNMENT_ID,
    version: assignment.version,
    state: 'active' as const,
    startsAt: assignment.startsAt,
    endsAt: assignment.expiresAt,
    reviewerLabel: 'Reviewer A',
  };
}

describe('review route guard: session, expiry, acting context, scope', () => {
  it('[P2-S09-AC-1016] a session whose lifetime has ended is an unauthenticated redirect and never reaches the platform', async () => {
    // Control: the same request with the clock inside the lifetime authorizes.
    expect((await resolve(OWNER)).result.kind).toBe('authorized');
    const { result, bound } = await resolve(OWNER, {
      now: () => Date.now() + SESSION_TTL_MS + 1_000,
    });
    expect(result.kind).toBe('unauthenticated');
    expect(bound.fetch).not.toHaveBeenCalled();
  });

  it('[P2-S09-AC-1016] a request without a session cookie never reaches the platform', async () => {
    const { result, bound } = await resolve(OWNER, {
      request: reviewRequest({ cookie: null }),
    });
    expect(result.kind).toBe('unauthenticated');
    expect(bound.fetch).not.toHaveBeenCalled();
  });

  it('[P2-S09-AC-1016] a browser-supplied acting-context identity never reaches the platform read', async () => {
    const forged = new Request(REVIEW_URL, {
      headers: {
        cookie: 'wj_access=opaque; wj_csrf=csrf-cookie',
        'x-acting-party-id': 'b7e402d9-81aa-7c35-a4f0-9d6e18b2c370',
        'x-wj-actor-id': '5a1c9e2b-4d37-7f08-9b6e-c01d2a3f4e51',
      },
    });
    const { bound } = await resolve(OWNER, { request: forged });
    const reads = bound.requests.filter((request) =>
      request.url.includes('/schema-reviews/'),
    );
    expect(reads).toHaveLength(1);
    const names = [...(reads[0]?.headers.keys() ?? [])];
    expect(names.filter((name) => /acting|actor/iu.test(name))).toStrictEqual(
      [],
    );
  });

  it.each([
    [401, 'unauthenticated'],
    [403, 'forbidden'],
    [404, 'not_found'],
  ] as const)(
    '[P2-S09-AC-1016] an upstream %i (acting context or scope refused by the platform) is the %s outcome with no page',
    async (status, kind) => {
      const { result } = await resolve({
        status,
        errorCode: {
          401: 'UNAUTHENTICATED',
          403: 'FORBIDDEN',
          404: 'NOT_FOUND',
        }[status],
      });
      expect(result.kind).toBe(kind);
      expect('page' in result).toBe(false);
    },
  );

  it('[P2-S09-AC-1016] the capability proof must be the designer or the review-only scope: the registry read scope alone is forbidden', async () => {
    const { result } = await resolve({
      capability: 'cms.schema_registry.read',
    });
    expect(result.kind).toBe('forbidden');
  });

  it('[P2-S09-AC-1016] the submitter and the assigned reviewer each authorize with their own presentation, decided by the capability', async () => {
    const designer = await resolve(OWNER);
    const reviewer = await resolve(REVIEWER);
    if (designer.result.kind !== 'authorized')
      throw new Error('designer not authorized');
    if (reviewer.result.kind !== 'authorized')
      throw new Error('reviewer not authorized');
    expect(designer.result.page.variant).toBe('ownerFull');
    expect(reviewer.result.page.variant).toBe('schemaReviewAssigned');
  });
});
