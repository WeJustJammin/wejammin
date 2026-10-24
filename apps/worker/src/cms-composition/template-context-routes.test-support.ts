import { vi } from 'vitest';

import {
  createCmsTemplateApp,
  type CmsTemplateDependencies,
} from './template-routes';

export const context = {
  contentTypes: [
    {
      id: '30000000-0000-4000-8000-000000000003',
      typeKey: 'profile',
      activeVersionId: '40000000-0000-4000-8000-000000000004',
      activeVersion: 1,
      sourceLocale: 'en-US',
    },
  ],
  registeredBlocks: [{ blockKey: 'profile.header', blockVersion: 1 }],
};
export const session = {
  userId: '10000000-0000-4000-8000-000000000001',
  actingPartyId: '20000000-0000-4000-8000-000000000002',
  capabilities: ['cms.template_designer'],
  mfaFresh: false,
};

export const harness = (overrides: Partial<CmsTemplateDependencies> = {}) => {
  const readContext = vi.fn(async () => ({
    ok: true as const,
    value: context,
  }));
  const dependencies = {
    humanOrigins: ['https://app.example.test'],
    now: () => 0,
    resolveSession: async () => ({ ok: true as const, value: session }),
    rateLimit: async (input: { limit: number }) => ({
      ok: true as const,
      value: {
        allowed: true,
        limit: input.limit,
        remaining: input.limit - 1,
        resetAt: 60000,
      },
    }),
    readContext,
    defineTemplate: async () => ({ ok: true as const, value: {} as never }),
    telemetry: () => undefined,
    ...overrides,
  } as CmsTemplateDependencies;
  return { app: createCmsTemplateApp(dependencies), readContext };
};
