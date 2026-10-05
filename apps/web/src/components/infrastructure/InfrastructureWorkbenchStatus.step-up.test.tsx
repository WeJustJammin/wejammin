import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import InfrastructureWorkbenchStatus from './InfrastructureWorkbenchStatus';

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';

const render = (
  initial: Parameters<typeof InfrastructureWorkbenchStatus>[0]['initial'],
) =>
  renderToStaticMarkup(
    <InfrastructureWorkbenchStatus
      initial={initial}
      requestId={REQUEST_ID}
      liveStatus="idle"
      lastKnownGoodAt={null}
      contractFieldCount={0}
      hasActorContext={false}
      validationMessage={null}
      onRetry={() => undefined}
    />,
  );

describe('workbench step-up recovery rendering', () => {
  it('[P2-S09-AC-1127] renders a /step-up?returnTo= link and no capability gate for step_up_required', () => {
    const html = render({
      status: 'step_up_required',
      returnTo: '/app/infrastructure?tab=history',
      allowedMethods: ['totp'],
    });
    expect(html).toContain(
      `href="/step-up?returnTo=${encodeURIComponent('/app/infrastructure?tab=history')}"`,
    );
    expect(html).toContain('Verification is required');
    expect(html).not.toContain('capability-gate');
  });

  it('[P2-S09-AC-1127] renders no step-up link for the 403 capability gate', () => {
    const html = render({
      status: 'capability_gate',
      recovery: 'request_capability',
      requiredCapability: 'infrastructure.write',
    });
    expect(html).not.toContain('/step-up');
  });
});
