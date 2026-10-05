// @vitest-environment jsdom

import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { MfaEnrollmentWizard } from './MfaEnrollmentWizard';
import { pressButton, CURRENT } from './mfa-wizard-support.test-support';
import {
  FACTOR_A,
  FACTOR_B,
  apiDeps,
  factor,
  factorsResource,
  flush,
  json,
  mount,
  stubFetch,
  type Mounted,
} from './step-up-mfa.test-support';

/**
 * AC906 / DEC-128: the browser refetches AUTH-API-16 on the multi-tab broadcast.
 *
 * This test replaces no part of the channel. Both "tabs" are separate React roots
 * built WITHOUT a `channel` prop, so each wizard creates the production port over the
 * runtime's own `BroadcastChannel`; the only thing the test controls is what each
 * tab's `fetch` answers. A factor removed in tab A must reach tab B through the real
 * broadcast, and tab B must then read canonical state from AUTH-API-16 (one GET, no
 * body, no mutation header) and show it.
 */
const mounted: Mounted[] = [];
afterEach(() => {
  while (mounted.length > 0) mounted.pop()?.unmount();
});

const tab = (fetchImpl: typeof fetch, factors: ReturnType<typeof factor>[]) => {
  const handle = mount(
    <MfaEnrollmentWizard
      variant="authPage"
      returnTo="/app/x"
      factors={factors}
      allowedMethods={['totp']}
      stepUp={{ fresh: false, freshUntil: null }}
      expectedVersion="4"
      api={apiDeps(fetchImpl)}
      navigate={() => undefined}
      reload={() => undefined}
      currentLocation={CURRENT}
    />,
  );
  mounted.push(handle);
  return handle.container;
};

const rowNames = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('tbody tr')).map(
    (row) => row.querySelector('th, td')?.textContent?.trim() ?? '',
  );

const waitUntil = async (condition: () => boolean): Promise<void> => {
  for (let waited = 0; waited < 3_000 && !condition(); waited += 10)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
};

describe('multi-tab refetch over the real BroadcastChannel', () => {
  it('[P2-S09-AC-906] the runtime provides a real BroadcastChannel and the wizard uses it (nothing is stubbed)', () => {
    expect(typeof BroadcastChannel).toBe('function');
    expect(BroadcastChannel.toString()).not.toMatch(/mock|stub|vi\.fn/iu);
  });

  it('[P2-S09-AC-906] a factor removed in tab A reaches tab B through the real broadcast, and tab B refetches canonical state once', async () => {
    const after = factorsResource(
      [factor(FACTOR_B, 'verified', 'Laptop')],
      '9',
    );
    const answer = () => json(200, after, { etag: '"9"' });
    const fetchA = stubFetch(answer(), answer(), answer());
    const fetchB = stubFetch(answer(), answer());
    const both = [factor(FACTOR_A), factor(FACTOR_B, 'verified', 'Laptop')];
    const containerA = tab(fetchA, both);
    const containerB = tab(fetchB, both);
    expect(rowNames(containerB)).toHaveLength(2);

    pressButton(containerA, 'Remove Phone a');
    pressButton(containerA, 'Remove authenticator');
    await flush();
    await waitUntil(() => fetchB.calls.length > 0);
    await flush();

    expect(fetchB.calls).toHaveLength(1);
    const [call] = fetchB.calls;
    expect(call?.method).toBe('GET');
    expect(call?.url).toBe('/api/v1/account/mfa/factors');
    expect(call?.body).toBeNull();
    for (const name of ['if-match', 'idempotency-key', 'x-csrf-token'])
      expect(call?.headers.has(name)).toBe(false);
    expect(rowNames(containerB)).toStrictEqual(['Laptop']);
    expect(rowNames(containerA)).toStrictEqual(['Laptop']);
  });

  it('[P2-S09-AC-906] a tab whose canonical read fails keeps its list and never invents the change', async () => {
    const after = factorsResource(
      [factor(FACTOR_B, 'verified', 'Laptop')],
      '9',
    );
    const fetchA = stubFetch(
      json(200, after, { etag: '"9"' }),
      json(200, after, { etag: '"9"' }),
      json(200, after, { etag: '"9"' }),
    );
    const fetchB = stubFetch(new Error('offline'), new Error('offline'));
    const both = [factor(FACTOR_A), factor(FACTOR_B, 'verified', 'Laptop')];
    const containerA = tab(fetchA, both);
    const containerB = tab(fetchB, both);

    pressButton(containerA, 'Remove Phone a');
    pressButton(containerA, 'Remove authenticator');
    await flush();
    await waitUntil(() => fetchB.calls.length > 0);
    await flush();

    expect(fetchB.calls.length).toBeGreaterThanOrEqual(1);
    expect(rowNames(containerB)).toHaveLength(2);
  });
});
