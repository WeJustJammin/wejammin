import { describe, expect, it, vi } from 'vitest';

import {
  createCmsTemplateApp,
  type CmsTemplateDependencies,
} from './template-routes';

/**
 * [P2-S12-AC-001] "accessibility contracts in templates". The CMS-03C-01 route refuses a definition that
 * carries an accessibility member (or any other unknown member) on the definition, a slot, an allowed
 * block reference or a binding: 422 TEMPLATE_VALIDATION_FAILED, a violation at the JSON pointer of the
 * member itself, and the port is never reached. A template therefore cannot state or override
 * a block's accessibility contract; it references exact immutable block versions only.
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

const slot = {
  key: 'header',
  required: true,
  allowedBlocks: [{ blockKey: 'profile.header', blockVersion: 1 }],
  maxCount: 1,
};
const withBlocks = { ...body, slots: [slot] };

const placements = [
  [
    'the definition',
    '/accessibility',
    { ...withBlocks, accessibility: { role: 'region' } },
  ],
  [
    'a slot',
    '/slots/0/accessibility',
    { ...withBlocks, slots: [{ ...slot, accessibility: { role: 'region' } }] },
  ],
  [
    'an allowed block reference',
    '/slots/0/allowedBlocks/0/accessibility',
    {
      ...withBlocks,
      slots: [
        {
          ...slot,
          allowedBlocks: [
            { ...slot.allowedBlocks[0], accessibility: { role: 'region' } },
          ],
        },
      ],
    },
  ],
  [
    'a binding',
    '/bindings/title/accessibility',
    {
      ...withBlocks,
      bindings: {
        title: {
          projection: 'profile.title',
          required: true,
          accessibility: { role: 'region' },
        },
      },
    },
  ],
] as const;

describe('CMS-03C-01 refuses an accessibility member in a template definition', () => {
  it('[P2-S12-AC-001] accepts the same definition without it, so the refusal below is the member (control)', async () => {
    const { app, defineTemplate } = harness();
    const response = await post(app, withBlocks);
    expect(response.status).not.toBe(422);
    expect(defineTemplate).toHaveBeenCalledTimes(1);
  });

  it.each(placements)(
    '[P2-S12-AC-001] %s: 422 TEMPLATE_VALIDATION_FAILED at its pointer, before the port',
    async (_where, pointer, value) => {
      const { app, defineTemplate } = harness();
      const response = await post(app, value);
      expect(response.status).toBe(422);
      const json = (await response.json()) as {
        code: string;
        details: { violations: Array<{ path: string; code: string }> };
      };
      expect(json.code).toBe('TEMPLATE_VALIDATION_FAILED');
      expect(json.details.violations.map(({ path }) => path)).toEqual([
        pointer,
      ]);
      expect(json.details.violations[0]?.code).toBe('invalid');
      expect(defineTemplate).not.toHaveBeenCalled();
    },
  );
});
