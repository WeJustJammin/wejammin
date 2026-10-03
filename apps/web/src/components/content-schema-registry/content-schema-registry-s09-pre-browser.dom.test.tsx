// @vitest-environment jsdom

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ContentSchemaRegistryWorkbench from './ContentSchemaRegistryWorkbench';
import { OPERATION_LABELS } from './ContentSchemaRegistryActionBar';
import { executeContentSchemaRegistryRead } from './content-schema-registry-runtime';
import { refetchContentSchemaRegistryCanonical } from './content-schema-registry-runtime-dom-refetch';
import { CONTENT_SCHEMA_REGISTRY_MUTATION_OPERATIONS } from '../../server/content-schema-registry-platform-api';
import { contentSchemaRegistryMutationOperationFromRequest } from '../../server/content-schema-registry-platform-api';
import {
  TYPE_ID,
  VERSION_ID,
  callFacade,
  draftDetail,
} from './content-schema-review-dec108.test-support';
import {
  fieldRecord,
  renderDocument,
  requireForm,
  versionPageProps,
  WorkbenchUnderTest,
} from './content-schema-review-dec108-render.test-support';
import { list } from './content-schema-registry-server-test-values';

const fromHere = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));
const read = (relative: string): string =>
  readFileSync(fromHere(relative), 'utf8');
