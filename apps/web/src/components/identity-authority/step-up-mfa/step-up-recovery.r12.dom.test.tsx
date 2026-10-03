// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';

import {
  FACTOR_A,
  FACTOR_B,
  CHALLENGE_ID,
  apiDeps,
  apiError,
  factor,
  factorsResource,
  flush,
  json,
  stubFetch,
} from './step-up-mfa.test-support';
import {
  fillAndSubmitName,
  mountWizard,
  pressButton,
  type WizardHarness,
} from './mfa-wizard-support.test-support';
import { createStepUpChallenge, removeFactor, verifyStepUp } from './mfa-api';
import {
  PERSON,
  REASON,
  mountReset,
  openConfirmation,
  press,
} from '../../platform-configuration/admin-mfa-reset/admin-mfa-reset.test-support';
import { submitMfaFactorReset } from '../../platform-configuration/admin-mfa-reset/admin-mfa-reset-api';

/**
 * AC1031 web half for AUTH-API-17, -19, -20, -21 and CFG-05B-06 (DEC-111): a
 * 401 STEP_UP_REQUIRED routes to /step-up with the current location. The 401
 * reserved no idempotency record, so a command that has a key (AUTH-API-19,
 * CFG-05B-06) sends whichever key the draft supplies, original included, and
 * the two recovery routes (AUTH-API-20/21) carry no key at all.
 */

const STEP_UP = {
  recoveryAction: 'step_up',
  allowedMethods: ['totp'],
} as const;
const two = [factor(FACTOR_A), factor(FACTOR_B, 'verified', 'Laptop')];

let harness: WizardHarness | null = null;
afterEach(() => {
  harness?.mounted.unmount();
  harness = null;
});

describe('[P2-S09-AC-1031] AUTH-API-17 and AUTH-API-19 step-up recovery', () => {
  it('[P2-S09-AC-1031] AUTH-API-17: a 401 STEP_UP_REQUIRED routes to /step-up and the key-less request is sent once', async () => {
    const fetchImpl = stubFetch(apiError(401, 'STEP_UP_REQUIRED', STEP_UP));
    harness = mountWizard(fetchImpl, { factors: two });
    const container = harness.mounted.container;
    pressButton(container, 'Set up an authenticator');
    fillAndSubmitName(container, 'Laptop');
    await flush();
    expect(harness.navigate).toHaveBeenCalledExactlyOnceWith(
      `/step-up?returnTo=${encodeURIComponent('/settings/security/mfa')}`,
    );
    expect(fetchImpl.calls).toHaveLength(1);
    expect(fetchImpl.calls[0]?.method).toBe('POST');
    expect(fetchImpl.calls[0]?.headers.get('idempotency-key')).toBeNull();
    expect(fetchImpl.calls[0]?.headers.get('if-match')).not.toBeNull();
  });

  it('[P2-S09-AC-1031] AUTH-API-19: a 401 STEP_UP_REQUIRED routes to /step-up with the removal key sent on the request', async () => {
    const fetchImpl = stubFetch(apiError(401, 'STEP_UP_REQUIRED', STEP_UP));
    harness = mountWizard(fetchImpl, { factors: two });
    const container = harness.mounted.container;
    pressButton(container, 'Remove Phone a');
    pressButton(container, 'Remove authenticator');
    await flush();
    expect(harness.navigate).toHaveBeenCalledExactlyOnceWith(
      `/step-up?returnTo=${encodeURIComponent('/settings/security/mfa')}`,
    );
    expect(fetchImpl.calls[0]?.method).toBe('DELETE');
    expect(fetchImpl.calls[0]?.headers.get('idempotency-key')).toMatch(
      /^mfa-/u,
    );
  });

  it('[P2-S09-AC-1031] AUTH-API-19: the original Idempotency-Key is sent again unchanged after the step-up refusal', async () => {
    const after = factorsResource(
      [factor(FACTOR_B, 'verified', 'Laptop')],
      '9',
    );
    const fetchImpl = stubFetch(
      apiError(401, 'STEP_UP_REQUIRED', STEP_UP),
      json(200, after, { etag: '"9"' }),
    );
    const input = {
      factorId: FACTOR_A,
      reason: 'user_request',
      version: '4',
      idempotencyKey: 'mfa-original-key-0001',
    } as const;
    const refused = await removeFactor(input, apiDeps(fetchImpl));
    expect(refused.ok).toBe(false);
    const retried = await removeFactor(input, apiDeps(fetchImpl));
    expect(retried.ok).toBe(true);
    expect(
      fetchImpl.calls.map((c) => c.headers.get('idempotency-key')),
    ).toEqual(['mfa-original-key-0001', 'mfa-original-key-0001']);
    expect(fetchImpl.calls.map((c) => c.headers.get('if-match'))).toEqual([
      '"4"',
      '"4"',
    ]);
  });
});

