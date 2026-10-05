import { describe, expect, it } from 'vitest';

import { createRegistrySet, platformRegistrySet } from '@wejammin/contracts';

const route = {
  method: 'GET',
  path: '/api/v1/health',
  authClass: 'public',
  cacheClass: 'no_store',
  timeoutMs: 8_000,
  rateClass: 'public_read',
  sloTier: 'tier_1',
  criticality: 'high',
  owner: 'Infrastructure',
  operationId: 'healthRead',
  requestSchema: 'EmptyRequestSchema',
  successSchema: 'HealthResponseSchema',
  errorSchemas: ['ApiErrorSchema'],
  bolaTest: 'public route has no object selector',
  runbook: 'docs/runbooks/platform/operational-endpoints.md',
  deprecated: false,
} as const;

const jobStatusRoute = {
  ...route,
  path: '/api/v1/jobs/{jobId}',
  authClass: 'authenticated',
  rateClass: 'authenticated_read',
  operationId: 'jobStatusRead',
  requestSchema: 'JobIdPathSchema',
  successSchema: 'JobStatusSchema',
  bolaTest:
    'owner, acting-party jobs.read, or operator jobs.read:any with step-up and reason',
  runbook: 'docs/runbooks/platform/jobs-outbox-reconciliation.md',
} as const;

const jobConsumer = {
  consumerId: 'platform.job.execute',
  owner: 'Infrastructure',
  messageSchema: 'QueueEnvelopeSchema',
  queueName: 'platform-jobs',
  leaseSeconds: 300,
  heartbeatSeconds: 60,
  maxLeaseSeconds: 840,
  maxDeliveries: 4,
  retryClass: 'bounded_exponential',
  retryDelaysSeconds: [15, 60, 300],
  deadLetterClass: 'platform-jobs-dlq',
  acceptedEvents: [
    { eventType: 'job.requested', schemaVersion: 1 },
    { eventType: 'identity.facet.changed.v1', schemaVersion: 1 },
    { eventType: 'identity.alias.changed.v1', schemaVersion: 1 },
    { eventType: 'identity.acting-context.revoked.v1', schemaVersion: 1 },
    { eventType: 'identity.organization.changed.v1', schemaVersion: 1 },
    { eventType: 'identity.relationship.changed.v1', schemaVersion: 1 },
    { eventType: 'identity.governance.activated.v1', schemaVersion: 1 },
  ],
  sloTier: 'tier_1',
  runbook: 'docs/runbooks/platform/jobs-outbox-reconciliation.md',
} as const;

const validInput = {
  routes: [route],
  consumers: [jobConsumer],
  providers: [
    {
      providerId: 'object_store',
      owner: 'Infrastructure',
      adapter: 'storage.r2',
      credentialBinding: 'OBJECT_STORAGE_TOKEN',
      replayWindowSeconds: 300,
      sloTier: 'tier_2',
      runbook: 'docs/runbooks/platform/provider-webhook-reconciliation.md',
    },
  ],
  retention: [
    {
      dataClass: 'operational.events',
      owner: 'Infrastructure',
      retentionDays: 30,
      deletionMode: 'hard_delete',
      legalHoldSupported: false,
      runbook: 'docs/runbooks/platform/retention.md',
    },
  ],
  slos: [
    {
      tier: 'tier_1',
      owner: 'Infrastructure',
      targetBasisPoints: 9_990,
      measurementLabel: 'api.availability',
      alertRoute: 'platform.on_call',
      runbook: 'docs/runbooks/platform/slo.md',
    },
  ],
} as const;

