import { createHash } from 'node:crypto';
import { TextDecoder } from 'node:util';

import {
  ContentSchemaRegistryManualAccessibilityReportSchema,
  type ContentSchemaRegistryManualAccessibilityReport,
} from '../../packages/contracts/src/content-schema-registry/operational-release-evidence-manual-accessibility-report.ts';
import type {
  ContentSchemaRegistryOperationalReleaseEvidence,
  OperationalReleaseEvidenceExpectedIdentity,
} from '../../packages/contracts/src/content-schema-registry/operational-release-evidence.ts';
import { parseStrictJson } from './parse-strict-json.ts';

type ManualAccessibilityEvidenceRun =
  ContentSchemaRegistryOperationalReleaseEvidence['accessibility']['manualRuns'][number];

// The report binds only hosted identity fields; production deployment fields
// remain mandatory in the production sidecar, not in this shared byte verifier.
type ManualAccessibilityExpectedIdentity = Pick<
  OperationalReleaseEvidenceExpectedIdentity,
  | 'sourceRevision'
  | 'hostedEnvironment'
  | 'hostedDeploymentId'
  | 'hostedDeployedAt'
  | 'trustedCutoffAt'
  | 'webOrigin'
>;

type AccessibilityEvidence =
  ContentSchemaRegistryOperationalReleaseEvidence['accessibility'];

type HostedE2eEvidence =
  ContentSchemaRegistryOperationalReleaseEvidence['hostedE2e'];

const sha256Bytes = (value: Uint8Array): string =>
  createHash('sha256').update(value).digest('hex');

const parseExpectedTimestamp = (
  name: 'hostedDeployedAt' | 'trustedCutoffAt',
  value: string,
): number => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed))
    throw new Error(
      `Manual accessibility expected ${name} timestamp is invalid.`,
    );
  return parsed;
};

const normalizedHttpsOrigin = (value: string): string | undefined => {
  try {
    const origin = new URL(value);
    if (
      origin.protocol !== 'https:' ||
      origin.username !== '' ||
      origin.password !== '' ||
      origin.pathname !== '/' ||
      origin.search !== '' ||
      origin.hash !== ''
    )
      return undefined;
    origin.hostname = origin.hostname.toLowerCase().replace(/\.$/u, '');
    return origin.origin;
  } catch {
    return undefined;
  }
};

const sameMembers = (
  actual: readonly string[],
  expected: readonly string[],
): boolean => {
  const actualSet = new Set(actual);
  return (
    actualSet.size === actual.length &&
    actualSet.size === expected.length &&
    expected.every((member) => actualSet.has(member))
  );
};

