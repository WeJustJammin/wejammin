/**
 * Class sweep (AC064, AC060): the request the production Worker adapter puts on the
 * wire for every contract-valid CMS human operation is a request the database
 * function accepts at its first gate.
 *
 * Each platform_private CMS function opens with
 * `cms_exact_keys(p_request, required, allowed)`: a member outside `allowed`, or a
 * missing `required` member, is INVALID_REQUEST before anything else is read. The
 * Worker tests fake the RPC, so a Worker that sent a differently shaped body (CMS-03A-02
 * sent the field definition flat while the function takes it as one `field` member)
 * passed every test and failed every real request. Here the real production app
 * handles a contract-valid request for each operation, the members it sent are
 * recorded at the fetch boundary, and they are compared with the required and allowed
 * lists read from the live function source, so a new or changed shape on either side
 * fails this file. The database's answer to the request is not asserted (the fixture
 * ids name nothing); only the shape is.
 *
 * Release operations (CMS-03A-05, CMS-03A-08) take a signed principal and are not
 * human routes; their wire shape is exercised by worker-round-trip.apispec.ts.
 */
import { randomUUID } from 'node:crypto';

import { beforeAll, describe, expect, it } from 'vitest';

import { EVIDENCE_OPS } from '../../apps/worker/src/content-schema-registry/phase-02-slice-09-be03a-evidence-support';
import { CMS_SCHEMA_REGISTRY_RPC } from '../../apps/worker/src/content-schema-registry/production';
import {
  type CmsApp,
  createCmsApp,
  draftTypeBody,
  ownerSession,
} from './support/cms-app';
import { type CmsOwner, ensureCmsOwner, psql } from './support/stack';

type Probe = Readonly<{
  operationId: string;
  rpc: string;
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
  ifMatch?: string;
}>;

const TYPE_ID = randomUUID();
const VERSION_ID = randomUUID();
const VERSIONS = `/api/v1/cms/content-types/${TYPE_ID}/versions/${VERSION_ID}`;

const CAPABILITIES = [
  'cms.schema_designer',
  'cms.schema_registry.read',
  'cms.schema_review',
  'cms.schema_review.assign',
] as const;

const originalOperations: readonly Probe[] = [
  {
    operationId: 'CMS-03A-01',
    rpc: CMS_SCHEMA_REGISTRY_RPC.createTypeDraft,
    method: 'POST',
    path: '/api/v1/cms/content-types',
    body: draftTypeBody('shape_probe'),
  },
  {
    operationId: 'CMS-03A-02',
    rpc: CMS_SCHEMA_REGISTRY_RPC.addFieldDefinition,
    method: 'POST',
    path: `${VERSIONS}/fields`,
    ifMatch: '1',
    body: {
      key: 'subtitle',
      kind: 'short_text',
      constraints: {},
      required: false,
      validatorKey: null,
      validatorVersion: null,
      defaultMode: 'literal',
      defaultValue: null,
      localizationMode: 'none',
      editorConfig: { label: 'Subtitle', order: 2 },
      lifecycle: 'active',
      migrationPlanId: null,
    },
  },
  {
    operationId: 'CMS-03A-03',
    rpc: CMS_SCHEMA_REGISTRY_RPC.bindRelation,
    method: 'POST',
    path: `${VERSIONS}/relations`,
    ifMatch: '1',
    body: {
      fieldId: randomUUID(),
      targetKind: 'domain',
      targetType: 'profile',
      projectionKey: 'profile.summary',
      cardinality: 'many',
      min: 0,
      max: 3,
      ordered: false,
      onUnavailable: 'placeholder',
    },
  },
  {
    operationId: 'CMS-03A-04',
    rpc: CMS_SCHEMA_REGISTRY_RPC.activateSchema,
    method: 'POST',
    path: `${VERSIONS}/activate`,
    ifMatch: '1',
    body: {
      expectedVersion: '1',
      dryRunId: randomUUID(),
      approvalIds: [randomUUID()],
      migrationPlanId: null,
    },
  },
  {
    operationId: 'CMS-03A-06',
    rpc: CMS_SCHEMA_REGISTRY_RPC.listContentTypes,
    method: 'GET',
    path: '/api/v1/cms/content-types',
  },
  {
    operationId: 'CMS-03A-07',
    rpc: CMS_SCHEMA_REGISTRY_RPC.getContentTypeVersion,
    method: 'GET',
    path: VERSIONS,
  },
];

