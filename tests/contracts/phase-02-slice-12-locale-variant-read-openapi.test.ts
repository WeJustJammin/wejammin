import { platformRegistrySet } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  openApiOperation,
  registerAgreementTests,
  withErrors,
  type ExpectedOperation,
} from './phase-02-slice-12-openapi.test-support';

/** DEC-205: the protected read of one locale variant, authorized as CMS-03C-04 (BE03c route registry, catalog and authority rows). */
const READ: ExpectedOperation = {
  id: 'cmsLocaleVariantRead',
  marker: 'P2-S12-AC-057',
  method: 'GET',
  path: '/api/v1/cms/entries/{entryId}/locales/{locale}',
  authClass: 'editorial_author',
  capabilities: ['cms.author', 'cms.editor'],
  capabilityMode: 'any_of',
  stepUp: 'none',
  owner: 'Editorial',
  csrf: 'none',
  idempotency: 'none',
  ifMatch: 'none',
  rateClass: 'cms-locale-read',
  limit: 300,
  partyLimit: 600,
  timeoutMs: 8_000,
  sloTier: 'tier_1',
  request: 'LocaleVariantReadApiRequestSchema',
  success: 'LocaleVariantReadSchema',
  params: ['path:entryId*', 'path:locale*'],
  statuses: withErrors(
    ['200'],
    ['400', '401', '403', '404', '415', '429', '500', '502', '503', '504'],
  ),
  successStatuses: ['200'],
  hasBody: false,
};

describe('Slice 12 cmsLocaleVariantRead canonical API authority (DEC-205)', () => {
  registerAgreementTests([READ]);

  it('[P2-S12-AC-057] sits beside the CMS-03C-04 write and adds no other mutation', () => {
    const locale = platformRegistrySet.routes.filter(({ path }) =>
      path.startsWith('/api/v1/cms/entries/{entryId}/locales/{locale}'),
    );
    expect(
      locale.map(({ method, path }) => `${method} ${path}`).sort(),
    ).toEqual([
      'GET /api/v1/cms/entries/{entryId}/locales/{locale}',
      'POST /api/v1/cms/entries/{entryId}/locales/{locale}/variants',
    ]);
    expect(
      openApiOperation('cmsLocaleVariantRead').requestBody,
    ).toBeUndefined();
  });

  it('[P2-S12-AC-057] answers 200 with the read, never the bare resource, and has no conflict or validation answer', () => {
    const operation = openApiOperation('cmsLocaleVariantRead');
    expect(
      operation.responses['200']?.content?.['application/json']?.schema,
    ).toEqual({ $ref: '#/components/schemas/LocaleVariantRead' });
    expect(operation.responses['409']).toBeUndefined();
    expect(operation.responses['422']).toBeUndefined();
  });
});
