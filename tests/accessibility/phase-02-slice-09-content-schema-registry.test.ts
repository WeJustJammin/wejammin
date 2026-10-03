import * as React from '../../apps/web/node_modules/react/index.js';
import { renderToStaticMarkup } from '../../apps/web/node_modules/react-dom/server.node.js';
import { readFileSync } from 'node:fs';
import {
  ContentSchemaRegistryDetailSchema,
  ContentSchemaRegistryListPageSchema,
} from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { emptyActivationPreparation } from '../../apps/web/src/components/content-schema-registry/content-schema-registry-activation-preparation.test-support';
import ContentSchemaRegistryWorkbench from '../../apps/web/src/components/content-schema-registry/ContentSchemaRegistryWorkbench';
import {
  CONTENT_SCHEMA_REGISTRY_CONTRACT_FIELDS,
  CONTENT_SCHEMA_REGISTRY_SAFE_ERROR_MESSAGES,
} from '../../apps/web/src/components/content-schema-registry/content-schema-registry-types';
import type { ContentSchemaRegistryWorkbenchProps } from '../../apps/web/src/components/content-schema-registry/content-schema-registry-types';

const TYPE_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
const VERSION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132db';
const ARTIFACT_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
const REQUEST_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dd';
const SUPPORT_REFERENCE = 'SR-1A2B-3C4D-5E6F-7A8B9C0D1E2F';
const HASH = 'a'.repeat(64);
const INSTANT = '2026-09-02T12:00:00.000Z';

// Fixtures are parsed through the real BE03a contract schemas, so a fixture
// that no longer matches the contract (for example one missing the OD-4
// locale members) fails here instead of inside a component render.
const list = ContentSchemaRegistryListPageSchema.parse({
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
});

const detail = ContentSchemaRegistryDetailSchema.parse({
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
  activationPreparation: emptyActivationPreparation,
});

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
  supportReference: SUPPORT_REFERENCE,
  csrfToken: 'csrf-token',
  canonicalUrl: '/app/cms-content-modeling',
  listUrl: '/app/cms-content-modeling?limit=25&sort=key&direction=asc',
  retryUrl: '/app/cms-content-modeling?limit=25&sort=key&direction=asc',
  onCanonicalRefetch: async () => undefined,
  contractFields: CONTENT_SCHEMA_REGISTRY_CONTRACT_FIELDS,
};

const render = (
  overrides: Partial<ContentSchemaRegistryWorkbenchProps> = {},
): string =>
  renderToStaticMarkup(
    React.createElement(ContentSchemaRegistryWorkbench, {
      ...baseProps,
      ...overrides,
    }),
  );

