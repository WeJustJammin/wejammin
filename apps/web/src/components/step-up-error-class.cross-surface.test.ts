import { describe, expect, it } from 'vitest';

import { presentIdentityAuthorityState } from './identity-authority/identity-authority-state';
import { resetFailureView } from './platform-configuration/admin-mfa-reset/admin-mfa-reset-failure';
import type { MfaFailure } from './identity-authority/step-up-mfa/mfa-failure';
import { stepUpRecoveryHref } from './infrastructure/infrastructure-workbench-state';
import { getProviderEvidenceErrorPresentation } from './infrastructure/provider-evidence/provider-evidence-errors';
import { classifyStepUpResponse } from './content-schema-registry/content-schema-registry-step-up-classify';

/**
 * FE00 error-per-class (DEC-111), one table across every web surface that owns
 * a protected command: a 401 STEP_UP_REQUIRED goes to the shared /step-up page
 * and is never rendered as a 403 capability gate or collapsed to sign-in. Each
 * row drives that surface's own mapper with the same Worker-shaped refusal.
 */

const RETURN_TO = '/app/surface?tab=security';
const STEP_UP = `/step-up?returnTo=${encodeURIComponent(RETURN_TO)}`;

const failure = (status: number, code: string): MfaFailure => ({
  status,
  code,
  reason: null,
  recoveryAction: null,
  allowedMethods: [],
  violationFields: [],
  requestId: null,
  retryAfterSeconds: null,
});

describe('[P2-S09-AC-1127] 401 STEP_UP_REQUIRED across web surfaces', () => {
  it('[P2-S09-AC-1127] identity authority routes to /step-up, not a gate or sign-in', () => {
    const state = presentIdentityAuthorityState({
      status: 'error',
      error: {
        code: 'STEP_UP_REQUIRED',
        message: 'Refused.',
        requestId: 'req-1',
        details: null,
      },
      retryable: false,
      currentPath: RETURN_TO,
    });
    expect(state).toMatchObject({
      recoveryAction: 'step-up',
      recoveryHref: STEP_UP,
    });
  });

  it('[P2-S09-AC-1127] platform-configuration admin MFA reset (CFG-05B-06) routes to step-up, not forbidden or sign-in', () => {
    expect(resetFailureView(failure(401, 'STEP_UP_REQUIRED')).kind).toBe(
      'step-up',
    );
    expect(resetFailureView(failure(401, 'UNAUTHENTICATED')).kind).toBe(
      'sign-in',
    );
    expect(resetFailureView(failure(403, 'FORBIDDEN')).kind).toBe('forbidden');
  });

  it('[P2-S09-AC-1127] infrastructure builds the /step-up href from the preserved returnTo', () => {
    expect(stepUpRecoveryHref({ returnTo: RETURN_TO })).toBe(STEP_UP);
  });

  it('[P2-S09-AC-1127] provider evidence owns STEP_UP_REQUIRED as step-up, never as a capability gate', () => {
    expect(getProviderEvidenceErrorPresentation('STEP_UP_REQUIRED').owner).toBe(
      'step-up',
    );
    expect(getProviderEvidenceErrorPresentation('FORBIDDEN').owner).toBe(
      'capability',
    );
  });

  it('[P2-S09-AC-1127] CMS commands classify a typed 401 STEP_UP_REQUIRED as navigation and a plain 401 as reauthentication', async () => {
    const stepUp = new Response(
      JSON.stringify({
        code: 'STEP_UP_REQUIRED',
        message: 'Recent verification is required.',
        requestId: '6a3173d9-f113-4aa4-91c3-3fbc137ea258',
        details: { recoveryAction: 'step_up', allowedMethods: ['totp'] },
      }),
      { status: 401 },
    );
    expect(await classifyStepUpResponse(stepUp)).toEqual({ kind: 'navigate' });
    const plain = new Response(
      JSON.stringify({ code: 'UNAUTHENTICATED', message: 'No.', details: {} }),
      { status: 401 },
    );
    expect(await classifyStepUpResponse(plain)).toBeNull();
  });
});