describe('[P2-S09-AC-1031] AUTH-API-20 and AUTH-API-21 are the recovery routes and carry no key', () => {
  it('[P2-S09-AC-1031] AUTH-API-20 and -21 send neither an Idempotency-Key nor an If-Match', async () => {
    const fetchImpl = stubFetch(
      apiError(401, 'UNAUTHENTICATED', { recoveryAction: 'reauthenticate' }),
      apiError(401, 'UNAUTHENTICATED', { recoveryAction: 'reauthenticate' }),
    );
    await createStepUpChallenge({}, apiDeps(fetchImpl));
    await verifyStepUp(
      { challengeId: CHALLENGE_ID, code: '123456' },
      apiDeps(fetchImpl),
    );
    expect(fetchImpl.calls.map((c) => c.method)).toEqual(['POST', 'POST']);
    for (const call of fetchImpl.calls) {
      expect(call.headers.get('idempotency-key')).toBeNull();
      expect(call.headers.get('if-match')).toBeNull();
    }
  });
});

describe('[P2-S09-AC-1031] CFG-05B-06 step-up recovery', () => {
  it('[P2-S09-AC-1031] routes a 401 STEP_UP_REQUIRED to /step-up, keeps no entry and sent the confirmed key', async () => {
    const fetchImpl = stubFetch(apiError(401, 'STEP_UP_REQUIRED', STEP_UP));
    const reset = mountReset(fetchImpl);
    try {
      await openConfirmation(reset.mounted.container);
      press(reset.mounted.container, 'Reset factors');
      await flush();
      expect(reset.navigate).toHaveBeenCalledWith(
        `/step-up?returnTo=${encodeURIComponent('/app/platform-configuration-admin?tab=mfa-reset')}`,
      );
      expect(fetchImpl.calls[0]?.headers.get('idempotency-key')).toBe(
        'reset-key-0001',
      );
      expect(reset.storage.dump()).not.toContain(PERSON);
      expect(reset.storage.dump()).not.toContain(REASON);
    } finally {
      reset.mounted.unmount();
    }
  });

  it('[P2-S09-AC-1031] the original Idempotency-Key is sent again unchanged after the step-up refusal', async () => {
    const fetchImpl = stubFetch(
      apiError(401, 'STEP_UP_REQUIRED', STEP_UP),
      json(200, {
        resetId: CHALLENGE_ID,
        targetPersonId: PERSON,
        state: 'completed',
        removedFactorCount: 2,
        mfaVersion: '7',
        outboxEventId: CHALLENGE_ID,
      }),
    );
    const values = { targetPersonId: PERSON, reason: REASON };
    const refused = await submitMfaFactorReset(
      values,
      'reset-original-key-0001',
      apiDeps(fetchImpl),
    );
    expect(refused.ok).toBe(false);
    const retried = await submitMfaFactorReset(
      values,
      'reset-original-key-0001',
      apiDeps(fetchImpl),
    );
    expect(retried.ok).toBe(true);
    expect(
      fetchImpl.calls.map((c) => c.headers.get('idempotency-key')),
    ).toEqual(['reset-original-key-0001', 'reset-original-key-0001']);
  });
});
