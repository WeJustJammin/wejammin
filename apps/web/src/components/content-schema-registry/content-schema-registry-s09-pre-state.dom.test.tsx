// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import CapabilityGate from '../infrastructure/CapabilityGate';
import ContentSchemaRegistryOfflineStatus from './ContentSchemaRegistryOfflineStatus';
import ContentSchemaRegistryStatus from './ContentSchemaRegistryStatus';
import ContentSchemaRegistrySyncConflict from './ContentSchemaRegistrySyncConflict';
import {
  CONTENT_SCHEMA_REGISTRY_SAFE_ERROR_MESSAGES,
  type ContentSchemaRegistryListState,
} from './content-schema-registry-types';
import {
  bindContentSchemaRegistryRealtimeInvalidation,
  publishContentSchemaRegistryInvalidation,
  subscribeContentSchemaRegistryInvalidation,
} from './content-schema-registry-invalidation';
import {
  createContentSchemaRegistryPorts,
  resolveContentSchemaRegistryPage,
} from '../../server/content-schema-registry-context';
import {
  ACTOR_ID,
  detail,
  list,
  PARTY_ID,
  TYPE_ID,
  VERSION_ID,
} from './content-schema-registry-server-test-values';
import {
  renderDocument,
  versionPageProps,
} from './content-schema-review-dec108-render.test-support';
import { draftDetail } from './content-schema-review-dec108.test-support';

const fromHere = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));
const read = (relative: string): string =>
  readFileSync(fromHere(relative), 'utf8');
const SUPPORT = 'SR-0A1B-2C3D-4E5F-6A7B';
const status = (
  state: ContentSchemaRegistryListState,
  extra: Record<string, unknown> = {},
) =>
  new DOMParser().parseFromString(
    `<body>${renderToStaticMarkup(
      <ContentSchemaRegistryStatus
        state={state}
        regionLabel="Registry list"
        supportReference={SUPPORT}
        canonicalUrl="/app/cms-content-modeling"
        resetUrl="/app/cms-content-modeling"
        {...extra}
      />,
    )}</body>`,
    'text/html',
  );

