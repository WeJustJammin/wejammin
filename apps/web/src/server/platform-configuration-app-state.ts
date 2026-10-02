import {
  Cfg05a02EffectiveValueResponseSchema,
  type Cfg05a02EffectiveValueQuery,
} from '@wejammin/contracts';

export type Cfg05a02EffectiveValueResponse = ReturnType<
  typeof Cfg05a02EffectiveValueResponseSchema.parse
>;

import { sanitizeConfigurationValue } from '../components/platform-configuration/platform-configuration-presentation-security';
import type {
  PlatformConfigurationAsyncState,
  PlatformConfigurationContractFields,
  PlatformConfigurationRecord,
  PlatformConfigurationVariant,
} from '../components/platform-configuration/platform-configuration-workbench-types';
import type {
  PlatformConfigurationPageResult,
  PlatformConfigurationPageState,
} from './platform-configuration-context';

export const PLATFORM_CONFIGURATION_CONTRACT_FIELDS: PlatformConfigurationContractFields =
  {
    source: '05a-settings-flags-runtime.md',
    fields: {
      Cfg05a01RegisterDefinitionRequest: [
        'key',
        'valueKind',
        'schema',
        'ownerCapability',
        'allowedScopes',
        'precedence',
        'mergeMode',
        'defaultSource',
        'defaultValue',
        'riskClass',
        'approverPolicy',
        'consumerKeys',
        'contractRelease',
        'sensitivity',
        'deprecationAt',
        'reason',
      ],
      Cfg05a01DefinitionResponse: [
        'definitionId',
        'definitionVersionId',
        'key',
        'version',
        'valueKind',
        'allowedScopes',
        'precedence',
        'mergeMode',
        'riskClass',
        'lifecycle',
        'schemaHash',
        'contractRelease',
        'synchronized',
        'createdAt',
      ],
      Cfg05a02EffectiveValueQuery: [
        'key',
        'environment',
        'partyId',
        'siteId',
        'route',
        'feature',
        'userId',
        'consumerKey',
        'supportedDefinitionVersions',
        'at',
      ],
      Cfg05a02EffectiveValueResponse: [
        'definitionId',
        'definitionVersionId',
        'key',
        'valueKind',
        'ownerCapability',
        'typedValue',
        'sourceScope',
        'sourceSubjectId',
        'sourceValueVersionId',
        'isDefault',
        'effectiveFrom',
        'effectiveTo',
        'evaluatedAt',
        'evaluatorVersion',
        'correlationId',
        'compatibility',
      ],
      Cfg05a03ProposeChangeRequest: [
        'scopeType',
        'scopeId',
        'environment',
        'typedValue',
        'interval',
        'expectedDefinitionVersion',
        'impactManifest',
        'rollbackCandidate',
        'reason',
        'consumerKeys',
      ],
      Cfg05a04ChangeActionRequest: [
        'action',
        'expectedReviewVersion',
        'candidateHash',
        'approvalReason',
        'stepUpToken',
        'scheduledFor',
        'rollbackValue',
        'canaryPercent',
      ],
    },
  };

const responseProjection = (
  response: Cfg05a02EffectiveValueResponse,
): Readonly<Record<string, unknown>> => ({
  definitionId: response.definitionId,
  definitionVersionId: response.definitionVersionId,
  key: response.key,
  valueKind: response.valueKind,
  typedValue: sanitizeConfigurationValue(response.typedValue),
  sourceScope: response.sourceScope,
  sourceSubjectId: response.sourceSubjectId,
  sourceValueVersionId: response.sourceValueVersionId,
  isDefault: response.isDefault,
  effectiveFrom: response.effectiveFrom,
  effectiveTo: response.effectiveTo,
  evaluatedAt: response.evaluatedAt,
  evaluatorVersion: response.evaluatorVersion,
  correlationId: response.correlationId,
  compatibility: response.compatibility,
});

