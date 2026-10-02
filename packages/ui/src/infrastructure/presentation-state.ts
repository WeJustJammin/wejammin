import { InfrastructureViewStateSchema } from '@wejammin/contracts';
import type { InfrastructureViewState } from '@wejammin/contracts';

import type { InfrastructureStatePresentation } from './presentation-types.ts';

/**
 * Turns the server-owned state union into render hints. This function keeps
 * the discriminant and all recovery identifiers intact so a UI cannot turn a
 * typed failure into an unqualified success message.
 */
export function presentInfrastructureState(
  state: InfrastructureViewState,
): InfrastructureStatePresentation {
  const parsed = InfrastructureViewStateSchema.parse(state);

  switch (parsed.status) {
    case 'idle':
      return { status: parsed.status, busy: false };
    case 'loading':
      return {
        status: parsed.status,
        busy: true,
        startedAt: parsed.startedAt,
        preserveSafePriorContent: parsed.preserveSafePriorContent,
        showSkeleton: !parsed.preserveSafePriorContent,
      };
    case 'validation_error':
      return {
        status: parsed.status,
        httpStatus: parsed.httpStatus,
        error: parsed.error,
        retainedInput: parsed.retainedInput,
        retainsInput: true,
      };
    case 'unauthenticated':
      return { status: parsed.status, returnTo: parsed.returnTo };
    case 'capability_gate':
      return {
        status: parsed.status,
        recovery: parsed.recovery,
        requiredCapability: parsed.requiredCapability,
        protectedLabelsVisible: false,
      };
    case 'step_up_required':
      return {
        status: parsed.status,
        returnTo: parsed.returnTo,
        recoveryHref: `/step-up?returnTo=${encodeURIComponent(parsed.returnTo)}`,
        allowedMethods: parsed.allowedMethods,
        gateRendered: false,
      };
    case 'not_found':
      return { status: parsed.status, disclosureSafe: true };
    case 'conflict':
      return {
        status: parsed.status,
        currentVersion: parsed.currentVersion,
        retainedInput: parsed.retainedInput,
        retainsInput: true,
      };
    case 'rate_wait':
      return {
        status: parsed.status,
        retryAt: parsed.retryAt,
        retainedInput: parsed.retainedInput,
        retainsInput: true,
      };
    case 'dependency_error':
      return {
        status: parsed.status,
        httpStatus: parsed.httpStatus,
        requestId: parsed.requestId,
        retryDelaysMs: parsed.safeRetryDelaysMs,
        safeRetry: true,
      };
    case 'empty':
      return { status: parsed.status, emptyReason: parsed.reason };
    case 'success':
      return {
        status: parsed.status,
        record: parsed.record,
        recordVersion: parsed.record.version,
      };
    case 'optimistic_pending':
      return {
        status: parsed.status,
        operationId: parsed.operationId,
        canonicalPreimage: parsed.canonicalPreimage,
      };
    case 'optimistic_rollback':
      return {
        status: parsed.status,
        operationId: parsed.operationId,
        restoredPreimage: true,
        canonicalPreimage: parsed.canonicalPreimage,
        error: parsed.error,
      };
    case 'disabled':
      return { status: parsed.status, prerequisite: parsed.prerequisite };
    case 'degraded':
      return {
        status: parsed.status,
        scope: parsed.scope,
        requestId: parsed.requestId,
        lastKnownGood: parsed.lastKnownGood?.record ?? null,
        freshnessLabel: parsed.lastKnownGood?.verifiedAt ?? null,
      };
  }
}
