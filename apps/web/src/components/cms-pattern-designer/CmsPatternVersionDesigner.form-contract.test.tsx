// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
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
  flush,
  mountElement,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsPatternVersionDesigner from './CmsPatternVersionDesigner';
import { savedPatternAddress } from './pattern-designer-location';
import { TYPE_ID } from '../../server/cms-pattern-platform.test-support';
import {
  CSRF_TOKEN,
  createdResult,
  designerContext,
  latestDetail,
  submitStub,
} from './pattern-designer.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

/**
 * FE03 "Form contract" (:1223): validation timing (syntax and safe local constraints on blur,
 * cross-field on review/submit, no pre-visit error), submission (disable only the commit action,
 * preserve its width and label, expose pending text, ignore duplicate activation) and completion
 * (update the URL once the version exists).
 */
type Props = React.ComponentProps<typeof CmsPatternVersionDesigner>;
const mount = (props: Partial<Props> = {}) =>
  mountElement(
    <CmsPatternVersionDesigner
      context={designerContext}
      latest={null}
      csrfToken={CSRF_TOKEN}
      {...props}
    />,
  );
const NEW_PATH = '/app/cms-content-modeling/patterns/new';
beforeEach(() => window.history.replaceState(null, '', NEW_PATH));
afterEach(() => window.history.replaceState(null, '', '/'));

const visit = async (control: HTMLElement): Promise<void> => {
  await act(async () => {
    control.focus();
    control.blur();
  });
};
const errorsOf = (container: HTMLElement): string[] =>
  Array.from(
    container.querySelectorAll('.cms-field-errors li'),
    (item) => item.textContent ?? '',
  );
const keyInput = (c: HTMLElement) =>
  byLabel<HTMLInputElement>(c, 'Pattern key');
const nodeKey = (c: HTMLElement) => byLabel<HTMLInputElement>(c, 'Node 1 key');
const props1 = (c: HTMLElement) =>
  byLabel<HTMLTextAreaElement>(c, 'Node 1 props (JSON object)');

describe('validation timing: syntax and safe local constraints on blur', () => {
  it('shows no error before any control was visited', async () => {
    const { container } = mount();
    await click(buttonNamed(container, 'Add a top-level block'));
    expect(errorsOf(container)).toEqual([]);
    expect(container.querySelectorAll('[aria-invalid="true"]')).toHaveLength(0);
  });

  it('does not judge the pattern key while it is typed into, only once it is left', async () => {
    const { container } = mount();
    await typeInto(keyInput(container), 'A');
    expect(errorsOf(container)).toEqual([]);
    await visit(keyInput(container));
    expect(errorsOf(container)).toEqual([
      'Use 2 to 64 lowercase letters, digits or hyphens, starting with a letter.',
    ]);
    expect(keyInput(container).getAttribute('aria-invalid')).toBe('true');
    expect(keyInput(container).getAttribute('aria-describedby')).toContain(
      'cms-pattern-key-errors',
    );
  });

  it('names a reserved key on blur and clears the error as soon as the key is corrected', async () => {
    const { container } = mount();
    await typeInto(keyInput(container), 'selector');
    await visit(keyInput(container));
    expect(errorsOf(container)).toEqual([
      'That key is reserved because it names a page or a route. Choose another.',
    ]);
    await typeInto(keyInput(container), 'profile-hero');
    expect(errorsOf(container)).toEqual([]);
  });

  it('says nothing for a valid key', async () => {
    const { container } = mount();
    await typeInto(keyInput(container), 'profile-hero');
    await visit(keyInput(container));
    expect(errorsOf(container)).toEqual([]);
  });

  it('flags a node key and node props on blur, beside the node that owns them', async () => {
    const { container } = mount();
    await click(buttonNamed(container, 'Add a top-level block'));
    await typeInto(nodeKey(container), 'Bad Key');
    await choose(
      byLabel(container, 'Node 1 block') as unknown as HTMLSelectElement,
      'profile.header@1',
    );
    expect(errorsOf(container)).toEqual([]);
    await visit(nodeKey(container));
    expect(errorsOf(container)).toEqual([
      'Use 1 to 64 lowercase letters, digits, hyphens or underscores, starting with a letter.',
    ]);
    expect(nodeKey(container).getAttribute('aria-invalid')).toBe('true');
    await typeInto(props1(container), '{"title":');
    expect(errorsOf(container)).toHaveLength(1);
    await visit(props1(container));
    expect(errorsOf(container)).toContain('Props must be valid JSON.');
    expect(props1(container).getAttribute('aria-invalid')).toBe('true');
    await typeInto(props1(container), '[1]');
    await visit(props1(container));
    expect(errorsOf(container)).toContain(
      'Props must be a JSON object, for example {}.',
    );
  });

  it('does not judge a node key being typed into before it was left, even after another control was left', async () => {
    const { container } = mount();
    await typeInto(keyInput(container), 'profile-hero');
    await visit(keyInput(container));
    await click(buttonNamed(container, 'Add a top-level block'));
    await typeInto(nodeKey(container), 'Bad Key');
    expect(errorsOf(container)).toEqual([]);
    expect(nodeKey(container).hasAttribute('aria-invalid')).toBe(false);
    await visit(nodeKey(container));
    expect(errorsOf(container)).toHaveLength(1);
  });

  it('names a props limit on blur, not only a props syntax error', async () => {
    const { container } = mount();
    await click(buttonNamed(container, 'Add a top-level block'));
    const many = JSON.stringify(
      Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`k${i}`, i])),
    );
    await typeInto(props1(container), many);
    await visit(props1(container));
    expect(errorsOf(container)).toEqual([
      'Props may have at most 64 keys. Remove some.',
    ]);
  });

  it('leaves cross-field rules, the content types and the empty tree to review or submit', async () => {
    const { container } = mount();
    await typeInto(keyInput(container), 'profile-hero');
    await click(buttonNamed(container, 'Add a top-level block'));
    await click(buttonNamed(container, 'Add a top-level block'));
    const keys = Array.from(
      container.querySelectorAll<HTMLInputElement>(
        'input[id^="cms-pattern-node-"][id$="-key"]',
      ),
    );
    await typeInto(keys[0] as HTMLInputElement, 'hero');
    await typeInto(keys[1] as HTMLInputElement, 'hero');
    const selects = Array.from(
      container.querySelectorAll('select[id$="-block"]'),
    ) as unknown as HTMLSelectElement[];
    for (const select of selects) await choose(select, 'profile.header@1');
    await click(
      container.querySelector('fieldset input[type="checkbox"]') as HTMLElement,
    );
    await visit(keys[0] as HTMLInputElement);
    await visit(keys[1] as HTMLInputElement);
    expect(errorsOf(container)).toEqual([]);
    await click(buttonNamed(container, 'Create draft'));
    await flush();
    expect(errorsOf(container).join(' ')).toContain(
      'Another node at this level already uses this key.',
    );
  });

  it('sends nothing for a blur: only the commit action sends', async () => {
    const submit = submitStub();
    const { container } = mount({ submit });
    await typeInto(keyInput(container), 'A');
    await visit(keyInput(container));
    expect(submit).not.toHaveBeenCalled();
  });
});

