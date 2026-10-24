import { describe, expect, it, vi } from 'vitest';

import {
  ENTRY_ID,
  SCHEMA_VERSION_ID,
  apiError,
  draftDetail,
} from '../cms-editorial/cms-editorial-editor-fixtures.test-support';
import { selectedType } from '../cms-editorial-fields/cms-field-fixtures.test-support';
import { createLocalePageReads } from './locale-variant-page-reads';
import { LOCALE, PAGE_PATH } from './locale-variant.test-support';

const page = (search = '') =>
  new Request(`https://web.test${PAGE_PATH}${search}`, {
    headers: {
      cookie: 'wj_access=a; wj_csrf=csrf-token; other=private',
      'if-none-match': '"stale"',
    },
  });
/** The strong representation ETag the Worker binds to an authoring-context body (BE03b CMS-03B-14). */
const representationEtag = async (resource: unknown): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(resource)),
  );
  return `"sha256:${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}"`;
};
const urlsOf = (binding: { fetch: ReturnType<typeof vi.fn> }) =>
  binding.fetch.mock.calls.map(([input]) => new URL((input as Request).url));

describe('the locale page reads, composed with the real proxies', () => {
  it('reads the draft, the author-safe definitions and the locale variant by derived paths, never the page address', async () => {
    const binding = {
      fetch: vi.fn(async (input: RequestInfo | URL) => {
        const { pathname } = new URL(
          input instanceof Request ? input.url : String(input),
        );
        if (pathname.includes('/locales/'))
          return Response.json({
            locale: LOCALE,
            activeFallbackChain: ['fr'],
            variant: null,
            fields: [],
            resolutions: [],
          });
        if (pathname === '/api/v1/cms/entries/authoring-context') {
          const resource = {
            creatableTypes: [selectedType()],
            selectedType: selectedType(),
            fields: [],
          };
          return Response.json(resource, {
            headers: { etag: await representationEtag(resource) },
          });
        }
        return draftDetail({
          entryVersion: '4',
          revisionNumber: '2',
          values: {},
        });
      }),
    };
    const reads = createLocalePageReads(binding);
    const request = page('?x=1');
    expect((await reads.draftDetail(request, ENTRY_ID)).status).toBe(200);
    expect(
      (await reads.authoringContext(request, SCHEMA_VERSION_ID)).status,
    ).toBe(200);
    expect((await reads.localeVariant(request, ENTRY_ID, LOCALE)).status).toBe(
      200,
    );
    const urls = urlsOf(binding);
    expect(urls.map((url) => `${url.pathname}${url.search}`)).toEqual([
      `/api/v1/cms/entries/${ENTRY_ID}`,
      `/api/v1/cms/entries/authoring-context?contentTypeVersionId=${SCHEMA_VERSION_ID}`,
      `/api/v1/cms/entries/${ENTRY_ID}/locales/${LOCALE}`,
    ]);
    for (const [input] of binding.fetch.mock.calls) {
      const sent = input as Request;
      expect(sent.method).toBe('GET');
      expect(sent.headers.get('cookie')).toContain('wj_access=a');
      expect(sent.headers.get('cookie')).not.toContain('private');
      expect(sent.headers.get('if-none-match')).toBeNull();
    }
  });

  it('relays a typed refusal of the locale read with its status and an ApiError the notice can use', async () => {
    const binding = {
      fetch: vi.fn(async () =>
        apiError(403, 'LOCALE_FORBIDDEN', { reasonCode: 'capability_missing' }),
      ),
    };
    const response = await createLocalePageReads(binding).localeVariant(
      page(),
      ENTRY_ID,
      LOCALE,
    );
    expect(response.status).toBe(403);
    expect(binding.fetch).toHaveBeenCalledTimes(1);
  });

  it('answers an unsafe id or tag with 400 before any upstream call, and a missing binding with 503', async () => {
    const binding = { fetch: vi.fn() };
    const reads = createLocalePageReads(binding);
    expect((await reads.localeVariant(page(), 'nope', LOCALE)).status).toBe(
      400,
    );
    expect((await reads.localeVariant(page(), ENTRY_ID, 'fr_CA')).status).toBe(
      400,
    );
    expect(binding.fetch).not.toHaveBeenCalled();
    expect(
      (
        await createLocalePageReads(undefined).localeVariant(
          page(),
          ENTRY_ID,
          LOCALE,
        )
      ).status,
    ).toBe(503);
  });

  it('answers 503 when the binding throws', async () => {
    const binding = {
      fetch: vi.fn(async () => Promise.reject(new Error('down'))),
    };
    const response = await createLocalePageReads(binding).localeVariant(
      page(),
      ENTRY_ID,
      LOCALE,
    );
    expect(response.status).toBe(503);
  });

  it('retries a safe read twice on a declared-retryable dependency answer (FE03 :1173), then relays the last one', async () => {
    vi.useFakeTimers();
    try {
      const binding = {
        fetch: vi.fn(async () => apiError(503, 'DEPENDENCY_UNAVAILABLE')),
      };
      const pending = createLocalePageReads(binding).localeVariant(
        page(),
        ENTRY_ID,
        LOCALE,
      );
      await vi.advanceTimersByTimeAsync(1_000);
      expect((await pending).status).toBe(503);
      expect(binding.fetch).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not retry a 403, a 404 or a 429', async () => {
    for (const [status, code] of [
      [403, 'LOCALE_FORBIDDEN'],
      [404, 'LOCALE_SOURCE_NOT_FOUND'],
      [429, 'RATE_LIMITED'],
    ] as const) {
      const binding = { fetch: vi.fn(async () => apiError(status, code)) };
      const response = await createLocalePageReads(binding).localeVariant(
        page(),
        ENTRY_ID,
        LOCALE,
      );
      expect(response.status).toBe(status);
      expect(binding.fetch).toHaveBeenCalledTimes(1);
    }
  });
});
