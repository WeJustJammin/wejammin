// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMemoryLockManager } from '../../lib/test-support/memory-lock-manager';
import { MemoryStorage } from '../../lib/test-support/memory-storage';
import { installContentSchemaRegistryCommandEnhancement } from './content-schema-registry-runtime-dom-mutations';
import {
  REQUEST_ID,
  REVIEW_ID,
  reviewResource,
} from './content-schema-review-dec108.test-support';
import {
  renderDocument,
  requireForm,
  reviewPageProps,
} from './content-schema-review-dec108-render.test-support';

/**
 * AC233: reconnect revalidates identity, authority, input and version. The
 * browser keeps no queued intent (see the no-offline-intent suite). When the
 * connection is lost mid-command the page reconciles the ambiguous outcome by
 * replaying the exact in-memory form and Idempotency-Key ONCE to the Worker
 * (never from storage, never again on `online` or visibility events). That
 * replay is a complete request, so the Worker revalidates identity, authority,
 * input and version, and each class's refusal reaches the page in its own
 * recovery, never as a silent success.
 */

const REVIEW_PATH = `/app/cms-content-modeling/schema-reviews/${REVIEW_ID}`;
const locks = createMemoryLockManager();
const sessionStore = new MemoryStorage();
const localStore = new MemoryStorage();

const mountDecisionForm = (): HTMLFormElement => {
  window.history.replaceState({}, '', REVIEW_PATH);
  document.body.innerHTML = renderDocument(
    reviewPageProps(reviewResource(), {
      variant: 'schemaReviewAssigned',
      access: 'read-only',
    }),
  ).body.innerHTML;
  const form = requireForm(document, 'CMS-03A-12');
  const radio = form.querySelector<HTMLInputElement>(
    'input[name="decision"][value="reject"]',
  );
  if (radio === null) throw new Error('no reject radio');
  radio.checked = true;
  return form;
};

const errorBody = (code: string, details: unknown = {}): string =>
  JSON.stringify({
    code,
    details,
    message: 'The command was not applied.',
    requestId: REQUEST_ID,
  });
const reply = (status: number, body: string): Promise<Response> =>
  Promise.resolve(
    new Response(body, {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
/** Transport identity, not user data: the pseudonymous client binding ID. */
const CLIENT_BINDING_KEY = 'wj_client_binding_id_v1';
const entriesOf = (storage: Storage): readonly string[] =>
  Array.from(
    { length: storage.length },
    (_, index) => storage.key(index) ?? '',
  ).filter((key) => key !== CLIENT_BINDING_KEY);
const submit = (form: HTMLFormElement): void => {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
};

beforeEach(() => {
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    value: sessionStore,
  });
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: localStore,
  });
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: locks.manager,
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  locks.releaseAll();
  sessionStore.clear();
  localStore.clear();
  document.body.replaceChildren();
});

type Revalidation = Readonly<{
  klass: 'identity' | 'authority' | 'input' | 'version';
  status: number;
  body: string;
  /** Observable recovery after the server's revalidation. */
  expect: (form: HTMLFormElement, navigate: ReturnType<typeof vi.fn>) => void;
}>;

const REVALIDATIONS: readonly Revalidation[] = [
  {
    klass: 'identity',
    status: 401,
    body: errorBody('UNAUTHENTICATED', { recoveryAction: 'reauthenticate' }),
    expect: (_form, navigate) =>
      expect(navigate).toHaveBeenCalledWith(
        `/auth/sign-in?returnTo=${encodeURIComponent(REVIEW_PATH)}`,
      ),
  },
  {
    klass: 'authority',
    status: 403,
    body: errorBody('FORBIDDEN', { reasonCode: 'CAPABILITY_REQUIRED' }),
    expect: (form, navigate) => {
      expect(navigate).not.toHaveBeenCalled();
      expect(form.querySelector('[data-cms-capability-gate]')).not.toBeNull();
    },
  },
  {
    klass: 'input',
    status: 422,
    body: errorBody('VALIDATION_FAILED', {
      violations: [{ path: 'reason', code: 'required', message: 'Required' }],
    }),
    expect: (form, navigate) => {
      expect(navigate).not.toHaveBeenCalled();
      expect(
        form.querySelector('[data-cms-validation-summary]'),
      ).not.toBeNull();
    },
  },
  {
    klass: 'version',
    status: 409,
    body: errorBody('CONFLICT', { conflict: 'VERSION_MISMATCH' }),
    expect: (form, navigate) => {
      expect(navigate).not.toHaveBeenCalled();
      expect(form.querySelector('[data-cms-sync-conflict]')).not.toBeNull();
    },
  },
];

describe('[P2-S09-AC-233] reconnect revalidates identity, authority, input and version', () => {
  it('[P2-S09-AC-233] a lost connection is reconciled by exactly one in-memory replay of the same form and key, and online or visibility events replay nothing more', async () => {
    const form = mountDecisionForm();
    const bodies: FormData[] = [];
    const fetchStub = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.body instanceof FormData) bodies.push(init.body);
      return Promise.reject(new TypeError('Failed to fetch'));
    });
    vi.stubGlobal('fetch', fetchStub);
    const cleanup = installContentSchemaRegistryCommandEnhancement(document, {
      navigate: vi.fn(),
    });
    submit(form);
    await vi.waitFor(() => expect(fetchStub).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 100));
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('online'));
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise((resolve) => setTimeout(resolve, 100));
    cleanup();
    expect(fetchStub).toHaveBeenCalledTimes(2);
    expect(Object.fromEntries(bodies[1] ?? [])).toEqual(
      Object.fromEntries(bodies[0] ?? []),
    );
    expect(entriesOf(sessionStore)).toEqual([]);
    expect(entriesOf(localStore)).toEqual([]);
  });

  for (const revalidation of REVALIDATIONS)
    it(`[P2-S09-AC-233] the replay after reconnect is a complete request and the server's ${revalidation.klass} revalidation (${revalidation.status}) reaches the page`, async () => {
      const form = mountDecisionForm();
      const bodies: FormData[] = [];
      const fetchStub = vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.body instanceof FormData) bodies.push(init.body);
          return bodies.length === 1
            ? Promise.reject(new TypeError('Failed to fetch'))
            : reply(revalidation.status, revalidation.body);
        },
      );
      vi.stubGlobal('fetch', fetchStub);
      const navigate = vi.fn();
      const cleanup = installContentSchemaRegistryCommandEnhancement(document, {
        navigate,
      });
      submit(form);
      await vi.waitFor(() => expect(fetchStub).toHaveBeenCalledTimes(2));
      await new Promise((resolve) => setTimeout(resolve, 100));
      cleanup();
      // The replay carries the same live decision, the page's version and the
      // original key, so only the server decides identity, authority, input
      // and version.
      const [first, replay] = bodies;
      expect(replay?.get('decision')).toBe('reject');
      for (const field of ['if-match', 'expectedVersion', 'idempotency-key'])
        expect(replay?.get(field)).toBe(first?.get(field));
      revalidation.expect(form, navigate);
    });
});