describe('completion: the address follows the saved version', () => {
  const createValid = async (container: HTMLElement): Promise<void> => {
    await typeInto(keyInput(container), 'profile-hero');
    await click(
      container.querySelector('fieldset input[type="checkbox"]') as HTMLElement,
    );
    await click(buttonNamed(container, 'Add a top-level block'));
    await typeInto(nodeKey(container), 'hero');
    await choose(
      byLabel(container, 'Node 1 block') as unknown as HTMLSelectElement,
      'profile.header@1',
    );
    await click(buttonNamed(container, 'Create draft'));
    await flush();
  };

  it('replaces the new-pattern address with the saved pattern, without adding a history entry', async () => {
    const length = window.history.length;
    const { container } = mount({
      submit: submitStub(createdResult({ patternKey: 'profile-hero' })),
    });
    expect(window.location.pathname).toBe(NEW_PATH);
    await createValid(container);
    expect(window.location.pathname).toBe(
      '/app/cms-content-modeling/patterns/profile-hero',
    );
    expect(window.history.length).toBe(length);
  });

  it('encodes the key the server returned, not the text typed', async () => {
    const { container } = mount({
      submit: submitStub(createdResult({ patternKey: 'other-key' })),
    });
    await createValid(container);
    expect(window.location.pathname).toBe(
      '/app/cms-content-modeling/patterns/other-key',
    );
  });

  it('also moves the address when an unknown outcome is settled as saved by the latest version', async () => {
    const readLatest = vi.fn(async () => ({
      kind: 'loaded' as const,
      detail: latestDetail({
        version: '1',
        patternVersion: 1,
        nodeCount: 1,
        compatibleTypeIds: [TYPE_ID],
        blockTree: [
          {
            kind: 'block',
            key: 'hero',
            blockKey: 'profile.header',
            blockVersion: 1,
            props: {},
            children: [],
          },
        ],
      }),
    }));
    const { container } = mount({
      submit: submitStub({ kind: 'uncertain' }),
      readLatest,
    });
    await createValid(container);
    expect(readLatest).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Pattern draft saved');
    expect(window.location.pathname).toBe(
      '/app/cms-content-modeling/patterns/profile-hero',
    );
  });

  it('encodes a key for the address', () => {
    expect(savedPatternAddress('a b/c')).toBe(
      '/app/cms-content-modeling/patterns/a%20b%2Fc',
    );
  });

  it('leaves the address alone when nothing was saved', async () => {
    const { container } = mount({
      submit: submitStub({ kind: 'rejected', status: 422 }),
    });
    await createValid(container);
    expect(window.location.pathname).toBe(NEW_PATH);
  });

  it('does not move an edit page that already is the pattern address', async () => {
    window.history.replaceState(
      null,
      '',
      '/app/cms-content-modeling/patterns/profile-hero?x=1',
    );
    const { container } = mount({
      latest: latestDetail(),
      submit: submitStub(createdResult({ patternVersion: 3, version: '3' })),
    });
    await click(buttonNamed(container, 'Save successor draft'));
    await flush();
    expect(window.location.pathname + window.location.search).toBe(
      '/app/cms-content-modeling/patterns/profile-hero?x=1',
    );
  });
});