const COOKIE = {
  cookie: 'wj_access=session; wj_csrf=csrf-token',
  'x-csrf-token': null,
  'idempotency-key': null,
  'if-match': null,
} as const;
const FIELD_EDIT = {
  key: 'headline',
  kind: 'short_text',
  constraints: '{}',
  editorConfig: '{"label":"Headline","order":0}',
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

/** Parse the stylesheet into its top-level rules and media blocks. */
const cssBlocks = (
  source: string,
): { media: string | null; body: string }[] => {
  const css = source.replace(/\/\*[\s\S]*?\*\//gu, '');
  const blocks: { media: string | null; body: string }[] = [];
  let depth = 0;
  let start = 0;
  let media: string | null = null;
  let top = '';
  for (let index = 0; index < css.length; index += 1) {
    const char = css[index];
    if (char === '{') {
      if (depth === 0) {
        const header = css.slice(start, index).trim();
        media = header.startsWith('@media') ? header : null;
        if (media === null) top += `${header}{`;
        start = index + 1;
      }
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        if (media !== null)
          blocks.push({ media, body: css.slice(start, index) });
        else top += `${css.slice(start, index)}}`;
        start = index + 1;
      }
    }
  }
  blocks.push({ media: null, body: top });
  return blocks;
};
const block = (css: string, media: string | null) =>
  cssBlocks(css)
    .filter((entry) => entry.media === media)
    .map((entry) => entry.body)
    .join('\n');

describe('[P2-S09-AC-244] [P2-S09-AC-245] [P2-S09-AC-246] the registry layout follows the FE03 responsive grid', () => {
  const css = read('./content-schema-registry.css');
  const grid = (body: string) =>
    body.match(/--registry-columns:\s*(\d+)/u)?.[1];

  it('is a 4-column grid with 16 px gutter and margins at mobile and stacks list, then detail, in one column', () => {
    const base = block(css, null);
    expect(grid(base)).toBe('4');
    expect(base).toMatch(/--registry-gutter:\s*1rem/u);
    expect(base).toMatch(/--registry-margin:\s*1rem/u);
    expect(base).toMatch(
      /grid-template-columns:\s*repeat\(var\(--registry-columns\),\s*minmax\(0,\s*1fr\)\)/u,
    );
    expect(base).toMatch(/column-gap:\s*var\(--registry-gutter\)/u);
    expect(base).toMatch(
      /\.content-schema-registry-grid\s*>\s*\*\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/u,
    );
    expect(base).toMatch(/min-block-size:\s*2\.75rem/u);
    expect(block(css, '@media (max-width: 48rem)')).toMatch(
      /\.content-schema-registry-table-wrap\s*\{\s*display:\s*none/u,
    );
    expect(block(css, '@media (max-width: 48rem)')).toMatch(
      /\.content-schema-registry-priority-list\s*\{\s*display:\s*block/u,
    );
  });

  it('is an 8-column grid with a 20 px gutter and 24 px margins from 769 px and a 12-column grid with a 24 px gutter and a 1440 px maximum from 1025 px', () => {
    const tablet = block(css, '@media (min-width: 48.0625rem)');
    expect(grid(tablet)).toBe('8');
    expect(tablet).toMatch(/--registry-gutter:\s*1\.25rem/u);
    expect(tablet).toMatch(/--registry-margin:\s*1\.5rem/u);
    expect(tablet).toMatch(/grid-column:\s*span 4/u);
    const desktop = block(css, '@media (min-width: 64.0625rem)');
    expect(grid(desktop)).toBe('12');
    expect(desktop).toMatch(/--registry-gutter:\s*1\.5rem/u);
    expect(desktop).toMatch(/grid-column:\s*span 7/u);
    expect(desktop).toMatch(/grid-column:\s*span 5/u);
    expect(block(css, null)).toMatch(/max-width:\s*90rem/u);
    expect(0.0625 * 16).toBe(1);
    expect(48.0625 * 16).toBe(769);
    expect(64.0625 * 16).toBe(1025);
  });

  it('puts Back before the detail content and keeps the table scroll inside its wrapper so the page never scrolls sideways at 320 px', () => {
    const doc = renderDocument(versionPageProps());
    const heading = doc.querySelector(
      '.content-schema-registry-detail-heading',
    ) as HTMLElement;
    expect(heading.firstElementChild?.tagName).toBe('A');
    expect(heading.firstElementChild?.textContent).toBe('Back to registry');
    expect(block(css, null)).toMatch(
      /\.content-schema-registry-table-wrap\s*\{\s*overflow-x:\s*auto/u,
    );
    expect(block(css, null)).toMatch(
      /\.content-schema-registry table\s*\{[^}]*min-inline-size:\s*42rem/u,
    );
    expect(block(css, '@media (min-width: 48.0625rem)')).toMatch(
      /\.content-schema-registry-detail-heading\s*>\s*a\s*\{\s*order:\s*2/u,
    );
    expect(/(?:^|[^-])width:\s*(?:[4-9]\d\d|\d{4,})px/u.test(css)).toBe(false);
  });

  it('keeps forms single-column and every control at least 44 px', () => {
    const doc = renderDocument(versionPageProps());
    for (const form of doc.querySelectorAll('form[data-cms-command-form]'))
      expect(form.querySelector('[style*="columns"]')).toBeNull();
    expect(block(css, null)).toMatch(
      /min-inline-size:\s*2\.75rem;\s*min-block-size:\s*2\.75rem/u,
    );
    expect(css).not.toMatch(
      /\.content-schema-registry-command-form[^{]*\{[^}]*grid-template-columns:\s*repeat\(\s*2/u,
    );
  });
});

describe('[P2-S09-AC-226] [P2-S09-AC-227] block registration and lifecycle have no browser surface', () => {
  it('names neither release operation as a browser mutation and refuses a forged request for either before any upstream call', async () => {
    for (const operationId of ['CMS-03A-05', 'CMS-03A-08']) {
      expect(
        Object.keys(CONTENT_SCHEMA_REGISTRY_MUTATION_OPERATIONS),
      ).not.toContain(operationId);
      expect(
        await contentSchemaRegistryMutationOperationFromRequest(
          new Request('https://app.test/app/cms-content-modeling', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ operationId }),
          }),
        ),
      ).toBeNull();
      const forged = await callFacade({
        target: {
          operationId,
          contentTypeId: TYPE_ID,
          versionId: VERSION_ID,
        } as never,
        payload: {
          blockKey: 'hero',
          fromLifecycle: 'supported',
          toLifecycle: 'deprecated',
        },
        headers: COOKIE,
        upstream: { status: 201, body: {} },
      });
      expect(forged.fetch, operationId).not.toHaveBeenCalled();
      expect(forged.response.status).toBeGreaterThanOrEqual(400);
    }
  });

  it('shows block records as read-only metadata: no form, upload, key, button or optimistic state is rendered for them', () => {
    const withBlocks = {
      ...list,
      items: [
        {
          resourceKind: 'block_definition_registry_record',
          id: VERSION_ID,
          version: '2',
          blockKey: 'hero.banner',
          blockVersion: 2,
          propsSchemaRef: 'cms/hero-banner',
          propsSchemaHash: 'c'.repeat(64),
          rendererRef: 'blocks/hero-banner',
          releaseDigest: 'c'.repeat(64),
          lifecycle: 'supported',
        },
      ],
    };
    const detail = draftDetail();
    const doc = renderDocument(
      versionPageProps({
        initialDetail: {
          status: 'success',
          version: '4',
          stale: false,
          data: { ...detail, blockDefinitions: withBlocks.items },
        } as never,
        initialList: {
          status: 'success',
          data: withBlocks as never,
          version: '4',
          stale: false,
        } as never,
        contentTypeId: TYPE_ID,
      }),
    );
    const text = doc.body.textContent ?? '';
    expect(text).toContain('hero.banner');
    for (const form of doc.querySelectorAll<HTMLFormElement>('form')) {
      expect(form.getAttribute('data-operation-id') ?? '').not.toMatch(
        /CMS-03A-0[58]/u,
      );
      expect(form.getAttribute('action') ?? '').not.toMatch(
        /blocks|lifecycle/u,
      );
    }
    expect(
      doc.querySelector(
        'input[type="file"], [data-operation-id="CMS-03A-05"], [data-operation-id="CMS-03A-08"]',
      ),
    ).toBeNull();
    expect(doc.body.innerHTML).not.toMatch(
      /X-WeJammin-Release|WEBHOOK_REJECTED|releaseNonce|releaseSignature|propsSnapshotAttestation|\/api\/v1\/cms\/blocks/u,
    );
    const buttons = [...doc.querySelectorAll('button')].map(
      (button) => button.textContent ?? '',
    );
    expect(
      buttons.filter((label) =>
        /deprecate|withdraw|register|publish block/iu.test(label),
      ),
    ).toEqual([]);
    expect(OPERATION_LABELS['CMS-03A-05']).toContain('release worker only');
    expect(OPERATION_LABELS['CMS-03A-08']).toContain('release worker only');
  });

  it('keeps release material out of every browser-facing source and refetches only authorized safe block metadata after a hint', () => {
    const dir = fromHere('./');
    const sources = readdirSync(dir).filter(
      (name) =>
        /\.(tsx?|css)$/u.test(name) && !/\.test\.|test-support/u.test(name),
    );
    const offenders = sources.filter((name) =>
      /X-WeJammin-Release|WEBHOOK_REJECTED|releaseNonceHash|propsSnapshotAttestation|\/api\/v1\/cms\/blocks\/versions/u.test(
        read(`./${name}`),
      ),
    );
    expect(offenders).toEqual([]);
    const hint = read('./content-schema-registry-invalidation.ts');
    expect(hint).toContain("'content-schema-registry.invalidate'");
    expect(hint).not.toMatch(/blockKey|lifecycle|release/u);
  });
});

describe('[P2-S09-AC-252] [P2-S09-AC-263] reads show loading only after 250 ms and announce the parsed result', () => {
  const shell = (): void => {
    document.body.innerHTML =
      '<main id="content-schema-registry-main"><h1>Registry</h1><section data-workbench="content-schema-registry" data-content-schema-registry-hydrated="true"><button id="keep" type="button">Kept record</button></section></main>';
  };
  const refreshed =
    '<html><head><title>Refreshed</title></head><body><main id="content-schema-registry-main"><h1>Registry</h1><section data-workbench="content-schema-registry" data-canonical-refetch-url="/app/cms-content-modeling"><button id="keep" type="button">Refreshed record</button></section></main></body></html>';
  const status = () => document.querySelector('[data-cms-canonical-status]');

  it('shows nothing before 250 ms, then a polite busy status and a known-layout skeleton that keep the prior shell', async () => {
    vi.useFakeTimers();
    shell();
    let finish: (response: Response) => void = () => undefined;
    const held = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => held),
    );
    const pending = refetchContentSchemaRegistryCanonical({
      document,
      canonicalUrl: '/app/cms-content-modeling',
      reason: 'list-read',
    });
    vi.advanceTimersByTime(249);
    expect(status()?.textContent ?? '').not.toContain('Loading');
    expect(document.querySelector('[data-cms-loading-skeleton]')).toBeNull();
    expect(
      document.querySelector('[data-workbench]')?.getAttribute('aria-busy'),
    ).not.toBe('true');
    vi.advanceTimersByTime(1);
    expect(status()?.textContent).toBe('Loading current records.');
    expect(status()?.getAttribute('aria-live')).toBe('polite');
    expect(
      document.querySelector('[data-workbench]')?.getAttribute('aria-busy'),
    ).toBe('true');
    expect(
      document
        .querySelector('[data-cms-loading-skeleton]')
        ?.getAttribute('aria-hidden'),
    ).toBe('true');
    expect(document.querySelector('h1')?.textContent).toBe('Registry');
    expect(document.querySelector('#keep')?.textContent).toBe('Kept record');
    finish(new Response(refreshed, { status: 200 }));
    await pending;
    expect(status()?.textContent).toBe(
      'Current server-verified records refreshed.',
    );
    expect(document.querySelector('[data-cms-loading-skeleton]')).toBeNull();
    expect(
      document.querySelector('[data-workbench]')?.getAttribute('aria-busy'),
    ).not.toBe('true');
  });

  it('never shows a loading state for a read that settles inside 250 ms but still announces the result', async () => {
    vi.useFakeTimers();
    shell();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(refreshed, { status: 200 })),
    );
    const pending = refetchContentSchemaRegistryCanonical({
      document,
      canonicalUrl: '/app/cms-content-modeling',
      reason: 'list-read',
    });
    vi.advanceTimersByTime(100);
    await pending;
    vi.advanceTimersByTime(1_000);
    expect(document.querySelector('[data-cms-loading-skeleton]')).toBeNull();
    expect(status()?.textContent).toBe(
      'Current server-verified records refreshed.',
    );
  });
});

