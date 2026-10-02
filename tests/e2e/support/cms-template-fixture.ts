import type {
  TemplateDesignerContext,
  TemplateVersionDetail,
  TemplateVersionResource,
} from '@wejammin/contracts';

import type {
  CmsTemplateDependencies,
  CmsTemplateResult,
} from '../../../apps/worker/src/cms-composition/template-routes';

const USER_ID = '10000000-0000-4000-8000-000000000001';
const TYPE_ID = '30000000-0000-4000-8000-000000000003';
const TEMPLATE_KEY = 'release-note';
const HASH = 'a'.repeat(64);
const INSTANT = '2026-09-27T12:00:00.000Z';

const context: TemplateDesignerContext = {
  contentTypes: [
    {
      id: TYPE_ID,
      typeKey: 'release_note',
      activeVersionId: '40000000-0000-4000-8000-000000000004',
      activeVersion: 1,
      sourceLocale: 'en-US',
    },
  ],
  registeredBlocks: [{ blockKey: 'hero.banner', blockVersion: 1 }],
};

const first: TemplateVersionDetail = {
  id: '40000000-0000-4000-8000-000000000001',
  version: '1',
  contentHash: HASH,
  createdAt: INSTANT,
  updatedAt: INSTANT,
  state: 'draft',
  templateKey: TEMPLATE_KEY,
  templateVersion: 1,
  compatibleTypeIds: [TYPE_ID],
  reservedRegions: ['header', 'now', 'record', 'detail', 'provenance'],
  blockRegistryDigest: HASH,
  slots: [],
  bindings: {},
  locale: 'en-US',
  audience: 'public',
};

const ok = <T>(value: T): CmsTemplateResult<T> => ({ ok: true, value });
const denied = (): CmsTemplateResult<never> => ({
  ok: false,
  status: 401,
  code: 'UNAUTHENTICATED',
  message: 'The authentication session is invalid.',
});

/**
 * Test-owned in-memory persistence for the real Astro/Worker route exercise.
 * It deliberately does not claim Supabase RPC, RLS, or hosted acceptance.
 */
export const createCmsTemplateFixture = (
  hasValidSession: (request: Request) => Promise<boolean>,
): CmsTemplateDependencies => {
  let latest = first;
  return {
    humanOrigins: ['http://127.0.0.1:4324'],
    now: Date.now,
    resolveSession: async (request) =>
      (await hasValidSession(request))
        ? ok({
            userId: USER_ID,
            actingPartyId: '20000000-0000-4000-8000-000000000002',
            capabilities: ['cms.template_designer'],
            mfaFresh: false,
          })
        : denied(),
    rateLimit: async (input) =>
      ok({
        allowed: true,
        limit: input.limit,
        remaining: input.limit - 1,
        resetAt: 2_000_000_000,
      }),
    readContext: async () => ok(context),
    readLatest: async (input) =>
      input.templateKey === TEMPLATE_KEY
        ? ok(latest)
        : {
            ok: false,
            status: 404,
            code: 'NOT_FOUND',
            message: 'Template not found.',
          },
    defineTemplate: async (input) => {
      if (input.body.templateKey !== TEMPLATE_KEY)
        return {
          ok: false,
          status: 404,
          code: 'NOT_FOUND',
          message: 'Template not found.',
        };
      if (
        input.ifMatch !== latest.version ||
        input.body.expectedVersion !== latest.version
      )
        return {
          ok: false,
          status: 409,
          code: 'CONFLICT',
          message: 'Template version changed.',
          details: {
            expectedVersion: input.ifMatch ?? '1',
            currentVersion: latest.version,
          },
        };
      const nextVersion = latest.templateVersion + 1;
      const version = String(nextVersion);
      const resource: TemplateVersionResource = {
        id: `40000000-0000-4000-8000-${version.padStart(12, '0')}`,
        version,
        contentHash: HASH,
        createdAt: INSTANT,
        updatedAt: INSTANT,
        state: 'draft',
        templateKey: TEMPLATE_KEY,
        templateVersion: nextVersion,
        compatibleTypeIds: input.body.compatibleTypeIds,
        reservedRegions: input.body.reservedRegions,
        blockRegistryDigest: HASH,
      };
      latest = {
        ...resource,
        slots: input.body.slots,
        bindings: input.body.bindings,
        locale: input.body.locale,
        audience: input.body.audience,
      };
      return ok(resource);
    },
    telemetry: () => undefined,
  };
};