export const platformConfigurationRecord = (
  response: Cfg05a02EffectiveValueResponse,
  page: PlatformConfigurationPageState | null = null,
): PlatformConfigurationRecord => ({
  id: response.definitionId,
  version: response.evaluatorVersion,
  state:
    response.compatibility === 'exact' ? 'effective' : 'compatible-fallback',
  provenance: [
    {
      source: 'settings-flags-runtime',
      evidence: `canonical-effective-value:${response.correlationId}`,
      at: response.evaluatedAt,
      visibility: page?.access === 'full' ? 'authorized' : 'disclosed',
    },
  ],
  projection: responseProjection(response),
});

export const parseEffectiveValue = (
  value: unknown,
): Cfg05a02EffectiveValueResponse | null => {
  const parsed = Cfg05a02EffectiveValueResponseSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

const canDiscloseConfiguration = (
  page: PlatformConfigurationPageState,
): boolean =>
  page.state === 'ready' &&
  !page.notDisclosed &&
  (page.access === 'read-only' || page.access === 'full');

export const platformConfigurationInitial = (
  pageResult: PlatformConfigurationPageResult | null,
  page: PlatformConfigurationPageState | null,
  response: Cfg05a02EffectiveValueResponse | null,
): PlatformConfigurationAsyncState => {
  if (pageResult?.kind !== 'ready' || page === null) {
    return {
      status: 'disabled',
      disabledReason: 'A server-verified session is required.',
    };
  }
  if (page.state === 'degraded') {
    return {
      status: 'degraded',
      data:
        response === null || !canDiscloseConfiguration(page)
          ? null
          : [platformConfigurationRecord(response, page)],
      requestId: page.requestId,
      lastVerifiedAt: page.lastVerifiedAt,
      error: page.error,
      retryable: true,
    };
  }
  if (!canDiscloseConfiguration(page)) {
    return {
      status: 'empty',
      reason: 'not-disclosed',
      data: [],
    };
  }
  if (response === null) {
    return {
      status: 'empty',
      reason: page.notDisclosed ? 'not-disclosed' : 'no-records',
      data: [],
    };
  }
  const record = platformConfigurationRecord(response, page);
  return {
    status: 'success',
    data: [record],
    version: record.version,
    stale: false,
  };
};

export const platformConfigurationVariant = (
  pageResult: PlatformConfigurationPageResult | null,
): PlatformConfigurationVariant =>
  pageResult?.kind === 'ready'
    ? pageResult.page.variant
    : 'disabledPrerequisite';

export const effectiveQueryFromUrl = (
  url: URL,
  key: string,
): Cfg05a02EffectiveValueQuery => {
  const supportedDefinitionVersions = url.searchParams
    .getAll('supportedDefinitionVersions')
    .filter((value) => /^[1-9][0-9]{0,17}$/u.test(value))
    .slice(0, 8);
  return {
    key,
    consumerKey:
      url.searchParams.get('consumerKey') ?? 'web.platform-configuration',
    supportedDefinitionVersions:
      supportedDefinitionVersions.length > 0
        ? supportedDefinitionVersions
        : ['1'],
    ...(url.searchParams.get('environment') === null
      ? {}
      : { environment: url.searchParams.get('environment')! }),
    ...(url.searchParams.get('partyId') === null
      ? {}
      : { partyId: url.searchParams.get('partyId')! }),
    ...(url.searchParams.get('siteId') === null
      ? {}
      : { siteId: url.searchParams.get('siteId')! }),
    ...(url.searchParams.get('route') === null
      ? {}
      : { route: url.searchParams.get('route')! }),
    ...(url.searchParams.get('feature') === null
      ? {}
      : { feature: url.searchParams.get('feature')! }),
    ...(url.searchParams.get('userId') === null
      ? {}
      : { userId: url.searchParams.get('userId')! }),
    ...(url.searchParams.get('at') === null
      ? {}
      : { at: url.searchParams.get('at')! }),
  };
};
