import { describe, expect, it } from 'vitest';

import { grantResource } from '../../server/cms-capability-grant.test-support';
import type { GrantCommandResult } from './cms-capability-grant-client';
import {
  COMMAND_COPY,
  stateForResult,
  type GrantCommandKind,
} from './cms-capability-grant-commands';

const WINDOW = { minDate: '2026-10-02', maxDate: '2026-12-30' } as const;

const result = (patch: Partial<GrantCommandResult>): GrantCommandResult => ({
  outcome: 'success',
  attempts: 1,
  reconciled: false,
  status: 201,
  retryAfterSeconds: null,
  resource: null,
  violations: [],
  requestId: null,
  recoveryAction: null,
  ...patch,
});

const failure = (
  kind: GrantCommandKind,
  patch: Partial<GrantCommandResult>,
) => {
  const state = stateForResult(kind, result(patch), WINDOW);
  if (state.status !== 'failure') throw new Error('expected a failure state');
  return state;
};

describe('[DEC-119] command success copy', () => {
  it('names only the capability label and valid-through date', () => {
    const state = stateForResult(
      'grant',
      result({ resource: grantResource() }),
      WINDOW,
    );
    expect(state).toStrictEqual({
      status: 'success',
      heading: 'Capability granted',
      announcement: 'Granted Author entries until 2026-10-31 (UTC).',
    });
    expect(JSON.stringify(state)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/u);
  });

  it('has renew and revoke wording', () => {
    expect(
      stateForResult(
        'renew',
        result({ status: 200, resource: grantResource() }),
        WINDOW,
      ),
    ).toMatchObject({
      heading: 'Grant renewed',
      announcement: 'Renewed Author entries until 2026-10-31 (UTC).',
    });
    expect(
      stateForResult(
        'revoke',
        result({
          status: 200,
          resource: grantResource({ state: 'revoked', lastAction: 'revoked' }),
        }),
        WINDOW,
      ),
    ).toMatchObject({
      heading: 'Grant revoked',
      announcement: 'Revoked Author entries.',
    });
  });

  it('succeeds with generic copy when no typed resource is available', () => {
    expect(stateForResult('grant', result({}), WINDOW)).toMatchObject({
      status: 'success',
      announcement: 'The capability grant was saved.',
    });
  });
});

describe('[DEC-119] command failure copy', () => {
  it('[P2-S09-AC-1000] [P2-S09-AC-1027] routes 401 STEP_UP_REQUIRED to the step-up action with exact copy', () => {
    const state = failure('grant', {
      outcome: 'step-up-required',
      status: 401,
    });
    expect(state.message).toBe('Verify your identity to change CMS access.');
    expect(state.action).toBe('step-up');
  });

  it('[P2-S09-AC-1001] [P2-S09-AC-1027] sends an unauthenticated session to sign-in', () => {
    expect(
      failure('renew', { outcome: 'unauthenticated', status: 401 }).action,
    ).toBe('sign-in');
  });

  it('[P2-S09-AC-1002] shows the owner gate copy for 403', () => {
    expect(
      failure('grant', { outcome: 'forbidden', status: 403 }).message,
    ).toBe('Only the organization owner can manage CMS access.');
  });

  it.each([
    [
      'grant',
      'That person could not be found as a member of your organization.',
      false,
    ],
    ['renew', 'This grant is no longer available.', true],
    ['revoke', 'This grant is no longer available.', true],
  ] as const)(
    '[P2-S09-AC-1003] 404 on %s is one non-disclosing refusal',
    (kind, message, refetch) => {
      const state = failure(kind, { outcome: 'not-found', status: 404 });
      expect(state.message).toBe(message);
      expect(state.refetch).toBe(refetch);
    },
  );

  it('[P2-S09-AC-1004] [P2-S09-AC-527] 409 on grant with the renew direction points at the existing grant; on renew/revoke it asks for review', () => {
    const grant = failure('grant', {
      outcome: 'conflict',
      status: 409,
      recoveryAction: 'renew',
    });
    expect(grant.message).toBe(
      'This person already holds this capability. Renew the existing grant instead.',
    );
    expect(grant.action).toBe('filter-capability');
    for (const kind of ['renew', 'revoke'] as const) {
      const state = failure(kind, { outcome: 'conflict', status: 409 });
      expect(state.message).toBe(
        'This grant changed. Review the current term and try again.',
      );
      expect(state.refetch).toBe(true);
    }
  });

  it('[P2-S09-AC-527] a grant 409 the API did not direct to renew never claims the person already holds the capability', () => {
    for (const recoveryAction of [
      null,
      'refresh',
      'use_new_idempotency_key',
      'reload',
    ]) {
      const grant = failure('grant', {
        outcome: 'conflict',
        status: 409,
        recoveryAction,
      });
      expect(grant.message).toBe(
        'This grant changed. Review the current term and try again.',
      );
      expect(grant.action).toBe('none');
      expect(grant.refetch).toBe(true);
    }
  });

  it('[P2-S09-AC-1005] 422 builds field errors from violations and a linked summary', () => {
    const state = failure('grant', {
      outcome: 'validation',
      status: 422,
      violations: [
        {
          pointer: '/validThrough',
          code: 'grant_term_spans_at_most_ninety_utc_days',
        },
      ],
    });
    expect(state.fieldErrors).toStrictEqual({
      validThrough: 'Choose an end date no more than 90 days from today (UTC).',
    });
    expect(state.message).toBe('Check the highlighted fields.');
  });

  it('[P2-S09-AC-1006] 429 carries the Retry-After countdown seconds', () => {
    const state = failure('grant', {
      outcome: 'rate-limited',
      status: 429,
      retryAfterSeconds: 12,
    });
    expect(state.retryAfterSeconds).toBe(12);
    expect(state.message).toBe('Too many requests. Try again shortly.');
  });

  it('[P2-S09-AC-1007] degraded never claims success and asks for a list refetch before retry', () => {
    const state = failure('grant', {
      outcome: 'degraded',
      status: 503,
      requestId: 'req-1',
    });
    expect(state.message).toBe(
      'The result of this change is not confirmed yet. Checking the current grants before you retry.',
    );
    expect(state.refetch).toBe(true);
    expect(state.requestId).toBe('req-1');
  });

  it('exposes the stable step-up return notice', () => {
    expect(COMMAND_COPY.entriesNotSaved).toBe('Your entries were not saved.');
  });
});
