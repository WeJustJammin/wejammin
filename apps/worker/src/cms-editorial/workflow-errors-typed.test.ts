import { describe, expect, it } from 'vitest';

import {
  ApiErrorSchema,
  CmsEditorialRefusalDetailsSchema,
  CmsPreflightUnavailableDetailsSchema,
  cmsEditorialRoutePolicies,
} from '@wejammin/contracts';

import {} from '../authentication/step-up';
import {
  normalizedWorkflowError,
  WORKFLOW_OPERATION_IDS,
} from './workflow-errors';
import type { CmsEditorialError } from './types';

/*
 * The Slice 11 error boundary (BE03b "Contract and error matrix"): every
 * browser refusal is projected through the operation's declared statuses and
 * closed reason tokens. A port is untrusted, so nothing outside the allowlist
 * and the contract's strict detail schemas ever reaches a client.
 */

const policyOf = (operationId: string) =>
  cmsEditorialRoutePolicies.find(
    (item) => item.operationId === operationId,
  ) as (typeof cmsEditorialRoutePolicies)[number];

const failure = (
  status: number,
  extra: Partial<Omit<CmsEditorialError, 'ok' | 'status'>> = {},
): CmsEditorialError =>
  ({
    ok: false,
    status,
    code: 'PRIVATE_CODE',
    message: 'private dependency text that must never be published',
    ...extra,
  }) as CmsEditorialError;

const submit = policyOf('CMS-03B-05');
const decision = policyOf('CMS-03B-06');
const schedule = policyOf('CMS-03B-07');
const publish = policyOf('CMS-03B-09');
const assignment = policyOf('CMS-03B-18');
const workflowRead = policyOf('CMS-03B-15');

describe('422 projection', () => {
  it('publishes preflight_failed with at most seventeen bare entries', () => {
    const entries = Array.from({ length: 17 }, () => ({
      category: 'contract',
      outcome: 'failed',
      reasonCode: 'value_invalid',
      blockingCount: 9,
      text: 'finding text',
    }));
    const projected = normalizedWorkflowError(
      failure(422, {
        details: { reasonCode: 'preflight_failed', preflight: entries },
      }),
      publish,
    );
    expect(projected.details).toEqual({
      reasonCode: 'preflight_failed',
      preflight: entries.map(({ category, outcome, reasonCode }) => ({
        category,
        outcome,
        reasonCode,
      })),
    });
  });

  it('keeps violations beside a typed time-authority token', () => {
    const violations = [
      { path: '/tzdbVersion', code: 'tzdb_version_mismatch', message: 'x' },
    ];
    expect(
      normalizedWorkflowError(
        failure(422, {
          details: {
            reasonCode: 'tzdb_version_mismatch',
            pinnedVersion: '2026e',
            violations,
            extra: 'dropped',
          },
        }),
        schedule,
      ).details,
    ).toEqual({
      reasonCode: 'tzdb_version_mismatch',
      pinnedVersion: '2026e',
      violations: [
        {
          path: '/tzdbVersion',
          code: 'tzdb_version_mismatch',
          message: 'The value is invalid.',
        },
      ],
    });
  });

  it.each([
    ['resolved_utc_mismatch', { expectedUtc: '2026-11-01T14:30:00Z' }],
    [
      'schedule_out_of_horizon',
      { minUtc: '2026-10-08T12:01:00Z', maxUtc: '2027-10-09T12:00:00Z' },
    ],
    [
      'nonexistent_local_time',
      {
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
      },
    ],
    [
      'ambiguous_local_time',
      {
        alternatives: [
          { disambiguation: 'earlier', resolvedUtc: '2026-11-01T05:30:00Z' },
          { disambiguation: 'later', resolvedUtc: '2026-11-01T06:30:00Z' },
        ],
      },
    ],
    ['unknown_timezone', {}],
    ['disambiguation_not_applicable', {}],
    ['authority_ends_before_schedule', {}],
  ] as const)('publishes %s with its members', (reasonCode, members) => {
    const projected = normalizedWorkflowError(
      failure(422, { details: { reasonCode, ...members } }),
      schedule,
    );
    expect(projected.details).toEqual({ reasonCode, ...members });
    expect(
      CmsEditorialRefusalDetailsSchema.safeParse(projected.details).success,
    ).toBe(true);
  });

  it('drops a structured token that lacks its required members', () => {
    expect(
      normalizedWorkflowError(
        failure(422, { details: { reasonCode: 'resolved_utc_mismatch' } }),
        schedule,
      ).details,
    ).toEqual({});
  });

  it('drops a preflight report that is not a list', () => {
    expect(
      normalizedWorkflowError(
        failure(422, {
          details: { reasonCode: 'preflight_failed', preflight: 'all' },
        }),
        publish,
      ).details,
    ).toEqual({});
  });

  it('publishes no typed token on a row that registers none', () => {
    const entryRow = policyOf('CMS-03B-01');
    expect(
      normalizedWorkflowError(
        failure(409, { details: { reasonCode: 'review_not_open' } }),
        entryRow,
      ).details,
    ).toEqual({ conflict: 'INVALID_TRANSITION', recoveryAction: 'refresh' });
    expect(
      normalizedWorkflowError(
        failure(503, { details: { dependencyClass: 'preflight' } }),
        entryRow,
      ).details,
    ).toEqual({ dependencyClass: 'cms_editorial', retryable: true });
  });

  it('drops a typed token the operation does not register', () => {
    expect(
      normalizedWorkflowError(
        failure(422, { details: { reasonCode: 'expiry_out_of_bounds' } }),
        schedule,
      ).details,
    ).toEqual({});
    expect(
      normalizedWorkflowError(
        failure(422, { details: { reasonCode: 'expiry_out_of_bounds' } }),
        assignment,
      ).details,
    ).toEqual({ reasonCode: 'expiry_out_of_bounds' });
  });
});