const amendmentOperations: readonly Probe[] = EVIDENCE_OPS.map((op) => ({
  operationId: op.operationId,
  rpc: CMS_SCHEMA_REGISTRY_RPC[
    op.portName as keyof typeof CMS_SCHEMA_REGISTRY_RPC
  ],
  method: op.method,
  path: op.path,
  ...(op.body === undefined ? {} : { body: op.body }),
  ...(op.ifMatch ? { ifMatch: '1' } : {}),
}));

const PROBES: readonly Probe[] = [
  ...originalOperations,
  ...amendmentOperations,
];

const names = (list: string): readonly string[] =>
  [...list.matchAll(/'([A-Za-z]+)'/gu)].map((match) => match[1] ?? '');

/** `required` and `allowed` of the function's first `cms_exact_keys(p_request, ...)` gate. */
const databaseGate = (
  rpc: string,
): Readonly<{ required: readonly string[]; allowed: readonly string[] }> => {
  const row = psql(`
    select (m)[1] || '#' || (m)[2]
      from (select regexp_match(p.prosrc,
              'cms_exact_keys\\(\\s*p_request,\\s*array\\[([^\\]]*)\\]::text\\[\\],\\s*array\\[([^\\]]*)\\]::text\\[\\]') as m
              from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'platform_private' and p.proname = '${rpc}') s
     where m is not null`);
  const [required = '', allowed = ''] = row.split('#');
  return { required: names(required), allowed: names(allowed) };
};

let owner: CmsOwner;
let app: CmsApp;

beforeAll(() => {
  owner = ensureCmsOwner();
  app = createCmsApp({
    ...ownerSession(owner.authUserId, owner.organizationId, CAPABILITIES),
    mfaFresh: true,
  });
});

describe('Worker request shape against the database request gate, every human CMS operation', () => {
  it('[P2-S09-AC-064] the sweep covers all sixteen human operations (A01-A04, A06, A07 and A09-A18)', () => {
    expect(PROBES.map((probe) => probe.operationId).sort()).toEqual(
      [
        'CMS-03A-01',
        'CMS-03A-02',
        'CMS-03A-03',
        'CMS-03A-04',
        'CMS-03A-06',
        'CMS-03A-07',
        ...Array.from(
          { length: 10 },
          (_, index) => `CMS-03A-${String(index + 9).padStart(2, '0')}`,
        ),
      ].sort(),
    );
  });

  for (const probe of PROBES) {
    it(`[P2-S09-AC-064] ${probe.operationId} (${probe.rpc}): every member the production adapter sends is allowed, and every required member is sent`, async () => {
      const gate = databaseGate(probe.rpc);
      expect(
        gate.allowed.length,
        `${probe.rpc} must expose a cms_exact_keys(p_request, ...) gate`,
      ).toBeGreaterThan(0);
      app.clearObserved();
      await app.send(probe.method, probe.path, {
        ...(probe.body === undefined ? {} : { body: probe.body }),
        ...(probe.ifMatch === undefined ? {} : { ifMatch: probe.ifMatch }),
      });
      const sent = app.sent().find((entry) => entry.rpc === probe.rpc);
      expect(
        sent,
        `${probe.operationId} never reached ${probe.rpc}`,
      ).toBeDefined();
      const members = sent?.members ?? [];
      expect(
        members.filter((member) => !gate.allowed.includes(member)),
        `${probe.rpc}: members sent but not allowed by the database gate`,
      ).toEqual([]);
      expect(
        gate.required.filter((member) => !members.includes(member)),
        `${probe.rpc}: members the database requires but the adapter did not send`,
      ).toEqual([]);
    });
  }
});
