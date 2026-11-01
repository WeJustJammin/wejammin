import { cmsEditorialRoutePolicies } from '@wejammin/contracts';

import { type Result } from './admission-common';
import { dependencyDeadline, dependencyTimedOut } from './admission-deadline';
import {
  CMS_EDITORIAL_REVISION_OPERATION_ID,
  type CmsEditorialDependencies,
  type CmsEditorialRateLimitInput,
  type CmsEditorialSession,
  type CmsEditorialTelemetryEvent,
} from './types';

const policy = cmsEditorialRoutePolicies.find(
  (item) => item.operationId === CMS_EDITORIAL_REVISION_OPERATION_ID,
) as (typeof cmsEditorialRoutePolicies)[number];

export const emitTelemetry = async (
  dependencies: CmsEditorialDependencies,
  event: CmsEditorialTelemetryEvent,
): Promise<void> => {
  try {
    await dependencies.telemetry?.(event);
  } catch {
    // Telemetry is never allowed to change a completed response.
  }
};

export const rateCheck = async (
  request: Request,
  dependencies: CmsEditorialDependencies,
  session: CmsEditorialSession,
  routePolicy: (typeof cmsEditorialRoutePolicies)[number] = policy,
  deadlineAt?: number,
): Promise<Result<Headers>> => {
  const headers = new Headers();
  for (const scope of ['user', 'party'] as const) {
    if (scope === 'party' && session.actingPartyId === null) continue;
    const remainingMs =
      deadlineAt === undefined
        ? (dependencies.deadlineMs ?? routePolicy.timeoutMs)
        : Math.ceil(deadlineAt - performance.now());
    if (remainingMs <= 0) return dependencyTimedOut();
    const result = await dependencyDeadline(
      (signal) =>
        dependencies.rateLimit(
          {
            operationId:
              routePolicy.operationId as CmsEditorialRateLimitInput['operationId'],
            request,
            actorId:
              scope === 'user'
                ? session.userId
                : (session.actingPartyId as string),
            actingPartyId: session.actingPartyId,
            principalClass: 'human',
            rateClass: routePolicy.rateClass,
            limit:
              scope === 'user'
                ? routePolicy.rateLimit
                : routePolicy.partyRateLimit,
            windowSeconds: routePolicy.rateWindowSeconds,
            rateScope: scope,
          },
          signal,
        ),
      remainingMs,
      request.signal,
    );
    if (!result.ok) return result;
    const decision = result.value;
    if (!decision.allowed) {
      const nowMs = dependencies.now?.() ?? Date.now();
      const nowSeconds = Math.floor(nowMs / 1000);
      const retryAfterSeconds = Math.max(1, decision.resetAt - nowSeconds);
      return {
        ok: false,
        status: 429,
        code: 'RATE_LIMITED',
        message: 'Too many CMS editorial requests.',
        details: {
          retryAfterSeconds,
          limit: decision.limit,
          resetAt: String(decision.resetAt),
        },
        retryAfterSeconds,
      };
    }
    // Report the admitted user bucket; the party check still gates admission.
    if (scope === 'user') {
      headers.set('ratelimit-limit', String(decision.limit));
      headers.set('ratelimit-remaining', String(decision.remaining));
      headers.set('ratelimit-reset', String(decision.resetAt));
    }
  }
  return { ok: true, value: headers };
};
