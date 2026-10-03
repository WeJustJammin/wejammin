// @vitest-environment jsdom

import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  FACTOR_A,
  FACTOR_B,
  factor,
  factorsResource,
  flush,
  json,
  stubFetch,
} from './step-up-mfa.test-support';
import {
  mountWizard,
  pressButton,
  type WizardHarness,
} from './mfa-wizard-support.test-support';

/**
 * FE01 multi-tab and BE01a `identity.mfa-factor.changed.v1`: when a factor
 * changes in another tab, this tab's projection re-reads AUTH-API-16; a change
 * made here tells the other tabs the same way. The signal carries nothing.
 */

let harness: WizardHarness | null = null;
afterEach(() => {
  harness?.mounted.unmount();
  harness = null;
});

const rowNames = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('tbody tr')).map(
    (row) => row.querySelector('th, td')?.textContent?.trim() ?? '',
  );

describe('factor change in another tab', () => {
  it('[P2-S09-AC-906] the signal makes this tab read AUTH-API-16 once, with no body or mutation header, and the list shows the new factor', async () => {
    const refreshed = factorsResource(
      [factor(FACTOR_A), factor(FACTOR_B, 'verified', 'Laptop')],
      '9',
    );
    const fetchImpl = stubFetch(json(200, refreshed, { etag: '"9"' }));
    harness = mountWizard(fetchImpl, { factors: [factor(FACTOR_A)] });
    const container = harness.mounted.container;
    expect(rowNames(container)).toHaveLength(1);
    act(() => harness?.channel.emit());
    await flush();
    expect(fetchImpl.calls).toHaveLength(1);
    const [call] = fetchImpl.calls;
    expect(call?.method).toBe('GET');
    expect(call?.url).toBe('/api/v1/account/mfa/factors');
    expect(call?.body).toBeNull();
    for (const name of ['if-match', 'idempotency-key', 'x-csrf-token'])
      expect(call?.headers.has(name)).toBe(false);
    expect(rowNames(container)).toHaveLength(2);
    expect(container.textContent).toContain('Laptop');
  });

  it('[P2-S09-AC-906] a failed re-read leaves the current list untouched', async () => {
    const fetchImpl = stubFetch(new Error('offline'));
    harness = mountWizard(fetchImpl, { factors: [factor(FACTOR_A)] });
    const container = harness.mounted.container;
    act(() => harness?.channel.emit());
    await flush();
    expect(fetchImpl.calls).toHaveLength(1);
    expect(rowNames(container)).toHaveLength(1);
  });

  it('[P2-S09-AC-906] removing a factor here posts the same empty signal for the other tabs', async () => {
    const after = factorsResource(
      [factor(FACTOR_B, 'verified', 'Laptop')],
      '9',
    );
    const fetchImpl = stubFetch(json(200, after, { etag: '"9"' }));
    harness = mountWizard(fetchImpl, {
      factors: [factor(FACTOR_A), factor(FACTOR_B, 'verified', 'Laptop')],
    });
    const container = harness.mounted.container;
    pressButton(container, 'Remove Phone a');
    pressButton(container, 'Remove authenticator');
    await flush();
    expect(harness.channel.posts()).toBe(1);
    expect(rowNames(container)).toStrictEqual(['Laptop']);
  });

  it('[P2-S09-AC-906] a refused removal posts nothing', async () => {
    const fetchImpl = stubFetch(
      json(
        409,
        {
          code: 'CONFLICT',
          message: 'refused',
          details: { reasonCode: 'last_factor_required' },
          requestId: '0195b6f0-0000-7000-8000-000000000001',
        },
        {},
      ),
    );
    harness = mountWizard(fetchImpl, { factors: [factor(FACTOR_A)] });
    const container = harness.mounted.container;
    pressButton(container, 'Remove Phone a');
    pressButton(container, 'Remove authenticator');
    await flush();
    expect(harness.channel.posts()).toBe(0);
  });
});