describe('[P2-S09-AC-253] bounded safe retries', () => {
  it('retries a canonical read at most twice, at 250 ms then 750 ms, and only with the server retry proof', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response('{}', {
          status: 503,
          headers: { 'x-content-schema-registry-retryable': 'true' },
        }),
    );
    const sleep = vi.fn<(ms: number) => Promise<void>>(async () => undefined);
    const result = await executeContentSchemaRegistryRead({
      url: '/app/cms-content-modeling',
      fetcher,
      sleep,
    });
    expect(result).toMatchObject({ outcome: 'degraded', attempts: 3 });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map((call) => call[0])).toEqual([250, 750]);
    const noProof = vi.fn(async () => new Response('{}', { status: 504 }));
    await executeContentSchemaRegistryRead({
      url: '/app/cms-content-modeling',
      fetcher: noProof,
      sleep,
    });
    expect(noProof).toHaveBeenCalledTimes(1);
  });
});

describe('[P2-S09-AC-255] [P2-S09-AC-256] [P2-S09-AC-257] browser mutation security', () => {
  const submit = async (
    edit: Record<string, string>,
    headers: Readonly<Record<string, string | null>> = COOKIE,
  ) => {
    const form = requireForm(renderDocument(versionPageProps()), 'CMS-03A-02');
    return callFacade({
      target: {
        operationId: 'CMS-03A-02' as never,
        contentTypeId: TYPE_ID,
        versionId: VERSION_ID,
      },
      form: { ...fieldRecord(form), ...FIELD_EDIT, ...edit },
      headers,
      upstream: { status: 201, body: {} },
    });
  };

  it('[P2-S09-AC-255] forwards only the session cookie and the declared transport fields and never a client role, capability or authority claim', async () => {
    const result = await submit(
      { role: 'owner', capability: 'cms.schema_designer' },
      {
        ...COOKIE,
        cookie: 'wj_access=session; wj_csrf=csrf-token; tracking=omit',
        'x-role': 'admin',
        'x-capability': 'cms.schema_designer',
        'x-actor-id': 'forged',
        authorization: 'Bearer forged',
      },
    );
    expect(result.fetch).not.toHaveBeenCalled();
    expect(result.response.status).toBeGreaterThanOrEqual(400);
    const ok = await submit(
      {},
      {
        ...COOKIE,
        cookie: 'wj_access=session; wj_csrf=csrf-token; tracking=omit',
        'x-role': 'admin',
        'x-capability': 'cms.schema_designer',
        'x-actor-id': 'forged',
        authorization: 'Bearer forged',
      },
    );
    const forwarded = ok.forwarded as Request;
    expect(forwarded.headers.get('cookie')).not.toContain('tracking');
    for (const header of [
      'x-role',
      'x-capability',
      'x-actor-id',
      'authorization',
    ])
      expect(forwarded.headers.get(header), header).toBeNull();
    expect(new URL(forwarded.url).origin).toBe('https://platform-api.internal');
    expect(JSON.stringify(ok.forwardedBody)).not.toMatch(
      /owner|admin|schema_designer/u,
    );
  });

  it('[P2-S09-AC-256] requires a same-origin Origin or Referer and the double-submit CSRF binding, and refuses every non-POST method', async () => {
    const results = {
      crossOrigin: await submit(
        {},
        { ...COOKIE, origin: 'https://evil.example' },
      ),
      crossReferer: await submit(
        {},
        { ...COOKIE, origin: null, referer: 'https://evil.example/page' },
      ),
      neither: await submit({}, { ...COOKIE, origin: null, referer: null }),
      noCookie: await submit({}, { ...COOKIE, cookie: 'wj_access=session' }),
      wrongToken: await submit({ csrf: 'other-token' }),
    };
    for (const [name, result] of Object.entries(results)) {
      expect(result.response.status, name).toBe(403);
      expect(result.fetch, name).not.toHaveBeenCalled();
    }
    const sameReferer = await submit(
      {},
      {
        ...COOKIE,
        origin: null,
        referer: 'https://app.test/app/cms-content-modeling',
      },
    );
    expect(sameReferer.fetch).toHaveBeenCalledTimes(1);
    for (const method of ['GET', 'HEAD', 'PUT', 'DELETE', 'PATCH']) {
      const { forwardContentSchemaRegistryMutation } =
        await import('../../server/content-schema-registry-platform-api');
      const fetch = vi.fn();
      const response = await forwardContentSchemaRegistryMutation(
        new Request('https://app.test/app/cms-content-modeling', { method }),
        { fetch },
        { operationId: 'CMS-03A-01' },
      );
      expect(response.status, method).toBeGreaterThanOrEqual(400);
      expect(fetch, method).not.toHaveBeenCalled();
    }
  });

  it('[P2-S09-AC-257] serializes only the named schema fields: an unnamed control, style, script or expression member is refused and server data is rendered as text', async () => {
    for (const edit of [
      { onclick: 'alert(1)' },
      { style: 'background:url(javascript:alert(1))' },
      { script: '<script>alert(1)</script>' },
      { expression: '1+1' },
      { 'x-html': '<b>x</b>' },
    ]) {
      const result = await submit(edit);
      expect(result.fetch, JSON.stringify(edit)).not.toHaveBeenCalled();
      expect(result.response.status).toBeGreaterThanOrEqual(400);
    }
    const clientValid = await submit({
      key: 'Bad Key',
      constraints: '{"pattern":"^a"}',
    });
    expect(clientValid.fetch).not.toHaveBeenCalled();
    expect(clientValid.response.status).toBe(422);
    const hostile = '<img src=x onerror=alert(1)><script>alert(2)</script>';
    const detail = draftDetail(undefined, { label: hostile });
    const doc = renderDocument(
      versionPageProps({
        initialDetail: {
          status: 'success',
          version: '4',
          stale: false,
          data: detail,
        } as never,
      }),
    );
    expect(doc.querySelector('img[src="x"], script')).toBeNull();
    expect(doc.body.textContent).toContain(hostile);
    const sources = readdirSync(fromHere('./')).filter(
      (name) => /\.tsx$/u.test(name) && !/\.test\.|test-support/u.test(name),
    );
    expect(
      sources.filter((name) =>
        /dangerouslySetInnerHTML|innerHTML\s*=|insertAdjacentHTML|eval\(|new Function\(/u.test(
          read(`./${name}`),
        ),
      ),
    ).toEqual([]);
    expect(
      renderToStaticMarkup(<WorkbenchUnderTest {...versionPageProps()} />),
    ).not.toMatch(/\sstyle="|javascript:/u);
  });
});

void ContentSchemaRegistryWorkbench;