export const validateContentSchemaRegistryManualAccessibilityReport = (
  report: unknown,
  manualRun: ManualAccessibilityEvidenceRun,
  accessibilityEvidence: AccessibilityEvidence,
  hostedEvidence: HostedE2eEvidence,
  expectedIdentity: ManualAccessibilityExpectedIdentity,
): ContentSchemaRegistryManualAccessibilityReport => {
  const parsed =
    ContentSchemaRegistryManualAccessibilityReportSchema.safeParse(report);
  if (!parsed.success)
    throw new Error('Manual accessibility report body is invalid.');
  const value = parsed.data;

  if (
    value.sourceRevision !== expectedIdentity.sourceRevision ||
    value.sourceRevision !== accessibilityEvidence.sourceRevision ||
    value.sourceRevision !== hostedEvidence.sourceRevision
  )
    throw new Error(
      'Manual accessibility report does not match the expected source SHA.',
    );
  if (
    value.environment !== 'staging' ||
    value.environment !== expectedIdentity.hostedEnvironment ||
    value.environment !== accessibilityEvidence.environment ||
    value.environment !== hostedEvidence.environment
  )
    throw new Error(
      'Manual accessibility report does not match the expected staging environment.',
    );
  if (
    value.deploymentId !== expectedIdentity.hostedDeploymentId ||
    value.deploymentId !== accessibilityEvidence.deploymentId ||
    value.deploymentId !== hostedEvidence.deploymentId
  )
    throw new Error(
      'Manual accessibility report does not match the expected deployment.',
    );

  const reportOrigin = normalizedHttpsOrigin(value.webOrigin);
  const expectedOrigin = normalizedHttpsOrigin(expectedIdentity.webOrigin);
  const accessibilityOrigin = normalizedHttpsOrigin(
    accessibilityEvidence.webOrigin,
  );
  const hostedOrigin = normalizedHttpsOrigin(hostedEvidence.webOrigin);
  if (
    reportOrigin === undefined ||
    reportOrigin !== expectedOrigin ||
    reportOrigin !== accessibilityOrigin ||
    reportOrigin !== hostedOrigin
  )
    throw new Error(
      'Manual accessibility report does not match the expected web origin.',
    );

  const expectedPlatform =
    manualRun.platform === 'macos_voiceover_safari'
      ? 'mac_safari_voiceover'
      : manualRun.platform === 'windows_nvda_firefox'
        ? 'windows_firefox_nvda'
        : undefined;
  if (expectedPlatform === undefined || value.platform !== expectedPlatform)
    throw new Error(
      'Manual accessibility report does not match the ordered platform tuple.',
    );
  if (
    value.operatorId !== manualRun.operator ||
    value.osVersion !== manualRun.osVersion ||
    value.browserVersion !== manualRun.browserVersion ||
    value.screenReaderVersion !== manualRun.screenReaderVersion ||
    value.completedAt !== manualRun.completedAt ||
    value.outcome !== manualRun.outcome ||
    !sameMembers(
      value.checks.map(({ check }) => check),
      manualRun.checks,
    )
  )
    throw new Error(
      'Manual accessibility report does not match its retained evidence entry.',
    );

  const hostedDeployedAt = parseExpectedTimestamp(
    'hostedDeployedAt',
    expectedIdentity.hostedDeployedAt,
  );
  const trustedCutoffAt = parseExpectedTimestamp(
    'trustedCutoffAt',
    expectedIdentity.trustedCutoffAt,
  );
  if (hostedDeployedAt > trustedCutoffAt)
    throw new Error(
      'Manual accessibility expected identity time bounds are invalid.',
    );
  const startedAt = Date.parse(value.startedAt);
  const completedAt = Date.parse(value.completedAt);
  if (startedAt < hostedDeployedAt)
    throw new Error(
      'Manual accessibility report starts before the expected hosted deployment.',
    );
  if (completedAt <= startedAt)
    throw new Error(
      'Manual accessibility report must complete after it starts.',
    );
  if (completedAt > trustedCutoffAt)
    throw new Error('Manual accessibility report exceeds the trusted cutoff.');

  return value;
};

export const validateContentSchemaRegistryManualAccessibilityReportBytes = (
  reportBytes: Uint8Array,
  expectedDigest: string,
  manualRun: ManualAccessibilityEvidenceRun,
  accessibilityEvidence: AccessibilityEvidence,
  hostedEvidence: HostedE2eEvidence,
  expectedIdentity: ManualAccessibilityExpectedIdentity,
): ContentSchemaRegistryManualAccessibilityReport => {
  if (sha256Bytes(reportBytes) !== expectedDigest)
    throw new Error(
      'Retained report digest does not match: manual accessibility.',
    );

  let report: unknown;
  try {
    const utf8 = new TextDecoder('utf-8', {
      fatal: true,
      ignoreBOM: true,
    }).decode(reportBytes);
    report = parseStrictJson(utf8);
  } catch (error: unknown) {
    throw new Error(
      'Manual accessibility retained report is not valid UTF-8 JSON.',
      { cause: error },
    );
  }

  return validateContentSchemaRegistryManualAccessibilityReport(
    report,
    manualRun,
    accessibilityEvidence,
    hostedEvidence,
    expectedIdentity,
  );
};
