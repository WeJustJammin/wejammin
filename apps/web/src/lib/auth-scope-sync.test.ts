import { describe, expect, it, vi } from 'vitest';

import {
  AUTH_SCOPE_CHANNEL_NAME,
  createAuthScopeChannel,
  installAuthScopeSync,
  type AuthScopePort,
} from './auth-scope-sync';
import {
  STEP_UP_ADMIN_RESET_MARKER_KEY,
  STEP_UP_DRAFT_KEY_PREFIX,
  STEP_UP_GRANT_ENVELOPE_KEY,
} from '../components/identity-authority/step-up-mfa/step-up-binding';

/**
 * Codex R14c2 #4: signing out, or signing in as someone else, in tab B must not
 * leave tab A holding the previous person's mounted step-up state (pending
 * envelopes, form values, idempotency keys). Tab A learns of the change through
 * a values-free BroadcastChannel signal and by re-reading the shared scope
 * cookie at every interaction boundary, then clears its tab state, freezes the
 * page and reloads so everything is re-resolved under the current session.
 */
const SCOPE_A = 'A'.repeat(32);
const SCOPE_B = 'B'.repeat(32);
const jarFor = (scope: string | null): string =>
  scope === null
    ? 'theme=dark'
    : `theme=dark; wj_step_up_scope=${scope}; other=1`;

const memoryStorage = (initial: Record<string, string>) => {
  const values = new Map(Object.entries(initial));
  return {
    values,
    get length() {
      return values.size;
    },
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => void values.delete(key),
  };
};

