import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import type { ContentSchemaRegistryWorkbenchIslandProps } from './ContentSchemaRegistryWorkbenchIsland';
import type { ContentSchemaRegistryWorkbenchProps } from './content-schema-registry-types';

/** Shared fixtures/helpers for the island canonical-refetch test suites. */

export const capturedWorkbench: { props: Record<string, unknown>[] } = {
  props: [],
};

export const lastWorkbenchProps = (): Record<string, unknown> =>
  (capturedWorkbench.props.at(-1) ?? {}) as Record<string, unknown>;

export const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
export const PARTY_ID = '20000000-0000-4000-8000-000000000002';
export const OTHER_PARTY_ID = '20000000-0000-4000-8000-0000000000ff';
export const TYPE_ID = '30000000-0000-4000-8000-000000000003';
export const VERSION_ID = '40000000-0000-4000-8000-000000000004';

export const RESOURCE = {
  resourceKind: 'content_type_version' as const,
  id: VERSION_ID,
  version: '1',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-09-02T12:00:00.000Z',
  updatedAt: '2026-09-02T12:00:00.000Z',
  state: 'draft' as const,
  contentTypeId: TYPE_ID,
  typeKey: 'article',
  label: 'Article',
  ownerCapability: 'cms.content.article',
  sourceLocale: 'en-US',
  defaultLocale: 'en-US',
  workflowKey: 'editorial.default',
  workflowVersion: '1',
  defaultTemplateVersionId: null,
  schemaArtifactId: '60000000-0000-4000-8000-000000000006',
  fieldCount: 0,
  relationCount: 0,
  capabilityBindingCount: 1,
  compatibility: 'additive' as const,
  dryRunId: '90000000-0000-4000-8000-000000000009',
  activationEvidence: null,
};

export const DETAIL = {
  resourceKind: 'content_type_version' as const,
  resource: RESOURCE,
  fields: [],
  relations: [],
  schemaArtifact: {
    resourceKind: 'schema_artifact' as const,
    id: '60000000-0000-4000-8000-000000000006',
    version: '1',
    state: 'compiled' as const,
    contentTypeVersionId: VERSION_ID,
    compilerVersion: '1.0.0',
    zodContractRef: 'contracts/cms/content-type-v1',
    artifactHash: 'a'.repeat(64),
    createdAt: '2026-09-02T12:00:00.000Z',
    updatedAt: '2026-09-02T12:00:00.000Z',
    compiledAt: '2026-09-02T12:00:00.000Z',
  },
  templateBindings: [],
  capabilityBindings: [],
  blockDefinitions: [],
};

export const workbenchProps = (
  overrides: Partial<ContentSchemaRegistryWorkbenchProps> = {},
): ContentSchemaRegistryWorkbenchProps => ({
  variant: 'ownerFull',
  access: 'full',
  actorId: ACTOR_ID,
  actingPartyId: PARTY_ID,
  actingContextLabel: 'Northwind Collective',
  stepUpState: 'verified',
  stepUpFreshUntil: '2026-10-01T12:05:00.000Z',
  query: { limit: 25, sort: 'key', direction: 'asc' },
  contentTypeId: TYPE_ID,
  versionId: VERSION_ID,
  cursor: null,
  expectedVersion: '1',
  requestId: '6a3173d9-f113-4aa4-91c3-3fbc137ea258',
  canonicalUrl: '/app/cms-content-modeling',
  listUrl: '/app/cms-content-modeling?limit=25&sort=key&direction=asc',
  retryUrl: '/app/cms-content-modeling/' + TYPE_ID + '/versions/' + VERSION_ID,
  csrfToken: '',
  contractFields: { source: 'contracts', fields: {} },
  initialList: { status: 'empty', reason: 'no-records' },
  initialDetail: {
    status: 'success',
    data: DETAIL,
    version: '1',
    stale: false,
  },
  onCanonicalRefetch: async () => undefined,
  ...overrides,
});

export const encValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return [1, value.map(encValue)];
  if (value !== null && typeof value === 'object')
    return [
      0,
      Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [key, encValue(entry)]),
      ),
    ];
  return [0, value];
};

export const entityEncode = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

export const islandMarkup = (props: Record<string, unknown>): string => {
  const encoded = Object.fromEntries(
    Object.entries(props)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, encValue(entry)]),
  );
  return (
    '<html><body><astro-island uid="u1" component-url="/_astro/ContentSchemaRegistryWorkbenchIsland.Ab.js" component-export="default" renderer-url="/_astro/client.Xy.js" props="' +
    entityEncode(JSON.stringify(encoded)) +
    '" ssr client="load"></astro-island></body></html>'
  );
};

export const okBody = (overrides: Record<string, unknown> = {}): string =>
  islandMarkup({
    state: 'ready',
    variant: 'ownerFull',
    access: 'full',
    actorId: ACTOR_ID,
    actingPartyId: PARTY_ID,
    actingContextLabel: 'Northwind Collective',
    stepUpState: 'verified',
    stepUpFreshUntil: '2026-10-01T12:05:00.000Z',
    requestId: 'r',
    initialList: { status: 'empty', reason: 'no-records' },
    initialDetail: {
      status: 'success',
      data: DETAIL,
      version: '1',
      stale: false,
    },
    ...overrides,
  });

export const islandPropsFixture = (
  overrides: Partial<ContentSchemaRegistryWorkbenchIslandProps> = {},
): ContentSchemaRegistryWorkbenchIslandProps => ({
  variant: 'ownerFull',
  access: 'full',
  actorId: ACTOR_ID,
  actingPartyId: PARTY_ID,
  actingContextLabel: 'Northwind Collective',
  stepUpState: 'verified',
  stepUpFreshUntil: '2026-10-01T12:05:00.000Z',
  query: { limit: 25, sort: 'key', direction: 'asc' },
  contentTypeId: TYPE_ID,
  versionId: VERSION_ID,
  cursor: null,
  expectedVersion: '1',
  requestId: '6a3173d9-f113-4aa4-91c3-3fbc137ea258',
  canonicalUrl: '/app/cms-content-modeling',
  listUrl: '/app/cms-content-modeling?limit=25&sort=key&direction=asc',
  retryUrl: '/app/cms-content-modeling/' + TYPE_ID + '/versions/' + VERSION_ID,
  csrfToken: '',
  contractFields: { source: 'contracts', fields: {} },
  initialList: { status: 'empty', reason: 'no-records' },
  initialDetail: {
    status: 'success',
    data: DETAIL,
    version: '1',
    stale: false,
  },
  canonicalRefetchUrl:
    '/app/cms-content-modeling/' +
    TYPE_ID +
    '/versions/' +
    VERSION_ID +
    '?limit=25',
  ...overrides,
});

export type Mounted = Readonly<{ container: HTMLDivElement; root: Root }>;

export const mountedViews: Mounted[] = [];

export const mountView = (element: React.ReactElement): Mounted => {
  const container = document.createElement('div');
  (document.body as unknown as HTMLElement).appendChild(container);
  const root = createRoot(container);
  act(() => root.render(element));
  const view = { container, root };
  mountedViews.push(view);
  return view;
};

export const unmountMountedViews = (): void => {
  while (mountedViews.length > 0) {
    const view = mountedViews.pop();
    if (view === undefined) continue;
    act(() => view.root.unmount());
    view.container.remove();
  }
  document.body.replaceChildren();
};

export const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};
