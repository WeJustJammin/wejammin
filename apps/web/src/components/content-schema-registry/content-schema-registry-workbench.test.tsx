import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import ContentSchemaRegistryWorkbench from './ContentSchemaRegistryWorkbench';
import ContentSchemaRegistryWorkbenchIsland from './ContentSchemaRegistryWorkbenchIsland';
import { CONTENT_SCHEMA_REGISTRY_CONTRACT_FIELDS } from './content-schema-registry-types';
import type {
  ContentSchemaRegistryDetail,
  ContentSchemaRegistryListPage,
  ContentSchemaRegistryQuery,
  ContentSchemaRegistryWorkbenchProps,
} from './content-schema-registry-types';

const TYPE_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
const VERSION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132db';
const HASH = 'c'.repeat(64);

const list = {
  items: [
    {
      resourceKind: 'content_type',
      id: TYPE_ID,
      version: '4',
      typeKey: 'release_note',
      builtIn: false,
      lifecycle: 'active',
      createdAt: '2026-09-02T12:00:00.000Z',
      updatedAt: '2026-09-02T12:00:00.000Z',
    },
    {
      resourceKind: 'content_type_version',
      id: VERSION_ID,
      version: '4',
      contentHash: HASH,
      createdAt: '2026-09-02T12:00:00.000Z',
      updatedAt: '2026-09-02T12:00:00.000Z',
      state: 'active',
      contentTypeId: TYPE_ID,
      typeKey: 'release_note',
      label: 'Release note',
      ownerCapability: 'cms.schema_registry.read',
      sourceLocale: 'en-US',
      defaultLocale: 'en-US',
      workflowKey: 'cms.content.workflow',
      workflowVersion: '1',
      defaultTemplateVersionId: null,
      schemaArtifactId: TYPE_ID,
      fieldCount: 0,
      relationCount: 0,
      capabilityBindingCount: 0,
      compatibility: 'additive',
      dryRunId: TYPE_ID,
      activationEvidence: null,
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
} satisfies ContentSchemaRegistryListPage;

const detail = {
  resourceKind: 'content_type_version',
  resource: {
    id: VERSION_ID,
    version: '4',
    contentHash: HASH,
    createdAt: '2026-09-02T12:00:00.000Z',
    updatedAt: '2026-09-02T12:00:00.000Z',
    resourceKind: 'content_type_version',
    state: 'active',
    contentTypeId: TYPE_ID,
    typeKey: 'release_note',
    label: 'Release note',
    ownerCapability: 'cms.schema_registry.read',
    sourceLocale: 'en-US',
    defaultLocale: 'en-US',
    workflowKey: 'cms.content.workflow',
    workflowVersion: '1',
    defaultTemplateVersionId: null,
    schemaArtifactId: TYPE_ID,
    fieldCount: 0,
    relationCount: 0,
    capabilityBindingCount: 0,
    compatibility: 'additive',
    dryRunId: TYPE_ID,
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
  fields: [],
  relations: [],
  schemaArtifact: {
    resourceKind: 'schema_artifact',
    id: TYPE_ID,
    version: '1',
    state: 'compiled',
    contentTypeVersionId: VERSION_ID,
    compilerVersion: '1.0',
    zodContractRef: 'schemas/release-note.json',
    artifactHash: HASH,
    createdAt: '2026-09-02T12:00:00.000Z',
    updatedAt: '2026-09-02T12:00:00.000Z',
    compiledAt: '2026-09-02T12:00:00.000Z',
  },
  templateBindings: [],
  capabilityBindings: [],
  blockDefinitions: list.items.filter(
    (item) => item.resourceKind === 'block_definition_registry_record',
  ),
} satisfies ContentSchemaRegistryDetail;

const query: ContentSchemaRegistryQuery = {
  limit: 25,
  sort: 'key',
  direction: 'asc',
};

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
  actorId: TYPE_ID,
  actingPartyId: VERSION_ID,
  query,
  contentTypeId: TYPE_ID,
  versionId: VERSION_ID,
  cursor: null,
  expectedVersion: '4',
  requestId: TYPE_ID,
  canonicalUrl: '/app/cms-content-modeling',
  listUrl:
    '/app/cms-content-modeling?resourceKind=content_type&limit=25&sort=key&direction=asc',
  retryUrl:
    '/app/cms-content-modeling?resourceKind=content_type&limit=25&sort=key&direction=asc',
  csrfToken: 'csrf-token',
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

describe('ContentSchemaRegistryWorkbench server-first projection', () => {
  it('[P2-S09-AC-250] renders the resolved acting-context disclosure without identifiers', () => {
    // The disclosure re-derives against the rendering clock, so the fixture
    // must sit inside the 10-minute verified window.
    const freshUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const markup = render({
      access: 'full',
      actingContextLabel: 'Northwind Collective',
      stepUpState: 'verified',
      stepUpFreshUntil: freshUntil,
    });
    expect(markup).toContain('Northwind Collective');
    expect(markup).toContain('Verified until');
    // The trusted acting party is serialized for the existing island
    // contract, but it must never be shown as the acting context itself.
    const disclosureStart = markup.indexOf('Acting context');
    expect(markup.slice(disclosureStart, disclosureStart + 220)).not.toContain(
      VERSION_ID,
    );
  });

  it('[P2-S09-AC-250] states the honest fallback when no context or expiry is proven', () => {
    const markup = render({ access: 'full' });
    expect(markup).toContain('Server-verified acting context unavailable');
    expect(markup).not.toContain('Verified until');
    expect(markup).toContain('Step-up required before commit');
  });

  it('[P2-S09-AC-250] adds no private identifier to the island boundary', () => {
    const boundary = render({
      access: 'full',
      actingContextLabel: 'Northwind Collective',
      stepUpState: 'verified',
      stepUpFreshUntil: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });
    // The disclosure contributes only a human label and a derived expiry. The
    // locked FE03 props already serialize actorId/actingPartyId for the
    // existing island contract; no private binding, session, or authority
    // value is added, and neither identifier renders as the acting context.
    const disclosureStart = boundary.indexOf('Acting context');
    const disclosureSection = boundary.slice(
      disclosureStart,
      boundary.indexOf('<dt>Step-up</dt>', disclosureStart),
    );
    expect(disclosureSection).toContain('Northwind Collective');
    expect(disclosureSection).not.toContain(VERSION_ID);
    expect(disclosureSection).not.toContain(TYPE_ID);
    // The idempotency key legitimately embeds the request id; assert the
    // boundary adds no private binding or session material beyond it.
    expect(boundary).not.toContain('actingContextId');
    expect(boundary).not.toContain('bindingId');
  });

  it('keeps SSR markup while hydrating a client-owned canonical refetch callback', () => {
    const { onCanonicalRefetch, ...serializableProps } = baseProps;
    expect(onCanonicalRefetch).toBeTypeOf('function');
    const markup = renderToStaticMarkup(
      React.createElement(ContentSchemaRegistryWorkbenchIsland, {
        ...serializableProps,
        canonicalRefetchUrl: baseProps.retryUrl,
      }),
    );

    expect(markup).toContain('data-canonical-refetch-binding="bound"');
    expect(markup).toContain('data-role-policy="server-authoritative"');
    expect(markup).toContain('data-workbench="content-schema-registry"');
    expect(markup).toContain('data-access="read-only"');
  });

  it('renders semantic protected list/detail markup and safe block fields only', () => {
    const markup = render();

    expect(markup).toContain('data-workbench="content-schema-registry"');
    expect(markup).toContain('data-access="read-only"');
    expect(markup).toContain('Content schema registry');
    expect(markup).toContain('<table');
    expect(markup).toContain('<caption');
    expect(markup).toContain('scope="col"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('aria-atomic="true"');
    expect(markup).toContain('name="resourceKind"');
    expect(markup).toContain('name="keyPrefix"');
    expect(markup).toContain(
      `/app/cms-content-modeling/${TYPE_ID}/versions/${VERSION_ID}?`,
    );
    expect(markup).toContain(`id="content-schema-registry-view-${VERSION_ID}"`);
    expect(markup).toContain(
      `id="content-schema-registry-view-${VERSION_ID}-priority"`,
    );
    expect(markup).not.toContain(`href="/app/cms-content-modeling/${TYPE_ID}"`);
    expect(markup).not.toContain(
      `href="/app/cms-content-modeling/${VERSION_ID}"`,
    );
    expect(markup).toContain('block_definition_registry_record');
    expect(markup).toContain('releaseDigest');
    expect(markup).toContain('3 registry records');
    expect(markup).toContain('No filters are applied.');
    expect(markup).not.toContain('releaseKeyId');
    expect(markup).not.toContain('propsSchemaSnapshot');
    expect(markup).not.toContain('releaseNonceHash');
    expect(markup).not.toContain('CMS-03A-05');
    expect(markup).not.toContain('CMS-03A-08');
  });

  it('announces the result count and active filters', () => {
    const markup = render({
      query: {
        resourceKind: 'content_type',
        keyPrefix: 'release',
        limit: 25,
        sort: 'key',
        direction: 'asc',
      },
      initialList: {
        status: 'success',
        data: { items: [list.items[0]!], nextCursor: null },
        version: '4',
        stale: false,
      },
    });

    expect(markup).toContain('1 registry record');
    expect(markup).toContain(
      'Active filters: resource kind content_type; key prefix release.',
    );
  });

  it('keeps detail retry exact and omits an irrelevant empty list status', () => {
    const retryUrl =
      `/app/cms-content-modeling/${TYPE_ID}/versions/${VERSION_ID}` +
      '?resourceKind=content_type&limit=25&sort=key&direction=asc';
    const markup = render({
      initialList: { status: 'empty', reason: 'no-records' },
      initialDetail: {
        status: 'degraded',
        data: null,
        requestId: TYPE_ID,
        lastVerifiedAt: null,
      },
      listUrl:
        '/app/cms-content-modeling?resourceKind=content_type&limit=25&sort=key&direction=asc',
      retryUrl,
    });

    expect(markup).toContain(
      `href="${retryUrl.replaceAll('&', '&amp;')}" data-cms-retry-control="enabled">Retry`,
    );
    expect(markup).not.toContain('No records are available.');
    expect(markup).not.toContain('Registry list');
  });

  it('uses fixed safe text for untrusted UI error messages', () => {
    const markup = render({
      initialList: {
        status: 'error',
        error: {
          code: 'INTERNAL_ERROR',
          message: 'provider secret must never reach the browser',
          requestId: TYPE_ID,
        },
        retryable: false,
      },
      initialDetail: null,
    });

    expect(markup).toContain('The registry could not be loaded.');
    expect(markup).not.toContain('provider secret');
  });

  it('keeps truthful empty, degraded, disabled, and hidden states distinct', () => {
    const empty = render({
      initialList: { status: 'empty', reason: 'filter-miss' },
      initialDetail: null,
    });
    expect(empty).toContain('No records match the current filters');
    expect(empty).toContain('Reset filters');
    expect(empty).not.toContain('Loading current records');

    const degraded = render({
      initialList: {
        status: 'degraded',
        data: null,
        requestId: TYPE_ID,
        lastVerifiedAt: null,
      },
      initialDetail: null,
    });
    expect(degraded).toContain('temporarily unavailable');
    expect(degraded).toContain(TYPE_ID);
    expect(degraded).toContain('Retry');

    const disabled = render({
      access: 'disabled',
      initialList: { status: 'disabled', reason: 'Read capability required.' },
      initialDetail: null,
    });
    expect(disabled).toContain('Read capability required');

    const hidden = render({
      access: 'not-rendered',
      initialList: { status: 'disabled', reason: 'Not disclosed.' },
      initialDetail: null,
    });
    expect(hidden).not.toContain('Content schema registry');
    expect(hidden).not.toContain(TYPE_ID);
  });
});