describe('[P2-S09-AC-230] [P2-S09-AC-263] the registry represents every state explicitly', () => {
  const error = (
    code: keyof typeof CONTENT_SCHEMA_REGISTRY_SAFE_ERROR_MESSAGES,
    httpStatus: number,
    retryAfterSeconds: number | null = null,
  ): ContentSchemaRegistryListState => ({
    status: 'error',
    error: { code, message: 'ignored server text' },
    retryable: httpStatus === 429 || httpStatus >= 500,
    httpStatus,
    retryAfterSeconds,
  });
  const rows: readonly (readonly [
    string,
    ContentSchemaRegistryListState,
    RegExp,
    'status' | 'alert' | 'busy',
  ])[] = [
    ['idle', { status: 'idle' }, /Select a registry record/u, 'status'],
    ['loading', { status: 'loading' }, /Loading current records/u, 'busy'],
    [
      'empty (no records)',
      { status: 'empty', reason: 'no-records' },
      /No records are available/u,
      'status',
    ],
    [
      'filter miss',
      { status: 'empty', reason: 'filter-miss' },
      /No records match the current filters/u,
      'status',
    ],
    [
      'success',
      { status: 'success', data: list as never, version: '4', stale: false },
      /Current server-verified records are shown/u,
      'status',
    ],
    [
      'validation',
      error('VALIDATION_FAILED', 422),
      /did not pass validation/u,
      'alert',
    ],
    ['auth', error('UNAUTHENTICATED', 401), /Sign in to view/u, 'alert'],
    ['capability', error('FORBIDDEN', 403), /do not have access/u, 'alert'],
    ['not found', error('NOT_FOUND', 404), /was not found/u, 'alert'],
    [
      'rate',
      error('RATE_LIMITED', 429, 9),
      /Too many registry requests/u,
      'alert',
    ],
    [
      'dependency invalid',
      error('DEPENDENCY_INVALID_RESPONSE', 502),
      /returned invalid data/u,
      'alert',
    ],
    [
      'dependency unavailable',
      error('DEPENDENCY_UNAVAILABLE', 503),
      /temporarily unavailable/u,
      'alert',
    ],
    [
      'dependency deadline',
      error('DEPENDENCY_DEADLINE_EXCEEDED', 504),
      /did not respond in time/u,
      'alert',
    ],
    [
      'degraded',
      {
        status: 'degraded',
        data: null,
        code: 'DEPENDENCY_UNAVAILABLE',
        lastVerifiedAt: null,
        retryable: true,
        httpStatus: 503,
      },
      /temporarily unavailable/u,
      'status',
    ],
    [
      'disabled',
      {
        status: 'disabled',
        reason: 'A server capability prerequisite is not satisfied.',
      },
      /prerequisite is not satisfied/u,
      'status',
    ],
  ];

  it('gives idle, loading, empty, filter miss, success, validation, auth, capability, not found, rate, dependency and degraded states their own role and copy', () => {
    const copies = new Set<string>();
    for (const [name, state, pattern, kind] of rows) {
      const doc = status(state);
      const region = doc.querySelector('section') as HTMLElement;
      expect(region.textContent, name).toMatch(pattern);
      if (kind === 'alert')
        expect(region.getAttribute('role'), name).toBe('alert');
      else expect(region.getAttribute('role'), name).toBe('status');
      if (kind === 'busy')
        expect(region.getAttribute('aria-busy'), name).toBe('true');
      copies.add(`${name}:${region.querySelector('p')?.textContent}`);
    }
    expect(
      new Set([...copies].map((entry) => entry.split(':')[1])).size,
    ).toBeGreaterThanOrEqual(rows.length - 2);
  });

  it('shows only the closed safe copy for an error code, never server text, and a recovery for each retryable one', () => {
    for (const [code, message] of Object.entries(
      CONTENT_SCHEMA_REGISTRY_SAFE_ERROR_MESSAGES,
    )) {
      const doc = status({
        status: 'error',
        error: { code: code as never, message: 'SECRET server text' },
        retryable: false,
      });
      expect(doc.body.textContent, code).toContain(message);
      expect(doc.body.textContent, code).not.toContain('SECRET server text');
    }
    const rate = status(error('RATE_LIMITED', 429, 9));
    expect(rate.querySelector('[data-retry-after-seconds]')?.textContent).toBe(
      'Retry available in 9 seconds.',
    );
    expect(
      rate.querySelector('[data-cms-retry-control="disabled"]'),
    ).not.toBeNull();
    const down = status(error('DEPENDENCY_UNAVAILABLE', 503));
    expect(
      down
        .querySelector('a[data-cms-retry-control="enabled"]')
        ?.getAttribute('href'),
    ).toBe('/app/cms-content-modeling');
    expect(
      status({ status: 'empty', reason: 'filter-miss' })
        .querySelector('a')
        ?.getAttribute('href'),
    ).toBe('/app/cms-content-modeling');
  });

  it('shows the capability, conflict and offline states with their own named regions', () => {
    const gate = renderToStaticMarkup(
      <CapabilityGate
        surface="content-schema-registry"
        variant="disabled"
        reasonCode="SCHEMA_DESIGNER_REQUIRED"
      />,
    );
    expect(gate).toContain('Schema changes unavailable');
    const conflict = renderToStaticMarkup(
      <ContentSchemaRegistrySyncConflict serverVersion="5" localVersion="4" />,
    );
    expect(conflict).toContain('Review the current registry version');
    const offline = renderToStaticMarkup(
      <ContentSchemaRegistryOfflineStatus
        connectivity="offline"
        intents={0}
        serverVersion="5"
        localVersion="4"
      />,
    );
    expect(offline).toContain('Registry is offline');
    expect(new Set([gate, conflict, offline]).size).toBe(3);
    expect(
      renderToStaticMarkup(
        <ContentSchemaRegistryOfflineStatus
          connectivity="online"
          intents={0}
          serverVersion={null}
          localVersion={null}
        />,
      ),
    ).toBe('');
  });
});

