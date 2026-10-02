import * as React from '../../apps/web/node_modules/react/index.js';
import { renderToStaticMarkup } from '../../apps/web/node_modules/react-dom/server.node.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, type BrowserContext, type Page } from '@playwright/test';

import ContentSchemaRegistryWorkbench from '../../apps/web/src/components/content-schema-registry/ContentSchemaRegistryWorkbench';
import { CONTENT_SCHEMA_REGISTRY_CONTRACT_FIELDS } from '../../apps/web/src/components/content-schema-registry/content-schema-registry-types';
import type { ContentSchemaRegistryWorkbenchProps } from '../../apps/web/src/components/content-schema-registry/content-schema-registry-types';

export const APP_ROUTE = '/app/cms-content-modeling';
export const TYPE_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
export const VERSION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132db';
export const ARTIFACT_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
export const REQUEST_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dd';
export const HASH = 'a'.repeat(64);
export const INSTANT = '2026-09-02T12:00:00.000Z';

export const SESSION_COOKIE = {
  name: 'wj_access',
  value: 's09-e2e-session',
  domain: '127.0.0.1',
  path: '/',
  httpOnly: true,
  secure: false,
  sameSite: 'Lax' as const,
};

export const REGISTRY_CSS = readFileSync(
  join(
    import.meta.dirname,
    '../../apps/web/src/components/content-schema-registry/content-schema-registry.css',
  ),
  'utf8',
);

export const list = {
  items: [
    {
      resourceKind: 'content_type',
      id: TYPE_ID,
      version: '4',
      typeKey: 'release_note',
      builtIn: false,
      lifecycle: 'active',
      createdAt: INSTANT,
      updatedAt: INSTANT,
    },
    {
      resourceKind: 'content_type_version',
      id: VERSION_ID,
      version: '4',
      contentHash: HASH,
      createdAt: INSTANT,
      updatedAt: INSTANT,
      state: 'active',
      contentTypeId: TYPE_ID,
      typeKey: 'release_note',
      label: 'Release note',
      ownerCapability: 'cms.schema_registry.read',
      sourceLocale: 'en-US',
      defaultLocale: 'en-US',
      supportedLocales: ['en-US'],
      fallbackChains: {},
      localeConfigHash: HASH,
      workflowKey: 'cms.content.workflow',
      workflowVersion: '1',
      defaultTemplateVersionId: null,
      schemaArtifactId: ARTIFACT_ID,
      fieldCount: 0,
      relationCount: 0,
      capabilityBindingCount: 0,
      compatibility: 'additive',
      dryRunId: null,
      activationEvidence: {
        key: 'cms.schema.activation',
        version: '1',
        policyHash: HASH,
        riskClass: 'ordinary',
        requiredDecisionCount: 1,
        requiredCapabilities: [],
        approvalEvidenceHash: HASH,
      },
    },
    {
      resourceKind: 'block_definition_registry_record',
      id: VERSION_ID,
      version: '2',
      blockKey: 'hero.banner',
      blockVersion: 2,
      propsSchemaRef: 'cms/hero-banner',
      propsSchemaHash: HASH,
      rendererRef: 'blocks/hero-banner',
      releaseDigest: HASH,
      lifecycle: 'supported',
    },
  ],
  nextCursor: 'opaque-next-cursor',
} as const;

export const detail = {
  resourceKind: 'content_type_version',
  resource: list.items[1],
  fields: [],
  relations: [],
  schemaArtifact: {
    resourceKind: 'schema_artifact',
    id: ARTIFACT_ID,
    version: '1',
    state: 'compiled',
    contentTypeVersionId: VERSION_ID,
    compilerVersion: '1.0',
    zodContractRef: 'schemas/release-note.json',
    artifactHash: HASH,
    createdAt: INSTANT,
    updatedAt: INSTANT,
    compiledAt: INSTANT,
  },
  templateBindings: [],
  capabilityBindings: [],
  blockDefinitions: [list.items[2]],
  activationPreparation: {
    dryRunRef: null,
    jobRef: null,
    reviewRef: null,
    permittedNextActions: [],
  },
} as const;

const baseProps: ContentSchemaRegistryWorkbenchProps = {
  initialList: { status: 'success', data: list, version: '4', stale: false },
  initialDetail: {
    status: 'success',
    data: detail,
    version: '4',
    stale: false,
  },
  variant: 'entitledRead',
  access: 'read-only',
  query: { limit: 25, sort: 'key', direction: 'asc' },
  contentTypeId: TYPE_ID,
  versionId: VERSION_ID,
  cursor: null,
  expectedVersion: '4',
  supportReference: REQUEST_ID,
  csrfToken: 'e2e-csrf-token',
  onCanonicalRefetch: async () => undefined,
  canonicalUrl: APP_ROUTE,
  listUrl: `${APP_ROUTE}?limit=25&sort=key&direction=asc`,
  retryUrl: `${APP_ROUTE}?limit=25&sort=key&direction=asc`,
  contractFields: CONTENT_SCHEMA_REGISTRY_CONTRACT_FIELDS,
};

