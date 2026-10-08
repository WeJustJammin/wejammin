// @vitest-environment jsdom

import { createRequire } from 'node:module';

import {
  AuthoringContextResourceSchema,
  ConflictDetailResourceSchema,
} from '@wejammin/contracts';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import * as React from '../../apps/web/node_modules/react/index.js';

const { act } = React;
import CmsEditorialConflictResolveIsland from '../../apps/web/src/components/cms-editorial/CmsEditorialConflictResolveIsland';
import CmsEditorialEntryCreateIsland from '../../apps/web/src/components/cms-editorial/CmsEditorialEntryCreateIsland';
import CmsEditorialEntryEditorIsland from '../../apps/web/src/components/cms-editorial/CmsEditorialEntryEditorIsland';
import CmsEditorialEntryList from '../../apps/web/src/components/cms-editorial/CmsEditorialEntryList';
import CmsEditorialRevisionCompare from '../../apps/web/src/components/cms-editorial/CmsEditorialRevisionCompare';
import CmsEditorialRevisionHistory from '../../apps/web/src/components/cms-editorial/CmsEditorialRevisionHistory';
import { conflictDetailBody } from '../../apps/web/src/components/cms-editorial/cms-editorial-conflict-fixtures.test-support';
import { conflictInitFrom } from '../../apps/web/src/components/cms-editorial/cms-editorial-conflict-state';
import {
  BLURB,
  TITLE,
  editorFields,
  editorInit,
} from '../../apps/web/src/components/cms-editorial/cms-editorial-editor-fixtures.test-support';
import {
  CHAIN_ID,
  HISTORY_ENTRY_ID,
  HISTORY_ROUTE,
  change,
  compareWith,
  historyPage,
  restore,
} from '../../apps/web/src/components/cms-editorial/cms-editorial-history-fixtures.test-support';
import CmsEditorialPageNotice from '../../apps/web/src/components/cms-editorial-pages/CmsEditorialPageNotice';
import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
} from '../../apps/web/src/components/cms-editorial-fields/cms-editor-dom.test-support';
import {
  allKindFields,
  selectedType,
} from '../../apps/web/src/components/cms-editorial-fields/cms-field-fixtures.test-support';

