import { describe, expect, it } from 'vitest';

import { governedApiError } from '../../server/cms-governed-review-fixtures.test-support';
import { GOVERNED_COMMAND_SPECS } from './governed-review-command-specs';
import { sendGovernedCommand } from './governed-review-command-transport';
import {
  catalogError,
  decideInput,
  environment,
  fetcherFor,
  submitInput,
} from './governed-review-transport.test-support';

describe('sendGovernedCommand failures', () => {
  const send = (response: Response | Error) =>
    sendGovernedCommand(
      GOVERNED_COMMAND_SPECS['CMS-03C-07'],
      decideInput,
      environment(fetcherFor(response)),
    );

  it('keeps the key on a lost connection, a 5xx, a redirect and a marked refusal', async () => {
    for (const response of [
      new Error('offline'),
      catalogError(503, 'DEPENDENCY_UNAVAILABLE'),
      catalogError(500, 'INTERNAL_ERROR'),
      new Response(null, { status: 302 }),
      new Response(
        JSON.stringify(governedApiError('GOVERNED_REVIEW_FORBIDDEN', 'm', {})),
        {
          status: 403,
          headers: { 'x-cms-editorial-outcome': 'unknown' },
        },
      ),
    ])
      expect((await send(response)).kind).toBe('unknown');
  });

  it('reads a plain 401 as a sign-out and keeps the request id', async () => {
    const result = await send(catalogError(401, 'UNAUTHENTICATED'));
    expect(result.kind).toBe('signed-out');
  });

  it('reads STEP_UP_REQUIRED as step-up navigation, and without a usable method as degraded', async () => {
    const stepUp = await send(
      catalogError(401, 'STEP_UP_REQUIRED', {
        recoveryAction: 'step_up',
        allowedMethods: ['totp'],
      }),
    );
    expect(stepUp).toEqual({ kind: 'step-up', recovery: { kind: 'navigate' } });
    const none = await send(
      catalogError(401, 'STEP_UP_REQUIRED', {
        recoveryAction: 'step_up',
        allowedMethods: ['sms'],
      }),
    );
    expect(none.kind === 'step-up' && none.recovery.kind).toBe('no-method');
  });

  it('classifies a definite refusal with its registered reason and the pointers it names', async () => {
    const result = await send(
      catalogError(422, 'GOVERNED_REVIEW_VALIDATION_FAILED', {
        violations: [{ path: '/reason', code: 'invalid' }],
      }),
    );
    expect(result.kind === 'refused' && result.refusal).toMatchObject({
      status: 422,
      code: 'GOVERNED_REVIEW_VALIDATION_FAILED',
      reason: null,
      violations: [{ path: '/reason', code: 'invalid' }],
    });
  });

  it.each([
    [403, 'GOVERNED_REVIEW_FORBIDDEN', 'separation_of_duties'],
    [409, 'GOVERNED_REVIEW_VERSION_CONFLICT', 'duplicate_decision'],
    [409, 'GOVERNED_REVIEW_VERSION_CONFLICT', 'specialist_slot_unsatisfiable'],
    [409, 'GOVERNED_REVIEW_VERSION_CONFLICT', 'dependency_changed'],
  ] as const)(
    'carries the registered %i reason %s with reasonCode %s',
    async (status, code, reason) => {
      const result = await send(
        catalogError(status, code, { reasonCode: reason }),
      );
      expect(result.kind === 'refused' && result.refusal.reason).toBe(reason);
    },
  );

  it('drops a reason that is not registered for the operation or not at its status', async () => {
    for (const [status, code, reasonCode] of [
      [409, 'GOVERNED_REVIEW_VERSION_CONFLICT', 'assignment_exists'],
      [403, 'GOVERNED_REVIEW_FORBIDDEN', 'duplicate_decision'],
      [409, 'GOVERNED_REVIEW_VERSION_CONFLICT', 'made_up'],
    ] as const) {
      const result = await send(catalogError(status, code, { reasonCode }));
      expect(result.kind === 'refused' && result.refusal.reason).toBeNull();
    }
  });

  it('reads the retry hint of a 429 from the details or the header', async () => {
    const result = await send(
      catalogError(429, 'RATE_LIMITED', { retryAfterSeconds: 12 }),
    );
    expect(result.kind === 'refused' && result.refusal.retryAfterSeconds).toBe(
      12,
    );
    const header = catalogError(429, 'RATE_LIMITED');
    header.headers.set('retry-after', '30');
    const second = await send(header);
    expect(second.kind === 'refused' && second.refusal.retryAfterSeconds).toBe(
      30,
    );
  });

  it('names the canonical domain of a submission refusal only when it is one of the closed six', async () => {
    const submit = (domain: unknown) =>
      sendGovernedCommand(
        GOVERNED_COMMAND_SPECS['CMS-03C-06'],
        submitInput,
        environment(
          fetcherFor(
            catalogError(422, 'GOVERNED_REVIEW_VALIDATION_FAILED', {
              reasonCode: 'canonical_source_unavailable',
              domain,
            }),
          ),
        ),
      );
    const named = await submit('gear');
    expect(named.kind === 'refused' && named.refusal.governed).toEqual({
      reason: 'canonical_source_unavailable',
      domain: 'gear',
    });
    const other = await submit('private SQL text');
    expect(other.kind === 'refused' && other.refusal.governed).toEqual({
      reason: 'canonical_source_unavailable',
      domain: null,
    });
  });
});
