import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import ProviderEvidenceError from './ProviderEvidenceError';
import { getProviderEvidenceErrorPresentation } from './provider-evidence-errors';

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';

const render = (code: string) =>
  renderToStaticMarkup(
    <ProviderEvidenceError
      state={{
        status: 'error',
        filters: { provider: null, state: null },
        code,
        requestId: REQUEST_ID,
        retryable: false,
        attempt: 0,
      }}
    />,
  );

describe('FE00 provider evidence step-up routing', () => {
  it('[P2-S09-AC-1127] gives STEP_UP_REQUIRED its own step-up owner, not the 403 capability gate', () => {
    expect(getProviderEvidenceErrorPresentation('STEP_UP_REQUIRED').owner).toBe(
      'step-up',
    );
    expect(getProviderEvidenceErrorPresentation('FORBIDDEN').owner).toBe(
      'capability',
    );
  });

  it('[P2-S09-AC-1127] renders a /step-up?returnTo= link for STEP_UP_REQUIRED and none for FORBIDDEN', () => {
    const stepUp = render('STEP_UP_REQUIRED');
    expect(stepUp).toContain('/step-up?returnTo=');
    expect(stepUp).not.toContain('provider-evidence-error--capability');
    expect(render('FORBIDDEN')).not.toContain('/step-up');
  });
});
