// @vitest-environment jsdom

import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { ACTING_CONTEXT_CHANGED_EVENT } from '../../lib/client-binding';
import { ActingContextRequestError } from './acting-context-errors';
import {
  ALIAS_CONTEXT_ID,
  ALIAS_PARTY_ID,
  act,
  chooseAlias,
  cleanupMounted,
  confirm,
  initial,
  installBrowserState,
  mountSwitcher,
  restoreReactActEnvironment,
  SELF_PARTY_ID,
} from './acting-context-test-support';

let browserState: ReturnType<typeof installBrowserState>;
const contextChangedListeners: EventListener[] = [];

beforeEach(() => {
  browserState = installBrowserState();
  contextChangedListeners.length = 0;
});

afterEach(() => {
  for (const listener of contextChangedListeners)
    window.removeEventListener(ACTING_CONTEXT_CHANGED_EVENT, listener);
  cleanupMounted(browserState.locks);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

afterAll(restoreReactActEnvironment);

describe('acting context switcher', () => {
  it('shows success only after the server confirms and canonical refetch succeeds', async () => {
    const operationOrder: string[] = [];
    const onBindContext = vi.fn(async () => {
      operationOrder.push('bind');
      return { selectedPartyId: ALIAS_PARTY_ID };
    });
    const onCanonicalRefetch = vi.fn(async () => {
      operationOrder.push('canonical-refetch');
      return initial;
    });
    const changed = vi.fn<EventListener>(() => {
      operationOrder.push('invalidate');
    });
    window.addEventListener(ACTING_CONTEXT_CHANGED_EVENT, changed);
    contextChangedListeners.push(changed);
    const { container } = mountSwitcher(onBindContext, onCanonicalRefetch);
    chooseAlias(container);

    await confirm(container);

    expect(onBindContext).toHaveBeenCalledWith(ALIAS_CONTEXT_ID);
    expect(onCanonicalRefetch).toHaveBeenCalledOnce();
    expect(
      container.querySelector('[data-testid="acting-context-indicator"]')
        ?.textContent,
    ).toContain('Neon Harbor');
    expect(changed).toHaveBeenCalledOnce();
    expect(operationOrder).toEqual(['bind', 'invalidate', 'canonical-refetch']);
    expect(changed.mock.calls[0]?.[0]).not.toHaveProperty('detail');
  });

  it('keeps the draft and focuses an error after a mismatched server response', async () => {
    const onBindContext = vi.fn(async () => ({
      selectedPartyId: SELF_PARTY_ID,
    }));
    const onCanonicalRefetch = vi.fn(async () => initial);
    const changed = vi.fn<EventListener>(() => undefined);
    window.addEventListener(ACTING_CONTEXT_CHANGED_EVENT, changed);
    contextChangedListeners.push(changed);
    const { container } = mountSwitcher(onBindContext, onCanonicalRefetch);
    chooseAlias(container);

    await confirm(container);

    const select = container.querySelector(
      '#acting-context-select',
    ) as HTMLSelectElement | null;
    const alert = container.querySelector<HTMLElement>(
      '[data-testid="acting-context-error"]',
    );
    expect(select?.value).toBe(ALIAS_CONTEXT_ID);
    expect(
      container
        .querySelector('[data-testid="acting-context-indicator"]')
        ?.getAttribute('data-context-id'),
    ).toBe('unverified');
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(alert?.textContent).toContain('different context');
    expect(document.activeElement).toBe(alert);
    expect(onCanonicalRefetch).not.toHaveBeenCalled();
    expect(changed).toHaveBeenCalledOnce();
    expect(changed.mock.calls[0]?.[0]).not.toHaveProperty('detail');
  });

  it('retains the deliberate draft and exposes a focused error after a failed bind', async () => {
    const onBindContext = vi.fn(async () => {
      throw new Error('The server denied this context change.');
    });
    const { container } = mountSwitcher(onBindContext, async () => initial);
    chooseAlias(container);

    await confirm(container);

    expect(
      (
        container.querySelector(
          '#acting-context-select',
        ) as HTMLSelectElement | null
      )?.value,
    ).toBe(ALIAS_CONTEXT_ID);
    expect(
      container.querySelector('[data-testid="acting-context-error"]')
        ?.textContent,
    ).toContain('The server denied this context change.');
    expect(document.activeElement?.getAttribute('role')).toBe('alert');
  });

  it('invalidates dependent surfaces when a failed bind may have reached the server', async () => {
    const onBindContext = vi.fn(async () => {
      throw new ActingContextRequestError(
        'The bind result could not be verified.',
        true,
      );
    });
    const changed = vi.fn<EventListener>(() => undefined);
    window.addEventListener(ACTING_CONTEXT_CHANGED_EVENT, changed);
    contextChangedListeners.push(changed);
    const { container } = mountSwitcher(onBindContext, async () => initial);
    chooseAlias(container);

    await confirm(container);

    expect(
      container
        .querySelector('[data-testid="acting-context-indicator"]')
        ?.getAttribute('data-context-id'),
    ).toBe('unverified');
    expect(changed).toHaveBeenCalledOnce();
    expect(changed.mock.calls[0]?.[0]).not.toHaveProperty('detail');
  });

  it('hides stale context and invalidates dependents when canonical verification fails', async () => {
    const onBindContext = vi.fn(async () => ({
      selectedPartyId: ALIAS_PARTY_ID,
    }));
    const onCanonicalRefetch = vi.fn(async () => {
      throw new Error('canonical read unavailable');
    });
    const changed = vi.fn<EventListener>(() => undefined);
    window.addEventListener(ACTING_CONTEXT_CHANGED_EVENT, changed);
    contextChangedListeners.push(changed);
    const { container } = mountSwitcher(onBindContext, onCanonicalRefetch);
    chooseAlias(container);

    await confirm(container);

    expect(
      container
        .querySelector('[data-testid="acting-context-indicator"]')
        ?.getAttribute('data-context-id'),
    ).toBe('unverified');
    expect(
      container.querySelector('[data-testid="acting-context-indicator"]')
        ?.textContent,
    ).toContain('Context could not be verified');
    expect(
      container.querySelector('[data-testid="acting-context-error"]')
        ?.textContent,
    ).toContain('Reload before continuing');
    expect(changed).toHaveBeenCalledOnce();
    expect(changed.mock.calls[0]?.[0]).not.toHaveProperty('detail');
  });

  it('invalidates dependent surfaces on revocation receipt even when canonical reconciliation fails', async () => {
    let receiveRevocation: (() => void) | undefined;
    class TestBroadcastChannel {
      onmessage: ((event: MessageEvent<unknown>) => void) | null = null;

      constructor() {
        receiveRevocation = () =>
          this.onmessage?.({
            data: { eventType: 'identity.acting-context.revoked.v1' },
          } as MessageEvent<unknown>);
      }

      close(): void {}
    }
    vi.stubGlobal('BroadcastChannel', TestBroadcastChannel);
    const changed = vi.fn<EventListener>(() => undefined);
    window.addEventListener(ACTING_CONTEXT_CHANGED_EVENT, changed);
    contextChangedListeners.push(changed);
    const onCanonicalRefetch = vi.fn(async () => {
      throw new Error('canonical read unavailable');
    });
    mountSwitcher(
      async () => ({ selectedPartyId: ALIAS_PARTY_ID }),
      onCanonicalRefetch,
    );

    await act(async () => {
      receiveRevocation?.();
      await Promise.resolve();
    });

    expect(onCanonicalRefetch).toHaveBeenCalledOnce();
    expect(changed).toHaveBeenCalledOnce();
    expect(changed.mock.calls[0]?.[0]).not.toHaveProperty('detail');
  });

  const seedStepUpState = (): void => {
    const stamp = { binding: null, createdAt: Date.now() };
    browserState.sessionStorage.setItem(
      'wj-step-up-draft:/app/cms-content-modeling:CMS-03A-04',
      JSON.stringify({
        values: { reason: 'tidy up' },
        idempotencyKey: 'key-0000000001',
        expectedVersion: '"7"',
        ...stamp,
      }),
    );
    browserState.sessionStorage.setItem(
      'wj:cms-grants:step-up-return',
      JSON.stringify({
        kind: 'grant',
        grantId: null,
        idempotencyKey: 'key-0000000002',
        ...stamp,
      }),
    );
    browserState.sessionStorage.setItem(
      'wj-admin-mfa-reset-interrupted',
      JSON.stringify(stamp),
    );
  };

  it('[P2-S09-AC-911] clears every pending step-up draft and envelope when the acting context changes', async () => {
    seedStepUpState();
    const { container } = mountSwitcher(
      async () => ({ selectedPartyId: ALIAS_PARTY_ID }),
      async () => initial,
    );
    chooseAlias(container);

    await confirm(container);

    for (const key of [
      'wj-step-up-draft:/app/cms-content-modeling:CMS-03A-04',
      'wj:cms-grants:step-up-return',
      'wj-admin-mfa-reset-interrupted',
    ])
      expect(browserState.sessionStorage.getItem(key), key).toBeNull();
  });

  it('[P2-S09-AC-911] clears pending step-up state on an acting-context revocation receipt', async () => {
    seedStepUpState();
    let receiveRevocation: (() => void) | undefined;
    class TestBroadcastChannel {
      onmessage: ((event: MessageEvent<unknown>) => void) | null = null;

      constructor() {
        receiveRevocation = () =>
          this.onmessage?.({
            data: { eventType: 'identity.acting-context.revoked.v1' },
          } as MessageEvent<unknown>);
      }

      close(): void {}
    }
    vi.stubGlobal('BroadcastChannel', TestBroadcastChannel);
    mountSwitcher(
      async () => ({ selectedPartyId: ALIAS_PARTY_ID }),
      async () => initial,
    );

    await act(async () => {
      receiveRevocation?.();
      await Promise.resolve();
    });

    expect(
      browserState.sessionStorage.getItem('wj:cms-grants:step-up-return'),
    ).toBeNull();
  });
});
