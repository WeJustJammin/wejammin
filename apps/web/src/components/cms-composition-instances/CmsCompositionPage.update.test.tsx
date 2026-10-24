// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  ENTRY,
  PLACE,
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
  removedPath,
  row,
  structurePath,
} from './composition.test-support';

/*
 * FE03 1115, 2708; P2-S12-AC-117, AC-123: resolve a pattern update. A pending_diff instance shows "Update available";
 * the diff is read fresh on every open; Accept carries the entry version, the instance version and one choice per
 * collision; the result names each outcome; choices survive a 409 for unchanged paths.
 */
beforeAll(enableReactAct);
afterAll(disableReactAct);

const pending = (n: number) => row(n, { state: 'pending_diff', version: '3' });
const radio = (container: HTMLElement, path: string, value: string) =>
  container.querySelector<HTMLInputElement>(
    `input[name="choice-${path}"][value="${value}"]`,
  )!;
const diff = diffOf(1, [
  propsPath('/a'),
  removedPath('/b'),
  structurePath('/c'),
]);
const diffResponse = (value = diff) =>
  json(value, 200, `"${value.instance.version}"`);
const updated = (rows: unknown[], version = '10') =>
  json({ items: rows }, 200, `"${version}"`);

const open = async (page: ReturnType<typeof mountPage>) => {
  await click(buttonNamed(page.container, 'Review update for /main/row-1'));
  await settle();
};
const answerAll = async (container: HTMLElement) => {
  await click(radio(container, '/a', 'yours'));
  await click(radio(container, '/b', 'theirs'));
  await click(radio(container, '/c', 'yours'));
};

describe('review: the diff is read fresh and nothing is preselected', () => {
  it('shows pending_diff as Update available and reads the diff of exactly that instance', async () => {
    const page = mountPage(
      { [diffPath(id(1))]: [diffResponse()] },
      { instances: [pending(1), row(2)] },
    );
    expect(page.container.textContent).toContain('Update available');
    await open(page);
    expect(page.calls).toHaveLength(1);
    expect(page.calls[0]?.method).toBe('GET');
    expect(page.container.querySelector('.cms-diff')).not.toBeNull();
    expect(
      page.container.querySelectorAll('input[type="radio"]:checked'),
    ).toHaveLength(0);
    expect(page.container.querySelector('[aria-current="true"]')?.id).toBe(
      `cms-instance-${id(1)}`,
    );
  });

  it('reads the diff again on every open: it is never cached', async () => {
    const page = mountPage(
      { [diffPath(id(1))]: [diffResponse(), diffResponse()] },
      { instances: [pending(1)] },
    );
    await open(page);
    await click(radio(page.container, '/a', 'yours'));
    await open(page);
    expect(page.calls).toHaveLength(2);
    expect(
      page.container.querySelectorAll('input[type="radio"]:checked'),
    ).toHaveLength(0);
  });

  it('names the typed diff_too_large refusal and offers no accept', async () => {
    const page = mountPage(
      {
        [diffPath(id(1))]: [
          refusal(422, 'COMPOSITION_VALIDATION_FAILED', {
            reasonCode: 'diff_too_large',
          }),
        ],
      },
      { instances: [pending(1)] },
    );
    await open(page);
    expect(page.container.textContent).toContain('too large to compare here');
    expect(() => buttonNamed(page.container, 'Accept update')).toThrow();
  });

  it('shows the no-update state for an instance with no newer compatible version', async () => {
    const none = diffOf(1, [], {
      targetPatternVersion: 1,
      bulkEligible: false,
    });
    const page = mountPage(
      { [diffPath(id(1))]: [diffResponse(none)] },
      { instances: [pending(1)] },
    );
    await open(page);
    expect(page.container.textContent).toContain(
      'No newer compatible pattern version',
    );
  });
});

