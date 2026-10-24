// @vitest-environment jsdom
import { createRequire } from 'node:module';

import * as React from 'react';
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
  byLabel,
  choose,
  click,
  disableReactAct,
  enableReactAct,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  diffPath,
  json,
  refusal,
  scriptedFetch,
  settle,
  UPDATE,
} from './composition-page.test-support';
import CmsCompositionPage from './CmsCompositionPage';
import {
  diffOf,
  entryFacts,
  plainPath,
  propsPath,
  removedPath,
  row,
  selectorItem,
  selectorPage,
  structurePath,
} from './composition.test-support';

/*
 * FE03 testing floor: axe with no serious or critical finding on the composition surface in the states a person meets:
 * clean, with rows, with a diff and every collision kind, refused, invalid and virtualized. The island is mounted for
 * real inside the landmarks the shared shell provides. jsdom has no layout, so colour contrast and target size are
 * covered by the e2e and manual accessibility reports; every structural rule (names, labels, roles, ARIA validity,
 * headings, landmarks, duplicate ids) runs.
 */
const requireFromPlaywright = createRequire(
  createRequire(import.meta.url).resolve('@axe-core/playwright'),
);
const axe = requireFromPlaywright('axe-core') as {
  run: (
    context: Element | Document,
    options: Record<string, unknown>,
  ) => Promise<{
    violations: Array<{
      id: string;
      impact: string | null;
      help: string;
      nodes: Array<{ target: unknown[] }>;
    }>;
  }>;
};
vi.setConfig({ testTimeout: 90_000 });
beforeAll(enableReactAct);
afterAll(disableReactAct);
afterEach(() => {
  document.body.replaceChildren();
});

const mountInShell = (element: React.ReactElement) => {
  document.documentElement.lang = 'en';
  document.title = 'Composition | WeJammin';
  document.body.innerHTML =
    '<nav aria-label="Skip navigation"><a href="#cms-editorial-main">Skip to main content</a></nav>' +
    '<main id="cms-editorial-main" tabindex="-1"><h1 id="page-title" tabindex="-1">Composition</h1></main>';
  const mounted = mountElement(element);
  document.getElementById('cms-editorial-main')!.appendChild(mounted.container);
  return mounted;
};

const findings = async (): Promise<string[]> => {
  const result = await axe.run(document, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
    },
    rules: {
      'color-contrast': { enabled: false },
      'target-size': { enabled: false },
    },
  });
  return result.violations.map(
    (violation) =>
      `${violation.impact ?? 'n/a'} ${violation.id}: ${violation.help} (${violation.nodes
        .map((node) => String(node.target[0]))
        .slice(0, 3)
        .join(' | ')})`,
  );
};

const hero = selectorItem('hero-block', 2);
const page = (
  script: Record<string, Array<Response>>,
  instances = [
    row(1, { state: 'pending_diff' }),
    row(2, { linkMode: 'detached' }),
    row(3),
  ],
) => {
  const scripted = scriptedFetch(script);
  const mounted = mountInShell(
    <CmsCompositionPage
      entry={entryFacts()}
      selector={selectorPage([hero, selectorItem('side-note', 1)])}
      instances={instances}
      csrfToken="csrf-token"
      fetcher={scripted.fetcher}
    />,
  );
  return { ...mounted, ...scripted };
};

describe('composition page: axe', () => {
  it('is not vacuous: the same run reports an unlabelled control', async () => {
    mountInShell(<button type="button" />);
    expect((await findings()).join('\n')).toMatch(/button-name/u);
  });

  it('has no serious finding when clean, with rows and when the form is invalid', async () => {
    const { container } = page({});
    expect(await findings()).toEqual([]);
    await click(buttonNamed(container, 'Place pattern'));
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(await findings()).toEqual([]);
  });

  it('has no serious finding with a diff that shows every collision kind and the new roots', async () => {
    const diff = diffOf(
      1,
      [
        propsPath('/a'),
        plainPath('/b'),
        structurePath('/c'),
        removedPath('/d'),
      ],
      {
        newRoots: [
          { rootPath: '/extra', blockKey: 'profile.header', blockVersion: 1 },
        ],
      },
    );
    const { container } = page({
      [diffPath(row(1).id)]: [json(diff, 200, '"3"')],
    });
    await click(buttonNamed(container, 'Review update for /main/row-1'));
    await settle();
    expect(container.querySelector('.cms-diff')).not.toBeNull();
    expect(await findings()).toEqual([]);
    await click(buttonNamed(container, 'Accept update'));
    expect(container.querySelector('.cms-diff [role="alert"]')).not.toBeNull();
    expect(await findings()).toEqual([]);
  });

  it('has no serious finding after a refusal and after a result', async () => {
    const diff = diffOf(1, [plainPath('/a')]);
    const { container } = page({
      [diffPath(row(1).id)]: [json(diff, 200, '"3"')],
      [UPDATE]: [refusal(422, 'COMPOSITION_VALIDATION_FAILED')],
    });
    await click(buttonNamed(container, 'Review update for /main/row-1'));
    await settle();
    await click(buttonNamed(container, 'Accept update'));
    await settle();
    expect(container.querySelector('[role="alert"] h2')?.textContent).toBe(
      'Update not applied',
    );
    expect(await findings()).toEqual([]);
  });

  it('has no serious finding with a virtualized list and the selector populated', async () => {
    const many = Array.from({ length: 300 }, (_, i) => row(i + 1));
    const { container } = page({}, many);
    await choose(
      byLabel<HTMLSelectElement>(container, 'Pattern'),
      hero.patternVersionId,
    );
    expect(container.querySelector('[data-windowed="true"]')).not.toBeNull();
    expect(await findings()).toEqual([]);
  });
});
