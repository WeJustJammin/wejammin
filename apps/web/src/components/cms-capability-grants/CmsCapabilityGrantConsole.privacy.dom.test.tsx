// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigateTo = vi.hoisted(() => vi.fn());
vi.mock('./cms-capability-grant-navigation', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('./cms-capability-grant-navigation')
  >()),
  navigateTo,
}));
vi.mock('../../lib/client-binding', () => ({
  addClientBindingIdHeader: async (_input: unknown, init?: RequestInit) => init,
}));

import {
  grantListPage,
  grantResource,
} from '../../server/cms-capability-grant.test-support';
import {
  apiError,
  consoleProps,
  jsonResponse,
  sampleItems,
} from './cms-capability-grant-console.test-support';
import {
  GRANT_UUID,
  click,
  fillGrantForm,
  mountConsole,
  query,
  scriptFetch,
  submit,
  textOf,
  typeInto,
  type Mounted,
} from './cms-capability-grant-dom.test-support';

/**
 * FE03: person identifiers appear only inside the owner-only island and never
 * enter the URL, localStorage, IndexedDB, BroadcastChannel, analytics,
 * telemetry, logs, Realtime bodies or announcement text. Every browser sink is
 * observed while a grant, a step-up detour and a person filter run.
 */

type Sink = { readonly name: string; readonly payload: string };

let mounted: Mounted | null = null;
let sinks: Sink[] = [];
const record = (name: string, ...payload: unknown[]): void => {
  sinks.push({
    name,
    payload: payload
      .map((value) => (typeof value === 'string' ? value : safeJson(value)))
      .join(' '),
  });
};
const safeJson = (value: unknown): string => {
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return String(value);
  }
};

class RecordingChannel {
  constructor(name: string) {
    record('BroadcastChannel.construct', name);
  }
  postMessage(message: unknown): void {
    record('BroadcastChannel.postMessage', message);
  }
  addEventListener(): void {}
  removeEventListener(): void {}
  close(): void {}
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  sinks = [];
  window.sessionStorage.clear();
  window.localStorage.clear();
  window.history.replaceState(
    null,
    '',
    '/app/cms-content-modeling/capability-grants',
  );
  navigateTo.mockClear();
  vi.stubGlobal('BroadcastChannel', RecordingChannel);
  vi.stubGlobal('indexedDB', {
    open: (...args: unknown[]) => {
      record('indexedDB.open', ...args);
      throw new Error('IndexedDB is not used by the grant console');
    },
  });
  Object.defineProperty(navigator, 'sendBeacon', {
    configurable: true,
    value: (...args: unknown[]) => {
      record('sendBeacon', ...args);
      return true;
    },
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
    this: Storage,
    key: string,
    value: string,
  ) {
    record('Storage.setItem', key, value);
  });
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const)
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      record(`console.${level}`, ...args);
    });
  const pushState = window.history.pushState.bind(window.history);
  const replaceState = window.history.replaceState.bind(window.history);
  vi.spyOn(window.history, 'pushState').mockImplementation((...args) => {
    record('history.pushState', ...args);
    pushState(...args);
  });
  vi.spyOn(window.history, 'replaceState').mockImplementation((...args) => {
    record('history.replaceState', ...args);
    replaceState(...args);
  });
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'sendBeacon');
});

const mount = (overrides = {}) => {
  mounted = mountConsole(consoleProps(overrides));
  return mounted.container;
};

const leaks = (): Sink[] =>
  sinks.filter((sink) => sink.payload.includes(GRANT_UUID));

describe('[P2-S09-AC-1014] person identifiers stay inside the owner-only island', () => {
  it('[P2-S09-AC-1014] a successful grant writes the person ID to no browser sink and no announcement', async () => {
    scriptFetch(
      () => jsonResponse(201, grantResource()),
      () => jsonResponse(200, grantListPage(sampleItems())),
    );
    const root = mount();
    await submit(fillGrantForm(root));
    expect(leaks()).toStrictEqual([]);
    const live = [
      ...root.querySelectorAll('[role="status"], [role="alert"]'),
    ].map((node) => textOf(node));
    expect(live.join(' ')).not.toContain(GRANT_UUID);
    expect(window.location.href).not.toContain(GRANT_UUID);
    expect(window.localStorage.length).toBe(0);
  });

  it('[P2-S09-AC-1014] a step-up detour records only the pending-command envelope (kind, grant, original key), never the person ID', async () => {
    scriptFetch(() =>
      jsonResponse(
        401,
        apiError('STEP_UP_REQUIRED', {
          recoveryAction: 'step_up',
          allowedMethods: ['totp'],
        }),
      ),
    );
    const root = mount();
    await submit(fillGrantForm(root));
    click(query(root, 'a[data-action="verify-identity"]'));
    expect(leaks()).toStrictEqual([]);
    const writes = sinks.filter((sink) => sink.name === 'Storage.setItem');
    expect(writes).toHaveLength(1);
    const [write] = writes;
    expect(write?.payload.startsWith('wj:cms-grants:step-up-return ')).toBe(
      true,
    );
    expect(
      JSON.parse(
        (write?.payload ?? '').slice('wj:cms-grants:step-up-return '.length),
      ),
    ).toEqual({
      kind: 'grant',
      grantId: null,
      idempotencyKey: expect.stringMatching(/^cms-grant-15-/u),
      // r14: stamped with the (absent in jsdom) session scope and the time.
      binding: null,
      createdAt: expect.any(Number),
    });
  });

  it('[P2-S09-AC-1014] the island-local person filter is sent to the read but reaches no sink or address', async () => {
    const { calls } = scriptFetch(() =>
      jsonResponse(200, grantListPage(sampleItems())),
    );
    const root = mount();
    typeInto(query(root, 'input[name="filterPerson"]'), GRANT_UUID);
    await vi.waitFor(() => expect(calls.length).toBeGreaterThan(0));
    expect(calls.at(-1)?.url).toContain(`subjectPersonId=${GRANT_UUID}`);
    expect(leaks()).toStrictEqual([]);
    expect(window.location.href).not.toContain(GRANT_UUID);
  });

  it('[P2-S09-AC-1014] no analytics, Realtime channel or IndexedDB sink is opened at all', async () => {
    scriptFetch(
      () => jsonResponse(201, grantResource()),
      () => jsonResponse(200, grantListPage(sampleItems())),
    );
    const root = mount();
    await submit(fillGrantForm(root));
    const opened = sinks.filter(
      (sink) =>
        sink.name.startsWith('BroadcastChannel') ||
        sink.name.startsWith('indexedDB') ||
        sink.name === 'sendBeacon',
    );
    expect(opened).toStrictEqual([]);
  });
});