const routeSource = (relativePath: string): string =>
  readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('P2-S09 content schema registry accessibility contract', () => {
  it('[P2-S09-AC-219] [P2-S09-AC-242] [P2-S09-AC-243] keeps both protected pages useful server-first documents', () => {
    const listPage = routeSource(
      '../../apps/web/src/pages/app/cms-content-modeling/index.astro',
    );
    const detailPage = routeSource(
      '../../apps/web/src/pages/app/cms-content-modeling/[contentTypeId]/versions/[versionId].astro',
    );

    for (const source of [listPage, detailPage]) {
      expect(source.match(/<h1\b/gu)).toHaveLength(1);
      expect(source).toContain('<html lang="en">');
      expect(source).toContain('href="#content-schema-registry-main"');
      expect(source).toContain('Skip to main content');
      expect(source).toContain('<main id="content-schema-registry-main"');
      expect(source).toContain('id="page-title" tabindex="-1"');
      expect(source).toContain('<nav aria-label="Primary navigation">');
      expect(source).toContain(
        "Astro.response.headers.set('Cache-Control', 'no-store')",
      );
      expect(source).toContain('export const prerender = false');
      expect(source).toContain('ContentSchemaRegistryWorkbenchIsland');
      expect(source).toContain('client:load');
      expect(source).not.toContain('ReleaseEnvelopeHeaders');
      expect(source).not.toContain('WEBHOOK_REJECTED');
    }
  });

  it('[P2-S09-AC-219] [P2-S09-AC-247] [P2-S09-AC-248] [P2-S09-AC-249] exposes named native controls, table semantics, status regions, and URL state in SSR HTML', () => {
    const markup = render();

    expect(markup).toContain(
      'aria-labelledby="content-schema-registry-heading"',
    );
    expect(markup).toContain('data-invalidation="canonical-refetch-only"');
    expect(markup).toContain('<form');
    expect(markup).toContain(
      'aria-describedby="content-schema-registry-filter-help content-schema-registry-filter-summary"',
    );
    expect(markup).toContain('<table>');
    expect(markup).toContain(
      '<caption>Server-verified content schema registry records</caption>',
    );
    expect(markup.match(/<th\b[^>]*scope="col"/gu)).toHaveLength(6);
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('aria-atomic="true"');
    expect(markup).not.toContain('role="grid"');
    expect(markup).toContain('name="resourceKind"');
    expect(markup).toContain('name="keyPrefix"');
    expect(markup).toContain('name="lifecycle"');
    expect(markup).toContain('name="state"');
    expect(markup).toContain('name="limit"');
    expect(markup).toContain('name="sort"');
    expect(markup).toContain('name="direction"');
    expect(markup).toContain('>Apply filters</button>');
    expect(markup).toContain('>Reset filters</a>');
    expect(markup).toContain('>Back to registry</a>');
    expect(markup).toContain('Next page</a>');
  });

  it('[P2-S09-AC-251] [P2-S09-AC-266] uses non-color status cues and a visible high-contrast focus indicator with reduced-motion handling', () => {
    const css = routeSource(
      '../../apps/web/src/components/content-schema-registry/content-schema-registry.css',
    );

    expect(css).toContain(':focus-visible');
    expect(css).toMatch(/outline:\s*3px\s+solid/iu);
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('scroll-behavior: auto');
    expect(css).toContain('transition-duration: 0.01ms');
    expect(css).toContain('border-inline-start-color');

    const reducedMotion = render({
      initialList: {
        status: 'degraded',
        data: null,
        code: 'DEPENDENCY_UNAVAILABLE',
        requestId: REQUEST_ID,
        lastVerifiedAt: null,
      },
      initialDetail: null,
    });
    expect(reducedMotion).toContain('role="status"');
    expect(reducedMotion).toContain('aria-live="polite"');
    expect(reducedMotion).toContain('The registry is temporarily unavailable.');
    // The browser shows the opaque support reference; the server-side request
    // identifier never crosses into the island markup (FE03 context evidence).
    expect(reducedMotion).toContain(
      `Support reference: <code>${SUPPORT_REFERENCE}</code>`,
    );
    expect(reducedMotion).not.toContain(REQUEST_ID);
    expect(reducedMotion).toContain('Retry');
  });

  it('[P2-S09-AC-254] [P2-S09-AC-263] renders every declared async state with bounded, exact recovery copy', () => {
    const states: readonly ContentSchemaRegistryWorkbenchProps['initialList'][] =
      [
        { status: 'idle' },
        { status: 'loading', preserveSafePriorContent: true },
        { status: 'empty', reason: 'filter-miss' },
        {
          status: 'error',
          error: {
            code: 'RATE_LIMITED',
            message: 'caller-controlled detail must not render',
            requestId: REQUEST_ID,
          },
          retryable: true,
        },
        {
          status: 'degraded',
          data: null,
          code: 'DEPENDENCY_DEADLINE_EXCEEDED',
          requestId: REQUEST_ID,
          lastVerifiedAt: null,
        },
        { status: 'disabled', reason: 'This workspace is disabled.' },
      ];

    for (const state of states) {
      const markup = render({ initialList: state, initialDetail: null });
      expect(markup).toMatch(/aria-(?:live|label)/u);
      expect(markup).not.toContain('caller-controlled detail must not render');
      expect(markup).not.toContain('role="grid"');
    }

    for (const [code, message] of Object.entries(
      CONTENT_SCHEMA_REGISTRY_SAFE_ERROR_MESSAGES,
    )) {
      const markup = render({
        initialList: {
          status: 'error',
          error: {
            code: code as never,
            message: 'untrusted',
            requestId: REQUEST_ID,
          },
          retryable: code === 'RATE_LIMITED',
        },
        initialDetail: null,
      });
      expect(markup).toContain(message);
      expect(markup).not.toContain('untrusted');
    }
  });

  it('[P2-S09-AC-258] [P2-S09-AC-259] [P2-S09-AC-260] keeps worker-only evidence, owner authority, and raw secrets out of browser HTML', () => {
    const markup = render();
    const forbiddenNames = [
      'ownerId',
      'releaseKeyId',
      'releaseRawBodyHash',
      'releaseSignatureHash',
      'releaseNonceHash',
      'releaseVerifiedAt',
      'propsSchemaSnapshot',
      'propsSnapshotAttestation',
      'WEBHOOK_REJECTED',
      'rawBody',
      'signature',
      'Idempotency-Key',
      'If-Match',
    ];
    for (const forbidden of forbiddenNames)
      expect(markup).not.toContain(forbidden);
    expect(markup).toContain('releaseDigest');
    expect(markup).toContain('Props schema reference');
    expect(markup).toContain('Renderer reference');

    const untrusted = render({
      initialList: {
        status: 'error',
        error: {
          code: 'INTERNAL_ERROR',
          message: '<script>do-not-execute</script>',
          requestId: REQUEST_ID,
        },
        retryable: false,
      },
      initialDetail: null,
    });
    expect(untrusted).toContain(
      CONTENT_SCHEMA_REGISTRY_SAFE_ERROR_MESSAGES.INTERNAL_ERROR,
    );
    expect(untrusted).not.toContain(
      '&lt;script&gt;do-not-execute&lt;/script&gt;',
    );
    expect(untrusted).not.toContain('<script>do-not-execute</script>');
  });

  it('[P2-S09-AC-244] [P2-S09-AC-245] [P2-S09-AC-246] declares the responsive layout and target-size contract in the route stylesheet', () => {
    const css = routeSource(
      '../../apps/web/src/components/content-schema-registry/content-schema-registry.css',
    );

    expect(css).toContain('min-block-size: 2.75rem');
    expect(css).toContain('min-inline-size: 0');
    expect(css).toContain('overflow-x: auto');
    expect(css).toContain('@media (min-width: 48.0625rem)');
    expect(css).toContain('@media (max-width: 48rem)');
    expect(css).toContain('@media (min-width: 64rem)');
    expect(css).toMatch(/grid-template-columns:\s*minmax\(0,\s*1\.1fr\)/u);
    expect(css).toMatch(/grid-template-columns:\s*minmax\(0,\s*1\.25fr\)/u);
  });
});
