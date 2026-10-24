import {
  CMS_SLICE_12_OPERATION_REASONS,
  CmsCompositionRefusalDetailsSchema,
} from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import { readCmsTemplateContext } from './cms-composition-platform-context';
import { readCmsTemplateDetail } from './cms-composition-platform-detail';
import { forwardCmsLocaleVariantMutation } from './cms-composition-platform-locale';
import { forwardCmsTemplateDefineMutation } from './cms-composition-platform-mutation';
import { request as templateRequest } from './cms-composition-platform-mutation-test-support';
import { forwardCmsRelatedContentMutation } from './cms-composition-platform-related';

/**
 * BE03c 1304: every 03c operation gives its 403 exactly one lowercase token, `capability_missing`
 * (`CMS_SLICE_12_OPERATION_REASONS`). The Web relays publish that token alone for an upstream 403 that
 * names it; the pre-contract upper-case `CAPABILITY_REQUIRED`, another operation's 403 token, an unknown
 * token and an untyped 403 all relay `{}`. The browser maps a template 403 by status (`TEMPLATE_FORBIDDEN`),
 * so no browser copy depends on the former token.
 */
const ORIGIN = 'https://app.example.test';
const REQUEST_ID = '50000000-0000-4000-8000-000000000005';
const ENTRY = 'd1000000-0000-4000-8000-000000000001';
const SOURCE_REVISION = 'd1000000-0000-4000-8000-000000000002';
const FIELD = 'd1000000-0000-4000-8000-000000000005';
const PIN = 'd1000000-0000-4000-8000-000000000006';
const COOKIE =
  'wj_access=protected; wj_csrf=csrf-token-123; private=do-not-forward';

const upstream = (code: string, noun: string, details: unknown): Response =>
  new Response(
    JSON.stringify({
      code,
      message: `${code}: ${noun} operation rejected or unavailable.`,
      requestId: REQUEST_ID,
      details,
    }),
    { status: 403, headers: { 'content-type': 'application/json' } },
  );

const mutationHeaders = (key: string) => ({
  origin: ORIGIN,
  cookie: COOKIE,
  'x-csrf-token': 'csrf-token-123',
  'content-type': 'application/json',
  'idempotency-key': key,
  'if-match': '"1"',
});

const localeCall = (fetch: () => Promise<Response>) =>
  forwardCmsLocaleVariantMutation(
    new Request(
      `${ORIGIN}/api/v1/cms/entries/${ENTRY}/locales/fr-FR/variants`,
      {
        method: 'POST',
        headers: mutationHeaders('locale-command-0001'),
        body: JSON.stringify({
          entryId: ENTRY,
          locale: 'fr-FR',
          sourceRevisionId: SOURCE_REVISION,
          fields: [{ fieldId: FIELD, value: 'Titre traduit' }],
          fallbackChain: ['en-US'],
          noFallbackFieldIds: [],
          sourceHash: 'a'.repeat(64),
          expectedVersion: '1',
        }),
      },
    ),
    ENTRY,
    'fr-FR',
    { fetch },
  );

const relatedCall = (fetch: () => Promise<Response>) =>
  forwardCmsRelatedContentMutation(
    new Request(`${ORIGIN}/api/v1/cms/entries/${ENTRY}/related-content`, {
      method: 'POST',
      headers: mutationHeaders('related-content-0001'),
      body: JSON.stringify({
        entryId: ENTRY,
        pins: [PIN],
        exclusions: [],
        derivedRule: null,
        expectedVersion: '1',
      }),
    }),
    ENTRY,
    { fetch },
  );

const readRequest = (path: string) =>
  new Request(`${ORIGIN}${path}`, {
    headers: { origin: ORIGIN, cookie: COOKIE },
  });

type Relay = Readonly<{
  name: string;
  /**
   * A token this operation's list carries whose contract status is not 403 (`cmsSlice12ReasonStatus`). On an
   * upstream 403 it must still relay `{}`: the status gate, not the list check, drops it. (The detail read's own
   * list no longer carries it, so that row is dropped by the list check as well.)
   */
  offStatusToken: string;
  call: (details: unknown) => Promise<Response>;
}>;