describe('accept: the exact request and the named outcome', () => {
  it('does not send while a collision is unanswered and focuses the first one', async () => {
    const page = mountPage(
      { [diffPath(id(1))]: [diffResponse()] },
      { instances: [pending(1)] },
    );
    await open(page);
    await click(radio(page.container, '/a', 'yours'));
    await click(buttonNamed(page.container, 'Accept update'));
    expect(page.calls).toHaveLength(1);
    expect(document.activeElement).toBe(radio(page.container, '/b', 'yours'));
  });

  it('sends the target version, the instance version, one choice per collision and the entry version, then names the new pin', async () => {
    const page = mountPage(
      {
        [diffPath(id(1))]: [diffResponse()],
        [UPDATE]: [
          updated([
            row(1, {
              version: '4',
              patternVersion: 2,
              linkMode: 'detached',
              state: 'active',
            }),
          ]),
        ],
      },
      { instances: [pending(1)] },
    );
    await open(page);
    await answerAll(page.container);
    await click(buttonNamed(page.container, 'Accept update'));
    await settle();
    const call = page.calls[1]!;
    expect(call.path).toBe('/api/v1/cms/compositions/pattern-updates');
    expect(call.headers['if-match']).toBe('"9"');
    expect(call.body).toEqual({
      action: 'accept',
      targetPatternVersion: 2,
      instances: [
        {
          instanceId: id(1),
          expectedVersion: '3',
          choices: [
            { path: '/a', choice: 'yours' },
            { path: '/b', choice: 'theirs' },
            { path: '/c', choice: 'yours' },
          ],
        },
      ],
      expectedVersion: '9',
    });
    expect(
      page.container.querySelector('#cms-composition-result-heading')
        ?.textContent,
    ).toBe('Update applied');
    expect(page.container.textContent).toContain('/main/row-1: Local copy');
    expect(page.container.querySelector('.cms-diff')).toBeNull();
    expect(page.container.textContent).toContain('Local copy');
    noStrayRequests(page.unexpected);
  });

  it('names a removal and the new pin of a clean accept', async () => {
    const clean = diffOf(1, [plainPath('/a')]);
    const page = mountPage(
      {
        [diffPath(id(1))]: [diffResponse(clean)],
        [UPDATE]: [updated([row(1, { version: '4', patternVersion: 2 })])],
      },
      { instances: [pending(1)] },
    );
    await open(page);
    await click(buttonNamed(page.container, 'Accept update'));
    await settle();
    expect(page.container.textContent).toContain(
      '/main/row-1: Now on pattern version 2',
    );
    expect(page.container.textContent).toContain('Up to date');
  });
});

describe('accept: refusals keep the author choices', () => {
  const setup = (second: Response) =>
    mountPage(
      {
        [diffPath(id(1))]: [
          diffResponse(),
          second.status === 200 ? second : diffResponse(),
        ],
        [UPDATE]: [
          second.status === 200
            ? refusal(409, 'COMPOSITION_VERSION_CONFLICT', {
                reasonCode: 'diff_has_collisions',
              })
            : second,
        ],
        [ENTRY]: [entryDetail('11')],
      },
      { instances: [pending(1)] },
    );

  it('on diff_has_collisions refetches the entry version and the diff and keeps choices for unchanged paths', async () => {
    const changed = structuredClone(diff);
    changed.paths[2] = { ...structurePath('/c'), yours: { edited: 'x' } };
    const page = setup(diffResponse(changed));
    await open(page);
    await answerAll(page.container);
    await click(buttonNamed(page.container, 'Accept update'));
    await settle();
    expect(page.container.textContent).toContain(
      'this update now has collisions',
    );
    expect(radio(page.container, '/a', 'yours').checked).toBe(true);
    expect(radio(page.container, '/b', 'theirs').checked).toBe(true);
    expect(radio(page.container, '/c', 'yours').checked).toBe(false);
    expect(radio(page.container, '/c', 'theirs').checked).toBe(false);
    noStrayRequests(page.unexpected);
  });

  it('on revision_not_editable keeps every choice and the refreshed facts', async () => {
    const page = mountPage(
      {
        [diffPath(id(1))]: [diffResponse(), diffResponse()],
        [UPDATE]: [
          refusal(409, 'COMPOSITION_VERSION_CONFLICT', {
            reasonCode: 'revision_not_editable',
          }),
        ],
        [ENTRY]: [entryDetail('9', { state: 'submitted' })],
      },
      { instances: [pending(1)] },
    );
    await open(page);
    await answerAll(page.container);
    await click(buttonNamed(page.container, 'Accept update'));
    await settle();
    expect(radio(page.container, '/a', 'yours').checked).toBe(true);
    expect(buttonNamed(page.container, 'Accept update').disabled).toBe(true);
    expect(page.container.textContent).toContain('not an editable draft');
  });

  it('on a 422 keeps the choices, says nothing was applied and does not refetch', async () => {
    const page = mountPage(
      {
        [diffPath(id(1))]: [diffResponse()],
        [UPDATE]: [refusal(422, 'COMPOSITION_VALIDATION_FAILED')],
      },
      { instances: [pending(1)] },
    );
    await open(page);
    await answerAll(page.container);
    await click(buttonNamed(page.container, 'Accept update'));
    await settle();
    const alert = page.container.querySelector(
      '#cms-composition-result-heading',
    )?.parentElement;
    expect(alert?.textContent).toContain('Nothing was applied');
    expect(radio(page.container, '/c', 'yours').checked).toBe(true);
    expect(page.calls).toHaveLength(2);
  });
});

