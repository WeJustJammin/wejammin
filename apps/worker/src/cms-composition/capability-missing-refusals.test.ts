import {
  CMS_SLICE_12_OPERATION_REASONS,
  CmsCompositionRefusalDetailsSchema,
} from '@wejammin/contracts';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { createCmsLocaleApp } from './locale-routes';
import { createCmsRelatedContentApp } from './related-content-routes';
import {
  body as relatedBody,
  dependencies as relatedDependencies,
  request as relatedRequest,
} from './related-content-routes.test-support';
import { registerCmsTemplateDetailRoutes } from './template-detail-routes';
import { createCmsTemplateApp } from './template-routes';
import type { CmsTemplateDependencies } from './template-routes';

/**
 * BE03c "Slice 12 typed refusals" (line 1399): the 403 tokens are `capability_missing` and `separation_of_duties`
 * (frozen contract `refusals.ts`, `CMS_SLICE_12_OPERATION_REASONS`). The operations exercised here (CMS-03C-01, -04,
 * -05 and the template reads) publish `capability_missing` alone; CMS-03C-06/-07 also publish `separation_of_duties`
 * and are covered by their own suites. The pre-contract upper-case `CAPABILITY_REQUIRED` is not a 03c token: no route
 * emits it and no detail filter relays it.
 */

const ACTOR = '10000000-0000-4000-8000-000000000001';
const PARTY = '20000000-0000-4000-8000-000000000002';
const TYPE_ID = '30000000-0000-4000-8000-000000000003';
const ORIGIN = 'https://cms.example.test';
const DIGEST = 'a'.repeat(64);

type SessionValue = Readonly<{
  userId: string;
  actingPartyId: string | null;
  capabilities: readonly string[];
  mfaFresh: boolean;
}>;
type Session =
  | Readonly<{ ok: true; value: SessionValue }>
  | Readonly<{
      ok: false;
      status: 403;
      code: string;
      message: string;
      details: Readonly<Record<string, unknown>>;
    }>;

const session = (capabilities: readonly string[]): Session => ({
  ok: true,
  value: { userId: ACTOR, actingPartyId: PARTY, capabilities, mfaFresh: true },
});
const noParty = (capability: string): Session => ({
  ok: true,
  value: {
    userId: ACTOR,
    actingPartyId: null,
    capabilities: [capability],
    mfaFresh: true,
  },
});
/** A session port that itself refuses with 403 and a hostile or foreign detail. */
const refusedSession = (
  details: Readonly<Record<string, unknown>>,
): Session => ({
  ok: false,
  status: 403,
  code: 'PORT_CODE',
  message: 'private provider text must not escape',
  details,
});

const allowedRate = async (input: { limit: number }) => ({
  ok: true as const,
  value: {
    allowed: true,
    limit: input.limit,
    remaining: input.limit - 1,
    resetAt: 60_000,
  },
});

const templateDependencies = (
  resolveSession: () => Promise<Session>,
): CmsTemplateDependencies =>
  ({
    humanOrigins: [ORIGIN],
    now: () => 0,
    resolveSession,
    rateLimit: allowedRate,
    defineTemplate: async () => {
      throw new Error('port reached before the capability gate');
    },
    readContext: async () => {
      throw new Error('port reached before the capability gate');
    },
    readLatest: async () => {
      throw new Error('port reached before the capability gate');
    },
    telemetry: () => undefined,
  }) as unknown as CmsTemplateDependencies;
const templateApp = (resolveSession: () => Promise<Session>) =>
  createCmsTemplateApp(templateDependencies(resolveSession));
/** The detail read is registered beside the app, as its own suite does. */
const templateDetailApp = (resolveSession: () => Promise<Session>) => {
  const app = new Hono();
  registerCmsTemplateDetailRoutes(app, templateDependencies(resolveSession));
  return app;
};

