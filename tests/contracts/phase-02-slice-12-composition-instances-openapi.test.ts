import { platformRegistrySet } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  openApiOperation,
  registerAgreementTests,
  withErrors,
  type ExpectedOperation,
} from './phase-02-slice-12-openapi.test-support';

/** DEC-206: the protected read of an entry's composition instances, authorized as CMS-03C-02 (BE03c route registry, catalog and authority rows). */
const READ: ExpectedOperation = {
  id: 'cmsCompositionInstancesRead',
  marker: 'P2-S12-AC-269',
  method: 'GET',
  path: '/api/v1/cms/entries/{entryId}/compositions',
  authClass: 'editorial_author',
  capabilities: ['cms.author', 'cms.editor'],
  capabilityMode: 'any_of',
  stepUp: 'none',
  owner: 'Editorial',
  csrf: 'none',
  idempotency: 'none',
  ifMatch: 'none',
  rateClass: 'cms-composition-instances-read',
  limit: 300,
  partyLimit: 600,
  timeoutMs: 8_000,
  sloTier: 'tier_1',
  request: 'CompositionInstancesReadApiRequestSchema',
  success: 'CompositionInstancePageSchema',
  params: ['path:entryId*', 'query:cursor', 'query:limit'],
  statuses: withErrors(
    ['200'],
    ['400', '401', '403', '404', '415', '429', '500', '502', '503', '504'],
  ),
  successStatuses: ['200'],
  hasBody: false,
};

describe('Slice 12 cmsCompositionInstancesRead canonical API authority (DEC-206)', () => {
  registerAgreementTests([READ]);

  it('[P2-S12-AC-269] is the only operation on the entry compositions path and takes no body', () => {
    const paths = platformRegistrySet.routes.filter(
      ({ path }) => path === '/api/v1/cms/entries/{entryId}/compositions',
    );
    expect(paths.map(({ method }) => method)).toEqual(['GET']);
    expect(
      openApiOperation('cmsCompositionInstancesRead').requestBody,
    ).toBeUndefined();
  });

  it('[P2-S12-AC-269] answers 200 with the page, and has no conflict or validation answer', () => {
    const operation = openApiOperation('cmsCompositionInstancesRead');
    expect(
      operation.responses['200']?.content?.['application/json']?.schema,
    ).toEqual({ $ref: '#/components/schemas/CompositionInstancePage' });
    expect(operation.responses['409']).toBeUndefined();
    expect(operation.responses['422']).toBeUndefined();
  });
});
