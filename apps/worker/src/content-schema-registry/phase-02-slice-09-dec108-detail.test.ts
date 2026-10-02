/**
 * CMS-03A-07 detail `activationPreparation` (BE03a resources: dry-run ref,
 * BE00 job ref, review ref, optional safe `templateCompatibility`, permitted
 * next actions). The completed contract already carries these fields; these
 * suites pin the Worker's strict parse so the DB RPC output (WP3) and the
 * Worker cannot drift apart again.
 */
import { describe, expect, it, vi } from 'vitest';

import type { WorkerBindings } from '../index';
import {
  createContentSchemaRegistryApp,
  createProductionContentSchemaRegistryDependencies,
} from './index';
import {
  CMS_ORIGIN,
  REQUEST_ID,
  TYPE_ID,
  VERSION_ID,
  detail,
  ok,
  session,
} from './phase-02-slice-09-test-values';
import {
  ACTING_CONTEXT_ID,
  REVIEWER_PERSON_ID,
  activationPreparation,
  compatibleTemplate,
  detailWithPreparation,
} from './phase-02-slice-09-dec108-test-values';
import { makeDec108Harness } from './phase-02-slice-09-dec108-test-support';

const DETAIL_PATH = `/api/v1/cms/content-types/${TYPE_ID}/versions/${VERSION_ID}`;
const detailRequest = (): Request =>
  new Request(`https://api.example.test${DETAIL_PATH}`, {
    headers: {
      origin: CMS_ORIGIN,
      authorization: 'Bearer verified-session',
      'x-request-id': REQUEST_ID,
    },
  });

const withPreparation = (preparation: Record<string, unknown>) => ({
  ...detail,
  activationPreparation: preparation,
});

const fetchDetail = async (value: unknown) => {
  const harness = makeDec108Harness({ port: ok(value) });
  const response = await harness.app.request(detailRequest());
  expect(harness.ports['getContentTypeVersion']).toHaveBeenCalledTimes(1);
  return response;
};

describe('CMS-03A-07 detail activationPreparation parse', () => {
  it('passes the complete preparation, including templateCompatibility, through unchanged', async () => {
    const response = await fetchDetail(detailWithPreparation);
    expect(response.status).toBe(200);
    const body = (await response.json()) as typeof detailWithPreparation;
    expect(body.activationPreparation).toEqual(activationPreparation);
    expect(body.activationPreparation.templateCompatibility).toEqual(
      compatibleTemplate,
    );
  });

  it('accepts a preparation with no templateCompatibility projection (optional)', async () => {
    const without: Record<string, unknown> = { ...activationPreparation };
    delete without.templateCompatibility;
    const response = await fetchDetail(withPreparation(without));
    expect(response.status).toBe(200);
  });

  it('accepts an empty preparation: no dry run, job, or review yet', async () => {
    const response = await fetchDetail(
      withPreparation({
        dryRunRef: null,
        jobRef: null,
        reviewRef: null,
        permittedNextActions: ['create_successor'],
      }),
    );
    expect(response.status).toBe(200);
  });

  it('refuses a detail without activationPreparation as 502 DEPENDENCY_INVALID_RESPONSE', async () => {
    const response = await fetchDetail(detail);
    expect(response.status).toBe(502);
    expect(((await response.json()) as { code: string }).code).toBe(
      'DEPENDENCY_INVALID_RESPONSE',
    );
  });

  it.each(['queued', 'running', 'succeeded', 'failed', 'cancelled'])(
    'accepts the BE00 JobState %s in jobRef',
    async (state) => {
      const response = await fetchDetail(
        withPreparation({
          ...activationPreparation,
          jobRef: { ...activationPreparation.jobRef, state },
        }),
      );
      expect(response.status).toBe(200);
    },
  );

  it.each(['completed', 'retrying', 'failed_retryable', 'failed_terminal'])(
    'refuses the pre-DEC-108 job vocabulary %s in jobRef',
    async (state) => {
      const response = await fetchDetail(
        withPreparation({
          ...activationPreparation,
          jobRef: { ...activationPreparation.jobRef, state },
        }),
      );
      expect(response.status).toBe(502);
    },
  );

  it.each([
    ['a readiness field', { readiness: 'ready' }],
    ['the acting-context binding id', { actingContextId: ACTING_CONTEXT_ID }],
    ['a reviewer person id', { reviewerPersonId: REVIEWER_PERSON_ID }],
    ['a per-row evidence list', { rowEvidence: [] }],
  ])(
    'refuses a preparation carrying %s as 502 (strict, no private ids)',
    async (_label, extra) => {
      const response = await fetchDetail(
        withPreparation({ ...activationPreparation, ...extra }),
      );
      expect(response.status).toBe(502);
      expect(await response.text()).not.toContain(ACTING_CONTEXT_ID);
    },
  );

  it.each([
    ['an incompatible template', { compatible: false }],
    ['a withdrawn template', { withdrawn: true }],
    [
      'extra template internals',
      { requiredCapabilities: ['cms.template_designer'] },
    ],
    ['a malformed digest', { templateDigest: 'nothex' }],
  ])('refuses templateCompatibility with %s as 502', async (_label, change) => {
    const response = await fetchDetail(
      withPreparation({
        ...activationPreparation,
        templateCompatibility: { ...compatibleTemplate, ...change },
      }),
    );
    expect(response.status).toBe(502);
  });

  it('refuses an unknown permitted next action', async () => {
    const response = await fetchDetail(
      withPreparation({
        ...activationPreparation,
        permittedNextActions: ['approve_myself'],
      }),
    );
    expect(response.status).toBe(502);
  });
});

describe('CMS-03A-07 detail through the production adapter', () => {
  const environment: WorkerBindings = {
    APP_ENVIRONMENT: 'staging',
    APP_RELEASE: 'slice-09-detail',
    SUPABASE_SECRET_KEY: 'sb_secret_slice_09_detail',
    SUPABASE_URL: 'https://supabase.example.test',
  };
  const appFor = (rpcBody: unknown) => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify(rpcBody), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const dependencies = createProductionContentSchemaRegistryDependencies({
      environment,
      fetchImpl,
      resolveSession: async () => ok(session),
      rateLimit: async () =>
        ok({
          allowed: true,
          limit: 120,
          remaining: 119,
          resetAt: 1_757_000_000,
        }),
      humanOrigins: [CMS_ORIGIN],
      releaseOrigins: ['https://release.example.test'],
    });
    return { app: createContentSchemaRegistryApp(dependencies), fetchImpl };
  };

  it('serves the RPC detail with activationPreparation through the named detail RPC', async () => {
    const { app, fetchImpl } = appFor(detailWithPreparation);
    const response = await app.request(detailRequest());
    expect(response.status).toBe(200);
    expect(new URL(String(fetchImpl.mock.calls[0]?.[0])).pathname).toMatch(
      /cms_get_content_type_version$/u,
    );
    const body = (await response.json()) as typeof detailWithPreparation;
    expect(body.activationPreparation).toEqual(activationPreparation);
  });

  it('refuses an RPC detail that lacks activationPreparation (the live DB regression) as 502', async () => {
    const { app } = appFor(detail);
    const response = await app.request(detailRequest());
    expect(response.status).toBe(502);
  });
});
