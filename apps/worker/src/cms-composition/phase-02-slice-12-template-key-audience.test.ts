import { describe, expect, it, vi } from 'vitest';

import {
  createCmsTemplateApp,
  type CmsTemplateDependencies,
} from './template-routes';

/**
 * [P2-S12-AC-005] [P2-S12-AC-022] [P2-S12-AC-025] [P2-S12-AC-189] [P2-S12-AC-192]
 * The route refuses a reserved template key and an audience outside ^[a-z0-9_-]{1,48}$ with the
 * 422 TEMPLATE_VALIDATION_FAILED of the BE03c catalog: a bounded JSON-pointer violation, and the
 * typed `details.reasonCode` key_reserved for the reserved key (E13); the database may also name it.
 */
const origin = 'https://cms-console.example.test';
const ID = (n: number) =>
  `d1200000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const body = {
  templateKey: 'profile-header',
  compatibleTypeIds: [ID(3)],
  slots: [],
  reservedRegions: ['header', 'now', 'record', 'detail', 'provenance'],
  bindings: {},
  locale: 'en-US',
  audience: 'public',
  expectedVersion: null,
};

const harness = (overrides: Partial<CmsTemplateDependencies> = {}) => {
  const defineTemplate = vi.fn(async () => ({
    ok: false as const,
    status: 500 as const,
    code: 'UNREACHED',
    message: 'port must not be reached',
  }));
  const dependencies = {
    humanOrigins: [origin],
    now: () => 1_000,
    resolveSession: async () => ({
      ok: true as const,
      value: {
        userId: ID(1),
        actingPartyId: ID(2),
        capabilities: ['cms.template_designer'],
        mfaFresh: false,
      },
    }),
    rateLimit: async (input: { limit: number }) => ({
      ok: true as const,
      value: {
        allowed: true,
        limit: input.limit,
        remaining: input.limit - 1,
        resetAt: 2_000,
      },
    }),
    defineTemplate,
    telemetry: () => undefined,
    ...overrides,
  } as unknown as CmsTemplateDependencies;
  return { app: createCmsTemplateApp(dependencies), defineTemplate };
};

const post = (app: ReturnType<typeof createCmsTemplateApp>, value: unknown) =>
  Promise.resolve(
    app.request('/api/v1/cms/templates/versions', {
      method: 'POST',
      headers: {
        origin,
        'content-type': 'application/json',
        'idempotency-key': 'template-key-audience-0001',
        'x-request-id': ID(900),
      },
      body: JSON.stringify(value),
    }),
  );

const violation = (path: string, code: string) => ({
  path,
  code,
  message: 'The value is invalid.',
});

describe('E13 reserved template keys at the route', () => {
  it.each(['context', 'versions', 'new'])(
    'refuses the reserved key %s with 422, key_reserved and a /templateKey pointer, before the port',
    async (templateKey) => {
      const { app, defineTemplate } = harness();
      const response = await post(app, { ...body, templateKey });
      expect(response.status).toBe(422);
      expect(await response.json()).toEqual({
        code: 'TEMPLATE_VALIDATION_FAILED',
        message:
          'TEMPLATE_VALIDATION_FAILED: template operation rejected or unavailable.',
        requestId: ID(900),
        details: {
          reasonCode: 'key_reserved',
          violations: [violation('/templateKey', 'key_reserved')],
        },
      });
      expect(defineTemplate).not.toHaveBeenCalled();
    },
  );

  it('accepts a key that merely contains a reserved word', async () => {
    const { app, defineTemplate } = harness();
    const response = await post(app, { ...body, templateKey: 'context-card' });
    expect(response.status).not.toBe(422);
    expect(defineTemplate).toHaveBeenCalledTimes(1);
  });

  it('relays the typed reason a port names, and drops one it does not register', async () => {
    const named = harness({
      defineTemplate: async () => ({
        ok: false,
        status: 422,
        code: 'VALIDATION_FAILED',
        message: 'private',
        details: {
          reasonCode: 'key_reserved',
          violations: [{ path: '/templateKey', code: 'key_reserved' }],
        },
      }),
    });
    const relayed = await post(named.app, body);
    expect(relayed.status).toBe(422);
    expect(((await relayed.json()) as { details: unknown }).details).toEqual({
      reasonCode: 'key_reserved',
      violations: [violation('/templateKey', 'key_reserved')],
    });
    const foreign = harness({
      defineTemplate: async () => ({
        ok: false,
        status: 422,
        code: 'VALIDATION_FAILED',
        message: 'private',
        details: {
          reasonCode: 'owner_row_exists',
          violations: [{ path: '/templateKey', code: 'invalid' }],
        },
      }),
    });
    const dropped = await post(foreign.app, body);
    expect(((await dropped.json()) as { details: unknown }).details).toEqual({
      violations: [violation('/templateKey', 'invalid')],
    });
  });
});

describe('E4 audience grammar at the route', () => {
  it.each([
    ['Public', 'Public'],
    ['a leading space', ' public'],
    ['a trailing space', 'public '],
    ['49 characters', 'a'.repeat(49)],
    ['an inner space', 'a b'],
    ['a trailing newline', 'public\n'],
    ['a dot', 'pub.lic'],
    ['an empty string', ''],
  ])(
    'refuses an audience of %s with 422 at /audience, before the port',
    async (_label, audience) => {
      const { app, defineTemplate } = harness();
      const response = await post(app, { ...body, audience });
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({
        code: 'TEMPLATE_VALIDATION_FAILED',
        details: { violations: [violation('/audience', 'audience_invalid')] },
      });
      expect(defineTemplate).not.toHaveBeenCalled();
    },
  );

  it.each(['public', 'members_only', 'a-b_c9', 'a'.repeat(48), 'a'])(
    'accepts the conforming audience %s as submitted',
    async (audience) => {
      const { app, defineTemplate } = harness();
      await post(app, { ...body, audience });
      expect(defineTemplate).toHaveBeenCalledTimes(1);
      expect(defineTemplate.mock.calls[0]).toBeDefined();
    },
  );

  it('relays a database refusal at /audience as one bounded violation', async () => {
    const { app } = harness({
      defineTemplate: async () => ({
        ok: false,
        status: 422,
        code: 'VALIDATION_FAILED',
        message: 'private',
        details: { violations: [{ path: '/audience', code: 'invalid' }] },
      }),
    });
    const response = await post(app, body);
    expect(response.status).toBe(422);
    expect(((await response.json()) as { details: unknown }).details).toEqual({
      violations: [violation('/audience', 'invalid')],
    });
  });
});
