import type { PatternNode } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  annotateOutline,
  outlineFromEditable,
  outlineFromWire,
  typeChoiceLabels,
} from './pattern-review-outline';
import type { EditableNode } from './pattern-tree-state';

const PATTERN_ID = '90000000-0000-4000-8000-000000000009';
const block = (
  key: string,
  children: PatternNode[] = [],
  props: Record<string, unknown> = {},
  blockKey = 'profile.header',
): PatternNode => ({
  kind: 'block',
  key,
  blockKey,
  blockVersion: 1,
  props: props as never,
  children,
});
const editable = (
  key: string,
  overrides: Partial<EditableNode> = {},
): EditableNode => ({
  uiId: `ui-${key}`,
  kind: 'block',
  key,
  blockRef: 'profile.header@1',
  propsText: '{}',
  patternId: '',
  patternVersion: 0,
  children: [],
  ...overrides,
});

describe('outlineFromWire', () => {
  it('summarises a block with its props and a nested pattern reference', () => {
    expect(
      outlineFromWire([
        block('hero', [block('title')], { size: 2 }),
        {
          kind: 'pattern',
          key: 'shared',
          patternId: PATTERN_ID,
          patternVersion: 3,
        },
      ]),
    ).toEqual([
      {
        key: 'hero',
        summary: 'profile.header@1 · props {"size":2}',
        children: [{ key: 'title', summary: 'profile.header@1', children: [] }],
      },
      {
        key: 'shared',
        summary: `nested pattern ${PATTERN_ID} version 3`,
        children: [],
      },
    ]);
  });
});

describe('outlineFromEditable', () => {
  it('canonicalises props text so equal data compares equal', () => {
    expect(
      outlineFromEditable([
        editable('a', { propsText: '{ "b": 1,\n "a": 2 }' }),
      ]),
    ).toEqual(outlineFromWire([block('a', [], { b: 1, a: 2 })]));
  });

  it('says so when no block is chosen and keeps unparseable props text as typed', () => {
    expect(
      outlineFromEditable([
        editable('a', { blockRef: '' }),
        editable('b', { propsText: '{oops' }),
      ]),
    ).toEqual([
      { key: 'a', summary: 'no block chosen', children: [] },
      { key: 'b', summary: 'profile.header@1 · props {oops', children: [] },
    ]);
  });

  it('describes a nested pattern node', () => {
    expect(
      outlineFromEditable([
        editable('s', {
          kind: 'pattern',
          blockRef: '',
          patternId: PATTERN_ID,
          patternVersion: 2,
        }),
      ]),
    ).toEqual([
      {
        key: 's',
        summary: `nested pattern ${PATTERN_ID} version 2`,
        children: [],
      },
    ]);
  });
});

describe('annotateOutline', () => {
  const mine = outlineFromWire([
    block('same'),
    block('changed', [], {}, 'profile.text'),
    block('mine', [block('inner')]),
    block('parent', [block('only-child'), block('shared-child')]),
  ]);
  const theirs = outlineFromWire([
    block('same'),
    block('changed'),
    block('theirs'),
    block('parent', [block('shared-child')]),
  ]);

  it('marks what only this side has, what differs and what is equal, by key at the same position', () => {
    const marked = annotateOutline(mine, theirs);
    expect(marked.map(({ key, status }) => [key, status])).toEqual([
      ['same', 'same'],
      ['changed', 'changed'],
      ['mine', 'only'],
      ['parent', 'same'],
    ]);
    expect(marked[2]?.children.map((child) => child.status)).toEqual(['only']);
    expect(marked[3]?.children.map(({ key, status }) => [key, status])).toEqual(
      [
        ['only-child', 'only'],
        ['shared-child', 'same'],
      ],
    );
  });

  it('is symmetric about what the other side lacks', () => {
    expect(
      annotateOutline(theirs, mine).map(({ key, status }) => [key, status]),
    ).toEqual([
      ['same', 'same'],
      ['changed', 'changed'],
      ['theirs', 'only'],
      ['parent', 'same'],
    ]);
  });
});

describe('typeChoiceLabels', () => {
  const context = {
    contentTypes: [{ id: 'a'.repeat(8) + '-0000', typeKey: 'profile' }],
  };
  it('names an active type by key and a retired one as no longer available', () => {
    expect(
      typeChoiceLabels(
        ['a'.repeat(8) + '-0000', 'b'.repeat(8) + '-0000'],
        context,
      ),
    ).toEqual(['profile', `${'b'.repeat(8)} (no longer available)`]);
  });
});
