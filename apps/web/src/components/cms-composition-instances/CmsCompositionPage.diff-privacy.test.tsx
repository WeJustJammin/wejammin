// @vitest-environment jsdom
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  UPDATE,
  diffPath,
  json,
  mountPage,
  noStrayRequests,
  settle,
} from './composition-page.test-support';
import { diffOf, id, plainPath, row } from './composition.test-support';
import type { DiffPath } from './composition-types';
import { expectListRefetches } from './composition-refetch.test-support';

/**
 * [P2-S12-AC-272] FE03 895 and 1845: the pattern diff values "never enter a public/private cache,
 * analytics event, Realtime body, URL, or log"; the browser half. The three values of a collision
 * (base, theirs, yours) carry sentinels. They are rendered only inside the diff section while it is
 * open, never in an attribute, the title, the URL, history, storage, cookies, the console, a
 * broadcast, socket, stream, beacon or cache; the one write carries the choice and never a value;
 * and the values are gone from the page once the update is accepted (the diff is re-required on
 * every open, FE03 2713).
 */
const BASE = 'sentinel-base-7a1c';
const THEIRS = 'sentinel-theirs-7a2d';
const YOURS = 'sentinel-yours-7a3e';
const SENTINELS = [BASE, THEIRS, YOURS];

const node = (text: string) => ({
  blockKey: 'profile.header',
  blockVersion: 1,
  props: { text },
  children: [],
});
const sentinelPath: DiffPath = {
  path: '/hero',
  base: node(BASE),
  theirs: node(THEIRS),
  yours: { text: YOURS },
  collision: true,
  collisionKind: 'props',
};

/** Every channel a value could leave the page through, observed. */
const watch = () => {
  const consoleCalls: unknown[][] = [];
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const)
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      consoleCalls.push(args);
    });
  const channels = {
    broadcast: vi.fn(),
    socket: vi.fn(),
    stream: vi.fn(),
    beacon: vi.fn(),
    cacheOpen: vi.fn(),
  };
  vi.stubGlobal('BroadcastChannel', channels.broadcast);
  vi.stubGlobal('WebSocket', channels.socket);
  vi.stubGlobal('EventSource', channels.stream);
  vi.stubGlobal('caches', { open: channels.cacheOpen });
  Object.defineProperty(navigator, 'sendBeacon', {
    value: channels.beacon,
    configurable: true,
  });
  return { consoleCalls, channels };
};

const attributeValues = (): string[] =>
  Array.from(document.querySelectorAll('*')).flatMap((element) =>
    Array.from(element.attributes).map((attribute) => attribute.value),
  );

beforeAll(enableReactAct);
afterAll(disableReactAct);
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('pattern diff surface: sentinel values stay on the diff surface', () => {
  it('[P2-S12-AC-272] renders the values only inside the open diff, leaves every channel untouched, writes a choice and never a value, and drops the values once accepted', async () => {
    const { consoleCalls, channels } = watch();
    const href = window.location.href;
    const length = window.history.length;
    const cookie = document.cookie;
    const diff = diffOf(1, [sentinelPath]);
    const page = mountPage(
      {
        [diffPath(id(1))]: [json(diff, 200, '"3"')],
        [UPDATE]: [
          json(
            {
              items: [
                row(1, { version: '4', patternVersion: 2, state: 'active' }),
              ],
            },
            200,
            '"10"',
          ),
        ],
      },
      { instances: [row(1, { state: 'pending_diff', version: '3' })] },
    );
    const texts = (): string => document.body.textContent ?? '';

    // Before the diff is opened no value is on the page.
    for (const sentinel of SENTINELS) expect(texts()).not.toContain(sentinel);

    await click(buttonNamed(page.container, 'Review update for /main/row-1'));
    await settle();
    // Open: the three values are shown, and only inside the diff section.
    const section = page.container.querySelector('.cms-diff');
    expect(section).not.toBeNull();
    for (const sentinel of SENTINELS) {
      expect(section?.textContent).toContain(sentinel);
      const outside = (document.body.textContent ?? '').replace(
        section?.textContent ?? '',
        '',
      );
      expect(outside).not.toContain(sentinel);
    }
    // They are text, never an attribute (id, name, value, aria, data) and never the title.
    for (const sentinel of SENTINELS) {
      expect(attributeValues().join('\n')).not.toContain(sentinel);
      expect(document.title).not.toContain(sentinel);
    }

    await click(
      page.container.querySelector<HTMLInputElement>(
        'input[name="choice-/hero"][value="yours"]',
      )!,
    );
    await click(buttonNamed(page.container, 'Accept update'));
    await settle();

    // The requests: the diff read names only the instance; the one write carries the choice, never a value.
    noStrayRequests(page.unexpected);
    expect(page.calls.map(({ method, path }) => `${method} ${path}`)).toEqual([
      `GET /api/v1/cms/compositions/instances/${id(1)}/update-diff`,
      'POST /api/v1/cms/compositions/pattern-updates',
    ]);
    for (const call of page.calls) {
      expect(call.search).toBe('');
      expect(call.path).toMatch(/^\/api\/v1\/cms\/compositions\//u);
      for (const sentinel of SENTINELS) {
        expect(JSON.stringify(call)).not.toContain(sentinel);
      }
    }
    expect(page.calls[1]?.body).toMatchObject({
      instances: [{ choices: [{ path: '/hero', choice: 'yours' }] }],
    });

    // Accepted: the diff is gone and so are its values (re-required on every open, never kept).
    expect(page.container.querySelector('.cms-diff')).toBeNull();
    for (const sentinel of SENTINELS) {
      expect(texts()).not.toContain(sentinel);
      expect(attributeValues().join('\n')).not.toContain(sentinel);
    }

    // Every other channel is untouched.
    expect(window.location.href).toBe(href);
    expect(window.history.length).toBe(length);
    expect(window.history.state).toBeNull();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(document.cookie).toBe(cookie);
    expect(JSON.stringify(consoleCalls)).not.toMatch(/sentinel-/u);
    expect(consoleCalls).toEqual([]);
    for (const channel of Object.values(channels))
      expect(channel).not.toHaveBeenCalled();
    expectListRefetches(page, 1);
  });

  it('[P2-S12-AC-272] opening another instance replaces the diff, so the first values are not kept', async () => {
    watch();
    const page = mountPage(
      {
        [diffPath(id(1))]: [json(diffOf(1, [sentinelPath]), 200, '"3"')],
        [diffPath(id(2))]: [json(diffOf(2, [plainPath('/note')]), 200, '"3"')],
      },
      {
        instances: [
          row(1, { state: 'pending_diff', version: '3' }),
          row(2, { state: 'pending_diff', version: '3' }),
        ],
      },
    );
    await click(buttonNamed(page.container, 'Review update for /main/row-1'));
    await settle();
    expect(page.container.textContent).toContain(BASE);
    await click(buttonNamed(page.container, 'Review update for /main/row-2'));
    await settle();
    expect(page.container.querySelectorAll('.cms-diff')).toHaveLength(1);
    for (const sentinel of SENTINELS) {
      expect(document.body.textContent).not.toContain(sentinel);
      expect(attributeValues().join('\n')).not.toContain(sentinel);
    }
  });
});
