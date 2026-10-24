// @vitest-environment jsdom
import type { PatternNode } from '@wejammin/contracts';
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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
import {
  CSRF_TOKEN,
  TYPE_B,
  createdResult,
  designerContext,
  latestDetail,
  nestedReferenceTree,
  submitStub,
} from './pattern-designer.test-support';
import {
  PATTERN_ID,
  TYPE_ID,
} from '../../server/cms-pattern-platform.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

type BlockNode = Extract<PatternNode, { kind: 'block' }>;

const mount = (
  props: Partial<React.ComponentProps<typeof CmsPatternVersionDesigner>> = {},
) =>
  mountElement(
    <CmsPatternVersionDesigner
      context={designerContext}
      latest={null}
      csrfToken={CSRF_TOKEN}
      {...props}
    />,
  );
const text = (container: HTMLElement): string => container.textContent ?? '';
const nodeKeyInputs = (container: HTMLElement): HTMLInputElement[] =>
  Array.from(
    container.querySelectorAll<HTMLInputElement>(
      'input[id^="cms-pattern-node-"]',
    ),
  ).filter((input) => input.id.endsWith('-key'));
const blockSelects = (container: HTMLElement): HTMLSelectElement[] =>
  Array.from(
    container.querySelectorAll('select[id$="-block"]'),
  ) as unknown as HTMLSelectElement[];
const keys = (container: HTMLElement): string[] =>
  nodeKeyInputs(container).map((input) => input.value);

describe('CmsPatternVersionDesigner: a new pattern', () => {
  it('starts with labelled controls, an empty-tree sentence and a disabled nested picker', () => {
    const { container } = mount();
    expect(container.querySelector('h2')?.textContent).toBe('Define a pattern');
    byLabel(container, 'Pattern key');
    expect(text(container)).toContain('This pattern has no nodes yet.');
    expect(buttonNamed(container, 'Add a top-level block').disabled).toBe(
      false,
    );
    const picker = byLabel(
      container,
      'Add a nested pattern',
    ) as unknown as HTMLSelectElement;
    expect(picker.disabled).toBe(true);
    expect(buttonNamed(container, 'Add nested pattern').disabled).toBe(true);
    const reason = container.querySelector('#cms-pattern-nested-reason');
    expect(reason?.textContent).toContain('not available yet');
    expect(picker.getAttribute('aria-describedby')).toBe(
      'cms-pattern-nested-reason',
    );
  });

  it('builds a tree from the registered blocks and submits the exact request', async () => {
    const submit = submitStub(createdResult({ nodeCount: 2 }));
    const { container } = mount({ submit });
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Pattern key'),
      'profile-hero',
    );
    await click(
      container.querySelector('fieldset input[type="checkbox"]') as HTMLElement,
    );
    await click(buttonNamed(container, 'Add a top-level block'));
    await typeInto(byLabel<HTMLInputElement>(container, 'Node 1 key'), 'hero');
    await choose(
      byLabel(container, 'Node 1 block') as unknown as HTMLSelectElement,
      'profile.header@1',
    );
    await typeInto(
      byLabel<HTMLTextAreaElement>(container, 'Node 1 props (JSON object)'),
      '{"title":"Hello"}',
    );
    await click(buttonNamed(container, 'Add a child block to node 1'));
    await typeInto(nodeKeyInputs(container)[1] as HTMLInputElement, 'title');
    await choose(
      blockSelects(container)[1] as HTMLSelectElement,
      'profile.text@3',
    );
    await click(buttonNamed(container, 'Create draft'));
    await flush();

    expect(submit).toHaveBeenCalledTimes(1);
    const [request, csrf, key] = submit.mock.calls[0] as unknown as [
      unknown,
      string,
      string,
    ];
    expect(csrf).toBe(CSRF_TOKEN);
    expect(key).toMatch(/^[0-9a-f-]{36}$/u);
    expect(request).toEqual({
      patternKey: 'profile-hero',
      compatibleTypeIds: [TYPE_ID],
      blockTree: [
        {
          kind: 'block',
          key: 'hero',
          blockKey: 'profile.header',
          blockVersion: 1,
          props: { title: 'Hello' },
          children: [
            {
              kind: 'block',
              key: 'title',
              blockKey: 'profile.text',
              blockVersion: 3,
              props: {},
              children: [],
            },
          ],
        },
      ],
      expectedVersion: null,
    });
    const status = container.querySelector(
      '#cms-pattern-status',
    ) as HTMLElement;
    const heading = status.querySelector('h3') as HTMLElement;
    expect(heading.textContent).toBe('Pattern draft saved');
    expect(status.textContent).toContain('not a published or active pattern');
    expect(status.querySelector('dl')?.textContent).toContain(
      'Nodes after expansion2',
    );
    expect(status.querySelector('dl code')?.textContent).toBe('c'.repeat(64));
    expect(status.querySelector('a')?.getAttribute('href')).toBe(
      '/app/cms-content-modeling/patterns/profile-hero',
    );
    expect(document.activeElement).toBe(heading);
    expect(buttonNamed(container, 'Create draft').disabled).toBe(true);
  });

  it('renders the tree as an ordered list with level text', async () => {
    const { container } = mount({ latest: latestDetail() });
    const lists = container.querySelectorAll('ol');
    expect(lists).toHaveLength(2);
    expect(lists[1]?.parentElement?.tagName).toBe('LI');
    expect(text(container)).toContain('Node 1 · Level 1 of 8');
    expect(text(container)).toContain('Node 1.1 · Level 2 of 8');
    expect(text(container)).toContain('2 of 512 nodes.');
    expect(
      container.querySelector('dl.cms-pattern-facts')?.textContent,
    ).toContain('Block registry digest' + 'b'.repeat(64));
    expect(text(container)).toContain('LifecycleDraft');
  });
});