const RELAYS: readonly Relay[] = [
  {
    name: 'template define (CMS-03C-01)',
    offStatusToken: 'block_registry_digest_mismatch',
    call: async (details) =>
      forwardCmsTemplateDefineMutation(templateRequest(), {
        fetch: vi.fn(async () =>
          upstream('TEMPLATE_FORBIDDEN', 'template', details),
        ),
      }),
  },
  {
    name: 'template context read',
    offStatusToken: 'block_registry_digest_mismatch',
    call: async (details) =>
      readCmsTemplateContext(readRequest('/api/v1/cms/templates/context'), {
        fetch: vi.fn(async () =>
          upstream('TEMPLATE_FORBIDDEN', 'template', details),
        ),
      }),
  },
  {
    name: 'template detail read',
    offStatusToken: 'block_registry_digest_mismatch',
    call: async (details) =>
      readCmsTemplateDetail(
        readRequest('/api/v1/cms/templates/profile-header'),
        {
          fetch: vi.fn(async () =>
            upstream('TEMPLATE_FORBIDDEN', 'template', details),
          ),
        },
        'profile-header',
      ),
  },
  {
    name: 'locale authoring (CMS-03C-04)',
    offStatusToken: 'locale_limit_reached',
    call: async (details) =>
      localeCall(async () => upstream('LOCALE_FORBIDDEN', 'locale', details)),
  },
  {
    name: 'related content (CMS-03C-05)',
    offStatusToken: 'derived_rule_unknown',
    call: async (details) =>
      relatedCall(async () =>
        upstream('RELATED_CONTENT_FORBIDDEN', 'related-content', details),
      ),
  },
];

const detailsOf = async (response: Response) =>
  ((await response.json()) as { details: Record<string, unknown> }).details;

describe.each(RELAYS)('$name 403 relay', ({ call, offStatusToken }) => {
  it('relays capability_missing alone, dropping every other member', async () => {
    const response = await call({
      reasonCode: 'capability_missing',
      secret: 'private',
    });
    expect(response.status).toBe(403);
    const details = await detailsOf(response);
    expect(details).toEqual({ reasonCode: 'capability_missing' });
    expect(CmsCompositionRefusalDetailsSchema.safeParse(details).success).toBe(
      true,
    );
  });

  it.each([
    [
      'the pre-contract upper-case token',
      { reasonCode: 'CAPABILITY_REQUIRED' },
    ],
    [
      'a 403 token this operation does not publish',
      { reasonCode: 'separation_of_duties' },
    ],
    ['a 409 token on a 403', { reasonCode: 'revision_not_editable' }],
    ['an unknown token', { reasonCode: 'private' }],
    ['a non-string token', { reasonCode: 7 }],
    ['no token', { secret: 'private' }],
  ])('relays {} for an upstream 403 carrying %s', async (_label, details) => {
    const response = await call(details);
    expect(response.status).toBe(403);
    expect(await detailsOf(response)).toEqual({});
  });

  it('relays {} for an upstream 403 carrying an on-list token of another status', async () => {
    const response = await call({
      reasonCode: offStatusToken,
      secret: 'private',
    });
    expect(response.status).toBe(403);
    expect(await detailsOf(response)).toEqual({});
  });
});

/**
 * `refusals.ts` gives the template detail read its own row (`cmsTemplateLatestRead`); the 403 relay of that
 * read must follow it, not CMS-03C-01's. Today both rows carry the same 403 token, so the wiring is only
 * observable by widening CMS-03C-01's row for the length of one test, as a later contract edit would.
 * `cmsTemplateContextRead` has no row (`error-catalog.ts` leaves it out) and follows the template family's
 * CMS-03C-01 row.
 */
describe('template read 403 relays follow their own contract row', () => {
  const WIDENED = 'separation_of_duties';
  const relay = (name: string): Relay =>
    RELAYS.find((candidate) => candidate.name === name) as Relay;
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
  const relayedBy = async (name: string) =>
    detailsOf(await relay(name).call({ reasonCode: WIDENED }));

  it('relays a token only CMS-03C-01 lists on the template define relay', async () => {
    await widened(async () => {
      expect(await relayedBy('template define (CMS-03C-01)')).toEqual({
        reasonCode: WIDENED,
      });
    });
  });

  it('does not relay it on the template detail read, which has its own row', async () => {
    await widened(async () => {
      expect(await relayedBy('template detail read')).toEqual({});
    });
  });

  it('lets the context read, which has no row, follow the CMS-03C-01 row', async () => {
    await widened(async () => {
      expect(await relayedBy('template context read')).toEqual({
        reasonCode: WIDENED,
      });
    });
  });
});