const templateBody = {
  templateKey: 'profile-header',
  compatibleTypeIds: [TYPE_ID],
  slots: [
    {
      key: 'header',
      required: true,
      allowedBlocks: [{ blockKey: 'profile.header', blockVersion: 1 }],
      maxCount: 1,
    },
  ],
  reservedRegions: ['header', 'now', 'record', 'detail', 'provenance'],
  bindings: { title: { projection: 'profile.title', required: true } },
  locale: 'en-US',
  audience: 'public',
  blockRegistryDigest: DIGEST,
  expectedVersion: null,
};

const ENTRY = 'd1000000-0000-4000-8000-000000000001';
const SOURCE_REVISION = 'd1000000-0000-4000-8000-000000000002';
const FIELD = 'd1000000-0000-4000-8000-000000000005';
const localeBody = {
  entryId: ENTRY,
  locale: 'fr-FR',
  sourceRevisionId: SOURCE_REVISION,
  fields: [{ fieldId: FIELD, value: 'Titre traduit' }],
  fallbackChain: ['en-US'],
  noFallbackFieldIds: [],
  sourceHash: DIGEST,
  expectedVersion: '1',
};

const localeApp = (resolveSession: () => Promise<Session>) =>
  createCmsLocaleApp({
    humanOrigins: [ORIGIN],
    now: () => 1_000,
    resolveSession,
    rateLimit: async (input) => ({
      ok: true,
      value: {
        allowed: true,
        limit: input.limit,
        remaining: input.limit - 1,
        resetAt: 2_000,
      },
    }),
    authorLocale: async () => {
      throw new Error('port reached before the capability gate');
    },
    readLocaleVariant: async () => {
      throw new Error('the write suite never reads');
    },
    telemetry: () => undefined,
  });

type Route = Readonly<{
  name: string;
  operation: string;
  /**
   * A token this operation's list carries whose contract status is not 403 (`cmsSlice12ReasonStatus`). On a 403
   * it must still relay `{}`: the status gate, not the list check, drops it. (The detail read's own list no
   * longer carries it, so that row is dropped by the list check as well.)
   */
  offStatusToken: string;
  call: (resolve: () => Promise<Session>) => Promise<Response>;
}>;

const ROUTES: readonly Route[] = [
  {
    name: 'template context read',
    operation: 'cmsTemplateContextRead',
    offStatusToken: 'block_registry_digest_mismatch',
    call: async (resolve) =>
      templateApp(resolve).request('/api/v1/cms/templates/context'),
  },
  {
    name: 'template detail read',
    operation: 'cmsTemplateLatestRead',
    offStatusToken: 'block_registry_digest_mismatch',
    call: async (resolve) =>
      templateDetailApp(resolve).request(
        '/api/v1/cms/templates/profile-header',
      ),
  },
  {
    name: 'template version define (CMS-03C-01)',
    operation: 'CMS-03C-01',
    offStatusToken: 'block_registry_digest_mismatch',
    call: async (resolve) =>
      templateApp(resolve).request('/api/v1/cms/templates/versions', {
        method: 'POST',
        headers: {
          origin: ORIGIN,
          'content-type': 'application/json',
          'idempotency-key': 'template-create-0001',
        },
        body: JSON.stringify(templateBody),
      }),
  },
  {
    name: 'locale authoring (CMS-03C-04)',
    operation: 'CMS-03C-04',
    offStatusToken: 'locale_limit_reached',
    call: async (resolve) =>
      localeApp(resolve).request(
        `https://api.example.test/api/v1/cms/entries/${ENTRY}/locales/fr-FR/variants`,
        {
          method: 'POST',
          headers: {
            origin: ORIGIN,
            'content-type': 'application/json',
            'idempotency-key': 'locale-command-0001',
            'if-match': '"1"',
          },
          body: JSON.stringify(localeBody),
        },
      ),
  },
  {
    name: 'related content (CMS-03C-05)',
    operation: 'CMS-03C-05',
    offStatusToken: 'derived_rule_unknown',
    call: async (resolve) =>
      createCmsRelatedContentApp(
        relatedDependencies({
          resolveSession: resolve,
          actRelatedContent: async () => {
            throw new Error('port reached before the capability gate');
          },
        }),
      ).request(relatedRequest({}, relatedBody)),
  },
];