export const renderWorkbench = (
  overrides: Partial<ContentSchemaRegistryWorkbenchProps> = {},
): string =>
  renderToStaticMarkup(
    renderPlaywrightComponent(ContentSchemaRegistryWorkbench, {
      ...baseProps,
      ...overrides,
    }),
  );

const renderPlaywrightComponent = <Props extends object>(
  component: (props: Props) => unknown,
  props: Props,
): React.ReactElement => {
  function PlaywrightComponentBoundary(): React.ReactNode {
    return normalizePlaywrightJsx(component(props));
  }
  return React.createElement(PlaywrightComponentBoundary);
};

/**
 * Playwright's JSX transform compiles `<>...</>` to a marker object instead of
 * `React.Fragment`; Slice 09 review, grant and locale components use fragments.
 */
const isPlaywrightFragmentType = (type: unknown): boolean =>
  typeof type === 'object' &&
  type !== null &&
  Object.hasOwn(type, '__pw_jsx_fragment');

export const normalizePlaywrightJsx = (value: unknown): React.ReactNode => {
  if (Array.isArray(value)) {
    const children = value.map((child, index) => {
      const normalized = normalizePlaywrightJsx(child);
      return React.isValidElement(normalized)
        ? React.cloneElement(normalized, { key: `s09-${index}` })
        : normalized;
    });
    return React.createElement(React.Fragment, null, children);
  }
  if (typeof value !== 'object' || value === null) {
    return value as React.ReactNode;
  }
  const candidate = value as {
    readonly __pw_type?: unknown;
    readonly type?: unknown;
    readonly props?: Record<string, unknown>;
  };
  if (
    candidate.__pw_type !== 'jsx' ||
    candidate.type === undefined ||
    candidate.props === undefined
  ) {
    return value as React.ReactNode;
  }
  const props = { ...candidate.props };
  if (Object.hasOwn(props, 'children')) {
    props.children = normalizePlaywrightJsx(props.children);
  }
  if (isPlaywrightFragmentType(candidate.type)) {
    return React.createElement(React.Fragment, null, props.children as never);
  }
  if (typeof candidate.type === 'function') {
    return renderPlaywrightComponent(
      candidate.type as (props: Record<string, unknown>) => unknown,
      props,
    );
  }
  return React.createElement(
    candidate.type as React.ElementType,
    props as React.Attributes & Record<string, unknown>,
  );
};

export const fixtureDocument = (workbench: string): string => {
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Content schema registry | WeJammin</title></head>
  <body class="content-schema-registry-page">
    <nav aria-label="Skip navigation"><a href="#content-schema-registry-main">Skip to main content</a></nav>
    <header aria-label="Application navigation"><a href="/">WeJammin</a><nav aria-label="Primary navigation"><a href="${APP_ROUTE}" aria-current="page">Content schema registry</a><a href="/system/degraded">System status</a></nav></header>
    <main id="content-schema-registry-main" tabindex="-1">
      <header><p>Authenticated workspace</p><h1 id="page-title" tabindex="-1">Content schema registry</h1><p>Inspect server-authorized schema metadata and safe block references.</p></header>
      ${workbench}
    </main>
  </body>
</html>`;
};

export const setRegistryFixture = async (
  page: Page,
  workbench: string = renderWorkbench(),
): Promise<void> => {
  // Establish the configured web origin so browser storage assertions are
  // meaningful, then replace only the document contents. Replacing the
  // existing document with setContent races Astro's dev HMR navigation in a
  // narrow viewport; DOM replacement preserves the same origin without a
  // second navigation.
  await page.goto('/profile-portfolio-offline.js', { waitUntil: 'load' });
  await page.evaluate((html) => {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    document.documentElement.lang = parsed.documentElement.lang;
    document.head.replaceChildren(...parsed.head.childNodes);
    document.body.className = parsed.body.className;
    document.body.replaceChildren(...parsed.body.childNodes);
  }, fixtureDocument(workbench));
  // The dev shell's CSP blocks an inline style tag after setContent. A
  // constructed stylesheet keeps this fixture on the real route CSS without
  // weakening the production CSP or changing any web source.
  await page.evaluate((css) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  }, REGISTRY_CSS);
};

export const authenticate = async (context: BrowserContext): Promise<void> => {
  await context.addCookies([SESSION_COOKIE]);
};

export const expectNoHorizontalOverflow = async (
  page: Page,
  soft = false,
): Promise<void> => {
  const assert = soft ? expect.soft : expect;
  const dimensions = await page.evaluate(() => ({
    bodyClientWidth: document.body.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    documentClientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    offenders: [...document.querySelectorAll('body *')]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          className: element.className,
          right: Math.ceil(rect.right),
          width: Math.ceil(rect.width),
        };
      })
      .filter(({ right }) => right > document.documentElement.clientWidth)
      .sort((left, right) => right.right - left.right)
      .slice(0, 8),
  }));
  const context = JSON.stringify({
    viewport: dimensions.documentClientWidth,
    offenders: dimensions.offenders,
  });
  assert(
    dimensions.bodyScrollWidth,
    `body overflow ${context}`,
  ).toBeLessThanOrEqual(dimensions.bodyClientWidth);
  assert(
    dimensions.documentScrollWidth,
    `document overflow ${context}`,
  ).toBeLessThanOrEqual(dimensions.documentClientWidth);
};
