import { describe, expect, it } from 'vitest';

import {
  CMS_SLICE_11_OPERATION_REASONS,
  CmsEditorialRefusalDetailsSchema,
  CmsStaleVersionDetailsSchema,
  cmsEditorialRoutePolicies,
  cmsSlice11ReasonStatus,
} from '@wejammin/contracts';

import { MFA_METHOD_REGISTRY } from '../authentication/step-up';
import {
  isWorkflowPolicy,
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

const hash = 'a'.repeat(64);
const submit = policyOf('CMS-03B-05');
const decision = policyOf('CMS-03B-06');
const workflowRead = policyOf('CMS-03B-15');
const queue = policyOf('CMS-03B-17');

describe('Slice 11 operation scope', () => {
  it('claims exactly the nine browser Slice 11 operations', () => {
    expect([...WORKFLOW_OPERATION_IDS].sort()).toEqual([
      'CMS-03B-05',
      'CMS-03B-06',
      'CMS-03B-07',
      'CMS-03B-08',
      'CMS-03B-09',
      'CMS-03B-15',
      'CMS-03B-16',
      'CMS-03B-17',
      'CMS-03B-18',
    ]);
    for (const id of WORKFLOW_OPERATION_IDS)
      expect(isWorkflowPolicy(policyOf(id))).toBe(true);
    expect(isWorkflowPolicy(policyOf('CMS-03B-01'))).toBe(false);
    expect(isWorkflowPolicy(policyOf('CMS-03B-13'))).toBe(false);
  });
});

describe('401 projection', () => {
  it('publishes STEP_UP_REQUIRED with the configured MFA methods when the row declares step-up', () => {
    const projected = normalizedWorkflowError(
      failure(401, { code: 'STEP_UP_REQUIRED' }),
      decision,
    );
    expect(projected).toMatchObject({
      status: 401,
      code: 'STEP_UP_REQUIRED',
      message: 'Recent verification is required.',
      details: {
        recoveryAction: 'step_up',
        allowedMethods: [...MFA_METHOD_REGISTRY],
      },
    });
  });

  it('never publishes STEP_UP_REQUIRED for a row without step-up', () => {
    const projected = normalizedWorkflowError(
      failure(401, { code: 'STEP_UP_REQUIRED' }),
      submit,
    );
    expect(projected).toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
      details: { recoveryAction: 'reauthenticate' },
    });
  });

  it('collapses every other 401 to reauthentication', () => {
    expect(
      normalizedWorkflowError(
        failure(401, { details: { recoveryAction: 'step_up' } }),
        decision,
      ),
    ).toMatchObject({
      code: 'UNAUTHENTICATED',
      details: { recoveryAction: 'reauthenticate' },
    });
  });
});

describe('403 projection', () => {
  it.each([
    ['capability_missing', submit],
    ['separation_of_duties', decision],
  ] as const)('publishes the registered %s token', (token, policy) => {
    const projected = normalizedWorkflowError(
      failure(403, { details: { reasonCode: token } }),
      policy,
    );
    expect(projected).toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
      details: { reasonCode: token },
    });
    expect(
      CmsEditorialRefusalDetailsSchema.safeParse(projected.details).success,
    ).toBe(true);
  });

  it('publishes no reason for an unregistered, foreign or absent token', () => {
    for (const reasonCode of [
      'private',
      'separation_of_duties',
      undefined,
    ] as const) {
      const projected = normalizedWorkflowError(
        failure(
          403,
          reasonCode === undefined ? {} : { details: { reasonCode } },
        ),
        workflowRead,
      );
      expect(projected.details).toEqual({});
    }
  });

  it('reports a status the row does not declare as a scrubbed 500', () => {
    expect(normalizedWorkflowError(failure(403), queue)).toEqual({
      ok: false,
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
      details: {},
    });
  });
});

describe('404 and 400 projection', () => {
  it('conceals a 404 with empty details', () => {
    const projected = normalizedWorkflowError(
      failure(404, { details: { reasonCode: 'capability_missing' } }),
      submit,
    );
    expect(projected).toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
      details: {},
    });
  });

  it('projects bounded safe violations only', () => {
    const projected = normalizedWorkflowError(
      failure(400, {
        details: {
          violations: [
            { path: '/revisionId', code: 'invalid_value', message: 'secret' },
            { path: 'not a pointer', code: 'x' },
            { path: '/a', code: 'Not-Lowercase' },
            'string',
            ...Array.from({ length: 60 }, (_, index) => ({
              path: `/p${index}`,
              code: 'invalid_value',
            })),
          ],
        },
      }),
      submit,
    );
    const violations = (projected.details as { violations: unknown[] })
      .violations;
    expect(violations).toHaveLength(50);
    expect(violations[0]).toEqual({
      path: '/revisionId',
      code: 'invalid_value',
      message: 'The value is invalid.',
    });
    expect(JSON.stringify(projected)).not.toContain('secret');
    expect(projected.message).toBe('The CMS editorial request is invalid.');
  });

  it('omits violations when none is a safe pointer', () => {
    const projected = normalizedWorkflowError(
      failure(400, { details: { violations: [{ path: 'bad' }] } }),
      submit,
    );
    expect(projected.details).toEqual({});
  });
});

