import type {
  CompositionInstanceResource,
  TaxonomyTermResource,
  TemplateVersionResource,
} from '@wejammin/contracts';
import { vi } from 'vitest';

import {
  createCmsPatternInstanceApp,
  type CmsPatternInstanceDependencies,
} from './pattern-instance-routes';
import {
  createCmsTaxonomyApp,
  type CmsTaxonomyDependencies,
} from './taxonomy-routes';
import {
  createCmsTemplateApp,
  type CmsTemplateDependencies,
} from './template-routes';
import {
  DIGEST,
  ID,
  merge,
  ORIGIN,
  rate,
  registerHeaderOrderTests,
  session,
  type Probe,
} from './write-header-order.test-support';

/**
 * BE00 lines 386-387 and BE03c 408/1502 for CMS-03C-01, -02 and -03 (the rule and its cases live
 * in `write-header-order.test-support.ts`; CMS-03C-04/-05 are in
 * `write-header-order-locale-related.test.ts`).
 */
const CREATED = '2026-09-28T04:00:00.000Z';

const meta = {
  version: '1',
  contentHash: DIGEST,
  createdAt: CREATED,
  updatedAt: CREATED,
};
const TEMPLATE: TemplateVersionResource = {
  ...meta,
  id: ID(10),
  state: 'draft',
  templateId: ID(11),
  templateKey: 'profile-header',
  templateVersion: 1,
  compatibleTypeIds: [ID(12)],
  reservedRegions: ['header', 'now', 'record', 'detail', 'provenance'],
  blockRegistryDigest: DIGEST,
};
const PLACEMENT_ROW: CompositionInstanceResource = {
  ...meta,
  id: ID(20),
  state: 'draft',
  revisionId: ID(21),
  path: '/primary/header',
  position: 0,
  blockKey: 'profile.header',
  blockVersion: 1,
  patternId: ID(22),
  patternVersion: 1,
  blockRegistryDigest: DIGEST,
  linkMode: 'linked',
  conflictState: 'none',
};
const TERM: TaxonomyTermResource = {
  ...meta,
  id: ID(32),
  lifecycle: 'active',
  taxonomyId: ID(31),
  termId: ID(32),
  termKey: 'jazz-fusion',
  parentId: null,
  successorId: null,
};

const TEMPLATE_HEADERS = {
  origin: ORIGIN,
  'content-type': 'application/json',
  'idempotency-key': 'template-create-0001',
};
const templateProbe: Probe = {
  name: 'CMS-03C-01 template version',
  badIfMatch: ['"1"', 'W/"1"'],
  send: async (headers, capability, body) => {
    const rateLimit = vi.fn(rate);
    const defineTemplate = vi.fn(async () => ({
      ok: true as const,
      value: TEMPLATE,
    }));
    const dependencies: CmsTemplateDependencies = {
      humanOrigins: [ORIGIN],
      now: () => 1_000,
      resolveSession: session(capability ? ['cms.template_designer'] : []),
      rateLimit,
      defineTemplate,
      readContext: vi.fn<CmsTemplateDependencies['readContext']>(),
      readLatest: vi.fn<CmsTemplateDependencies['readLatest']>(),
      telemetry: () => undefined,
    };
    const response = await createCmsTemplateApp(dependencies).request(
      'https://api.example.test/api/v1/cms/templates/versions',
      {
        method: 'POST',
        headers: merge(TEMPLATE_HEADERS, headers),
        body: JSON.stringify(
          body ?? {
            templateKey: 'profile-header',
            compatibleTypeIds: [ID(12)],
            slots: [
              {
                key: 'header',
                required: true,
                allowedBlocks: [
                  { blockKey: 'profile.header', blockVersion: 1 },
                ],
                maxCount: 1,
              },
            ],
            reservedRegions: TEMPLATE.reservedRegions,
            bindings: {
              title: { projection: 'profile.title', required: true },
            },
            locale: 'en-US',
            audience: 'public',
            blockRegistryDigest: DIGEST,
            expectedVersion: null,
          },
        ),
      },
    );
    return {
      response,
      rateLimit: () => rateLimit.mock.calls.length,
      port: () => defineTemplate.mock.calls.length,
    };
  },
};

const PATTERN_HEADERS = {
  origin: ORIGIN,
  'content-type': 'application/json',
  'idempotency-key': 'pattern-instance-0001',
  'if-match': '"1"',
};
const patternProbe: Probe = {
  name: 'CMS-03C-02 pattern instance',
  badIfMatch: [null, 'W/"1"', '1', '"2"'],
  send: async (headers, capability, body) => {
    const rateLimit = vi.fn(rate);
    const insertPattern = vi.fn(async () => ({
      ok: true as const,
      value: { items: [PLACEMENT_ROW] },
      etag: '"7"',
    }));
    const dependencies: CmsPatternInstanceDependencies = {
      humanOrigins: [ORIGIN],
      now: () => 1_000,
      resolveSession: session(capability ? ['cms.author'] : []),
      rateLimit,
      insertPattern,
      telemetry: () => undefined,
    };
    const response = await createCmsPatternInstanceApp(dependencies).request(
      'https://api.example.test/api/v1/cms/compositions/pattern-instances',
      {
        method: 'POST',
        headers: merge(PATTERN_HEADERS, headers),
        body: JSON.stringify(
          body ?? {
            revisionId: ID(21),
            patternId: ID(22),
            patternVersion: 1,
            linkMode: 'linked',
            slotPath: '/primary',
            overrides: {},
            expectedVersion: '1',
          },
        ),
      },
    );
    return {
      response,
      rateLimit: () => rateLimit.mock.calls.length,
      port: () => insertPattern.mock.calls.length,
    };
  },
};

const TAXONOMY_HEADERS = {
  origin: ORIGIN,
  'content-type': 'application/json',
  'idempotency-key': 'taxonomy-action-0001',
  'if-match': '"1"',
};
const taxonomyProbe: Probe = {
  name: 'CMS-03C-03 taxonomy term action',
  badIfMatch: [null, 'W/"1"', '1', '"2"'],
  send: async (headers, capability, body) => {
    const rateLimit = vi.fn(rate);
    const actTerm = vi.fn(async () => ({ ok: true as const, value: TERM }));
    const dependencies: CmsTaxonomyDependencies = {
      humanOrigins: [ORIGIN],
      now: () => 1_000,
      resolveSession: session(capability ? ['cms.taxonomy_curator'] : []),
      rateLimit,
      actTerm,
      telemetry: () => undefined,
    };
    const response = await createCmsTaxonomyApp(dependencies).request(
      `https://api.example.test/api/v1/cms/taxonomies/${ID(31)}/terms/actions`,
      {
        method: 'POST',
        headers: merge(TAXONOMY_HEADERS, headers),
        body: JSON.stringify(
          body ?? {
            taxonomyId: ID(31),
            action: 'create',
            termKey: 'jazz-fusion',
            parentId: null,
            survivorId: null,
            labels: [{ locale: 'en-US', label: 'Jazz fusion' }],
            aliases: [],
            expectedVersion: '1',
          },
        ),
      },
    );
    return {
      response,
      rateLimit: () => rateLimit.mock.calls.length,
      port: () => actTerm.mock.calls.length,
    };
  },
};

registerHeaderOrderTests([templateProbe, patternProbe, taxonomyProbe]);
