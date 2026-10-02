// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ContentSchemaRegistryWorkbench from './ContentSchemaRegistryWorkbench';
import type { ContentSchemaRegistryWorkbenchProps } from './content-schema-registry-types';

type Mounted = Readonly<{ container: HTMLDivElement; root: Root }>;

const mounted: Mounted[] = [];

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const PARTY_ID = '20000000-0000-4000-8000-000000000002';
const OTHER_PARTY_ID = '20000000-0000-4000-8000-0000000000ff';
const TYPE_ID = '30000000-0000-4000-8000-000000000003';
const VERSION_ID = '40000000-0000-4000-8000-000000000004';

const RESOURCE = {
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

const DETAIL = {
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

const props = (
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

const mount = (element: React.ReactElement): Mounted => {
  const container = document.createElement('div');
  (document.body as unknown as HTMLElement).appendChild(container);
  const root = createRoot(container);
  act(() => root.render(element));
  const view = { container, root };
  mounted.push(view);
  return view;
};

const confirmationCheckbox = (
  container: HTMLElement,
): HTMLInputElement | null =>
  container.querySelector<HTMLInputElement>(
    '#content-schema-registry-confirmed',
  );

const click = (element: Element): void => {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});

afterEach(() => {
  while (mounted.length > 0) {
    const view = mounted.pop();
    if (view === undefined) continue;
    act(() => view.root.unmount());
    view.container.remove();
  }
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('[P2-S09-AC-250] confirmation ownership across canonical refresh', () => {
  it('preserves acknowledgement across a same-projection refresh', () => {
    const view = mount(<ContentSchemaRegistryWorkbench {...props()} />);
    const checkbox = confirmationCheckbox(view.container);
    expect(checkbox).not.toBeNull();
    click(checkbox as HTMLInputElement);
    expect(confirmationCheckbox(view.container)?.checked).toBe(true);

    act(() => {
      view.root.render(<ContentSchemaRegistryWorkbench {...props()} />);
    });
    expect(confirmationCheckbox(view.container)?.checked).toBe(true);
  });

  it('resets acknowledgement when the acting party changes', () => {
    const view = mount(<ContentSchemaRegistryWorkbench {...props()} />);
    const checkbox = confirmationCheckbox(view.container);
    click(checkbox as HTMLInputElement);
    expect(confirmationCheckbox(view.container)?.checked).toBe(true);

    act(() => {
      view.root.render(
        <ContentSchemaRegistryWorkbench
          {...props({
            actingPartyId: OTHER_PARTY_ID,
            actingContextLabel: 'Other Collective',
          })}
        />,
      );
    });
    expect(confirmationCheckbox(view.container)?.checked).toBe(false);
  });

  it('resets acknowledgement when the expected version changes', () => {
    const view = mount(<ContentSchemaRegistryWorkbench {...props()} />);
    const checkbox = confirmationCheckbox(view.container);
    click(checkbox as HTMLInputElement);
    expect(confirmationCheckbox(view.container)?.checked).toBe(true);

    const nextDetail = {
      status: 'success' as const,
      data: {
        ...DETAIL,
        resource: { ...RESOURCE, version: '2' },
      },
      version: '2',
      stale: false,
    };
    act(() => {
      view.root.render(
        <ContentSchemaRegistryWorkbench
          {...props({ expectedVersion: '2', initialDetail: nextDetail })}
        />,
      );
    });
    expect(confirmationCheckbox(view.container)?.checked).toBe(false);
  });

  it('resets acknowledgement when the step-up window changes', () => {
    const view = mount(<ContentSchemaRegistryWorkbench {...props()} />);
    const checkbox = confirmationCheckbox(view.container);
    click(checkbox as HTMLInputElement);
    expect(confirmationCheckbox(view.container)?.checked).toBe(true);

    const { stepUpFreshUntil, ...withoutFresh } = props();
    void stepUpFreshUntil;
    act(() => {
      view.root.render(
        <ContentSchemaRegistryWorkbench
          {...withoutFresh}
          stepUpState="required"
        />,
      );
    });
    expect(confirmationCheckbox(view.container)?.checked).toBe(false);
  });
});
