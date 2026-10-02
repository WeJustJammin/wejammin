import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseCanonicalWorkbenchOutcome } from './content-schema-registry-runtime-dom-refetch-project';
import { CONTENT_SCHEMA_REGISTRY_PROJECTION_KEYS } from './content-schema-registry-canonical-keys';
import { emptyActivationPreparation } from './content-schema-registry-activation-preparation.test-support';

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Unit RED for the canonical refetch projection. Semantics under test:
 * every well-typed canonical result (success, empty, error, denial/disabled)
 * REPLACES the protected UI through React; only missing/malformed/ambiguous
 * props render a safe disabled boundary. A prior full success never survives
 * an invalid or non-success canonical result.
 */

const RESOURCE = {
  resourceKind: 'content_type_version',
  id: '40000000-0000-4000-8000-000000000004',
  version: '1',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-09-02T12:00:00.000Z',
  updatedAt: '2026-09-02T12:00:00.000Z',
  state: 'draft',
  contentTypeId: '30000000-0000-4000-8000-000000000003',
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
  compatibility: 'additive',
  dryRunId: '90000000-0000-4000-8000-000000000009',
  activationEvidence: null,
};

const SCHEMA_ARTIFACT = {
  resourceKind: 'schema_artifact',
  id: '60000000-0000-4000-8000-000000000006',
  version: '1',
  state: 'compiled',
  contentTypeVersionId: '40000000-0000-4000-8000-000000000004',
  compilerVersion: '1.0.0',
  zodContractRef: 'contracts/cms/content-type-v1',
  artifactHash: 'a'.repeat(64),
  createdAt: '2026-09-02T12:00:00.000Z',
  updatedAt: '2026-09-02T12:00:00.000Z',
  compiledAt: '2026-09-02T12:00:00.000Z',
};

const DETAIL = {
  resourceKind: 'content_type_version',
  resource: RESOURCE,
  fields: [],
  relations: [],
  schemaArtifact: SCHEMA_ARTIFACT,
  templateBindings: [],
  capabilityBindings: [],
  blockDefinitions: [],
  activationPreparation: emptyActivationPreparation,
};

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const ACTING_PARTY_ID = '20000000-0000-4000-8000-000000000002';
const OTHER_PARTY_ID = '20000000-0000-4000-8000-0000000000ff';

const propsPayload = (overrides: Record<string, unknown> = {}) => ({
  state: 'ready',
  variant: 'ownerFull',
  access: 'full',
  actorId: ACTOR_ID,
  actingPartyId: ACTING_PARTY_ID,
  actingContextLabel: 'Northwind Collective',
  stepUpState: 'verified',
  stepUpFreshUntil: '2026-10-01T12:05:00.000Z',
  query: { limit: 25, sort: 'key', direction: 'asc' },
  requestId: '6a3173d9-f113-4aa4-91c3-3fbc137ea258',
  initialList: { status: 'empty', reason: 'no-records' },
  initialDetail: {
    status: 'success',
    data: DETAIL,
    version: '1',
    stale: false,
  },
  contractFields: { source: 'contracts', fields: {} },
  retryUrl: '/app/cms-content-modeling/x',
  ...overrides,
});

const entityEncode = (value: unknown): string =>
  JSON.stringify(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

/**
 * Encode a props object the way Astro serializes island props: every value is a
 * [typeCode, payload] tuple (0 = plain, 1 = array). This mirrors the real
 * attribute so the codec exercises the production shape.
 */
const encValue = (value: unknown): unknown => {
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

const encProps = (value: Record<string, unknown>): unknown =>
  Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, encValue(entry)]),
  );

const ISLAND_OPEN =
  '<astro-island uid="EQror" component-url="/_astro/ContentSchemaRegistryWorkbenchIsland.AbCdEf12.js" component-export="default" renderer-url="/_astro/client.XyZ.js"';

const island = (props: unknown, suffix = ''): string =>
  ISLAND_OPEN +
  ' props="' +
  entityEncode(encProps(props as Record<string, unknown>)) +
  '" ssr client="load">' +
  suffix +
  '</astro-island>';

const page = (body: string): string => '<html><body>' + body + '</body></html>';

