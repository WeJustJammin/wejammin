import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import LoginMethodErrorPanel from './LoginMethodErrorPanel';
import { errorCopy } from './types';

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';

const render = (code: string) =>
  renderToStaticMarkup(
    <LoginMethodErrorPanel
      error={{ code, requestId: REQUEST_ID, retryAfterSeconds: null }}
      refreshDisabled={false}
      onRefresh={() => undefined}
    />,
  );

describe('FE00 login-method manager step-up routing', () => {
  it('[P2-S09-AC-1127] does not fold STEP_UP_REQUIRED into the 403 FORBIDDEN copy', () => {
    const stepUp = errorCopy({
      code: 'STEP_UP_REQUIRED',
      requestId: REQUEST_ID,
      retryAfterSeconds: null,
    });
    const forbidden = errorCopy({
      code: 'FORBIDDEN',
      requestId: REQUEST_ID,
      retryAfterSeconds: null,
    });
    expect(stepUp).not.toBe(forbidden);
    expect(stepUp).toContain('verification');
  });

  it('[P2-S09-AC-1127] renders a /step-up?returnTo= link to the security settings for STEP_UP_REQUIRED and none for FORBIDDEN', () => {
    expect(render('STEP_UP_REQUIRED')).toContain(
      `href="/step-up?returnTo=${encodeURIComponent('/settings/security')}"`,
    );
    expect(render('FORBIDDEN')).not.toContain('/step-up');
  });
});
