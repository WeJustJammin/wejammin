import { describe, expect, it, vi } from 'vitest';

import {
  ApiErrorSchema,
  AuthoringContextReadSchema,
  AuthoringContextResourceSchema,
  type AuthoringContextField,
  type AuthoringContextResource,
  type AuthoringContextType,
} from '@wejammin/contracts';

import { createCmsEditorialApp, type CmsEditorialDependencies } from './index';

/**
 * QA-RED for CMS-03B-14 (BE03b `GET /api/v1/cms/entries/authoring-context`). The
 * literal authoring-context preparation read is not registered and no
 * `getAuthoringContext` port exists yet, so every case must fail only because
 * the route/port is absent.
 */

const origin = 'https://cms-console.example.test';
const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userId = '10000000-0000-4000-8000-000000000001';
const partyId = '20000000-0000-4000-8000-000000000002';
const entryId = '30000000-0000-4000-8000-000000000003';
const versionId = '71000000-0000-4000-8000-000000000007';
const hash = 'a'.repeat(64);
const instant = '2026-09-26T12:00:00.000Z';
const path = '/api/v1/cms/entries/authoring-context';

const evidence = {
  key: 'editorial.standard',
  version: '1',
  policyHash: hash,
  riskClass: 'ordinary' as const,
  requiredDecisionCount: 1,
  requiredCapabilities: [],
  approvalEvidenceHash: hash,
};

const selectedType: AuthoringContextType = {
  contentTypeId: '70000000-0000-4000-8000-000000000007',
  contentTypeVersionId: versionId,
  label: 'Article',
  sourceLocale: 'en-US',
  defaultLocale: 'en-US',
  supportedLocales: ['en-US'],
  schemaArtifact: {
    id: '72000000-0000-4000-8000-000000000007',
    contentTypeVersionId: versionId,
    artifactHash: hash,
    compilerVersion: '1.0.0',
    zodContractRef: '03a.content-type-version.v1',
  },
  validatorRefs: [],
  workflowPolicy: evidence,
  activationEvidence: evidence,
};

const field: AuthoringContextField = {
  stableFieldId: '73000000-0000-4000-8000-000000000007',
  key: 'title',
  kind: 'short_text',
  constraints: {},
  required: true,
  defaultMode: 'none',
  localizationMode: 'localized',
  editorConfig: { label: 'Title', order: 0 },
  relationDefinition: null,
};

const unselected: AuthoringContextResource = {
  creatableTypes: [selectedType],
  selectedType: null,
  fields: [],
};

const selected: AuthoringContextResource = {
  creatableTypes: [selectedType],
  selectedType,
  fields: [field],
};

const unavailable = async () => ({
  ok: false as const,
  status: 503 as const,
  code: 'DEPENDENCY_UNAVAILABLE',
  message: 'Unavailable.',
});

type PortOutcome = (input: unknown, signal: AbortSignal) => Promise<unknown>;

type HarnessOptions = Readonly<{
  port?: PortOutcome;
  omitPort?: boolean;
  resolveSession?: CmsEditorialDependencies['resolveSession'];
  rateLimit?: CmsEditorialDependencies['rateLimit'];
  telemetry?: NonNullable<CmsEditorialDependencies['telemetry']>;
  deadlineMs?: number;
}>;

const harness = (options: HarnessOptions = {}) => {
  const getAuthoringContext = vi.fn(
    options.port ?? (async () => ({ ok: true as const, value: unselected })),
  );
  const getEntryDraft = vi.fn(async () => ({
    ok: true as const,
    value: { leaked: true },
  }));
  const telemetry = vi.fn(options.telemetry ?? ((): void => undefined));
  const ports =
    options.omitPort === true
      ? { appendRevision: unavailable }
      : { appendRevision: unavailable, getAuthoringContext, getEntryDraft };
  const dependencies = {
    ports,
    resolveSession:
      options.resolveSession ??
      (async () => ({
        ok: true as const,
        value: {
          userId,
          actingPartyId: partyId,
          capabilities: ['cms.author'],
          mfaFresh: true,
        },
      })),
    rateLimit:
      options.rateLimit ??
      (async () => ({
        ok: true as const,
        value: { allowed: true, limit: 300, remaining: 299, resetAt: 60_000 },
      })),
    humanOrigins: [origin],
    now: () => 0,
    ...(options.deadlineMs === undefined
      ? {}
      : { deadlineMs: options.deadlineMs }),
    telemetry,
  } as unknown as CmsEditorialDependencies;
  return {
    app: createCmsEditorialApp(dependencies),
    getAuthoringContext,
    getEntryDraft,
    telemetry,
  };
};