describe('[P2-S09-AC-231] URL and server state are canonical and no global client store exists', () => {
  it('declares no state-management or query-cache library and keeps module state out of the registry sources', () => {
    const pkg = JSON.parse(read('../../../package.json')) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(
      names.filter((name) =>
        /^(zustand|redux|@reduxjs\/toolkit|jotai|recoil|mobx|valtio|nanostores|@nanostores\/.*|swr|@tanstack\/.*|xstate|effector|pinia)$/u.test(
          name,
        ),
      ),
    ).toEqual([]);
    const sources = [
      'ContentSchemaRegistryWorkbench.tsx',
      'ContentSchemaRegistryWorkbenchIsland.tsx',
      'use-content-schema-registry-island-runtime.ts',
      'content-schema-registry-runtime-dom.ts',
    ];
    for (const file of sources) {
      const text = read(`./${file}`);
      expect(text, file).not.toMatch(
        /\bcreateContext\(|\buseReducer\(|window\.__|globalThis\.__|\bcreateStore\(/u,
      );
      expect(text, file).not.toMatch(/^(?:export )?let\s/mu);
    }
  });

  it('keeps island-local state to disclosure, draft, filter and focus values and confines the external store to the one-shot review note', () => {
    const files = [
      'ContentSchemaRegistryStatus.tsx',
      'ContentSchemaRegistryConfirmationStep.tsx',
      'ContentSchemaRegistryVersionForms.tsx',
      'ContentSchemaRegistryReviewAssignmentForm.tsx',
      'ContentSchemaRegistryLocaleChains.tsx',
      'use-locale-config-draft.ts',
      'use-step-up-freshness.ts',
      'use-content-schema-registry-island-runtime.ts',
      'ContentSchemaRegistryReviewFlash.tsx',
    ];
    const stateNames: string[] = [];
    for (const file of files)
      for (const match of read(`./${file}`).matchAll(
        /const \[(\w+), set\w+\] = (?:React\.)?useState/gu,
      ))
        stateNames.push(match[1] as string);
    const allowed = new Set([
      'retryDeadline',
      'clock',
      'retryIdentity',
      'confirmed',
      'choice',
      'values',
      'errors',
      'draft',
      'tagText',
      'tagError',
      'announcement',
      'revealed',
      'focusId',
      'now',
      'contextEpoch',
      'projection',
      'loading',
      'offline',
      'message',
      'focusLocator',
      // Transient: whether the lazily loaded views have hydrated (no data).
      'viewsReady',
    ]);
    expect(stateNames.filter((name) => !allowed.has(name))).toEqual([]);
    expect(stateNames.length).toBeGreaterThan(10);
    expect(read('./ContentSchemaRegistryReviewFlash.tsx')).toContain(
      'sessionStorage',
    );
  });

  it('renders the same page from the same URL and server props and a different page when the server state differs', () => {
    const props = versionPageProps();
    const first = renderDocument(props).body.innerHTML;
    const second = renderDocument({ ...props }).body.innerHTML;
    expect(second).toBe(first);
    const other = renderDocument(
      versionPageProps({
        initialDetail: {
          status: 'success',
          version: '9',
          stale: false,
          data: draftDetail(undefined, { version: '9' }),
        } as never,
        expectedVersion: '9',
      }),
    ).body.innerHTML;
    expect(other).not.toBe(first);
    expect(
      renderDocument(props)
        .querySelector('section[data-workbench]')
        ?.getAttribute('data-canonical-refetch-url'),
    ).toBe(props.retryUrl);
    expect(
      renderDocument(props)
        .querySelector('section[data-workbench]')
        ?.getAttribute('data-invalidation'),
    ).toBe('canonical-refetch-only');
  });
});

describe('[P2-S09-AC-232] Realtime and BroadcastChannel carry invalidation hints only', () => {
  const channel = () => {
    const listeners = new Set<(event: { data: unknown }) => void>();
    const sent: unknown[] = [];
    return {
      sent,
      post: (data: unknown) =>
        listeners.forEach((listener) => listener({ data })),
      api: {
        postMessage: (message: unknown) => sent.push(message),
        addEventListener: (
          _type: 'message',
          listener: (event: { data: unknown }) => void,
        ) => listeners.add(listener),
        removeEventListener: (
          _type: 'message',
          listener: (event: { data: unknown }) => void,
        ) => listeners.delete(listener),
      },
    };
  };

  it('publishes a bare type-only hint and acts on nothing else', () => {
    const bus = channel();
    publishContentSchemaRegistryInvalidation(bus.api as never);
    expect(bus.sent).toEqual([{ type: 'content-schema-registry.invalidate' }]);
    const refetch = vi.fn();
    const subscription = subscribeContentSchemaRegistryInvalidation({
      channel: bus.api as never,
      onInvalidate: refetch,
    });
    for (const data of [
      { type: 'content-schema-registry.invalidate', version: '5' },
      { type: 'content-schema-registry.invalidate', record: list.items[0] },
      { type: 'other' },
      'content-schema-registry.invalidate',
      null,
      5,
      { items: [] },
    ])
      bus.post(data);
    expect(refetch).not.toHaveBeenCalled();
    bus.post({ type: 'content-schema-registry.invalidate' });
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(refetch).toHaveBeenCalledWith();
    subscription.unsubscribe();
    bus.post({ type: 'content-schema-registry.invalidate' });
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('refetches through the canonical read for a Realtime hint and writes no cache or storage in any tab', () => {
    const touched: string[] = [];
    const storage = {
      getItem: () => (touched.push('get'), null),
      setItem: () => touched.push('set'),
      removeItem: () => touched.push('remove'),
      clear: () => touched.push('clear'),
    };
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('sessionStorage', storage);
    vi.stubGlobal('indexedDB', { open: () => touched.push('idb') });
    vi.stubGlobal('caches', { open: () => touched.push('cache') });
    const bus = channel();
    const refetch = vi.fn();
    const stop = bindContentSchemaRegistryRealtimeInvalidation(
      bus.api as never,
      refetch,
    );
    bus.post({ type: 'content-schema-registry.invalidate' });
    publishContentSchemaRegistryInvalidation(bus.api as never);
    stop();
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(touched).toEqual([]);
    vi.unstubAllGlobals();
    const source = read('./content-schema-registry-invalidation.ts');
    expect(source).not.toMatch(
      /localStorage|sessionStorage|indexedDB|caches\.|serviceWorker/u,
    );
  });
});

describe('[P2-S09-AC-234] list and detail data never enters a cache, storage, message, analytics, search or sitemap', () => {
  const sources = [
    'ContentSchemaRegistryWorkbench.tsx',
    'ContentSchemaRegistryList.tsx',
    'ContentSchemaRegistryDetail.tsx',
    'content-schema-registry-runtime-dom-refetch.ts',
    'content-schema-registry-runtime-dom-refetch-project.ts',
    'content-schema-registry-runtime-read.ts',
    'content-schema-registry-canonical-read.ts',
    '../../server/content-schema-registry-platform-reads.ts',
    '../../server/content-schema-registry-context.ts',
  ];

  it('reads and renders registry data without any storage, cache, beacon or analytics API', () => {
    for (const file of sources) {
      const text = read(file.startsWith('..') ? file : `./${file}`);
      expect(text, file).not.toMatch(
        /localStorage|indexedDB|\bcaches\b|serviceWorker|sendBeacon|gtag\(|analytics|BroadcastChannel\(/u,
      );
      expect(text, file).not.toMatch(/sessionStorage\.setItem/u);
    }
  });

  it('never intercepts a registry navigation or API request in the one service worker the app registers', async () => {
    const script = readFileSync(
      fromHere('../../../public/profile-portfolio-sw.js'),
      'utf8',
    );
    const listeners: Record<string, (event: unknown) => void> = {};
    const respond = vi.fn();
    new Function('self', 'caches', 'fetch', 'Response', 'Headers', script)(
      {
        addEventListener: (
          type: string,
          listener: (event: unknown) => void,
        ) => {
          listeners[type] = listener;
        },
        skipWaiting: () => undefined,
        clients: { claim: () => undefined },
      },
      {
        open: () => {
          throw new Error('cache touched');
        },
      },
      () => Promise.resolve(new Response('ok')),
      Response,
      Headers,
    );
    const fetchEvent = (path: string) => ({
      request: { mode: 'navigate', url: `https://app.test${path}` },
      respondWith: respond,
    });
    for (const path of [
      '/app/cms-content-modeling',
      `/app/cms-content-modeling/${TYPE_ID}/versions/${VERSION_ID}`,
      '/api/v1/cms/content-types',
      '/app/cms-content-modeling/schema-reviews/x',
    ])
      listeners.fetch?.(fetchEvent(path));
    expect(respond).not.toHaveBeenCalled();
    listeners.fetch?.(fetchEvent('/profiles/someone'));
    expect(respond).toHaveBeenCalledTimes(1);
  });

  it('marks every protected registry page no-store and noindex and generates no sitemap or search entry for it', () => {
    for (const page of [
      'index.astro',
      '[contentTypeId]/versions/[versionId].astro',
      'schema-reviews/[reviewId].astro',
      'capability-grants.astro',
    ]) {
      const text = read(`../../pages/app/cms-content-modeling/${page}`);
      expect(text, page).toContain(
        "Astro.response.headers.set('Cache-Control', 'no-store')",
      );
      expect(text, page).toMatch(
        /<meta\s+name="robots"\s+content="noindex"\s*\/>/u,
      );
    }
    const pkg = read('../../../package.json');
    expect(pkg).not.toMatch(/sitemap|algolia|meilisearch|typesense|lunr/iu);
    const config = read('../../../astro.config.mjs');
    expect(config).not.toMatch(/sitemap/iu);
  });
});

describe('[P2-S09-AC-235] [P2-S09-AC-263] the role matrix renders registry reads from the server projection only', () => {
  const PROTECTED = [
    'entitledRead',
    'ownerFull',
    'guardianMandate',
    'juniorRestricted',
    'businessMandate',
    'staffCaseScoped',
    'adminStepUp',
  ] as const;

  it('renders the list for every protected variant and nothing at all for the not-rendered Free projection', () => {
    for (const variant of PROTECTED) {
      const doc = renderDocument(
        versionPageProps({
          variant,
          access: 'read-only',
          contentTypeId: null,
          versionId: null,
          initialDetail: null,
          initialList: {
            status: 'success',
            data: list as never,
            version: '4',
            stale: false,
          } as never,
        }),
      );
      expect(doc.querySelector('table'), variant).not.toBeNull();
      expect(
        doc
          .querySelector('section[data-workbench]')
          ?.getAttribute('data-variant'),
      ).toBe(variant);
    }
    for (const variant of ['forbiddenHidden', 'entitledRead'] as const) {
      const doc = renderDocument(
        versionPageProps({
          variant,
          access: 'not-rendered',
          initialList: {
            status: 'success',
            data: list as never,
            version: '4',
            stale: false,
          } as never,
        }),
      );
      expect(doc.body.textContent?.trim(), variant).toBe('');
    }
  });

  it('lets only the server access decide controls: a role label alone never opens or closes a command', () => {
    const forms = (variant: string, access: 'full' | 'read-only') =>
      renderDocument(versionPageProps({ variant, access })).querySelectorAll(
        'form[data-cms-command-form]',
      ).length;
    expect(forms('ownerFull', 'read-only')).toBe(0);
    expect(forms('entitledRead', 'read-only')).toBe(0);
    expect(forms('entitledRead', 'full')).toBeGreaterThan(0);
    expect(forms('ownerFull', 'full')).toBe(forms('entitledRead', 'full'));
    expect(
      renderDocument(versionPageProps())
        .querySelector('section[data-workbench]')
        ?.getAttribute('data-role-policy'),
    ).toBe('server-authoritative');
  });
});

describe('[P2-S09-AC-242] [P2-S09-AC-243] protected routes guard on the server and never fall back to other data', () => {
  const ports = (overrides: Record<string, unknown> = {}) => {
    const calls = {
      list: vi.fn(() => list),
      detail: vi.fn(() => detail),
      authority: vi.fn(() => ({
        actingPartyId: PARTY_ID,
        capabilities: ['cms.schema_registry.read'],
      })),
    };
    return {
      calls,
      ports: createContentSchemaRegistryPorts({
        verifySession: () => ({ userId: ACTOR_ID, expiresAt: 200 }),
        now: () => 100,
        resolveAuthority: calls.authority as never,
        loadList: calls.list as never,
        loadDetail: calls.detail as never,
        ...overrides,
      }),
    };
  };
  const detailInput = (p: ReturnType<typeof ports>['ports']) => ({
    request: new Request('https://app.test/app/cms-content-modeling'),
    route: 'detail' as const,
    ports: p,
    requestId: ACTOR_ID,
    contentTypeId: TYPE_ID,
    versionId: VERSION_ID,
  });

  it('normalizes the sign-in returnTo to a same-origin path and refuses protocol-relative and absolute targets', async () => {
    const { safeContentSchemaRegistryReturnPath } =
      await import('../../server/content-schema-registry-contracts');
    expect(
      safeContentSchemaRegistryReturnPath(
        new URL('https://app.test/app/cms-content-modeling?limit=25'),
      ),
    ).toBe('/app/cms-content-modeling?limit=25');
    expect(
      safeContentSchemaRegistryReturnPath(
        new URL('https://app.test//evil.example/path'),
      ),
    ).toBe('/app/cms-content-modeling');
    expect(
      safeContentSchemaRegistryReturnPath(
        new URL('https://app.test/\\evil.example'),
      ),
    ).toBe('/app/cms-content-modeling');
    for (const page of [
      'index.astro',
      '[contentTypeId]/versions/[versionId].astro',
    ]) {
      const text = read(`../../pages/app/cms-content-modeling/${page}`);
      expect(text).toMatch(
        /Astro\.redirect\(\s*`\/auth\/sign-in\?returnTo=\$\{encodeURIComponent\(safeContentSchemaRegistryReturnPath\(Astro\.url\)\)\}`,\s*303,?\s*\)/u,
      );
      expect(text).toMatch(
        /result\.kind === 'forbidden'[\s\S]{0,160}new Response\('Forbidden', \{\s*status: 403/u,
      );
      expect(text).toMatch(
        /not_found[\s\S]{0,200}new Response\('Not found', \{\s*status: 404/u,
      );
    }
  });

  it('answers a concealed or mismatched detail with not_found and a forbidden one with forbidden, never reading the list or any public data', async () => {
    for (const [name, loadDetail, kind] of [
      [
        'hidden',
        () => {
          throw Object.assign(new Error('nf'), {
            kind: 'not_found',
            status: 404,
          });
        },
        'not_found',
      ],
      [
        'mismatched version',
        () => ({ ...detail, resource: { ...detail.resource, id: TYPE_ID } }),
        'not_found',
      ],
      [
        'mismatched type',
        () => ({
          ...detail,
          resource: { ...detail.resource, contentTypeId: VERSION_ID },
        }),
        'not_found',
      ],
    ] as const) {
      const harness = ports({ loadDetail });
      const result = await resolveContentSchemaRegistryPage(
        detailInput(harness.ports) as never,
      );
      expect(result.kind, name).not.toBe('authorized');
      if (name !== 'hidden') expect(result.kind).toBe(kind);
      expect(harness.calls.list, name).not.toHaveBeenCalled();
    }
    const noCapability = ports();
    const forbidden = await resolveContentSchemaRegistryPage({
      ...detailInput(noCapability.ports),
      ports: ports({
        resolveAuthority: () => ({ actingPartyId: PARTY_ID, capabilities: [] }),
      }).ports,
    } as never);
    expect(forbidden.kind).toBe('forbidden');
    expect(noCapability.calls.detail).not.toHaveBeenCalled();
  });

  it('re-verifies the session and the exact authority and ids on every deep-link load: no cached authority or version', async () => {
    const harness = ports();
    for (let load = 0; load < 3; load += 1)
      expect(
        (
          await resolveContentSchemaRegistryPage(
            detailInput(harness.ports) as never,
          )
        ).kind,
      ).toBe('authorized');
    expect(harness.calls.authority).toHaveBeenCalledTimes(3);
    expect(harness.calls.detail).toHaveBeenCalledTimes(3);
    for (const call of harness.calls.detail.mock.calls as unknown[][])
      expect(call[0]).toMatchObject({
        contentTypeId: TYPE_ID,
        versionId: VERSION_ID,
      });
    const expired = ports({
      verifySession: () => ({ userId: ACTOR_ID, expiresAt: 50 }),
    });
    expect(
      (
        await resolveContentSchemaRegistryPage(
          detailInput(expired.ports) as never,
        )
      ).kind,
    ).toBe('unauthenticated');
    expect(expired.calls.detail).not.toHaveBeenCalled();
  });
});
