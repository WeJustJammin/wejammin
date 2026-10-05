import type {
  TemplateVersionRequest,
  TemplateVersionResource,
} from '@wejammin/contracts';

import { createProductionCmsTemplateDependencies } from './cms-composition-production';
import type { CmsTemplatePortInput } from './cms-composition/template-routes';
import {
  environment,
  json,
  PARTY_ID,
  REQUEST_ID,
  USER_ID,
} from './cms-editorial-production.test-support';

/** Shared fixtures for the CMS-03C-01 production template adapter tests. */
export const TYPE_ID = '30000000-0000-4000-8000-000000000003';
export const TEMPLATE_ID = '40000000-0000-4000-8000-000000000004';
export const DIGEST = 'a'.repeat(64);

export { environment, PARTY_ID, REQUEST_ID, USER_ID };
export { json };

export const BODY: TemplateVersionRequest = {
  templateKey: 'profile-header',
  compatibleTypeIds: [TYPE_ID],
  slots: [
    {
      key: 'header',
      required: true,
      allowedBlocks: [{ blockKey: 'profile.header', blockVersion: 1 }],
      maxCount: 1,
    },
  ],
  reservedRegions: ['header', 'now', 'record', 'detail', 'provenance'],
  bindings: { title: { projection: 'profile.title', required: true } },
  locale: 'en-US',
  audience: 'public',
  blockRegistryDigest: DIGEST,
  expectedVersion: null,
};

export const RESOURCE: TemplateVersionResource = {
  id: TEMPLATE_ID,
  version: '1',
  contentHash: DIGEST,
  createdAt: '2026-09-27T12:00:00Z',
  updatedAt: '2026-09-27T12:00:00Z',
  state: 'draft',
  templateKey: BODY.templateKey,
  templateVersion: 1,
  compatibleTypeIds: [TYPE_ID],
  reservedRegions: BODY.reservedRegions,
  blockRegistryDigest: DIGEST,
};

export const request = (): Request =>
  new Request('https://api.example.test/api/v1/cms/templates/versions', {
    headers: { 'x-correlation-id': REQUEST_ID },
  });

export const input = (
  overrides: Partial<CmsTemplatePortInput> = {},
): CmsTemplatePortInput => ({
  operationId: 'CMS-03C-01',
  request: request(),
  requestId: REQUEST_ID,
  session: {
    userId: USER_ID,
    actingPartyId: PARTY_ID,
    capabilities: ['cms.template_designer'],
    mfaFresh: false,
  },
  body: BODY,
  idempotencyKey: 'template-create-0001',
  ifMatch: null,
  ...overrides,
});

export const compose = (fetchImpl: typeof fetch) =>
  createProductionCmsTemplateDependencies({
    environment,
    fetchImpl,
    humanOrigins: ['https://cms.example.test'],
    resolveSession: async () => ({ ok: true, value: input().session }),
  });
