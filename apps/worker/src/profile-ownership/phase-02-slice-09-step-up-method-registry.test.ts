import { describe, expect, it, vi } from 'vitest';

import { MFA_METHOD_REGISTRY } from '../authentication/step-up';
import {
  CHALLENGE_ID,
  CLAIM_ID,
  bindings,
  commandRequest,
  createProfileApp,
  session,
} from './phase-02-slice-05.test-support';

// Profile claim proofs (challenge_code, attester_route) are evidence kinds,
// not step-up factors. BE02a's STEP_UP_REQUIRED is the BE00/DEC-111 response,
// so its allowedMethods are the configured step-up method registry.
describe('profile-ownership STEP_UP_REQUIRED method registry (BE00 recovery routing)', () => {
  it('[P2-S09-AC-909] answers a stale step-up with 401, step_up and the registry methods only', async () => {
    const stale = createProfileApp();
    vi.mocked(stale.auth.resolveSession).mockResolvedValueOnce({
      ok: true,
      value: { ...session, stepUpAt: null },
    });
    const response = await stale.app.fetch(
      commandRequest(
        `/api/v1/party-claims/${CLAIM_ID}/proofs`,
        {
          kind: 'challenge_code',
          challengeId: CHALLENGE_ID,
          code: '482901',
          reasonCode: 'claim_proof',
        },
        { ifMatch: '"1"' },
      ),
      bindings,
    );

    expect(response.status).toBe(401);
    const body = (await response.json()) as {
      code?: string;
      error?: { code?: string; details?: unknown };
      details?: unknown;
    };
    const code = body.code ?? body.error?.code;
    const details = body.details ?? body.error?.details;
    expect(code).toBe('STEP_UP_REQUIRED');
    expect(details).toEqual({
      recoveryAction: 'step_up',
      allowedMethods: [...MFA_METHOD_REGISTRY],
    });
    expect(details).toEqual({
      recoveryAction: 'step_up',
      allowedMethods: ['totp'],
    });
  });
});