describe('detach and Place', () => {
  it('detaches a row from the list with its own version and names the local copy', async () => {
    const page = mountPage(
      { [UPDATE]: [updated([row(2, { version: '4', linkMode: 'detached' })])] },
      { instances: [row(2, { version: '3' })] },
    );
    await click(buttonNamed(page.container, 'Detach /main/row-2'));
    await settle();
    expect(page.calls[0]?.body).toEqual({
      action: 'detach',
      instances: [{ instanceId: id(2), expectedVersion: '3', choices: [] }],
      expectedVersion: '9',
    });
    expect(page.container.textContent).toContain('/main/row-2: Local copy');
    expect(() => buttonNamed(page.container, 'Detach /main/row-2')).toThrow();
  });

  it('keeps another instance’s open diff and its choices when a different row is detached', async () => {
    const page = mountPage(
      {
        [diffPath(id(1))]: [diffResponse()],
        [UPDATE]: [updated([row(2, { version: '4', linkMode: 'detached' })])],
      },
      { instances: [pending(1), row(2, { version: '3' })] },
    );
    await open(page);
    await click(radio(page.container, '/a', 'yours'));
    await click(buttonNamed(page.container, 'Detach /main/row-2'));
    await settle();
    expect(page.container.querySelector('.cms-diff')).not.toBeNull();
    expect(radio(page.container, '/a', 'yours').checked).toBe(true);
    expect(page.container.textContent).toContain('/main/row-2: Local copy');
  });

  it('places a chosen new root through CMS-03C-02 with the instance revision, pattern and link mode', async () => {
    const withRoots = diffOf(1, [plainPath('/a')], {
      targetPatternVersion: 3,
      newRoots: [
        { rootPath: '/extra', blockKey: 'profile.header', blockVersion: 1 },
        { rootPath: '/other', blockKey: 'profile.header', blockVersion: 1 },
      ],
    });
    const page = mountPage(
      {
        [diffPath(id(1))]: [diffResponse(withRoots), diffResponse(withRoots)],
        [PLACE]: [
          json(
            {
              items: [
                row(7, {
                  path: '/main/extra',
                  patternVersion: 3,
                  state: 'draft',
                  position: 9,
                }),
              ],
            },
            201,
            '"10"',
          ),
        ],
      },
      { instances: [pending(1)] },
    );
    await open(page);
    await click(
      page.container.querySelectorAll<HTMLInputElement>(
        '.cms-diff-new input[type="checkbox"]',
      )[0]!,
    );
    await click(buttonNamed(page.container, 'Place selected blocks'));
    await settle();
    expect(page.calls[1]?.body).toEqual({
      revisionId: row(1).revisionId,
      patternId: row(1).patternId,
      patternVersion: 3,
      linkMode: 'linked',
      slotPath: '/main',
      overrides: {},
      roots: ['/extra'],
      expectedVersion: '9',
    });
    expect(page.container.textContent).toContain(
      'Placed 1 block from pattern version 3.',
    );
    expect(page.calls).toHaveLength(3);
    expect(
      page.container.querySelectorAll('ul.cms-instance-rows > li'),
    ).toHaveLength(2);
  });
});
