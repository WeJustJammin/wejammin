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
 * FE03 "Offline: only non-registry commands may store non-canonical intents".
 * A protected registry command that does not succeed (network loss, 503, 403,
 * 409, 422) leaves nothing behind in any browser store: no draft, no queued
 * intent. Only the 401 STEP_UP_REQUIRED detour keeps a tab-scoped sessionStorage
 * draft (DEC-111, covered by the step-up suite), never localStorage or
 * IndexedDB. Reconnect therefore has no stored intent to replay, so identity,
 * authority, input and version are always revalidated by a fresh submission.
 */

const REVIEW_PATH = `/app/cms-content-modeling/schema-reviews/${REVIEW_ID}`;
const locks = createMemoryLockManager();
const indexedDbOpen = vi.fn();

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

/** Transport identity, not user data: the pseudonymous client binding ID header source. */
const CLIENT_BINDING_KEY = 'wj_client_binding_id_v1';

const entriesOf = (storage: Storage): readonly string[] =>
  Array.from(
    { length: storage.length },
    (_, index) => storage.key(index) ?? '',
  ).filter((key) => key !== CLIENT_BINDING_KEY);

const errorBody = (code: string, details: unknown = {}): string =>
  JSON.stringify({
    code,
    details,
    message: 'The command was not applied.',
    requestId: REQUEST_ID,
  });

type Outcome = Readonly<{
  title: string;
  respond: () => Promise<Response>;
}>;

const json = (status: number, body: string): Promise<Response> =>
  Promise.resolve(
    new Response(body, {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );

const OUTCOMES: readonly Outcome[] = [
  {
    title: 'a lost connection',
    respond: () => Promise.reject(new TypeError('Failed to fetch')),
  },
  { title: 'a 503 outage', respond: () => json(503, errorBody('UNAVAILABLE')) },
  { title: 'a 403 refusal', respond: () => json(403, errorBody('FORBIDDEN')) },
  { title: 'a 409 conflict', respond: () => json(409, errorBody('CONFLICT')) },
  {
    title: 'a 422 validation failure',
    respond: () =>
      json(
        422,
        errorBody('VALIDATION_FAILED', {
          violations: [
            { path: 'reason', code: 'required', message: 'Required' },
          ],
        }),
      ),
  },
];

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
  vi.stubGlobal('indexedDB', { open: indexedDbOpen });
});

afterEach(() => {
  vi.unstubAllGlobals();
  locks.releaseAll();
  sessionStore.clear();
  localStore.clear();
  indexedDbOpen.mockClear();
  document.body.replaceChildren();
});

describe('[P2-S09-AC-233] unsaved registry data is not stored as a draft or offline intent', () => {
  for (const outcome of OUTCOMES)
    it(`[P2-S09-AC-233] stores nothing in sessionStorage, localStorage or IndexedDB after ${outcome.title}`, async () => {
      const form = mountDecisionForm();
      const fetchStub = vi.fn(outcome.respond);
      vi.stubGlobal('fetch', fetchStub);
      const cleanup = installContentSchemaRegistryCommandEnhancement(document, {
        navigate: vi.fn(),
      });
      form.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
      await vi.waitFor(() => expect(fetchStub).toHaveBeenCalled());
      await new Promise((resolve) => setTimeout(resolve, 50));
      cleanup();
      expect(entriesOf(sessionStore)).toEqual([]);
      expect(entriesOf(localStore)).toEqual([]);
      expect(indexedDbOpen).not.toHaveBeenCalled();
    });

  it('[P2-S09-AC-233] keeps the only step-up draft in sessionStorage, never localStorage or IndexedDB', async () => {
    const form = mountDecisionForm();
    const fetchStub = vi.fn(() =>
      json(
        401,
        errorBody('STEP_UP_REQUIRED', {
          recoveryAction: 'step_up',
          allowedMethods: ['totp'],
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchStub);
    const navigate = vi.fn();
    const cleanup = installContentSchemaRegistryCommandEnhancement(document, {
      navigate,
    });
    form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await vi.waitFor(() => expect(navigate).toHaveBeenCalled());
    cleanup();
    expect(entriesOf(sessionStore)).toHaveLength(1);
    expect(entriesOf(localStore)).toEqual([]);
    expect(indexedDbOpen).not.toHaveBeenCalled();
  });
});
