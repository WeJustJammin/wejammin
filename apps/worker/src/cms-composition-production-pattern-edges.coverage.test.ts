import {
  CMS_SLICE_11_CONFLICT_REASONS,
  CMS_SLICE_11_FORBIDDEN_REASONS,
  CMS_SLICE_11_VALIDATION_REASONS,
  CMS_SLICE_12_OPERATION_REASONS,
  CmsSlice12ReasonCodeSchema,
} from '@wejammin/contracts';
import { parseServerEnvironment } from '@wejammin/config/environment';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createProductionCmsPatternDefinitionDependencies } from './cms-composition-production-pattern-definition';
import {} from './cms-composition-production-pattern-definition-latest';
import { placementRpcError } from './cms-composition-production-pattern-errors';
import { patternUpdateRpcFailure } from './cms-composition-production-pattern-update-failure';
import { governedRpcError } from './cms-composition-production-governed-review-errors';
import { authenticationSession } from './cms-editorial-production-session-test-support';
import type { WorkerBindings } from './index';
import {
  designerSession,
  expectError,
  jsonReply,
  ORIGIN,
  patternBody,
  patternDetail,
  patternHarness,
  PATTERN_KEY,
  readRequest,
  REQUEST_ID,
  writeRequest,
} from './cms-composition/pattern-definition.test-support';
import { puSession } from './cms-composition/pattern-update-routes.test-support';
import {
  PU_REQUEST_ID,
  PU_SELECTOR_PATH,
  PU_TYPE_ID,
  puId,
  selectorPage,
} from './cms-composition/pattern-update.test-support';
import { createPupHarness } from './cms-composition-production-pattern-update.test-support';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const environment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'slice-12-pattern-coverage',
  SUPABASE_SECRET_KEY: 'sb_secret_synthetic_pattern_coverage',
  SUPABASE_URL: 'https://supabase.example.test',
};

/** Reasons the 03b editorial table owns: valid P0001 tokens that carry a `reasonCode` but are no Slice 12 reason. */
const FOREIGN_REASONS: readonly string[] = [
  ...CMS_SLICE_11_FORBIDDEN_REASONS,
  ...CMS_SLICE_11_CONFLICT_REASONS,
  ...CMS_SLICE_11_VALIDATION_REASONS,
].filter((reason) => !CmsSlice12ReasonCodeSchema.safeParse(reason).success);

describe('a reason of another editorial domain never crosses an operation boundary', () => {
  it('has foreign reasons to try', () => {
    expect(FOREIGN_REASONS.length).toBeGreaterThan(0);
  });

  it.each(FOREIGN_REASONS)(
    'CMS-03C-12 and the latest read scrub %s to 500',
    async (reason) => {
      for (const send of [
        (h: ReturnType<typeof patternHarness>) => h.send(writeRequest()),
        (h: ReturnType<typeof patternHarness>) => h.send(readRequest()),
      ]) {
        const harness = patternHarness({
          reply: () => jsonReply({ code: 'P0001', message: reason }, 400),
        });
        await expectError(await send(harness), 500, 'INTERNAL_ERROR');
      }
    },
  );

  it.each(FOREIGN_REASONS)('CMS-03C-02 scrubs %s to 500', (reason) => {
    expect(
      placementRpcError(400, { code: 'P0001', message: reason }),
    ).toMatchObject({ ok: false, status: 500 });
  });

  it.each(FOREIGN_REASONS)('governed reviews scrub %s to 500', (reason) => {
    expect(
      governedRpcError('CMS-03C-06', 400, { code: 'P0001', message: reason }),
    ).toMatchObject({ ok: false, status: 500 });
  });
});

describe('CMS-03C-02 placement refusals', () => {
  it.each([
    ['structured INTERNAL_ERROR', { code: 'INTERNAL_ERROR' }],
    ['P0001 INTERNAL_ERROR', { code: 'P0001', message: 'INTERNAL_ERROR' }],
  ])('scrubs %s to 500', (_n, payload) => {
    expect(placementRpcError(400, payload)).toMatchObject({
      ok: false,
      status: 500,
    });
  });

  it('scrubs a Slice 12 reason that CMS-03C-02 does not publish to 500', () => {
    const unpublished = CmsSlice12ReasonCodeSchema.options.filter(
      (reason) =>
        !(
          CMS_SLICE_12_OPERATION_REASONS['CMS-03C-02'] as readonly string[]
        ).includes(reason) &&
        reason !== 'pattern_depth_exceeded' &&
        reason !== 'pattern_nodes_exceeded',
    );
    expect(unpublished.length).toBeGreaterThan(0);
    for (const reason of unpublished)
      expect(
        placementRpcError(422, { code: 'P0001', message: reason }),
      ).toMatchObject({ ok: false, status: 500 });
  });
});

describe('linked-update refusal tokens', () => {
  it('reads a structured token without a message', () => {
    expect(
      patternUpdateRpcFailure('CMS-03C-13', 404, { code: 'NOT_FOUND' }),
    ).toMatchObject({ ok: false, status: 404 });
  });

  it('scrubs a platform raise that names no message to 500', () => {
    expect(
      patternUpdateRpcFailure('CMS-03C-15', 400, { code: 'P0001' }),
    ).toMatchObject({ ok: false, status: 500 });
  });
});

