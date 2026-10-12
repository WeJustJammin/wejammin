import { describe, expect, it } from 'vitest';

import {
  cmsEditorialDeclaredStatuses,
  cmsEditorialDeclaresError,
  cmsEditorialRoutePolicies,
} from './index';

/*
 * BE00 lines 172 and 590: `DEPENDENCY_UNAVAILABLE` is the only global code for
 * a dependency failure, 502 when a contacted dependency answers invalid data and
 * 503 when it is unavailable. No spec or decision defines `BAD_GATEWAY`, so no
 * CMS editorial route may declare or emit it.
 */
describe('[BE00:172][BE00:590] a CMS editorial 502 is DEPENDENCY_UNAVAILABLE', () => {
  it('registers the eighteen editorial rows this guard covers', () => {
    expect(cmsEditorialRoutePolicies).toHaveLength(18);
  });

  it('never declares BAD_GATEWAY on any editorial route', () => {
    for (const policy of cmsEditorialRoutePolicies)
      expect(Object.keys(policy.errors), policy.operationId).not.toContain(
        'BAD_GATEWAY',
      );
  });

  it('declares DEPENDENCY_UNAVAILABLE for 502 and 503 and keeps 504 as GATEWAY_TIMEOUT on every route', () => {
    for (const policy of cmsEditorialRoutePolicies) {
      const { operationId, errors } = policy;
      expect(
        cmsEditorialDeclaresError(errors, 'DEPENDENCY_UNAVAILABLE', 502),
        `${operationId} 502`,
      ).toBe(true);
      expect(
        cmsEditorialDeclaresError(errors, 'DEPENDENCY_UNAVAILABLE', 503),
        `${operationId} 503`,
      ).toBe(true);
      expect(
        cmsEditorialDeclaresError(errors, 'GATEWAY_TIMEOUT', 504),
        `${operationId} 504`,
      ).toBe(true);
      expect(
        cmsEditorialDeclaresError(errors, 'DEPENDENCY_UNAVAILABLE', 504),
        `${operationId} 504 is not DEPENDENCY_UNAVAILABLE here`,
      ).toBe(false);
    }
  });

  it('keeps 500 INTERNAL_ERROR and the 502/503/504 status cells on every route', () => {
    for (const policy of cmsEditorialRoutePolicies) {
      const statuses = cmsEditorialDeclaredStatuses(policy.errors);
      expect(statuses, policy.operationId).toEqual(
        expect.arrayContaining([400, 401, 415, 422, 429, 500, 502, 503, 504]),
      );
      expect(
        cmsEditorialDeclaresError(policy.errors, 'INTERNAL_ERROR', 500),
        policy.operationId,
      ).toBe(true);
    }
  });
});

describe('cmsEditorialDeclaredStatuses', () => {
  it('flattens a multi-status code and lists every status once, ascending', () => {
    expect(
      cmsEditorialDeclaredStatuses({
        NOT_FOUND: 404,
        DEPENDENCY_UNAVAILABLE: [502, 503],
        INVALID_REQUEST: 400,
        UNAUTHENTICATED: 401,
        STEP_UP_REQUIRED: 401,
      }),
    ).toEqual([400, 401, 404, 502, 503]);
  });
});

describe('cmsEditorialDeclaresError', () => {
  const errors = {
    NOT_FOUND: 404,
    DEPENDENCY_UNAVAILABLE: [502, 503],
  } as const;

  it('accepts only a declared code with a declared status', () => {
    expect(cmsEditorialDeclaresError(errors, 'NOT_FOUND', 404)).toBe(true);
    expect(
      cmsEditorialDeclaresError(errors, 'DEPENDENCY_UNAVAILABLE', 502),
    ).toBe(true);
    expect(
      cmsEditorialDeclaresError(errors, 'DEPENDENCY_UNAVAILABLE', 503),
    ).toBe(true);
  });

  it('refuses a declared code on another status, an undeclared code and an inherited member', () => {
    expect(cmsEditorialDeclaresError(errors, 'NOT_FOUND', 403)).toBe(false);
    expect(
      cmsEditorialDeclaresError(errors, 'DEPENDENCY_UNAVAILABLE', 504),
    ).toBe(false);
    expect(cmsEditorialDeclaresError(errors, 'BAD_GATEWAY', 502)).toBe(false);
    expect(cmsEditorialDeclaresError(errors, 'constructor', 502)).toBe(false);
  });
});
