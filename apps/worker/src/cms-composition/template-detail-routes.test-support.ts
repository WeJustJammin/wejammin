import { Hono } from 'hono';
import { vi } from 'vitest';
import type { TemplateVersionDetail } from '@wejammin/contracts';

import type { CmsTemplateDependencies } from './template-routes';
import { registerCmsTemplateDetailRoutes } from './template-detail-routes';

export const path = '/api/v1/cms/templates/profile-header';
export const session = {
  userId: '10000000-0000-4000-8000-000000000001',
  actingPartyId: '20000000-0000-4000-8000-000000000002',
  capabilities: ['cms.template_designer'],
  mfaFresh: false,
};
export const detail: TemplateVersionDetail = {
  id: '30000000-0000-4000-8000-000000000003',
  version: '2',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-09-27T12:00:00Z',
  updatedAt: '2026-09-27T12:00:00Z',
  state: 'draft',
  templateId: '90000000-0000-4000-8000-000000000009',
  templateKey: 'profile-header',
  templateVersion: 2,
  compatibleTypeIds: ['40000000-0000-4000-8000-000000000004'],
  reservedRegions: ['header', 'now', 'record', 'detail', 'provenance'],
  blockRegistryDigest: 'b'.repeat(64),
  slots: [],
  bindings: {},
  locale: 'en-US',
  audience: 'public',
};

export const harness = (overrides: Partial<CmsTemplateDependencies> = {}) => {
  const readLatest = vi.fn(async () => ({ ok: true as const, value: detail }));
  const resolveSession = vi.fn(async () => ({
    ok: true as const,
    value: session,
  }));
  const dependencies = {
    humanOrigins: ['https://app.example.test'],
    now: () => 0,
    resolveSession,
    rateLimit: async (input: { limit: number }) => ({
      ok: true as const,
      value: {
        allowed: true,
        limit: input.limit,
        remaining: input.limit - 1,
        resetAt: 60000,
      },
    }),
    defineTemplate: async () => ({ ok: true as const, value: {} as never }),
    readContext: async () => ({
      ok: true as const,
      value: { contentTypes: [], registeredBlocks: [] },
    }),
    readLatest,
    telemetry: () => undefined,
    ...overrides,
  } as CmsTemplateDependencies;
  const app = new Hono();
  registerCmsTemplateDetailRoutes(app, dependencies);
  return { app, readLatest, resolveSession };
};
