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
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsLocaleVariantForm from './CmsLocaleVariantForm';
import type { LocaleSubmitResult } from './locale-variant-submit';
import { BLURB, LEGAL, TITLE, resolution } from './locale-variant.test-support';
import {
  formProps,
  refreshStub,
  submitStub,
} from './locale-variant-form.test-support';

/*
 * FE03 testing floor: axe with no serious or critical finding on the surface, in the states a person meets:
 * clean, resolved, refused, in review, degraded. jsdom has no layout, so colour contrast and target size are
 * covered by the e2e and manual accessibility reports; every structural rule (names, labels, roles, ARIA
 * validity, headings, landmarks, duplicate ids) runs.
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
  document.title = 'Translate | WeJammin';
  document.body.innerHTML =
    '<nav aria-label="Skip navigation"><a href="#cms-editorial-main">Skip to main content</a></nav>' +
    '<main id="cms-editorial-main" tabindex="-1"><h1 id="page-title" tabindex="-1">Translate</h1></main>';
  const main = document.getElementById('cms-editorial-main') as HTMLElement;
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

const resolved = () => [
  resolution(TITLE, { stale: true }),
  resolution(BLURB, {
    provenance: 'localized_fallback',
    resolvedFromLocale: 'en-US',
  }),
  resolution(LEGAL, {
    mode: 'no_fallback',
    outcome: 'missing',
    provenance: 'missing',
    blocking: true,
    reasonCode: 'no_fallback_missing',
  }),
];

const refused = async (result: LocaleSubmitResult) => {
  const mounted = mountInShell(
    <CmsLocaleVariantForm
      {...formProps({
        submit: submitStub(result),
        refresh: refreshStub({ kind: 'failed', status: 503 }),
      })}
    />,
  );
  await typeInto(byLabel(mounted.container, 'Title'), 'Un titre');
  await click(buttonNamed(mounted.container, 'Save translation'));
  await flush();
  return mounted;
};

describe('CmsLocaleVariantForm: axe, no serious or critical finding (FE03 testing floor)', () => {
  it('negative control: the harness does report a control without a name', async () => {
    mountInShell(<input type="text" />);
    expect((await findings()).join('\n')).toMatch(/label/u);
  });

  it('is clean as loaded, with and without the resolution projection', async () => {
    mountInShell(<CmsLocaleVariantForm {...formProps()} />);
    expect(await findings()).toEqual([]);
    document.body.replaceChildren();
    mountInShell(
      <CmsLocaleVariantForm {...formProps({ resolutions: resolved() })} />,
    );
    expect(await findings()).toEqual([]);
  });

  it('is clean with nothing translatable and with fields held back', async () => {
    mountInShell(
      <CmsLocaleVariantForm
        {...formProps({ fields: [], unavailableFields: ['Body'] })}
      />,
    );
    expect(await findings()).toEqual([]);
  });

  it('is clean in the invalid, saved and refused states', async () => {
    const invalid = mountInShell(<CmsLocaleVariantForm {...formProps()} />);
    await click(buttonNamed(invalid.container, 'Save translation'));
    await flush();
    expect(await findings()).toEqual([]);
    document.body.replaceChildren();
    const saved = await refused({
      kind: 'saved',
      saved: {
        version: '5',
        state: 'draft',
        staleFieldIds: [],
        savedFieldIds: [TITLE],
      },
    });
    expect(
      saved.container.querySelector('#cms-locale-result-heading'),
    ).not.toBeNull();
    expect(await findings()).toEqual([]);
    document.body.replaceChildren();
    await refused({ kind: 'rejected', status: 403 });
    expect(await findings()).toEqual([]);
  });

  it('is clean in the fallback-order, review and rate-limited states', async () => {
    await refused({
      kind: 'chain_mismatch',
      activeFallbackChain: ['fr', 'de', 'en-US'],
    });
    expect(await findings()).toEqual([]);
    document.body.replaceChildren();
    await refused({ kind: 'conflict', currentVersion: '9' });
    expect(await findings()).toEqual([]);
    document.body.replaceChildren();
    await refused({ kind: 'rejected', status: 429, retryAfterSeconds: 30 });
    expect(await findings()).toEqual([]);
  });
});
