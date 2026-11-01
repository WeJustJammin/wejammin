import {
  CMS_PREFLIGHT_CATEGORIES,
  cmsEditorialRoutePolicies,
} from '@wejammin/contracts';
import { expect } from 'vitest';

import type { CmsEditorialTelemetryEvent } from './types';
import {
  postJson,
  workflowHarness,
  type WorkflowHarnessOptions,
  type WorkflowPortName,
} from './workflow-harness.test-support';

/*
 * Support for the CMS-03B-06, CMS-03B-07 and CMS-03B-09 telemetry redaction
 * suite (P2-S11-AC-016, AC-022, AC-034): the closed event and metric
 * vocabulary, the scenario types, and the check that turns any breach of the
 * redaction contract into a readable finding.
 */

export type OperationId = 'CMS-03B-06' | 'CMS-03B-07' | 'CMS-03B-09';

/** The only top-level members a redacted event may have (`CmsEditorialTelemetryEvent`). */
const CLOSED_EVENT_KEYS: ReadonlySet<string> = new Set<
  keyof CmsEditorialTelemetryEvent
>([
  'operationId',
  'requestId',
  'correlationId',
  'outcome',
  'status',
  'errorCode',
  'durationMs',
  'actorClass',
  'rateClass',
  'rateLimit',
  'rateWindowSeconds',
  'deadlineMs',
  'eventType',
  'slo',
  'runbook',
  'traceSteps',
  'metrics',
  'traceId',
  'actingContextClass',
  'retryable',
  'dependency',
  'entityIdHash',
  'entityVersion',
]);

const PLAIN_METRICS: ReadonlySet<string> = new Set([
  'cms_editorial_latency_ms',
  'request_status',
  'slo_command_p95_ms',
  'slo_protected_rpc_p95_ms',
  'slo_acceptance_p99_ms',
  'cms_editorial_rate_limited_total',
]);

const OUTCOMES = 'success|rate_limited|denied|conflict|invalid|failed';
const CATEGORIES = CMS_PREFLIGHT_CATEGORIES.join('|');
const PREFLIGHT_OUTCOMES = 'passed|failed|unavailable';

/** The labelled counter families an operation may emit, each with closed label values. */
const closedFamilies = (
  operationId: OperationId,
  phase: 'schedule' | 'publish' | null,
): readonly RegExp[] => [
  new RegExp(
    `^cms_editorial_request_total\\{operation="${operationId}",outcome="(${OUTCOMES})"\\}$`,
    'u',
  ),
  new RegExp(
    `^cms_editorial_error_total\\{code="[A-Z][A-Z_]{2,39}",operation="${operationId}"\\}$`,
    'u',
  ),
  new RegExp(
    `^cms_editorial_conflict_total\\{operation="${operationId}",reason="(VERSION_MISMATCH|IDEMPOTENCY_MISMATCH|INVALID_TRANSITION)"\\}$`,
    'u',
  ),
  new RegExp(
    `^cms_separation_of_duties_refusal_total\\{operation="${operationId}"\\}$`,
    'u',
  ),
  ...(operationId === 'CMS-03B-06'
    ? [
        new RegExp(
          `^cms_review_decision_total\\{decision="(approve|reject|unknown)",outcome="(${OUTCOMES})"\\}$`,
          'u',
        ),
        /^cms_review_invalidated_total\{reason="dependency_changed"\}$/u,
      ]
    : []),
  ...(phase === null
    ? []
    : [
        new RegExp(
          `^cms_preflight_result_total\\{category="(${CATEGORIES})",outcome="(${PREFLIGHT_OUTCOMES})",phase="${phase}"\\}$`,
          'u',
        ),
      ]),
  ...(operationId === 'CMS-03B-09'
    ? [/^cms_publication_lineage_conflict_total$/u]
    : []),
];

export type Scenario = Readonly<{
  title: string;
  status: number;
  options?: WorkflowHarnessOptions;
  body?: Record<string, unknown>;
  /** The port refusal to inject (the port is then called exactly once). */
  refusal?: Readonly<{
    status: number;
    code: string;
    details?: Record<string, unknown>;
  }>;
}>;

export type OperationCase = Readonly<{
  operationId: OperationId;
  path: string;
  body: Record<string, unknown>;
  port: WorkflowPortName;
  phase: 'schedule' | 'publish' | null;
  /** Values that identify a record, a person or caller content. */
  secrets: ReadonlyArray<readonly [label: string, value: string]>;
  scenarios: readonly Scenario[];
}>;

/** Upstream text a port refusal carries; it must never reach a log. */
export const UPSTREAM_TEXT =
  'db-host-17.internal refused SELECT * FROM cms_reviews';
export const PII_EMAIL = 'jane.doe+reviewer@example.test';
export const DEPENDENCY_HASH = 'd'.repeat(64);
export const CONTENT_SECRET_REASON = `Escalated by ${PII_EMAIL} after the legal call.`;

export const sha256Of = async (value: string): Promise<string> =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
  ]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

export const policyOf = (operationId: OperationId) =>
  cmsEditorialRoutePolicies.find(
    (row) => row.operationId === operationId,
  ) as (typeof cmsEditorialRoutePolicies)[number];

/**
 * Every way an event can break the redaction contract, as readable findings: a
 * member outside the closed set, a metric outside a declared family, a code the
 * client did not see, or a secret value anywhere in the serialized event.
 */
export const redactionFindings = (
  event: CmsEditorialTelemetryEvent,
  operation: Pick<OperationCase, 'operationId' | 'phase' | 'secrets'>,
  publishedCode: string | null,
): readonly string[] => {
  const findings: string[] = [];
  for (const key of Object.keys(event))
    if (!CLOSED_EVENT_KEYS.has(key)) findings.push(`event member ${key}`);
  const families = closedFamilies(operation.operationId, operation.phase);
  for (const [key, value] of Object.entries(event.metrics ?? {})) {
    if (!PLAIN_METRICS.has(key) && !families.some((family) => family.test(key)))
      findings.push(`metric ${key}`);
    if (!Number.isFinite(value)) findings.push(`metric value of ${key}`);
  }
  if ((event.errorCode ?? null) !== publishedCode)
    findings.push(`error code ${String(event.errorCode)}`);
  const serialized = JSON.stringify(event);
  for (const [label, value] of operation.secrets)
    if (serialized.includes(value)) findings.push(`leaks the ${label}`);
  return findings;
};

/** Drive one scenario through the real route and return the event and response. */
export const run = async (operation: OperationCase, scenario: Scenario) => {
  const refusal = scenario.refusal;
  const { app, telemetry, ports } = workflowHarness({
    ...scenario.options,
    ...(refusal === undefined
      ? {}
      : {
          port: {
            [operation.port]: async () => ({
              ok: false as const,
              status: refusal.status,
              code: refusal.code,
              message: UPSTREAM_TEXT,
              ...(refusal.details === undefined
                ? {}
                : { details: refusal.details }),
            }),
          },
        }),
  });
  const response = await postJson(app, operation.path, {
    ...operation.body,
    ...scenario.body,
  });
  await Promise.resolve();
  expect(telemetry).toHaveBeenCalledTimes(1);
  const event = telemetry.mock.calls[0]![0] as CmsEditorialTelemetryEvent;
  return { event, response, ports };
};
