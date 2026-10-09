import { CMS_A11Y_CHECKER_TIMEOUT_MS } from '@wejammin/contracts';
import type { Logger } from '@wejammin/observability/logging';

import {
  evaluateAccessibilityGate,
  toPreflightEvidence,
  type AccessibilityGateRun,
  type AccessibilityLoadResult,
} from './cms-editorial/a11y-structural';
import type {
  CmsEditorialQualityGate,
  CmsEditorialQualityGateInput,
} from './cms-editorial/types';
import { mapCmsEditorialRpcFailure } from './cms-editorial-production-errors';
import { baseRpcHeaders } from './cms-editorial-production-ports';
import {
  cmsEditorialContextFor,
  correlationFor,
} from './cms-editorial-production-session';
import {
  createDeadline,
  fetchWithDeadline,
  parseJsonResponse,
  readRpcError,
} from './cms-editorial-production-transport';
import type {
  CmsEditorialProductionConfiguration,
  CmsEditorialServerSessionContext,
} from './cms-editorial-production-types';

/**
 * The Worker side of the in-process `quality_gate_evaluate` call (BE05c, D25):
 * one read-only service RPC loads the revision the checker needs, the pure
 * `cms.a11y.structural` module judges it within its 2,000 ms budget, and the
 * verified `PreflightEvidence` goes to the command RPC. The load persists
 * nothing and answers the checker input only; the database re-verifies the
 * evidence (provider, freshness, binding hash) before trusting it.
 */

export const QUALITY_GATE_RPC = 'cms_load_quality_gate_input' as const;

/** A revision's checker input is larger than an ordinary 256 KiB envelope. */
export const QUALITY_GATE_MAX_RESPONSE_BYTES = 1_048_576;

/** The browser operation each preflight phase belongs to (headers and logs). */
const PHASE_OPERATION = {
  submit: 'CMS-03B-05',
  schedule: 'CMS-03B-07',
  publish: 'CMS-03B-09',
  workflow_read: 'CMS-03B-15',
} as const;

const UNAVAILABLE: AccessibilityLoadResult = {
  ok: false,
  retryable: true,
  reason: 'dependency_unavailable',
};

const UNREADABLE: AccessibilityLoadResult = {
  ok: false,
  retryable: false,
  reason: 'target_unreadable',
};

export type QualityGateIdentity = Readonly<{
  operationId: string;
  requestId: string;
  correlationId: string;
}>;

/**
 * Load the checker input through the service RPC. A hidden, absent or
 * unreadable target is the same non-retryable `target_unreadable` (no existence
 * oracle); a dependency fault is retryable once by the gate.
 */
export const loadQualityGateInput = async (
  configuration: CmsEditorialProductionConfiguration,
  request: Readonly<Record<string, unknown>>,
  identity: QualityGateIdentity,
  signal: AbortSignal,
): Promise<AccessibilityLoadResult> => {
  const deadline = createDeadline(signal, CMS_A11Y_CHECKER_TIMEOUT_MS);
  try {
    const response = await fetchWithDeadline(
      configuration,
      `${configuration.baseUrl}/rest/v1/rpc/${QUALITY_GATE_RPC}`,
      {
        method: 'POST',
        headers: baseRpcHeaders(configuration, identity),
        body: JSON.stringify({ p_request: request }),
      },
      deadline,
    );
    if (!response.ok) return UNAVAILABLE;
    if (!response.value.ok) {
      const failure = mapCmsEditorialRpcFailure(
        response.value.status,
        await readRpcError(
          response.value,
          configuration.maxResponseBytes,
          deadline.signal,
        ),
      );
      return failure.status >= 500 ? UNAVAILABLE : UNREADABLE;
    }
    const parsed = await parseJsonResponse(
      response.value,
      QUALITY_GATE_MAX_RESPONSE_BYTES,
      deadline.signal,
    );
    return parsed.ok ? { ok: true, input: parsed.value } : UNREADABLE;
  } finally {
    deadline.dispose();
  }
};

/** The gate run as a redacted log event: state, duration and counts only. */
export const logQualityGateRun = (
  logger: Logger,
  identity: QualityGateIdentity,
  run: AccessibilityGateRun,
): void => {
  logger.info(
    {
      eventName: 'cms.editorial.accessibility_gate',
      operation: `cms.editorial.${identity.operationId}`,
      outcome: run.state === 'failed' ? 'failure' : 'success',
      requestId: identity.requestId,
      correlationId: identity.correlationId,
      durationMs: run.durationMs,
      retryable: run.state === 'failed',
      attributes: {
        checker_state: run.state,
        ...(run.state === 'failed' ? { failure_code: run.failureCode } : {}),
      },
      metrics: {
        cms_a11y_checker_duration_ms: run.durationMs,
        ...(run.state === 'failed'
          ? {}
          : { blocking_findings: run.result.blockingCount }),
      },
    },
    { samplingClass: 'always', highRisk: run.state === 'failed' },
  );
};

export type CmsEditorialQualityGateOptions = Readonly<{
  configuration: CmsEditorialProductionConfiguration;
  contexts: WeakMap<Request, CmsEditorialServerSessionContext>;
  logger: Logger;
}>;

const requestFor = (
  input: CmsEditorialQualityGateInput,
  options: CmsEditorialQualityGateOptions,
): Readonly<Record<string, unknown>> => ({
  phase: input.phase,
  ...(input.entryId === null ? {} : { entryId: input.entryId }),
  ...(input.revisionId === null ? {} : { revisionId: input.revisionId }),
  context: cmsEditorialContextFor(
    input,
    options.contexts,
    options.configuration.now,
  ),
});

/** Compose the browser-route quality gate over the protected RPC transport. */
export const createCmsEditorialQualityGate =
  (options: CmsEditorialQualityGateOptions): CmsEditorialQualityGate =>
  async (input, signal) => {
    const identity: QualityGateIdentity = {
      operationId: PHASE_OPERATION[input.phase],
      requestId: input.requestId,
      correlationId: correlationFor(input),
    };
    const run = await evaluateAccessibilityGate({
      load: (gateSignal) =>
        loadQualityGateInput(
          options.configuration,
          requestFor(input, options),
          identity,
          gateSignal,
        ),
      now: options.configuration.now,
      signal,
    });
    logQualityGateRun(options.logger, identity, run);
    return toPreflightEvidence(run);
  };
