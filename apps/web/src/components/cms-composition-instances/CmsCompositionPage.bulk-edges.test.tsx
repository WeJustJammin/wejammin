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
  answerHeld,
  heldReply,
  resultHeading,
  resultText,
} from './composition-command-states.test-support';
import {
  ENTRY,
  UPDATE,
  diffPath,
  entryDetail,
  json,
  mountPage,
  refusal,
  settle,
} from './composition-page.test-support';
import {
  LIST,
  listPage,
  expectListRefetches,
} from './composition-refetch.test-support';
import { diffOf, id, plainPath, row } from './composition.test-support';

/*
 * [P2-S12-AC-271] A bulk sequence stops cleanly when the entry cannot be read between requests or a request is refused, and the diffs a
 * 409 re-reads report their own failure (FE03 1049).
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);

const pending = (n: number) => row(n, { state: 'pending_diff', version: '3' });
const clean = (n: number) => json(diffOf(n, [plainPath()]), 200, '"3"');
const conflict = () =>
  refusal(409, 'COMPOSITION_VERSION_CONFLICT', {
    reasonCode: 'diff_has_collisions',
  });
const select = async (container: HTMLElement, numbers: readonly number[]) => {
  for (const n of numbers)
    await click(byLabel<HTMLInputElement>(container, `Select /main/row-${n}`));
};
const reviewAndAccept = async (
  page: ReturnType<typeof mountPage>,
  n: number,
) => {
  await select(
    page.container,
    Array.from({ length: n }, (_, i) => i + 1),
  );
  await click(buttonNamed(page.container, 'Review selected updates'));
  await settle();
  await click(buttonNamed(page.container, 'Accept all selected updates'));
  await settle();
};

describe('bulk: the sequence stops cleanly', () => {
  const rows40 = Array.from({ length: 40 }, (_, i) =>
    row(i + 1, { state: 'pending_diff', version: '3' }),
  );
  const diffs40 = () =>
    Object.fromEntries(
      Array.from({ length: 40 }, (_, i) => [
        diffPath(id(i + 1)),
        [clean(i + 1)],
      ]),
    );
  const applied32 = () =>
    json(
      {
        items: Array.from({ length: 32 }, (_, i) =>
          row(i + 1, { version: '4', patternVersion: 2 }),
        ),
      },
      200,
      '"10"',
    );

  it('[P2-S12-AC-271] commandState error: when the entry cannot be read between requests the sequence stops, says how many were applied and keeps the unapplied diffs without re-reading them', async () => {
    const page = mountPage(
      {
        ...diffs40(),
        [UPDATE]: [applied32()],
        [ENTRY]: [refusal(503, 'DEPENDENCY_UNAVAILABLE')],
        [LIST]: [listPage(rows40)],
      },
      { instances: rows40 },
    );
    await reviewAndAccept(page, 40);
    expect(resultHeading(page.container)).toBe('Updates stopped');
    expect(resultText(page.container)).toContain(
      'The entry version could not be read again.',
    );
    expect(resultText(page.container)).toContain('1 of 2 requests applied.');
    expect(page.container.querySelector('.cms-diff')?.textContent).toContain(
      '8 updates selected.',
    );
    expect(page.container.textContent).toContain('8 selected');
  });

  it('[P2-S12-AC-271] commandState error: a refused request that is not a 409 stops the sequence and keeps the unapplied diffs as they are, without a re-read', async () => {
    const page = mountPage(
      {
        ...diffs40(),
        [UPDATE]: [
          applied32(),
          refusal(422, 'COMPOSITION_VALIDATION_FAILED', {}),
        ],
        [ENTRY]: [entryDetail('10')],
        [LIST]: [listPage(rows40)],
      },
      { instances: rows40 },
    );
    await reviewAndAccept(page, 40);
    expect(resultHeading(page.container)).toBe('Updates stopped');
    expect(resultText(page.container)).toContain('1 of 2 requests applied.');
    expect(page.container.querySelector('.cms-diff')?.textContent).toContain(
      '8 updates selected.',
    );
    expect(
      page.calls.filter((call) => call.path.endsWith('/update-diff')),
    ).toHaveLength(40);
  });
});

describe('bulk detach: a 409 on a later request', () => {
  it('[P2-S12-AC-271] commandState error: a 409 on the second request of a bulk detach says how many were applied, refetches the entry and the list, and leaves the rest selected', async () => {
    const rows33 = Array.from({ length: 33 }, (_, i) => row(i + 1));
    const detached32 = json(
      {
        items: Array.from({ length: 32 }, (_, i) =>
          row(i + 1, { version: '4', linkMode: 'detached' }),
        ),
      },
      200,
      '"10"',
    );
    const page = mountPage(
      {
        [UPDATE]: [detached32, conflict()],
        [ENTRY]: [entryDetail('10'), entryDetail('11')],
        [LIST]: [listPage(rows33)],
      },
      { instances: rows33 },
    );
    await select(
      page.container,
      rows33.map((_, i) => i + 1),
    );
    await click(buttonNamed(page.container, 'Detach selected'));
    await settle();
    expect(resultHeading(page.container)).toBe('Detach stopped');
    expect(resultText(page.container)).toContain('1 of 2 requests applied.');
    expect(page.container.textContent).toContain('1 selected');
    expect(page.lists).toHaveLength(1);
    expect(page.container.querySelector('.cms-diff')).toBeNull();
  });
});

describe('bulk 409: the diffs it re-reads', () => {
  const mount = (second: Response, more: Record<string, Response[]> = {}) =>
    mountPage(
      {
        [diffPath(id(1))]: [clean(1), second],
        [diffPath(id(2))]: [clean(2), clean(2)],
        [UPDATE]: [conflict()],
        [ENTRY]: [entryDetail('11')],
        ...more,
      },
      { instances: [pending(1), pending(2)] },
    );

  it('[P2-S12-AC-271] diffState error: a diff that cannot be read again after a 409 is said so, and no stale diff is kept', async () => {
    const limited = mount(
      refusal(
        429,
        'RATE_LIMITED',
        { retryAfterSeconds: 7 },
        { 'retry-after': '7' },
      ),
    );
    await reviewAndAccept(limited, 2);
    expect(limited.container.querySelector('.cms-diff')).toBeNull();
    expect(limited.container.textContent).toContain('7 seconds');
    expectListRefetches(limited, 1);
    limited.unmount();
    const large = mount(
      refusal(422, 'COMPOSITION_VALIDATION_FAILED', {
        reasonCode: 'diff_too_large',
      }),
    );
    await reviewAndAccept(large, 2);
    expect(large.container.querySelector('.cms-diff')).toBeNull();
    expect(large.container.textContent).toContain('too large to compare here');
    expect(large.container.textContent).toContain('2 selected');
    expectListRefetches(large, 1);
  });

  it('[P2-S12-AC-271] diffState error: a diff that cannot be reached after a 409 is said so, and no stale diff is kept', async () => {
    const page = mountPage(
      {
        [diffPath(id(1))]: [clean(1)],
        [diffPath(id(2))]: [clean(2)],
        [UPDATE]: [conflict()],
        [ENTRY]: [entryDetail('11')],
      },
      { instances: [pending(1), pending(2)] },
    );
    await reviewAndAccept(page, 2);
    expect(page.container.querySelector('.cms-diff')).toBeNull();
    expect(page.container.textContent).toContain(
      'The update could not be read right now.',
    );
    expectListRefetches(page, 1);
  });

  it('[P2-S12-AC-271] diffState error: a page that goes away while the diffs are read again changes nothing', async () => {
    const held = heldReply();
    const page = mount(clean(1), {
      [diffPath(id(1))]: [clean(1), held.reply as unknown as Response],
    });
    await reviewAndAccept(page, 2);
    page.unmount();
    await answerHeld(held, clean(1));
    await settle();
    expect(
      page.calls.filter((call) => call.path === diffPath(id(2)).slice(4)),
    ).toHaveLength(1);
    expectListRefetches(page, 1);
  });
});
