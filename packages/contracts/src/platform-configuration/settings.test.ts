import { describe, expect, it } from 'vitest';

import {
  CONFIGURATION_ROUTE_CONTRACTS,
  Cfg05a01DefinitionResponseSchema,
  Cfg05a01RegisterDefinitionRequestSchema,
  Cfg05a02EffectiveValueQuerySchema,
  Cfg05a02EffectiveValueResponseSchema,
  Cfg05a03ChangeResponseSchema,
  Cfg05a03ProposeChangeRequestSchema,
  Cfg05a04ChangeActionRequestSchema,
  Cfg05a04ChangeActionResponseSchema,
  ConfigFlagChangedV1Schema,
  ConfigKillSwitchChangedV1Schema,
  ConfigSettingActivatedV1Schema,
  ConfigurationJsonObjectSchema,
  ConfigurationJsonValueSchema,
  ConfigurationRouteMetadataSchema,
} from './index.ts';

const id = '018f2f72-4b5a-7c9d-8e1f-123456789abc';
const otherId = '018f2f72-4b5a-7c9d-8e1f-123456789abd';
const instant = '2026-09-02T03:00:00.000Z';
const later = '2026-09-03T03:00:00.000Z';
const hash = 'a'.repeat(64);

const definitionRequest = {
  key: 'profile.visibility',
  valueKind: 'boolean',
  schema: { type: 'boolean' },
  ownerCapability: 'settings.profile.write',
  allowedScopes: ['platform', 'party'],
  precedence: ['party', 'platform'],
  mergeMode: 'replace',
  defaultSource: 'literal',
  defaultValue: false,
  riskClass: 'high',
  approverPolicy: {
    minimumDistinct: 2,
    requiresMfa: true,
    requiresCanary: true,
    notifyCapabilities: ['settings.profile.read'],
  },
  consumerKeys: ['web.profile'],
  contractRelease: 'phase-2.7',
  sensitivity: 'internal',
  reason: 'Register governed profile visibility.',
} as const;