describe('409 projection', () => {
  it('publishes a stale CAS operand with safe versions only', () => {
    const projected = normalizedWorkflowError(
      failure(409, {
        details: {
          conflict: 'VERSION_MISMATCH',
          recoveryAction: 'refresh',
          expectedVersion: '3',
          currentVersion: '4',
          reasonCode: 'dependency_changed',
        },
      }),
      decision,
    );
    expect(projected.details).toEqual({
      conflict: 'VERSION_MISMATCH',
      recoveryAction: 'refresh',
      expectedVersion: '3',
      currentVersion: '4',
    });
    expect(
      CmsStaleVersionDetailsSchema.safeParse(projected.details).success,
    ).toBe(true);
  });

  it('drops malformed versions and defaults the recovery to reload', () => {
    const projected = normalizedWorkflowError(
      failure(409, {
        details: {
          conflict: 'VERSION_MISMATCH',
          recoveryAction: 'use_new_idempotency_key',
          expectedVersion: '03',
          currentVersion: 4,
        },
      }),
      decision,
    );
    expect(projected.details).toEqual({
      conflict: 'VERSION_MISMATCH',
      recoveryAction: 'reload',
    });
  });

  it('publishes an idempotency mismatch with its recovery', () => {
    expect(
      normalizedWorkflowError(
        failure(409, { details: { conflict: 'IDEMPOTENCY_MISMATCH' } }),
        decision,
      ).details,
    ).toEqual({
      conflict: 'IDEMPOTENCY_MISMATCH',
      recoveryAction: 'use_new_idempotency_key',
    });
  });

  it('publishes a plain state conflict as a refreshable invalid transition', () => {
    for (const details of [undefined, { conflict: 'private' }] as const) {
      expect(
        normalizedWorkflowError(
          failure(409, details === undefined ? {} : { details }),
          decision,
        ).details,
      ).toEqual({ conflict: 'INVALID_TRANSITION', recoveryAction: 'refresh' });
    }
  });

  it('publishes every registered 409 reason of the operation as exactly its reasonCode', () => {
    for (const [operationId, reasons] of Object.entries(
      CMS_SLICE_11_OPERATION_REASONS,
    )) {
      const policy = policyOf(operationId);
      for (const reason of reasons) {
        if (cmsSlice11ReasonStatus(reason) !== 409) continue;
        if (reason === 'dependency_changed') continue;
        expect(
          normalizedWorkflowError(
            failure(409, { details: { reasonCode: reason } }),
            policy,
          ).details,
        ).toEqual({ reasonCode: reason });
      }
    }
  });

  it('requires the dependency hash for dependency_changed and publishes only that member', () => {
    expect(
      normalizedWorkflowError(
        failure(409, {
          details: {
            reasonCode: 'dependency_changed',
            dependencyHash: hash,
            x: 1,
          },
        }),
        submit,
      ).details,
    ).toEqual({ reasonCode: 'dependency_changed', dependencyHash: hash });
    // Without the proof the strict detail schema fails: the reason is dropped.
    expect(
      normalizedWorkflowError(
        failure(409, { details: { reasonCode: 'dependency_changed' } }),
        submit,
      ).details,
    ).toEqual({ conflict: 'INVALID_TRANSITION', recoveryAction: 'refresh' });
  });

  it('drops a token another operation owns or one whose status disagrees', () => {
    const foreign = normalizedWorkflowError(
      failure(409, { details: { reasonCode: 'assignment_limit' } }),
      submit,
    );
    expect(foreign.details).toEqual({
      conflict: 'INVALID_TRANSITION',
      recoveryAction: 'refresh',
    });
    const wrongStatus = normalizedWorkflowError(
      failure(409, { details: { reasonCode: 'capability_missing' } }),
      submit,
    );
    expect(wrongStatus.details).toEqual({
      conflict: 'INVALID_TRANSITION',
      recoveryAction: 'refresh',
    });
  });

  it('publishes the cursor conflict of the queue as a refreshable conflict', () => {
    expect(normalizedWorkflowError(failure(409), queue).details).toEqual({
      conflict: 'INVALID_TRANSITION',
      recoveryAction: 'refresh',
    });
  });
});