describe('closed platform registries', () => {
  it('registers the foundation routes, retention class, and SLO as closed inputs', () => {
    expect(
      platformRegistrySet.routes.map(({ operationId }) => operationId),
    ).toEqual([
      'healthRead',
      'readinessRead',
      'diagnosticsRead',
      'jobStatusRead',
      'uploadIntentCreate',
      'authProviderCatalogRead',
      'authEmailStart',
      'authOAuthStart',
      'authCallbackComplete',
      'authLoginMethodsRead',
      'authLoginMethodLinkIntentCreate',
      'authLoginMethodUnlink',
      'authAccountMergeCreate',
      'authAccountMergeRead',
      'authAccountMergeProofCreate',
      'authAccountMergeConfirm',
      'authSessionRead',
      'authSessionRefresh',
      'authPersonBootstrap',
      'authLogout',
      'authMfaFactorsRead',
      'authMfaEnrollmentStart',
      'authMfaFactorVerify',
      'authMfaFactorRemove',
      'authStepUpChallengeCreate',
      'authStepUpVerify',
      'uploadIntentComplete',
      'identityCreate',
      'identityReadSelf',
      'identityFacetAdd',
      'identityFacetRemove',
      'identityAliasCreate',
      'identityAliasPatch',
      'identityHandleChange',
      'identityAliasRetire',
      'identityTransferOfferCreate',
      'identityTransferAccept',
      'identityTransferDecline',
      'identityContextsRead',
      'identityContextBind',
      'identityLegalRead',
      'identityLegalUpsert',
      'identityLegalDisclose',
      'identityDisclosureRead',
      'identityPublicProjection',
      'organizationCreate',
      'organizationRead',
      'organizationTypeAdd',
      'organizationTypeRemove',
      'membershipInvite',
      'membershipAssert',
      'membershipAccept',
      'membershipEnd',
      'membershipCapacityAdd',
      'membershipsRead',
      'profileMatchCreate',
      'profileInvitationCreate',
      'profileRemedyCreate',
      'profileClaimCreate',
      'profileClaimRead',
      'profileChallengeCreate',
      'profileProofCreate',
      'profileConversionCreate',
      'CMS-03A-01',
      'CMS-03A-02',
      'CMS-03A-03',
      'CMS-03A-04',
      'CMS-03A-05',
      'CMS-03A-06',
      'CMS-03A-07',
      'CMS-03A-08',
      'CMS-03A-09',
      'CMS-03A-10',
      'CMS-03A-11',
      'CMS-03A-12',
      'CMS-03A-13',
      'CMS-03A-14',
      'CMS-03A-15',
      'CMS-03A-16',
      'CMS-03A-17',
      'CMS-03A-18',
      'CMS-03B-01',
      'CMS-03B-02',
      'CMS-03B-03',
      'CMS-03B-04',
      'CMS-03B-10',
      'CMS-03B-11',
      'CMS-03B-12',
      'CMS-03B-13',
      'CMS-03B-14',
      'cmsTemplateContextRead',
      'CMS-03C-01',
      'CMS-03C-02',
      'CMS-03C-03',
      'cmsTemplateLatestRead',
      'CMS-03C-04',
      'CMS-03C-05',
      'CFG-05B-06',
      'CFG-05B-07',
    ]);
    expect(
      platformRegistrySet.consumers.map(({ consumerId }) => consumerId),
    ).toEqual([
      'platform.job.execute',
      'profile.match',
      'profile.invitation',
      'profile.claim-deadline',
      'profile.proof-reconcile',
    ]);
    expect(platformRegistrySet.providers).toEqual([]);
    expect(platformRegistrySet.retention).toHaveLength(1);
    expect(platformRegistrySet.slos).toHaveLength(2);
    expect(platformRegistrySet.slos.map(({ tier }) => tier)).toEqual([
      'tier_1',
      'tier_2',
    ]);
  });

  it('registers upload admission and completion while provider registries remain closed', () => {
    expect(platformRegistrySet.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operationId: 'uploadIntentCreate',
          path: '/api/v1/upload-intents',
          timeoutMs: 15_000,
        }),
        expect.objectContaining({
          operationId: 'uploadIntentComplete',
          path: '/api/v1/upload-intents/{uploadIntentId}/complete',
          timeoutMs: 15_000,
        }),
      ]),
    );
    expect(platformRegistrySet.providers).toEqual([]);
  });

  it('registers the job status route with its authenticated-read boundary', () => {
    expect(platformRegistrySet.routes).toContainEqual(jobStatusRoute);
    expect(platformRegistrySet.routes).not.toContainEqual(
      expect.objectContaining({
        path: '/api/v1/jobs/{jobId}',
        authClass: 'public',
      }),
    );
  });

  it('registers the job consumer delivery and dispatch contract', () => {
    expect(platformRegistrySet.consumers).toContainEqual(jobConsumer);
    expect(jobConsumer.acceptedEvents).toEqual([
      { eventType: 'job.requested', schemaVersion: 1 },
      { eventType: 'identity.facet.changed.v1', schemaVersion: 1 },
      { eventType: 'identity.alias.changed.v1', schemaVersion: 1 },
      { eventType: 'identity.acting-context.revoked.v1', schemaVersion: 1 },
      { eventType: 'identity.organization.changed.v1', schemaVersion: 1 },
      { eventType: 'identity.relationship.changed.v1', schemaVersion: 1 },
      { eventType: 'identity.governance.activated.v1', schemaVersion: 1 },
    ]);
    expect(jobConsumer.maxDeliveries).toBe(4);
    expect(jobConsumer).toMatchObject({
      heartbeatSeconds: 60,
      leaseSeconds: 300,
      maxLeaseSeconds: 840,
      retryDelaysSeconds: [15, 60, 300],
    });
  });

  it('accepts complete strict registry inputs', () => {
    expect(createRegistrySet(validInput)).toEqual(validInput);
  });

  it.each([
    ['route', { ...validInput, routes: [route, route] }],
    [
      'operation ID',
      {
        ...validInput,
        routes: [route, { ...route, path: '/api/v1/ready' }],
      },
    ],
    [
      'consumer',
      {
        ...validInput,
        consumers: [...validInput.consumers, validInput.consumers[0]],
      },
    ],
    [
      'provider',
      {
        ...validInput,
        providers: [...validInput.providers, validInput.providers[0]],
      },
    ],
    [
      'retention class',
      {
        ...validInput,
        retention: [...validInput.retention, validInput.retention[0]],
      },
    ],
    [
      'SLO tier',
      { ...validInput, slos: [...validInput.slos, validInput.slos[0]] },
    ],
  ])('rejects a duplicate %s key', (_label, input) => {
    expect(() => createRegistrySet(input)).toThrow();
  });

  it('rejects unknown keys and missing ownership evidence', () => {
    expect(() =>
      createRegistrySet({
        ...validInput,
        routes: [{ ...route, providerTopology: 'private' }],
      }),
    ).toThrow();
    expect(() =>
      createRegistrySet({
        ...validInput,
        routes: [{ ...route, owner: undefined }],
      }),
    ).toThrow();
  });

  it('rejects malformed consumer delivery metadata and duplicate event pairs', () => {
    expect(() =>
      createRegistrySet({
        ...validInput,
        consumers: [{ ...jobConsumer, maxDeliveries: 3 }],
      }),
    ).toThrow();
    expect(() =>
      createRegistrySet({
        ...validInput,
        consumers: [
          {
            ...jobConsumer,
            acceptedEvents: [
              ...jobConsumer.acceptedEvents,
              { eventType: 'job.requested', schemaVersion: 1 },
            ],
          },
        ],
      }),
    ).toThrow();
  });

  it('rejects routes and consumers that reference a missing SLO tier', () => {
    expect(() =>
      createRegistrySet({
        ...validInput,
        routes: [{ ...route, sloTier: 'tier_missing' }],
      }),
    ).toThrow();
    expect(() =>
      createRegistrySet({
        ...validInput,
        consumers: [{ ...jobConsumer, sloTier: 'tier_missing' }],
      }),
    ).toThrow();
  });

  it('rejects runbooks outside the canonical allowed repository paths', () => {
    expect(() =>
      createRegistrySet({
        ...validInput,
        routes: [{ ...route, runbook: 'docs/runbooks/platform/missing.md' }],
      }),
    ).toThrow();
    expect(() =>
      createRegistrySet({
        ...validInput,
        consumers: [
          { ...jobConsumer, runbook: 'docs/runbooks/platform/missing.md' },
        ],
      }),
    ).toThrow();
  });
});