const fakeChannel = () => {
  const listeners = new Set<() => void>();
  const port: AuthScopePort & { posts: number; deliver: () => void } = {
    posts: 0,
    post: () => {
      port.posts += 1;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    deliver: () => listeners.forEach((listener) => listener()),
  };
  return port;
};

type Harness = ReturnType<typeof harness>;
const harness = (initialScope: string | null, withStorage = true) => {
  let jar: string | null = jarFor(initialScope);
  const document = Object.assign(new EventTarget(), {
    visibilityState: 'visible' as 'visible' | 'hidden',
  });
  const window = new EventTarget();
  const channel = fakeChannel();
  const storage = memoryStorage({
    [`${STEP_UP_DRAFT_KEY_PREFIX}decision`]: '{"idempotencyKey":"k"}',
    [STEP_UP_GRANT_ENVELOPE_KEY]: '{"idempotencyKey":"k2"}',
    [STEP_UP_ADMIN_RESET_MARKER_KEY]: '1',
    unrelated: 'keep',
  });
  const freeze = vi.fn();
  const reload = vi.fn();
  const sync = installAuthScopeSync({
    cookieJar: () => jar,
    storage: withStorage ? storage : null,
    channel,
    document,
    window,
    freeze,
    reload,
  });
  return {
    sync,
    channel,
    storage,
    freeze,
    reload,
    document,
    window,
    setScope: (scope: string | null) => void (jar = jarFor(scope)),
    setJar: (value: string | null) => void (jar = value),
  };
};

const stale = (h: Harness): void => {
  expect(h.reload).toHaveBeenCalledTimes(1);
  expect(h.freeze).toHaveBeenCalledTimes(1);
  expect([...h.storage.values.keys()]).toEqual(['unrelated']);
  expect(h.sync.isCurrent()).toBe(false);
};

describe('auth scope sync across tabs', () => {
  it('announces its load once, carrying no value', () => {
    const h = harness(SCOPE_A);
    expect(h.channel.posts).toBe(1);
    expect(AUTH_SCOPE_CHANNEL_NAME).toBe('wj-auth-scope');
  });

  it('stays quiet while the scope cookie is unchanged', () => {
    const h = harness(SCOPE_A);
    h.channel.deliver();
    h.window.dispatchEvent(new Event('focus'));
    expect(h.reload).not.toHaveBeenCalled();
    expect(h.sync.isCurrent()).toBe(true);
    expect(h.storage.values.size).toBe(4);
  });

  it('clears tab state, freezes and reloads when another tab signs in as someone else', () => {
    const h = harness(SCOPE_A);
    h.setScope(SCOPE_B);
    h.channel.deliver();
    stale(h);
  });

  it('clears tab state when another tab signs out and the scope cookie disappears', () => {
    const h = harness(SCOPE_A);
    h.setScope(null);
    h.channel.deliver();
    stale(h);
  });

  it('treats an unreadable cookie jar as a lost scope', () => {
    const h = harness(SCOPE_A);
    h.setJar(null);
    h.channel.deliver();
    stale(h);
  });

  it('does nothing in a tab that held no scope (nothing privileged was mounted)', () => {
    const h = harness(null);
    h.setScope(SCOPE_B);
    h.channel.deliver();
    h.window.dispatchEvent(new Event('focus'));
    expect(h.reload).not.toHaveBeenCalled();
    expect(h.sync.isCurrent()).toBe(true);
  });

  it.each([
    [
      'window focus',
      (h: Harness) => h.window.dispatchEvent(new Event('focus')),
    ],
    ['pageshow', (h: Harness) => h.window.dispatchEvent(new Event('pageshow'))],
    [
      'the tab becoming visible',
      (h: Harness) => h.document.dispatchEvent(new Event('visibilitychange')),
    ],
  ])(
    're-reads the cookie when %s fires, with no broadcast at all',
    (_name, fire) => {
      const h = harness(SCOPE_A);
      h.setScope(SCOPE_B);
      fire(h);
      stale(h);
    },
  );

  it('ignores a visibility change to hidden', () => {
    const h = harness(SCOPE_A);
    h.setScope(SCOPE_B);
    h.document.visibilityState = 'hidden';
    h.document.dispatchEvent(new Event('visibilitychange'));
    expect(h.reload).not.toHaveBeenCalled();
  });

  it.each(['submit', 'click', 'keydown', 'pointerdown'])(
    'blocks a %s that arrives before any signal, so a retained command cannot be submitted',
    (type) => {
      const h = harness(SCOPE_A);
      h.setScope(SCOPE_B);
      const reached = vi.fn();
      h.document.addEventListener(type, reached);
      const event = new Event(type, { cancelable: true });
      h.document.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      expect(reached).not.toHaveBeenCalled();
      stale(h);
    },
  );

  it('lets an interaction through while the scope is current', () => {
    const h = harness(SCOPE_A);
    const reached = vi.fn();
    h.document.addEventListener('submit', reached);
    const event = new Event('submit', { cancelable: true });
    h.document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(reached).toHaveBeenCalledTimes(1);
  });

  it('keeps blocking after it went stale and reloads only once', () => {
    const h = harness(SCOPE_A);
    h.setScope(SCOPE_B);
    h.channel.deliver();
    h.window.dispatchEvent(new Event('focus'));
    const event = new Event('submit', { cancelable: true });
    h.document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(h.reload).toHaveBeenCalledTimes(1);
  });

  it('survives blocked storage: it still freezes and reloads', () => {
    const h = harness(SCOPE_A, false);
    h.setScope(SCOPE_B);
    h.channel.deliver();
    expect(h.reload).toHaveBeenCalledTimes(1);
    expect(h.freeze).toHaveBeenCalledTimes(1);
  });

  it('stops listening once stopped', () => {
    const h = harness(SCOPE_A);
    h.sync.stop();
    h.setScope(SCOPE_B);
    h.channel.deliver();
    h.window.dispatchEvent(new Event('focus'));
    expect(h.reload).not.toHaveBeenCalled();
  });
});

describe('auth scope sync over the real BroadcastChannel', () => {
  it('a load in tab B reaches tab A, which then clears and reloads', async () => {
    let jar = jarFor(SCOPE_A);
    const reloadA = vi.fn();
    const storageA = memoryStorage({
      [`${STEP_UP_DRAFT_KEY_PREFIX}decision`]: 'draft',
    });
    const syncA = installAuthScopeSync({
      cookieJar: () => jar,
      storage: storageA,
      channel: createAuthScopeChannel(),
      document: Object.assign(new EventTarget(), {
        visibilityState: 'visible',
      }),
      window: new EventTarget(),
      freeze: vi.fn(),
      reload: reloadA,
    });
    // Tab B signs in as someone else (the shared cookie rotates), then loads.
    jar = jarFor(SCOPE_B);
    const syncB = installAuthScopeSync({
      cookieJar: () => jar,
      storage: memoryStorage({}),
      channel: createAuthScopeChannel(),
      document: Object.assign(new EventTarget(), {
        visibilityState: 'visible',
      }),
      window: new EventTarget(),
      freeze: vi.fn(),
      reload: vi.fn(),
    });
    await vi.waitFor(() => expect(reloadA).toHaveBeenCalledTimes(1));
    expect(storageA.values.size).toBe(0);
    syncA.stop();
    syncB.stop();
  });
});