/*
 * FE03 testing floor: axe with no serious or critical finding on every Slice 10
 * editorial surface. The surfaces are mounted for real (islands through their
 * own controllers, views from the verified fixtures) inside the document
 * landmarks the shared shell provides, and axe runs over the live DOM. jsdom has
 * no layout, so colour-contrast and target-size are covered by the e2e and
 * manual accessibility reports, not here; every structural rule (names, labels,
 * roles, ARIA validity, headings, landmarks, duplicate ids) runs.
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

beforeAll(enableReactAct);
afterAll(disableReactAct);
afterEach(() => {
  document.body.replaceChildren();
  document.cookie = 'wj_csrf=; max-age=0';
});

const shell = (): HTMLElement => {
  document.documentElement.lang = 'en';
  document.title = 'Editorial surface | WeJammin';
  document.body.innerHTML =
    '<nav aria-label="Skip navigation"><a href="#cms-editorial-main">Skip to main content</a></nav>' +
    '<main id="cms-editorial-main" tabindex="-1"><h1 id="page-title" tabindex="-1">Editorial surface</h1></main>';
  return document.getElementById('cms-editorial-main') as HTMLElement;
};

const mountInShell = (element: React.ReactElement) => {
  const main = shell();
  const mounted = mountElement(element);
  main.appendChild(mounted.container);
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

const noSerious = (found: string[]): string[] =>
  found.filter((line) => /^(serious|critical) /u.test(line));

const noop = (): void => undefined;
void noop;

describe('Slice 10 editorial surfaces: axe', () => {
  it('create form, with every field kind', async () => {
    document.cookie = 'wj_csrf=csrf-token';
    mountInShell(
      React.createElement(CmsEditorialEntryCreateIsland, {
        type: selectedType(),
        fields: allKindFields(),
      }),
    );
    expect(await findings()).toEqual([]);
  });

  it('create form after a refused submit (error summary and invalid controls)', async () => {
    document.cookie = 'wj_csrf=csrf-token';
    const { container } = mountInShell(
      React.createElement(CmsEditorialEntryCreateIsland, {
        type: selectedType(),
        fields: allKindFields(),
      }),
    );
    await click(buttonNamed(container, 'Create entry'));
    await flush();
    expect(
      container.querySelector('[data-cms-editorial-validation-summary]'),
    ).not.toBeNull();
    expect(await findings()).toEqual([]);
  });

  it('draft editor, clean and after a refused explicit save', async () => {
    document.cookie = 'wj_csrf=csrf-token';
    const { container } = mountInShell(
      React.createElement(CmsEditorialEntryEditorIsland, {
        init: editorInit({
          fields: editorFields(),
          openConflict: {
            conflictId: '018f0c45-73fe-7dc2-9c09-68f7ecf132ee',
            version: '1',
          },
        }),
      }),
    );
    expect(await findings()).toEqual([]);
    const rating = container.querySelector('input[aria-label], input');
    expect(rating).not.toBeNull();
    await act(async () => {
      // Clear the required title, then save: the summary and invalid state.
      const title = Array.from(container.querySelectorAll('input')).find(
        (input) => input.id === `field-${TITLE}`,
      ) as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set;
      setter?.call(title, '');
      title.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click(buttonNamed(container, 'Save draft'));
    await flush();
    expect(await findings()).toEqual([]);
  });

  it('conflict resolution, undecided and refused', async () => {
    document.cookie = 'wj_csrf=csrf-token';
    const init = conflictInitFrom(
      ConflictDetailResourceSchema.parse(
        conflictDetailBody({
          paths: [
            {
              fieldId: TITLE,
              base: { value: 'a' },
              theirs: { value: 'b' },
              yours: { value: 'c' },
            },
            {
              fieldId: BLURB,
              base: { value: null },
              theirs: { value: 'd' },
              yours: { value: 'e' },
            },
          ],
        }),
      ),
      AuthoringContextResourceSchema.parse({
        creatableTypes: [selectedType()],
        selectedType: selectedType(),
        fields: editorFields(),
      }).fields,
    );
    const { container } = mountInShell(
      React.createElement(CmsEditorialConflictResolveIsland, { init }),
    );
    expect(await findings()).toEqual([]);
    await click(buttonNamed(container, 'Resolve conflict'));
    await flush();
    expect(
      container.querySelector('[data-cms-editorial-validation-summary]'),
    ).not.toBeNull();
    expect(await findings()).toEqual([]);
  });

  it('history, comparison with the restore review open, and the restore-unavailable state', async () => {
    const page = historyPage({
      compare: compareWith(
        [change('field'), change('block'), change('relation')],
        restore('available', 2),
      ),
    });
    mountInShell(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(CmsEditorialRevisionHistory, {
          page,
          entryId: HISTORY_ENTRY_ID,
          routePath: HISTORY_ROUTE,
          query: { state: 'draft' },
        }),
        React.createElement(CmsEditorialRevisionCompare, {
          compare: page.compare,
          refusal: null,
          entryId: HISTORY_ENTRY_ID,
          expectedVersion: '7',
        }),
      ),
    );
    expect(CHAIN_ID.length).toBeGreaterThan(0);
    document.querySelector('details')?.setAttribute('open', '');
    expect(await findings()).toEqual([]);
    document.body.replaceChildren();
    const unavailable = historyPage({
      compare: compareWith([change('field')], restore('transform_missing')),
    });
    mountInShell(
      React.createElement(CmsEditorialRevisionCompare, {
        compare: unavailable.compare,
        refusal: null,
        entryId: HISTORY_ENTRY_ID,
        expectedVersion: '7',
      }),
    );
    expect(await findings()).toEqual([]);
  });

  it('entry list, empty states and a closed notice', async () => {
    const entry = {
      id: '018f0c45-73fe-7dc2-9c09-68f7ecf20001',
      entryId: '018f0c45-73fe-7dc2-9c09-68f7ecf10001',
      revisionNumber: '1',
      locale: 'en-US',
      state: 'draft',
      contentHash: 'a'.repeat(64),
      createdAt: '2026-10-05T00:00:00Z',
      authorClass: 'author',
      entryLifecycle: 'active',
      entryUpdatedAt: '2026-10-05T01:00:00Z',
    };
    const list = (items: unknown[], query: Record<string, string>) =>
      mountInShell(
        React.createElement(CmsEditorialEntryList, {
          page: {
            items,
            nextCursor: items.length > 0 ? 'c' : null,
            pageVersion: '1',
          } as never,
          routePath: '/app/cms-content-modeling/entries',
          query,
        }),
      );
    list([entry], {});
    expect(await findings()).toEqual([]);
    document.body.replaceChildren();
    list([], {});
    expect(await findings()).toEqual([]);
    document.body.replaceChildren();
    list([], { state: 'published' });
    expect(await findings()).toEqual([]);
    document.body.replaceChildren();
    mountInShell(
      React.createElement(CmsEditorialPageNotice, {
        notice: {
          status: 503,
          title: 'Temporarily unavailable',
          heading: 'Temporarily unavailable',
          message: 'Nothing was loaded; try again shortly.',
          retryHref: '/app/cms-content-modeling/entries',
          requestId: '018f0c45-73fe-7dc2-9c09-68f7ecf132e9',
        },
      }),
    );
    expect(await findings()).toEqual([]);
  });

  it('keeps the severity filter honest: nothing serious or critical can hide behind a lower impact', () => {
    expect(noSerious(['moderate x: y (z)'])).toEqual([]);
    expect(noSerious(['serious x: y (z)'])).toEqual(['serious x: y (z)']);
  });
});