describe('pattern definition composition', () => {
  const create = (overrides: Record<string, unknown> = {}) =>
    createProductionCmsPatternDefinitionDependencies({
      environment: parseServerEnvironment(environment),
      fetchImpl: vi.fn() as never,
      humanOrigins: [ORIGIN],
      ...overrides,
    });

  it.each([
    ['a zero deadline', { deadlineMs: 0 }],
    ['a fractional deadline', { deadlineMs: 1.5 }],
    ['a deadline above the 15 second route deadline', { deadlineMs: 15_001 }],
    ['a zero response budget', { maxResponseBytes: 0 }],
    ['a fractional response budget', { maxResponseBytes: 10.5 }],
  ])('refuses %s at composition', (_n, overrides) => {
    expect(() => create(overrides)).toThrow(
      'Invalid CMS pattern definition production configuration.',
    );
  });

  it('uses the runtime fetch when none is injected', async () => {
    const runtimeFetch = vi.fn<typeof fetch>(async () =>
      Response.json(patternDetail()),
    );
    vi.stubGlobal('fetch', runtimeFetch);
    const request = readRequest();
    const dependencies = createProductionCmsPatternDefinitionDependencies({
      environment: parseServerEnvironment(environment),
      humanOrigins: [ORIGIN],
      now: () => 1_000,
      auth: {
        resolveSession: async () => ({
          ok: true as const,
          value: authenticationSession({
            authUserId: designerSession.userId,
            actingPartyId: designerSession.actingPartyId,
            stepUpAt: null,
          }),
        }),
      },
      resolveCapabilities: designerSession.capabilities,
    });
    const signal = new AbortController().signal;
    const session = await dependencies.resolveSession(request, signal);
    if (!session.ok) throw new Error('The session fixture must resolve.');
    const result = await dependencies.readLatest(
      {
        operationId: 'cmsPatternLatestRead',
        request,
        requestId: REQUEST_ID,
        session: session.value,
        patternKey: PATTERN_KEY,
      },
      signal,
    );
    expect(result.ok).toBe(true);
    expect(String(runtimeFetch.mock.calls[0]?.[0])).toBe(
      'https://supabase.example.test/rest/v1/rpc/cms_pattern_latest',
    );
  });

  it('refuses a definition input of another operation or an invalid body with 400 and no call', async () => {
    const harness = patternHarness();
    const request = writeRequest();
    const signal = new AbortController().signal;
    const session = await harness.dependencies.resolveSession(request, signal);
    if (!session.ok) throw new Error('The session fixture must resolve.');
    const base = {
      request,
      requestId: REQUEST_ID,
      session: session.value,
      idempotencyKey: 'pattern-definition-0001',
      ifMatch: null,
    };
    expect(
      await harness.dependencies.definePattern(
        {
          ...base,
          operationId: 'cmsPatternLatestRead',
          body: patternBody(),
        } as never,
        signal,
      ),
    ).toMatchObject({ ok: false, status: 400 });
    expect(
      await harness.dependencies.definePattern(
        {
          ...base,
          operationId: 'CMS-03C-12',
          body: { ...patternBody(), patternKey: 'Invalid_Key' },
        },
        signal,
      ),
    ).toMatchObject({ ok: false, status: 400 });
    expect(
      await harness.dependencies.readLatest(
        {
          ...base,
          operationId: 'cmsPatternLatestRead',
          patternKey: 'Invalid_Key',
        },
        signal,
      ),
    ).toMatchObject({ ok: false, status: 400 });
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });
});

describe('linked-update production composition', () => {
  it('uses the runtime fetch when none is injected', async () => {
    const runtimeFetch = vi.fn<typeof fetch>(async () =>
      Response.json(selectorPage()),
    );
    vi.stubGlobal('fetch', runtimeFetch);
    const harness = createPupHarness(undefined as never);
    const response = await harness.request(
      `${PU_SELECTOR_PATH}?contentTypeId=${PU_TYPE_ID}`,
    );
    expect(response.status).toBe(200);
    expect(runtimeFetch).toHaveBeenCalledTimes(1);
    expect(String(runtimeFetch.mock.calls[0]?.[0])).toBe(
      'https://supabase.example.test/rest/v1/rpc/cms_list_pattern_selector',
    );
  });

  it('refuses a composition-instances read of another operation or an invalid entry with 400 and no call', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const harness = createPupHarness(fetchImpl);
    const request = new Request(`https://api.example.test${PU_SELECTOR_PATH}`);
    const base = {
      request,
      requestId: PU_REQUEST_ID,
      session: puSession(),
      limit: 25,
    };
    const signal = new AbortController().signal;
    expect(
      await harness.dependencies.readInstances(
        { ...base, operationId: 'CMS-03C-13', entryId: puId(9) } as never,
        signal,
      ),
    ).toMatchObject({ ok: false, status: 400 });
    expect(
      await harness.dependencies.readInstances(
        {
          ...base,
          operationId: 'cmsCompositionInstancesRead',
          entryId: 'not-a-uuid',
        },
        signal,
      ),
    ).toMatchObject({ ok: false, status: 400 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