const get = (
  app: ReturnType<typeof createCmsEditorialApp>,
  suffix = '',
  headers: Record<string, string> = {},
): Promise<Response> =>
  Promise.resolve(
    app.request(`${path}${suffix}`, {
      method: 'GET',
      headers: { origin, 'x-request-id': requestId, ...headers },
    }),
  );

describe('CMS-03B-14 protected authoring-context route', () => {
  it('[P2-S10-AC-100] serves the strict creatable-type projection with a no-store ETag', async () => {
    const { app, getAuthoringContext } = harness();
    const response = await get(app);
    expect(response.status).toBe(200);
    expect(AuthoringContextResourceSchema.parse(await response.json())).toEqual(
      unselected,
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('etag')).toMatch(/^"[^"].*"$/u);
    expect(response.headers.get('etag')).not.toContain('W/');
    expect(getAuthoringContext).toHaveBeenCalledTimes(1);
    expect(getAuthoringContext.mock.calls[0]?.[0]).toMatchObject({
      operationId: 'CMS-03B-14',
    });
  });

  it('[P2-S10-AC-100] returns the selected type and its projected fields when a version is requested', async () => {
    const { app } = harness({
      port: async () => ({ ok: true, value: selected }),
    });
    const response = await get(app, `?contentTypeVersionId=${versionId}`);
    expect(response.status).toBe(200);
    const body = AuthoringContextResourceSchema.parse(await response.json());
    expect(body.selectedType?.contentTypeVersionId).toBe(versionId);
    expect(body.fields).toHaveLength(1);
    expect(
      AuthoringContextReadSchema.parse({
        query: { contentTypeVersionId: versionId },
        resource: body,
      }).resource.selectedType?.contentTypeVersionId,
    ).toBe(versionId);
  });

  it('[P2-S10-AC-103] matches the literal authoring-context segment before the entry UUID route', async () => {
    const { app, getAuthoringContext, getEntryDraft } = harness();
    const response = await get(app);
    expect(response.status).toBe(200);
    expect(getAuthoringContext).toHaveBeenCalledTimes(1);
    expect(getEntryDraft).not.toHaveBeenCalled();
    expect(entryId).toBeDefined();
  });

  it('[P2-S10-AC-101] rejects undeclared query keys and any caller-supplied schema authority', async () => {
    const { app, getAuthoringContext } = harness();
    const unknown = await get(app, '?schemaArtifact=x');
    expect(unknown.status).toBe(400);
    // The literal route rejects the undeclared key itself -- not the generic
    // entry-path rejection the UUID route would raise for `authoring-context`.
    expect(await unknown.json()).toMatchObject({
      code: 'INVALID_REQUEST',
      details: { violations: [{ code: 'unknown_field' }] },
    });
    for (const query of [
      '?workflowPolicy=x',
      '?approvalEvidence=x',
      '?contentTypeVersionId=not-a-uuid',
      `?contentTypeVersionId=${versionId}&contentTypeVersionId=${versionId}`,
    ])
      expect((await get(app, query)).status).toBe(400);
    expect(getAuthoringContext).not.toHaveBeenCalled();
  });

  it('[P2-S10-AC-101] rejects request bodies and mutation headers on the read', async () => {
    const { app, getAuthoringContext } = harness();
    expect((await get(app)).status).toBe(200);
    expect((await get(app, '?', { 'idempotency-key': 'key' })).status).toBe(
      400,
    );
    expect((await get(app, '?', { 'if-match': '"1"' })).status).toBe(400);
    expect((await get(app, '?', { 'content-length': '2' })).status).toBe(400);
    expect(
      (await get(app, '?', { 'content-type': 'application/json' })).status,
    ).toBe(415);
    expect(getAuthoringContext).not.toHaveBeenCalled();
  });

  it('[P2-S10-AC-102] never grants or implies cms.schema_registry.read', async () => {
    const { app } = harness({
      port: async () => ({ ok: true, value: selected }),
    });
    const response = await get(app, `?contentTypeVersionId=${versionId}`);
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain('cms.schema_registry.read');
    expect(text).not.toContain(userId);
    expect(text).not.toContain(partyId);
    expect(text).not.toContain('ownerId');
  });

  it('[P2-S10-AC-102] conceals an inaccessible or absent target schema as 404', async () => {
    const { app } = harness({
      port: async () => ({
        ok: false,
        status: 404,
        code: 'NOT_FOUND',
        message: 'The requested CMS editorial resource was not found.',
        details: { reasonCode: 'concealed' },
      }),
    });
    const response = await get(app, `?contentTypeVersionId=${versionId}`);
    expect(response.status).toBe(404);
    const payload = ApiErrorSchema.parse(await response.json());
    expect(payload.code).toBe('NOT_FOUND');
    expect(payload.details).toEqual({});
  });

  it('[P2-S10-AC-104] refuses a dependency projection that omits required preparation evidence', async () => {
    const { app } = harness({
      port: async () => ({
        ok: true,
        value: {
          creatableTypes: [selectedType],
          selectedType: { ...selectedType, schemaArtifact: undefined },
          fields: [],
        },
      }),
    });
    const response = await get(app);
    expect(response.status).toBe(502);
    expect(ApiErrorSchema.parse(await response.json()).code).toBe(
      'BAD_GATEWAY',
    );
  });

  it('[P2-S10-AC-102] answers an anonymous caller 401 and a reviewer-only session 403 before reads', async () => {
    const anonymous = harness({
      resolveSession: async () => ({
        ok: false,
        status: 401,
        code: 'UNAUTHENTICATED',
        message: 'No session.',
      }),
    });
    expect((await get(anonymous.app)).status).toBe(401);
    const reviewer = harness({
      resolveSession: async () => ({
        ok: true,
        value: {
          userId,
          actingPartyId: partyId,
          capabilities: ['cms.reviewer'],
          mfaFresh: true,
        },
      }),
    });
    expect((await get(reviewer.app)).status).toBe(403);
    expect(anonymous.getAuthoringContext).not.toHaveBeenCalled();
    expect(reviewer.getAuthoringContext).not.toHaveBeenCalled();
  });

  it('[P2-S10-AC-103] fails closed when the authoring-context port is not wired', async () => {
    const { app } = harness({ omitPort: true });
    const response = await get(app);
    expect(response.status).toBe(503);
    expect(ApiErrorSchema.parse(await response.json()).code).toBe(
      'DEPENDENCY_UNAVAILABLE',
    );
  });

  it('[P2-S10-AC-103] enforces the declared read rate with the read limit', async () => {
    const { app, getAuthoringContext } = harness({
      rateLimit: async () => ({
        ok: true,
        value: { allowed: false, limit: 300, remaining: 0, resetAt: 60 },
      }),
    });
    const response = await get(app);
    expect(response.status).toBe(429);
    expect(response.headers.get('ratelimit-limit')).toBe('300');
    expect(ApiErrorSchema.parse(await response.json()).code).toBe(
      'RATE_LIMITED',
    );
    expect(getAuthoringContext).not.toHaveBeenCalled();
  });

  it('[P2-S10-AC-104] maps a dependency timeout to 504 and an invalid projection to 502', async () => {
    const timed = harness({
      port: () => new Promise<never>(() => undefined),
      deadlineMs: 10,
    });
    expect((await get(timed.app)).status).toBe(504);
    const broken = harness({
      port: async () => ({ ok: true, value: { creatableTypes: 'nope' } }),
    });
    expect((await get(broken.app)).status).toBe(502);
  });

  it('[P2-S10-AC-104] emits redacted telemetry carrying only the CMS-03B-14 operation id', async () => {
    const { app, telemetry } = harness();
    expect((await get(app)).status).toBe(200);
    const event = telemetry.mock.calls[0]?.[0] as unknown as Record<
      string,
      unknown
    >;
    expect(event.operationId).toBe('CMS-03B-14');
    expect(event.actorClass).toBe('human');
    const serialized = JSON.stringify(event);
    for (const secret of [versionId, userId, partyId, hash, 'Article'])
      expect(serialized).not.toContain(secret);
    expect(instant.length).toBeGreaterThan(0);
  });
});