describe('CmsPatternVersionDesigner: the error summary names the node', () => {
  it('sends nothing, links each problem to its control and marks it invalid', async () => {
    const submit = submitStub();
    const { container } = mount({ submit });
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Pattern key'),
      'profile-hero',
    );
    await click(
      container.querySelector('fieldset input[type="checkbox"]') as HTMLElement,
    );
    await click(buttonNamed(container, 'Add a top-level block'));
    await click(buttonNamed(container, 'Add a child block to node 1'));
    await typeInto(nodeKeyInputs(container)[1] as HTMLInputElement, 'node-1');
    await click(buttonNamed(container, 'Create draft'));
    await flush();
    expect(submit).not.toHaveBeenCalled();
    const status = container.querySelector(
      '#cms-pattern-status',
    ) as HTMLElement;
    expect(status.getAttribute('role')).toBe('alert');
    expect(status.textContent).toContain(
      '2 problems to fix; nothing was sent.',
    );
    expect(document.activeElement).toBe(status.querySelector('h3'));
    expect(document.activeElement?.textContent).toBe('Check the pattern');
    const links = Array.from(status.querySelectorAll('a'));
    expect(links.map((link) => link.textContent)).toEqual([
      'Node 1: Choose a registered block.',
      'Node 1.1: Choose a registered block.',
    ]);
    await click(links[1] as HTMLElement);
    const second = blockSelects(container)[1];
    expect(document.activeElement).toBe(second);
    expect(second?.getAttribute('aria-invalid')).toBe('true');
    const describedBy = second?.getAttribute('aria-describedby') ?? '';
    expect(container.querySelector(`#${describedBy}`)?.textContent).toBe(
      'Choose a registered block.',
    );
  });

  it('names a duplicate sibling key and a missing content type', async () => {
    const { container } = mount();
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Pattern key'),
      'profile-hero',
    );
    await click(buttonNamed(container, 'Add a top-level block'));
    await click(buttonNamed(container, 'Add a top-level block'));
    await typeInto(nodeKeyInputs(container)[1] as HTMLInputElement, 'node-1');
    for (const block of blockSelects(container))
      await choose(block, 'profile.header@1');
    await click(buttonNamed(container, 'Create draft'));
    await flush();
    const links = Array.from(
      (
        container.querySelector('#cms-pattern-status') as HTMLElement
      ).querySelectorAll('a'),
    ).map((link) => link.textContent);
    expect(links).toContain('Choose at least one content type.');
    expect(links).toContain(
      'Node 2: Another node at this level already uses this key. Rename one.',
    );
  });
});

