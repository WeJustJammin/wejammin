// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import { flush, mount, type Mounted } from './step-up-mfa.test-support';
import { StepUpRecoveryLink } from './StepUpRecoveryLink';

let mounted: Mounted | null = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  window.history.replaceState(null, '', '/');
});

describe('FE00 step-up recovery link', () => {
  it('[P2-S09-AC-1127] server markup links to /step-up?returnTo= with the fallback path', () => {
    expect(
      renderToStaticMarkup(
        <StepUpRecoveryLink fallbackPath="/app/infrastructure" />,
      ),
    ).toContain(
      `href="/step-up?returnTo=${encodeURIComponent('/app/infrastructure')}"`,
    );
  });

  it('[P2-S09-AC-1127] returns to the current relative path and query once mounted in the browser', async () => {
    window.history.replaceState(
      null,
      '',
      '/app/infrastructure/provider-operations?state=failed',
    );
    mounted = mount(<StepUpRecoveryLink fallbackPath="/app/infrastructure" />);
    await flush();
    expect(mounted.container.querySelector('a')?.getAttribute('href')).toBe(
      `/step-up?returnTo=${encodeURIComponent('/app/infrastructure/provider-operations?state=failed')}`,
    );
  });
});
