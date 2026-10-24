// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  ENTRY,
  UPDATE,
  diffPath,
  entryDetail,
  json,
  mountPage,
  noStrayRequests,
  refusal,
  settle,
} from './composition-page.test-support';
import {
  diffOf,
  id,
  plainPath,
  propsPath,
  row,
} from './composition.test-support';

/*
 * FE03 887, 1115; DEC-181; P2-S12-AC-123: bulk acceptance only when no selected instance collides, never more than 32
 * instances in one request, the entry version read again between requests, all-or-nothing within a request.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);

const count = 70;
const rowsOf = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    row(i + 1, { state: 'pending_diff', version: '3' }),
  );
const select = async (container: HTMLElement, numbers: readonly number[]) => {
  for (const n of numbers)
    await click(byLabel<HTMLInputElement>(container, `Select /main/row-${n}`));
};
const cleanDiffs = (n: number) =>
  Object.fromEntries(
    Array.from({ length: n }, (_, i) => [
      diffPath(id(i + 1)),
      [json(diffOf(i + 1, [plainPath()]), 200, '"3"')],
    ]),
  );
const appended = (from: number, to: number, version: string) =>
  json(
    {
      items: Array.from({ length: to - from + 1 }, (_, i) =>
        row(from + i, { version: '4', patternVersion: 2 }),
      ),
    },
    200,
    `"${version}"`,
  );

describe('bulk accept', () => {
  it('sends 70 clean instances as successive requests of 32, 32 and 6, reading the entry version between them', async () => {
    const page = mountPage(
      {
        ...cleanDiffs(count),
        [UPDATE]: [
          appended(1, 32, '10'),
          appended(33, 64, '11'),
          appended(65, 70, '12'),
        ],
        [ENTRY]: [entryDetail('10'), entryDetail('11')],
      },
      { instances: rowsOf(count) },
    );
    await select(
      page.container,
      Array.from({ length: count }, (_, i) => i + 1),
    );
    await click(buttonNamed(page.container, 'Review selected updates'));
    await settle();
    expect(page.container.textContent).toContain('70 updates selected.');
    expect(page.container.textContent).toContain(
      'Accepting sends 3 requests of at most 32 instances',
    );
    await click(buttonNamed(page.container, 'Accept all selected updates'));
    await settle();
    const posts = page.calls.filter((call) => call.method === 'POST');
    expect(
      posts.map(
        (call) => (call.body as { instances: unknown[] }).instances.length,
      ),
    ).toEqual([32, 32, 6]);
    expect(posts.map((call) => call.headers['if-match'])).toEqual([
      '"9"',
      '"10"',
      '"11"',
    ]);
    expect(
      posts.map(
        (call) => (call.body as { expectedVersion: string }).expectedVersion,
      ),
    ).toEqual(['9', '10', '11']);
    const refetches = page.calls.filter((call) =>
      call.path.startsWith('/api/v1/cms/entries/'),
    );
    expect(refetches).toHaveLength(2);
    expect(
      (
        posts[0]!.body as { instances: Array<{ choices: unknown[] }> }
      ).instances.every((t) => t.choices.length === 0),
    ).toBe(true);
    expect(
      page.container.querySelector('#cms-composition-result-heading')
        ?.textContent,
    ).toBe('Updates applied');
    expect(
      page.container.querySelectorAll('.cms-composition-status li'),
    ).toHaveLength(count);
    expect(page.container.textContent).toContain('0 selected');
    noStrayRequests(page.unexpected);
  });

  it('stops at a failed request, says how many were applied and leaves the rest selected', async () => {
    const page = mountPage(
      {
        ...cleanDiffs(40),
        [UPDATE]: [
          appended(1, 32, '10'),
          refusal(409, 'COMPOSITION_VERSION_CONFLICT', {
            reasonCode: 'diff_has_collisions',
          }),
        ],
        [ENTRY]: [entryDetail('10')],
      },
      { instances: rowsOf(40) },
    );
    await select(
      page.container,
      Array.from({ length: 40 }, (_, i) => i + 1),
    );
    await click(buttonNamed(page.container, 'Review selected updates'));
    await settle();
    await click(buttonNamed(page.container, 'Accept all selected updates'));
    await settle();
    const status = page.container.querySelector(
      '#cms-composition-result-heading',
    )?.parentElement;
    expect(status?.textContent).toContain('Updates stopped');
    expect(status?.textContent).toContain('1 of 2 requests applied.');
    expect(page.container.textContent).toContain('8 selected');
    expect(page.container.querySelector('.cms-diff')?.textContent).toContain(
      '8 updates selected.',
    );
  });

  it('refuses bulk acceptance when any selected instance collides and names it', async () => {
    const page = mountPage(
      {
        [diffPath(id(1))]: [json(diffOf(1, [plainPath()]), 200, '"3"')],
        [diffPath(id(2))]: [json(diffOf(2, [propsPath()]), 200, '"3"')],
      },
      { instances: rowsOf(2) },
    );
    await select(page.container, [1, 2]);
    await click(buttonNamed(page.container, 'Review selected updates'));
    await settle();
    expect(
      buttonNamed(page.container, 'Accept all selected updates').disabled,
    ).toBe(true);
    expect(page.container.querySelector('.cms-diff')?.textContent).toContain(
      '/main/row-2',
    );
    expect(page.calls.filter((call) => call.method === 'POST')).toHaveLength(0);
  });

  it('keeps Review selected updates unavailable when a selected row has no update', async () => {
    const page = mountPage({}, { instances: [...rowsOf(1), row(5)] });
    await select(page.container, [1, 5]);
    expect(
      buttonNamed(page.container, 'Review selected updates').disabled,
    ).toBe(true);
    expect(buttonNamed(page.container, 'Detach selected').disabled).toBe(false);
  });
});

describe('bulk detach', () => {
  it('detaches 33 selected rows as requests of 32 and 1 with no choices', async () => {
    const detached = (from: number, to: number, version: string) =>
      json(
        {
          items: Array.from({ length: to - from + 1 }, (_, i) =>
            row(from + i, { version: '4', linkMode: 'detached' }),
          ),
        },
        200,
        `"${version}"`,
      );
    const page = mountPage(
      {
        [UPDATE]: [detached(1, 32, '10'), detached(33, 33, '11')],
        [ENTRY]: [entryDetail('10')],
      },
      {
        instances: Array.from({ length: 33 }, (_, i) =>
          row(i + 1, { version: '3' }),
        ),
      },
    );
    await select(
      page.container,
      Array.from({ length: 33 }, (_, i) => i + 1),
    );
    await click(buttonNamed(page.container, 'Detach selected'));
    await settle();
    const posts = page.calls.filter((call) => call.method === 'POST');
    expect(
      posts.map((call) => (call.body as { action: string }).action),
    ).toEqual(['detach', 'detach']);
    expect(
      posts.map(
        (call) => (call.body as { instances: unknown[] }).instances.length,
      ),
    ).toEqual([32, 1]);
    expect(posts.map((call) => call.headers['if-match'])).toEqual([
      '"9"',
      '"10"',
    ]);
    expect(
      page.container.querySelector('#cms-composition-result-heading')
        ?.textContent,
    ).toBe('Blocks detached');
    noStrayRequests(page.unexpected);
  });
});