describe('CmsPatternVersionDesigner: explicit tree controls', () => {
  const twoRoots = async () => {
    const view = mount();
    await click(buttonNamed(view.container, 'Add a top-level block'));
    await click(buttonNamed(view.container, 'Add a top-level block'));
    const inputs = nodeKeyInputs(view.container);
    await typeInto(inputs[1] as HTMLInputElement, 'second');
    await typeInto(inputs[0] as HTMLInputElement, 'first');
    return view;
  };

  it('moves a node earlier or later, announces it and keeps the keyboard on a usable control', async () => {
    const { container } = await twoRoots();
    expect(keys(container)).toEqual(['first', 'second']);
    expect(buttonNamed(container, 'Move node 1 earlier').disabled).toBe(true);
    expect(buttonNamed(container, 'Move node 2 later').disabled).toBe(true);
    await click(buttonNamed(container, 'Move node 2 earlier'));
    expect(keys(container)).toEqual(['second', 'first']);
    expect(text(container)).toContain('Moved node to 1, position 1 of 2.');
    const active = document.activeElement as HTMLElement;
    expect(active.tagName).toBe('BUTTON');
    expect(active.textContent).toBe('Move node 1 later');
    await click(buttonNamed(container, 'Move node 1 later'));
    expect(keys(container)).toEqual(['first', 'second']);
    expect((document.activeElement as HTMLElement).textContent).toBe(
      'Move node 2 earlier',
    );
  });

  it('removes a node with its children, announces it and focuses the tree', async () => {
    const { container } = mount({ latest: latestDetail() });
    await click(buttonNamed(container, 'Remove node 1'));
    expect(container.querySelectorAll('ol')).toHaveLength(0);
    expect(text(container)).toContain(
      'Removed node 1 and everything inside it.',
    );
    expect(text(container)).toContain('This pattern has no nodes yet.');
    expect(document.activeElement?.id).toBe('cms-pattern-tree');
  });

  it('focuses the key of a new node', async () => {
    const { container } = mount();
    await click(buttonNamed(container, 'Add a top-level block'));
    expect(document.activeElement?.id).toMatch(/^cms-pattern-node-.+-key$/u);
    expect((document.activeElement as HTMLInputElement).value).toBe('node-1');
  });

  it('disables adding past 32 roots and past 8 levels', () => {
    const roots = Array.from({ length: 32 }, (_, index) => ({
      kind: 'pattern' as const,
      key: `n${index}`,
      patternId: PATTERN_ID,
      patternVersion: 1,
    }));
    const full = mount({
      latest: latestDetail({ blockTree: roots, nodeCount: 32 }),
    });
    expect(buttonNamed(full.container, 'Add a top-level block').disabled).toBe(
      true,
    );
    full.unmount();

    const leaf: BlockNode = {
      kind: 'block',
      key: 'n8',
      blockKey: 'profile.header',
      blockVersion: 1,
      props: {},
      children: [],
    };
    let chain = leaf;
    for (let level = 7; level >= 1; level -= 1)
      chain = { ...leaf, key: `n${level}`, children: [chain] };
    const deep = mount({
      latest: latestDetail({ blockTree: [chain], nodeCount: 8 }),
    });
    expect(
      buttonNamed(deep.container, 'Add a child block to node 1.1.1.1.1.1.1')
        .disabled,
    ).toBe(false);
    expect(
      buttonNamed(deep.container, 'Add a child block to node 1.1.1.1.1.1.1.1')
        .disabled,
    ).toBe(true);
  });

  it('keeps a saved nested pattern movable and removable but not editable', () => {
    const { container } = mount({
      latest: latestDetail({ blockTree: nestedReferenceTree(), nodeCount: 1 }),
    });
    expect(text(container)).toContain('Nested pattern');
    expect(text(container)).toContain('kept as saved');
    expect(container.querySelector('textarea')).toBeNull();
    buttonNamed(container, 'Remove node 1');
    expect(() =>
      buttonNamed(container, 'Add a child block to node 1'),
    ).toThrow();
  });
});

describe('CmsPatternVersionDesigner: prerequisites', () => {
  it('explains a missing session and a missing content type, and cannot submit', () => {
    const { container } = mount({
      csrfToken: '',
      context: { ...designerContext, contentTypes: [] },
    });
    expect(text(container)).toContain(
      'Reload to restore the protected form session.',
    );
    expect(text(container)).toContain('No active content types are available');
    expect(buttonNamed(container, 'Create draft').disabled).toBe(true);
  });

  it('offers every content type as a checkbox', () => {
    const { container } = mount();
    const boxes = container.querySelectorAll('fieldset input[type="checkbox"]');
    expect(boxes).toHaveLength(designerContext.contentTypes.length);
    expect(text(container)).toContain('profile');
    expect(TYPE_B).toBeTruthy();
  });
});