const detailsOf = async (response: Response) =>
  ((await response.json()) as { details: Record<string, unknown> }).details;

describe.each(ROUTES)(
  '$name 403 capability token',
  ({ call, offStatusToken }) => {
    it('answers a missing capability with capability_missing before the port', async () => {
      const response = await call(async () => session(['cms.reader']));
      expect(response.status).toBe(403);
      const details = await detailsOf(response);
      expect(details).toEqual({ reasonCode: 'capability_missing' });
      expect(
        CmsCompositionRefusalDetailsSchema.safeParse(details).success,
      ).toBe(true);
    });

    it('answers a session without an acting party with capability_missing', async () => {
      const response = await call(async () => noParty('cms.template_designer'));
      expect(response.status).toBe(403);
      expect(await detailsOf(response)).toEqual({
        reasonCode: 'capability_missing',
      });
    });

    it.each([
      ['the pre-contract upper-case token', 'CAPABILITY_REQUIRED'],
      ['a 403 token this operation does not publish', 'separation_of_duties'],
      ['a 409 token on a 403', 'revision_not_editable'],
      ['an unknown token', 'not_a_token'],
    ])(
      'relays {} for a session port 403 carrying %s',
      async (_label, token) => {
        const response = await call(async () =>
          refusedSession({ reasonCode: token, secret: 'private' }),
        );
        expect(response.status).toBe(403);
        expect(await detailsOf(response)).toEqual({});
      },
    );

    it('relays {} for a session port 403 carrying an on-list token of another status', async () => {
      const response = await call(async () =>
        refusedSession({ reasonCode: offStatusToken, secret: 'private' }),
      );
      expect(response.status).toBe(403);
      expect(await detailsOf(response)).toEqual({});
    });

    it('relays the typed token of a session port 403 and nothing else', async () => {
      const response = await call(async () =>
        refusedSession({ reasonCode: 'capability_missing', secret: 'private' }),
      );
      expect(response.status).toBe(403);
      expect(await detailsOf(response)).toEqual({
        reasonCode: 'capability_missing',
      });
    });
  },
);

/**
 * `refusals.ts` gives the template detail read its own row (`cmsTemplateLatestRead`); the 403 relay of that
 * read must follow it, not CMS-03C-01's. Today both rows carry the same 403 token, so the wiring is only
 * observable by widening CMS-03C-01's row for the length of one test, as a later contract edit would.
 * `cmsTemplateContextRead` has no row (`error-catalog.ts` leaves it out) and follows the template family's
 * CMS-03C-01 row.
 */
describe('template read 403 relays follow their own contract row', () => {
  const WIDENED = 'separation_of_duties';
  const route = (operation: string): Route =>
    ROUTES.find((candidate) => candidate.operation === operation) as Route;
  const widened = async (run: () => Promise<void>) => {
    // The contract table is `as const` (readonly types only); widening the live array is the test's lever.
    const row = CMS_SLICE_12_OPERATION_REASONS[
      'CMS-03C-01'
    ] as unknown as string[];
    row.push(WIDENED);
    try {
      await run();
    } finally {
      row.splice(row.indexOf(WIDENED), 1);
    }
  };
  const refusedWith = async (operation: string) =>
    detailsOf(
      await route(operation).call(async () =>
        refusedSession({ reasonCode: WIDENED }),
      ),
    );

  it('relays a token only CMS-03C-01 lists on the template define route', async () => {
    await widened(async () => {
      expect(await refusedWith('CMS-03C-01')).toEqual({ reasonCode: WIDENED });
    });
  });

  it('does not relay it on the template detail read, which has its own row', async () => {
    await widened(async () => {
      expect(await refusedWith('cmsTemplateLatestRead')).toEqual({});
    });
  });

  it('lets the context read, which has no row, follow the CMS-03C-01 row', async () => {
    await widened(async () => {
      expect(await refusedWith('cmsTemplateContextRead')).toEqual({
        reasonCode: WIDENED,
      });
    });
  });
});
