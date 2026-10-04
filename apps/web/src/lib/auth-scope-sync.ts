import {
  clearAllStepUpState,
  readStepUpScope,
} from '../components/identity-authority/step-up-mfa/step-up-binding';

/**
 * Cross-tab auth-scope sync (Codex R14c2 #4).
 *
 * Step-up drafts, pending-command envelopes and the forms that hold an
 * Idempotency-Key live in a tab. The session cookies are shared by every tab of
 * the browser, so signing out or signing in as someone else in tab B changes
 * the session tab A is about to send, while tab A's mounted state still belongs
 * to the previous person. `clearAllStepUpState` clears only the tab that calls
 * it; this module makes every other tab call it.
 *
 * A page holds the opaque `wj_step_up_scope` nonce it loaded with. The nonce
 * follows the signed-in subject (the web edge rotates it on a subject change and
 * expires it when no session is carried), so a different nonce, or none, means
 * the tab's privileged state is stale. The tab then clears its step-up storage,
 * freezes the page (`inert`) and reloads, so the server re-resolves everything
 * under the current session before anything can render or submit.
 *
 * The tab is told by a values-free BroadcastChannel signal (sent by every page
 * load, so a sign-out or sign-in landing in tab B reaches tab A) and by
 * re-reading the shared cookie on focus, pageshow, visibility and at every
 * interaction boundary (submit, click, keydown, pointerdown), where a stale tab
 * also swallows the event so the retained command cannot be submitted. A tab
 * that held no scope had nothing privileged mounted and is never reloaded.
 */

export const AUTH_SCOPE_CHANNEL_NAME = 'wj-auth-scope';

/** An invalidation-only signal; it never carries a scope value, proof or secret. */
export type AuthScopePort = Readonly<{
  post: () => void;
  subscribe: (listener: () => void) => () => void;
}>;

export const createAuthScopeChannel = (): AuthScopePort | null => {
  if (typeof BroadcastChannel === 'undefined') return null;
  return {
    post: () => {
      const channel = new BroadcastChannel(AUTH_SCOPE_CHANNEL_NAME);
      channel.postMessage({ type: 'auth-scope-check' });
      channel.close();
    },
    subscribe: (listener) => {
      const channel = new BroadcastChannel(AUTH_SCOPE_CHANNEL_NAME);
      channel.onmessage = () => listener();
      return () => channel.close();
    },
  };
};

type ScopeEventTarget = Pick<
  EventTarget,
  'addEventListener' | 'removeEventListener'
>;

export type AuthScopeSyncEnvironment = Readonly<{
  cookieJar: () => string | null;
  storage: Parameters<typeof clearAllStepUpState>[0];
  channel: AuthScopePort | null;
  document: ScopeEventTarget & Readonly<{ visibilityState?: string }>;
  window: ScopeEventTarget;
  /** Makes the page inert so nothing can be interacted with while it reloads. */
  freeze: () => void;
  reload: () => void;
}>;

export type AuthScopeSync = Readonly<{
  /** True while the tab still holds the scope it loaded with. */
  isCurrent: () => boolean;
  stop: () => void;
}>;

const INTERACTION_EVENTS = [
  'submit',
  'click',
  'keydown',
  'pointerdown',
] as const;

export const installAuthScopeSync = (
  env: AuthScopeSyncEnvironment,
): AuthScopeSync => {
  const loadedWith = readStepUpScope(env.cookieJar());
  let stale = false;

  const goStale = (): void => {
    if (stale) return;
    stale = true;
    clearAllStepUpState(env.storage);
    env.freeze();
    env.reload();
  };

  const check = (): void => {
    if (stale || loadedWith === null) return;
    if (readStepUpScope(env.cookieJar()) !== loadedWith) goStale();
  };

  const guardInteraction = (event: Event): void => {
    check();
    if (!stale) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  const onVisibility = (): void => {
    if (env.document.visibilityState !== 'hidden') check();
  };

  for (const type of INTERACTION_EVENTS)
    env.document.addEventListener(type, guardInteraction, true);
  env.document.addEventListener('visibilitychange', onVisibility);
  env.window.addEventListener('focus', check);
  env.window.addEventListener('pageshow', check);
  const unsubscribe = env.channel?.subscribe(check);
  // Every page load tells the other tabs to re-read the shared cookie: a
  // sign-out or sign-in that lands in this tab is how they learn of it.
  env.channel?.post();

  return {
    isCurrent: () => !stale,
    stop: () => {
      for (const type of INTERACTION_EVENTS)
        env.document.removeEventListener(type, guardInteraction, true);
      env.document.removeEventListener('visibilitychange', onVisibility);
      env.window.removeEventListener('focus', check);
      env.window.removeEventListener('pageshow', check);
      unsubscribe?.();
    },
  };
};

const storageOrNull = (): Parameters<typeof clearAllStepUpState>[0] => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  installAuthScopeSync({
    cookieJar: () => {
      try {
        return document.cookie;
      } catch {
        return null;
      }
    },
    storage: storageOrNull(),
    channel: createAuthScopeChannel(),
    document,
    window,
    freeze: () => {
      document.documentElement.setAttribute('inert', '');
      document.documentElement.setAttribute('aria-busy', 'true');
    },
    reload: () => window.location.reload(),
  });
}
