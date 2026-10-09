import { describe, expect, it } from 'vitest';

import { projectCmsWorkflowErrorDetails as project } from './cms-workflow-platform-errors';

/*
 * The Slice 11 first-party error relay rebuilds every published detail from the
 * generated closed vocabularies (CmsEditorialRefusalDetailsSchema, the stale
 * version, preflight-unavailable and step-up schemas) and the operation's own
 * reason set. Nothing the upstream wrote is copied verbatim.
 */
const HASH = 'c'.repeat(64);

describe('401 detail relay', () => {
  it('relays the exact step-up recovery action and method list for STEP_UP_REQUIRED', () => {
    expect(
      project('CMS-03B-06', 401, 'STEP_UP_REQUIRED', {
        recoveryAction: 'step_up',
        allowedMethods: ['totp'],
        leaked: 'x',
      }),
    ).toEqual({ recoveryAction: 'step_up', allowedMethods: ['totp'] });
    expect(
      project('CMS-03B-06', 401, 'STEP_UP_REQUIRED', {
        recoveryAction: 'step_up',
        allowedMethods: ['totp', 'sms'],
      }),
    ).toEqual({ recoveryAction: 'step_up', allowedMethods: ['totp', 'sms'] });
  });

  it('collapses a malformed step-up detail to nothing so the browser degrades', () => {
    expect(
      project('CMS-03B-06', 401, 'STEP_UP_REQUIRED', {
        recoveryAction: 'reauthenticate',
        allowedMethods: ['totp'],
      }),
    ).toEqual({});
    expect(project('CMS-03B-06', 401, 'STEP_UP_REQUIRED', 'text')).toEqual({});
  });

  it('keeps only the reauthenticate recovery for a plain UNAUTHENTICATED', () => {
    expect(
      project('CMS-03B-05', 401, 'UNAUTHENTICATED', {
        recoveryAction: 'reauthenticate',
        extra: 1,
      }),
    ).toEqual({ recoveryAction: 'reauthenticate' });
    expect(
      project('CMS-03B-05', 401, 'UNAUTHENTICATED', { recoveryAction: 'x' }),
    ).toEqual({});
  });
});

describe('403 detail relay', () => {
  it('relays only the two registered gate tokens an operation may publish', () => {
    expect(
      project('CMS-03B-09', 403, 'FORBIDDEN', {
        reasonCode: 'separation_of_duties',
      }),
    ).toEqual({ reasonCode: 'separation_of_duties' });
    expect(
      project('CMS-03B-06', 403, 'FORBIDDEN', {
        reasonCode: 'capability_missing',
        capability: 'cms.publisher',
      }),
    ).toEqual({});
  });

  it('drops a token the operation does not publish and a token of another status', () => {
    expect(
      project('CMS-03B-08', 403, 'FORBIDDEN', {
        reasonCode: 'separation_of_duties',
      }),
    ).toEqual({});
    expect(
      project('CMS-03B-05', 403, 'FORBIDDEN', {
        reasonCode: 'review_not_open',
      }),
    ).toEqual({});
    expect(project('CMS-03B-05', 403, 'FORBIDDEN', null)).toEqual({});
  });
});

describe('409 detail relay', () => {
  it('relays a registered conflict reason with its structured members', () => {
    expect(
      project('CMS-03B-05', 409, 'CONFLICT', {
        reasonCode: 'dependency_changed',
        dependencyHash: HASH,
      }),
    ).toEqual({ reasonCode: 'dependency_changed', dependencyHash: HASH });
    expect(
      project('CMS-03B-06', 409, 'CONFLICT', { reasonCode: 'review_not_open' }),
    ).toEqual({ reasonCode: 'review_not_open' });
  });

  it('refuses a reason the operation cannot publish and keeps the stale-version kind', () => {
    expect(
      project('CMS-03B-06', 409, 'CONFLICT', {
        reasonCode: 'assignment_limit',
        conflict: 'VERSION_MISMATCH',
        recoveryAction: 'reload',
        currentVersion: '9',
      }),
    ).toEqual({
      conflict: 'VERSION_MISMATCH',
      recoveryAction: 'reload',
      currentVersion: '9',
    });
  });

  it('refuses a reason whose structured members are malformed', () => {
    expect(
      project('CMS-03B-05', 409, 'CONFLICT', {
        reasonCode: 'dependency_changed',
        dependencyHash: 'short',
      }),
    ).toEqual({});
  });

  it('keeps the idempotency mismatch kind without a reason', () => {
    expect(
      project('CMS-03B-07', 409, 'CONFLICT', {
        conflict: 'IDEMPOTENCY_MISMATCH',
        recoveryAction: 'use_new_idempotency_key',
      }),
    ).toEqual({
      conflict: 'IDEMPOTENCY_MISMATCH',
      recoveryAction: 'use_new_idempotency_key',
    });
  });
});