describe('[P2-S09-AC-250] canonical refetch projection', () => {
  it('applies a validated success projection from the current WorkbenchIsland props', () => {
    const result = parseCanonicalWorkbenchOutcome(page(island(propsPayload())));
    expect(result.kind).toBe('projection');
    if (result.kind !== 'projection') return;
    expect(result.projection.initialDetail?.status).toBe('success');
    if (result.projection.initialDetail?.status !== 'success') return;
    expect(result.projection.initialDetail.version).toBe('1');
    expect(result.projection.initialDetail.stale).toBe(false);
    expect(result.projection.actingContextLabel).toBe('Northwind Collective');
    expect(result.projection.stepUpState).toBe('verified');
  });

  it('applies a canonical empty list, replacing a prior full success', () => {
    const result = parseCanonicalWorkbenchOutcome(page(island(propsPayload())));
    expect(result.kind).toBe('projection');
    if (result.kind !== 'projection') return;
    expect(result.projection.initialList).toEqual({
      status: 'empty',
      reason: 'no-records',
    });
  });

  it('applies a canonical denial so the protected UI is removed via React', () => {
    const result = parseCanonicalWorkbenchOutcome(
      page(
        island(
          propsPayload({
            access: 'disabled',
            variant: 'forbiddenHidden',
            initialDetail: { status: 'disabled', reason: 'FORBIDDEN' },
          }),
        ),
      ),
    );
    expect(result.kind).toBe('projection');
    if (result.kind !== 'projection') return;
    expect(result.projection.access).toBe('disabled');
    expect(result.projection.initialDetail).toEqual({
      status: 'disabled',
      reason: 'FORBIDDEN',
    });
  });

  it('accepts a genuine acting-context change from trusted same-origin SSR', () => {
    const result = parseCanonicalWorkbenchOutcome(
      page(
        island(
          propsPayload({
            actingPartyId: OTHER_PARTY_ID,
            actingContextLabel: 'Other Collective',
          }),
        ),
      ),
    );
    expect(result.kind).toBe('projection');
    if (result.kind !== 'projection') return;
    expect(result.projection.actingContextLabel).toBe('Other Collective');
  });

  it('does not renew the freshness window when the refetch omits it', () => {
    const result = parseCanonicalWorkbenchOutcome(
      page(
        island(
          propsPayload({
            stepUpState: 'required',
            stepUpFreshUntil: undefined,
          }),
        ),
      ),
    );
    expect(result.kind).toBe('projection');
    if (result.kind !== 'projection') return;
    expect(result.projection.stepUpState).toBe('required');
    expect(result.projection.stepUpFreshUntil).toBeUndefined();
  });

  it('renders a safe disabled outcome when the island is absent', () => {
    expect(parseCanonicalWorkbenchOutcome(page(''))).toEqual({
      kind: 'disabled',
      reason: 'markup',
    });
  });

  it('renders a safe disabled outcome on malformed island props', () => {
    const markup = page(
      ISLAND_OPEN + ' props="not-json" ssr client="load"></astro-island>',
    );
    expect(parseCanonicalWorkbenchOutcome(markup)).toEqual({
      kind: 'disabled',
      reason: 'props',
    });
  });

  it('renders a safe disabled outcome on duplicate island props', () => {
    const markup = page(island(propsPayload()) + island(propsPayload()));
    expect(parseCanonicalWorkbenchOutcome(markup)).toEqual({
      kind: 'disabled',
      reason: 'props',
    });
  });

  it('renders a safe disabled outcome on an unsupported tuple type', () => {
    const markup = page(
      ISLAND_OPEN +
        ' props="{&quot;a&quot;:[99,&quot;x&quot;]}" ssr client="load"></astro-island>',
    );
    expect(parseCanonicalWorkbenchOutcome(markup)).toEqual({
      kind: 'disabled',
      reason: 'props',
    });
  });

  it('renders a safe disabled outcome on a prototype key', () => {
    const markup = page(
      ISLAND_OPEN +
        ' props="{&quot;__proto__&quot;:{&quot;x&quot;:[0,&quot;y&quot;]}}" ssr client="load"></astro-island>',
    );
    expect(parseCanonicalWorkbenchOutcome(markup)).toEqual({
      kind: 'disabled',
      reason: 'props',
    });
  });

  it('renders a safe disabled outcome when the server detail violates the strict contract', () => {
    const result = parseCanonicalWorkbenchOutcome(
      page(
        island(
          propsPayload({
            initialDetail: {
              status: 'success',
              data: { ...DETAIL, unexpected: true },
              version: '1',
              stale: false,
            },
          }),
        ),
      ),
    );
    expect(result).toEqual({ kind: 'disabled', reason: 'invalid' });
  });

  it('rejects a non-UUID actorId but accepts null authority ids', () => {
    expect(
      parseCanonicalWorkbenchOutcome(
        page(island(propsPayload({ actorId: 'not-a-uuid' }))),
      ),
    ).toEqual({ kind: 'disabled', reason: 'invalid' });
    const noAuthority = parseCanonicalWorkbenchOutcome(
      page(island(propsPayload({ actorId: null, actingPartyId: null }))),
    );
    expect(noAuthority.kind).toBe('projection');
  });

  it('accepts exactly the declared island projection keyset', () => {
    expect(CONTENT_SCHEMA_REGISTRY_PROJECTION_KEYS.size).toBe(22);
    expect(CONTENT_SCHEMA_REGISTRY_PROJECTION_KEYS.has('actorId')).toBe(true);
    expect(CONTENT_SCHEMA_REGISTRY_PROJECTION_KEYS.has('actingPartyId')).toBe(
      true,
    );
  });

  it('ignores island-like markup inside script and comment regions', () => {
    const decoy =
      '<script>var s = ' +
      JSON.stringify(ISLAND_OPEN + ' props="x" ssr></astro-island>') +
      ';</script><!-- ' +
      ISLAND_OPEN +
      ' props="y" ssr></astro-island> -->';
    const result = parseCanonicalWorkbenchOutcome(
      page(decoy + island(propsPayload())),
    );
    expect(result.kind).toBe('projection');
  });

  it('never logs protected payload and returns only a fixed failure vocabulary', () => {
    const spies = [
      vi.spyOn(console, 'log'),
      vi.spyOn(console, 'info'),
      vi.spyOn(console, 'warn'),
      vi.spyOn(console, 'error'),
      vi.spyOn(console, 'debug'),
    ];
    const markup = page(
      island(
        propsPayload({
          initialDetail: {
            status: 'success',
            data: { ...DETAIL, leakedLabel: 'SECRET-PROPS-VALUE' },
            version: '1',
            stale: false,
          },
        }),
      ),
    );
    const result = parseCanonicalWorkbenchOutcome(markup);
    expect(result).toEqual({ kind: 'disabled', reason: 'invalid' });
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
      expect(JSON.stringify(spy.mock.calls)).not.toContain(
        'SECRET-PROPS-VALUE',
      );
    }
  });
});