describe('transport statuses', () => {
  it('publishes the registered preflight unavailability', () => {
    const projected = normalizedWorkflowError(
      failure(503, {
        details: { dependencyClass: 'preflight', retryAfterSeconds: 30 },
      }),
      publish,
    );
    expect(projected).toMatchObject({
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
      details: {
        dependencyClass: 'preflight',
        retryable: true,
        retryAfterSeconds: 30,
      },
      retryAfterSeconds: 30,
    });
    expect(
      CmsPreflightUnavailableDetailsSchema.safeParse(projected.details).success,
    ).toBe(true);
  });

  it('retries a preflight outage after the default delay when no hint is given', () => {
    const projected = normalizedWorkflowError(
      failure(503, { details: { dependencyClass: 'preflight' } }),
      submit,
    );
    expect(projected.details).toEqual({
      dependencyClass: 'preflight',
      retryable: true,
    });
    expect(projected.retryAfterSeconds).toBe(5);
  });

  it('publishes ordinary dependency unavailability for the generic dependency', () => {
    for (const details of [
      undefined,
      { dependencyClass: 'private' },
    ] as const) {
      const projected = normalizedWorkflowError(
        failure(503, details === undefined ? {} : { details }),
        publish,
      );
      expect(projected.details).toEqual({
        dependencyClass: 'cms_editorial',
        retryable: true,
      });
      expect(projected.retryAfterSeconds).toBe(5);
    }
  });

  it('never publishes a preflight class on a row that evaluates no preflight', () => {
    expect(
      normalizedWorkflowError(
        failure(503, { details: { dependencyClass: 'preflight' } }),
        decision,
      ).details,
    ).toEqual({ dependencyClass: 'cms_editorial', retryable: true });
  });

  it('clamps the preflight retry hint to the contract bound', () => {
    expect(
      normalizedWorkflowError(
        failure(503, {
          details: { dependencyClass: 'preflight', retryAfterSeconds: 99_999 },
        }),
        publish,
      ).details,
    ).toEqual({
      dependencyClass: 'preflight',
      retryable: true,
      retryAfterSeconds: 3600,
    });
  });

  it('publishes the canonical 502, 504 and 500 envelopes', () => {
    expect(normalizedWorkflowError(failure(502), publish)).toMatchObject({
      status: 502,
      code: 'BAD_GATEWAY',
      details: { dependencyClass: 'cms_editorial', retryable: false },
    });
    expect(normalizedWorkflowError(failure(504), publish)).toMatchObject({
      status: 504,
      code: 'GATEWAY_TIMEOUT',
      details: { dependencyClass: 'cms_editorial', retryable: true },
      retryAfterSeconds: 5,
    });
    expect(normalizedWorkflowError(failure(500), publish)).toMatchObject({
      status: 500,
      code: 'INTERNAL_ERROR',
      details: {},
    });
  });

  it('keeps the bounded rate details of a 429', () => {
    const projected = normalizedWorkflowError(
      failure(429, {
        retryAfterSeconds: 7,
        details: {
          limit: 30,
          resetAt: '1234567',
          retryAfterSeconds: 7,
          secret: 1,
        },
      }),
      submit,
    );
    expect(projected).toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
      details: { limit: 30, resetAt: '1234567', retryAfterSeconds: 7 },
      retryAfterSeconds: 7,
    });
    const bare = normalizedWorkflowError(
      failure(429, { details: { limit: 0, resetAt: 'x' } }),
      submit,
    );
    expect(bare.details).toEqual({ retryAfterSeconds: 1 });
  });

  it('allows request media only on a body-carrying command', () => {
    expect(normalizedWorkflowError(failure(415), submit).details).toEqual({
      allowedMediaTypes: ['application/json'],
    });
    expect(normalizedWorkflowError(failure(415), workflowRead).details).toEqual(
      {
        allowedMediaTypes: [],
      },
    );
  });
});

describe('published envelope', () => {
  it('always validates as an ApiError and never carries dependency text', () => {
    for (const operationId of WORKFLOW_OPERATION_IDS) {
      const policy = policyOf(operationId);
      for (const status of Object.values(policy.errors)) {
        const projected = normalizedWorkflowError(failure(status), policy);
        expect(projected.message).not.toContain('private');
        expect(
          ApiErrorSchema.safeParse({
            code: projected.code,
            message: projected.message,
            details: projected.details,
            requestId: '00000000-0000-4000-8000-000000000000',
          }).success,
        ).toBe(true);
      }
    }
  });
});