describe('422 detail relay', () => {
  it('relays the per-category preflight list without counts or text', () => {
    const preflight = [
      { category: 'contract', outcome: 'failed', reasonCode: 'value_invalid' },
      {
        category: 'accessibility',
        outcome: 'unavailable',
        reasonCode: 'checker_failed',
      },
    ];
    expect(
      project('CMS-03B-05', 422, 'VALIDATION_FAILED', {
        reasonCode: 'preflight_failed',
        preflight: preflight.map((entry) => ({ ...entry, blockingCount: 3 })),
      }),
    ).toEqual({});
    expect(
      project('CMS-03B-05', 422, 'VALIDATION_FAILED', {
        reasonCode: 'preflight_failed',
        preflight,
      }),
    ).toEqual({ reasonCode: 'preflight_failed', preflight });
  });

  it('relays the time-authority members of the schedule refusals', () => {
    const gap = {
      reasonCode: 'nonexistent_local_time',
      alternatives: [
        {
          localDateTime: '2026-03-08T01:30:00',
          resolvedUtc: '2026-03-08T06:30:00Z',
        },
        {
          localDateTime: '2026-03-08T03:30:00',
          resolvedUtc: '2026-03-08T07:30:00Z',
        },
      ],
    };
    expect(project('CMS-03B-07', 422, 'VALIDATION_FAILED', gap)).toEqual(gap);
    expect(
      project('CMS-03B-07', 422, 'VALIDATION_FAILED', {
        reasonCode: 'schedule_out_of_horizon',
        minUtc: '2026-10-08T12:01:00Z',
        maxUtc: '2027-10-09T12:00:00Z',
      }),
    ).toEqual({
      reasonCode: 'schedule_out_of_horizon',
      minUtc: '2026-10-08T12:01:00Z',
      maxUtc: '2027-10-09T12:00:00Z',
    });
  });

  it('falls back to bounded field violations when the reason is not publishable', () => {
    expect(
      project('CMS-03B-08', 422, 'VALIDATION_FAILED', {
        reasonCode: 'unknown_timezone',
        violations: [{ path: '/route', code: 'route_max', message: 'x' }],
      }),
    ).toEqual({
      violations: [
        { path: '/route', code: 'route_max', message: 'The value is invalid.' },
      ],
    });
  });
});

describe('503 and generic relay', () => {
  it('relays the preflight-unavailable dependency class with its retry hint', () => {
    expect(
      project('CMS-03B-09', 503, 'DEPENDENCY_UNAVAILABLE', {
        dependencyClass: 'preflight',
        retryable: true,
        retryAfterSeconds: 30,
      }),
    ).toEqual({
      dependencyClass: 'preflight',
      retryable: true,
      retryAfterSeconds: 30,
    });
  });

  it('keeps the generic dependency and rate-limit hints for every other answer', () => {
    expect(
      project('CMS-03B-09', 503, 'DEPENDENCY_UNAVAILABLE', {
        dependencyClass: 'cms_editorial',
        retryable: true,
        secret: 'x',
      }),
    ).toEqual({ dependencyClass: 'cms_editorial', retryable: true });
    expect(
      project('CMS-03B-18', 429, 'RATE_LIMITED', {
        limit: 10,
        retryAfterSeconds: 7,
        resetAt: '123',
      }),
    ).toEqual({ limit: 10, retryAfterSeconds: 7, resetAt: '123' });
    expect(project('CMS-03B-18', 404, 'NOT_FOUND', { a: 1 })).toEqual({});
  });
});