describe('Phase 2 Slice 07 configuration contracts', () => {
  it('accepts the exact definition contract and rejects unknown or inconsistent fields', () => {
    expect(
      Cfg05a01RegisterDefinitionRequestSchema.parse(definitionRequest),
    ).toEqual(definitionRequest);
    expect(
      Cfg05a01RegisterDefinitionRequestSchema.safeParse({
        ...definitionRequest,
        extra: true,
      }).success,
    ).toBe(false);
    expect(
      Cfg05a01RegisterDefinitionRequestSchema.safeParse({
        ...definitionRequest,
        precedence: ['user'],
      }).success,
    ).toBe(false);
    expect(
      Cfg05a01RegisterDefinitionRequestSchema.safeParse({
        ...definitionRequest,
        defaultSource: 'required',
      }).success,
    ).toBe(false);
    expect(
      Cfg05a01RegisterDefinitionRequestSchema.safeParse({
        ...definitionRequest,
        defaultValue: undefined,
      }).success,
    ).toBe(false);
  });

  it('validates definition and effective-value projections without secret extras', () => {
    const definition = {
      definitionId: id,
      definitionVersionId: otherId,
      key: 'profile.visibility',
      version: '1',
      valueKind: 'boolean',
      allowedScopes: ['platform', 'party'],
      precedence: ['party', 'platform'],
      mergeMode: 'replace',
      riskClass: 'high',
      lifecycle: 'active',
      schemaHash: hash,
      contractRelease: 'phase-2.7',
      synchronized: true,
      createdAt: instant,
    } as const;
    expect(Cfg05a01DefinitionResponseSchema.parse(definition)).toEqual(
      definition,
    );
    expect(
      Cfg05a01DefinitionResponseSchema.safeParse({
        ...definition,
        secret: 'no',
      }).success,
    ).toBe(false);

    const query = {
      key: 'profile.visibility',
      partyId: id,
      consumerKey: 'web.profile',
      supportedDefinitionVersions: ['1'],
    } as const;
    expect(Cfg05a02EffectiveValueQuerySchema.parse(query)).toEqual(query);
    const response = {
      definitionId: id,
      definitionVersionId: otherId,
      key: 'profile.visibility',
      valueKind: 'boolean',
      ownerCapability: 'settings.profile.write',
      typedValue: true,
      sourceScope: 'party',
      sourceSubjectId: id,
      sourceValueVersionId: otherId,
      isDefault: false,
      effectiveFrom: instant,
      effectiveTo: null,
      evaluatedAt: instant,
      evaluatorVersion: '1',
      correlationId: id,
      compatibility: 'exact',
    } as const;
    expect(Cfg05a02EffectiveValueResponseSchema.parse(response)).toEqual(
      response,
    );
    const withoutOwner: Partial<typeof response> = { ...response };
    delete withoutOwner.ownerCapability;
    expect(
      Cfg05a02EffectiveValueResponseSchema.safeParse(withoutOwner).success,
    ).toBe(false);
    for (const invalid of ['', 'Settings.Edit', 'settings edit', 'x'])
      expect(
        Cfg05a02EffectiveValueResponseSchema.safeParse({
          ...response,
          ownerCapability: invalid,
        }).success,
      ).toBe(false);
  });

  it('locks proposal, review, schedule, activation and rollback shapes', () => {
    const proposal = {
      scopeType: 'party',
      scopeId: id,
      environment: 'production',
      typedValue: true,
      interval: { effectiveFrom: instant, effectiveTo: later },
      expectedDefinitionVersion: '1',
      impactManifest: { consumers: ['web.profile'] },
      rollbackCandidate: false,
      reason: 'Enable the governed profile projection.',
      consumerKeys: ['web.profile'],
    } as const;
    expect(Cfg05a03ProposeChangeRequestSchema.parse(proposal)).toEqual(
      proposal,
    );
    expect(
      Cfg05a03ProposeChangeRequestSchema.safeParse({
        ...proposal,
        interval: { effectiveFrom: later, effectiveTo: instant },
      }).success,
    ).toBe(false);
    expect(
      Cfg05a03ChangeResponseSchema.safeParse({
        reviewId: id,
        candidateValueVersionId: otherId,
        definitionId: id,
        definitionVersion: '1',
        state: 'draft',
        valueHash: hash,
        impactManifestHash: hash,
        effectivePreview: true,
        rollbackAvailable: true,
        submittedAt: instant,
      }).success,
    ).toBe(true);

    const baseAction = {
      expectedReviewVersion: '1',
      candidateHash: hash,
      approvalReason: 'Reviewed against the frozen impact manifest.',
    } as const;
    expect(
      Cfg05a04ChangeActionRequestSchema.safeParse({
        ...baseAction,
        action: 'schedule',
      }).success,
    ).toBe(false);
    expect(
      Cfg05a04ChangeActionRequestSchema.safeParse({
        ...baseAction,
        action: 'rollback',
      }).success,
    ).toBe(false);
    expect(
      Cfg05a04ChangeActionRequestSchema.safeParse({
        ...baseAction,
        action: 'schedule',
        scheduledFor: later,
      }).success,
    ).toBe(true);
    expect(
      Cfg05a04ChangeActionRequestSchema.safeParse({
        ...baseAction,
        action: 'rollback',
        rollbackValue: false,
      }).success,
    ).toBe(true);
    expect(
      Cfg05a04ChangeActionResponseSchema.safeParse({
        reviewId: id,
        resultingValueVersionId: otherId,
        resultingState: 'active',
        resultingVersion: '2',
        candidateHash: hash,
        approvalCount: 2,
        snapshotIntentId: id,
        outboxEventId: otherId,
        effectiveAt: instant,
      }).success,
    ).toBe(true);
  });

  it('bounds JSON depth, collection sizes, keys and bytes', () => {
    let nested: unknown = 'leaf';
    for (let depth = 0; depth < 10; depth += 1) nested = [nested];
    const objectWithTooManyKeys = Object.fromEntries(
      Array.from({ length: 65 }, (_, index) => [`k${index}`, index]),
    );
    expect(ConfigurationJsonValueSchema.safeParse(nested).success).toBe(false);
    expect(
      ConfigurationJsonValueSchema.safeParse(
        Array.from({ length: 65 }, (_, index) => index),
      ).success,
    ).toBe(false);
    expect(
      ConfigurationJsonValueSchema.safeParse([objectWithTooManyKeys]).success,
    ).toBe(false);
    expect(
      ConfigurationJsonValueSchema.safeParse({ ['k'.repeat(129)]: true })
        .success,
    ).toBe(false);
    expect(
      ConfigurationJsonValueSchema.safeParse('x'.repeat(65_537)).success,
    ).toBe(false);
    expect(
      ConfigurationJsonObjectSchema.safeParse({ safe: true }).success,
    ).toBe(true);
    expect(
      ConfigurationJsonObjectSchema.safeParse(objectWithTooManyKeys).success,
    ).toBe(false);
  });

  it('registers exactly four active routes and identifier-only events', () => {
    expect(
      CONFIGURATION_ROUTE_CONTRACTS.map(({ operationId }) => operationId),
    ).toEqual(['CFG-05A-01', 'CFG-05A-02', 'CFG-05A-03', 'CFG-05A-04']);
    for (const route of CONFIGURATION_ROUTE_CONTRACTS) {
      const metadata = {
        operationId: route.operationId,
        method: route.method,
        path: route.path,
        successStatus: route.successStatus,
        authClass: route.authClass,
        idempotencyRequired: route.idempotencyRequired,
        deadlineMs: route.deadlineMs,
      };
      expect(ConfigurationRouteMetadataSchema.safeParse(metadata).success).toBe(
        true,
      );
    }
    expect(
      ConfigSettingActivatedV1Schema.parse({
        definitionId: id,
        valueVersionId: otherId,
        scopeType: 'party',
        scopeId: id,
      }),
    ).toEqual({
      definitionId: id,
      valueVersionId: otherId,
      scopeType: 'party',
      scopeId: id,
    });
    expect(
      ConfigFlagChangedV1Schema.safeParse({
        flagId: id,
        flagVersionId: otherId,
      }).success,
    ).toBe(true);
    expect(
      ConfigKillSwitchChangedV1Schema.safeParse({
        switchId: id,
        switchVersionId: otherId,
        activationId: id,
        payload: true,
      }).success,
    ).toBe(false);
  });
});
