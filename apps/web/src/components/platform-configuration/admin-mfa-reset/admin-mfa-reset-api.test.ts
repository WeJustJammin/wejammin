import { describe, expect, it } from 'vitest';

import {
  apiDeps,
  apiError,
  json,
  stubFetch,
} from '../../identity-authority/step-up-mfa/step-up-mfa.test-support';
import { ADMIN_RESET_PATH, submitMfaFactorReset } from './admin-mfa-reset-api';

const PERSON = '0195b6f0-0000-7000-8000-0000000000aa';
const ID = '0195b6f0-0000-7000-8000-0000000000bb';
const reset = (state: 'completed' | 'reconciling') => ({
  resetId: ID,
  targetPersonId: PERSON,
  state,
  removedFactorCount: 2,
  mfaVersion: '7',
  outboxEventId: ID,
});

describe('submitMfaFactorReset (CFG-05B-06)', () => {
  it('[P2-S09-AC-1112] [P2-S09-AC-1113] posts exactly the strict body with an Idempotency-Key and CSRF header', async () => {
    const fetchImpl = stubFetch(json(200, reset('completed')));
    const outcome = await submitMfaFactorReset(
      { targetPersonId: PERSON, reason: 'Lost phone' },
      'reset-key-0001',
      apiDeps(fetchImpl),
    );
    expect(outcome).toMatchObject({
      ok: true,
      data: { state: 'completed', removedFactorCount: 2 },
    });
    const call = fetchImpl.calls[0];
    expect(call?.url).toBe(ADMIN_RESET_PATH);
    expect(ADMIN_RESET_PATH).toBe('/api/v1/admin/identity/mfa-factor-resets');
    expect(call?.method).toBe('POST');
    expect(call?.body).toEqual({
      targetPersonId: PERSON,
      reason: 'Lost phone',
    });
    expect(call?.headers.get('idempotency-key')).toBe('reset-key-0001');
    expect(call?.headers.get('x-csrf-token')).toMatch(/^csrf-/u);
    expect(call?.headers.get('if-match')).toBeNull();
  });

  it('accepts 202 reconciling as ok without promoting it to completed', async () => {
    const outcome = await submitMfaFactorReset(
      { targetPersonId: PERSON, reason: 'r' },
      'reset-key-0001',
      apiDeps(stubFetch(json(202, reset('reconciling')))),
    );
    expect(outcome).toMatchObject({ ok: true, data: { state: 'reconciling' } });
  });

  it('turns a malformed success body into a 502 failure', async () => {
    const outcome = await submitMfaFactorReset(
      { targetPersonId: PERSON, reason: 'r' },
      'reset-key-0001',
      apiDeps(stubFetch(json(200, { state: 'completed' }))),
    );
    expect(outcome).toMatchObject({
      ok: false,
      failure: { status: 502, code: 'INVALID_RESPONSE' },
    });
  });

  it('surfaces the parsed ApiError and network failures', async () => {
    const denied = await submitMfaFactorReset(
      { targetPersonId: PERSON, reason: 'r' },
      'reset-key-0001',
      apiDeps(stubFetch(apiError(403, 'FORBIDDEN'))),
    );
    expect(denied).toMatchObject({
      ok: false,
      failure: { status: 403, code: 'FORBIDDEN' },
    });
    const down = await submitMfaFactorReset(
      { targetPersonId: PERSON, reason: 'r' },
      'reset-key-0001',
      apiDeps(stubFetch(new Error('offline'))),
    );
    expect(down).toMatchObject({
      ok: false,
      failure: { status: 0, code: 'NETWORK_ERROR' },
    });
  });

  it('never sends an invalid body', async () => {
    const fetchImpl = stubFetch(json(200, reset('completed')));
    const outcome = await submitMfaFactorReset(
      { targetPersonId: 'nope', reason: '' },
      'reset-key-0001',
      apiDeps(fetchImpl),
    );
    expect(outcome).toMatchObject({ ok: false, failure: { status: 400 } });
    expect(fetchImpl.calls).toHaveLength(0);
  });
});
