import { PatternVersionRequestSchema } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  buildPatternVersionRequest,
  type PatternDesignerContext,
  type PatternDesignerFields,
} from './pattern-designer-request';
import type { EditableNode } from './pattern-tree-state';

const TYPE_A = '30000000-0000-4000-8000-000000000003';
const TYPE_B = '30000000-0000-4000-8000-000000000004';
const UUID = '90000000-0000-4000-8000-000000000009';
const context: PatternDesignerContext = {
  contentTypes: [
    { id: TYPE_A, typeKey: 'profile' },
    { id: TYPE_B, typeKey: 'release' },
  ],
  registeredBlocks: [
    { blockKey: 'profile.header', blockVersion: 1 },
    { blockKey: 'profile.text', blockVersion: 3 },
  ],
};
const node = (
  key: string,
  extra: Partial<EditableNode> = {},
): EditableNode => ({
  uiId: `id-${key}`,
  kind: 'block',
  key,
  blockRef: 'profile.header@1',
  propsText: '{}',
  patternId: '',
  patternVersion: 0,
  children: [],
  ...extra,
});
const fields = (
  override: Partial<PatternDesignerFields> = {},
): PatternDesignerFields => ({
  patternKey: 'profile-hero',
  compatibleTypeIds: [TYPE_A],
  tree: [
    node('hero', { children: [node('title', { blockRef: 'profile.text@3' })] }),
  ],
  expectedVersion: null,
  ...override,
});
const targets = (result: ReturnType<typeof buildPatternVersionRequest>) =>
  result.ok ? [] : result.issues.map(({ target }) => target);

describe('buildPatternVersionRequest', () => {
  it('builds a request the contract accepts and sends no digest', () => {
    const result = buildPatternVersionRequest(fields(), context);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(PatternVersionRequestSchema.safeParse(result.value).success).toBe(
      true,
    );
    expect(result.value).toEqual({
      patternKey: 'profile-hero',
      compatibleTypeIds: [TYPE_A],
      blockTree: [
        {
          kind: 'block',
          key: 'hero',
          blockKey: 'profile.header',
          blockVersion: 1,
          props: {},
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
    expect(Object.keys(result.value)).not.toContain('blockRegistryDigest');
    expect(result.body).toBe(JSON.stringify(result.value));
  });

  it('sends the read version as expectedVersion for a successor', () => {
    const result = buildPatternVersionRequest(
      fields({ expectedVersion: '7' }),
      context,
    );
    expect(result.ok && result.value.expectedVersion).toBe('7');
  });

  it('keeps a nested pattern reference as read', () => {
    const result = buildPatternVersionRequest(
      fields({
        tree: [
          node('shared', {
            kind: 'pattern',
            blockRef: '',
            patternId: UUID,
            patternVersion: 2,
          }),
        ],
      }),
      context,
    );
    expect(result.ok && result.value.blockTree).toEqual([
      { kind: 'pattern', key: 'shared', patternId: UUID, patternVersion: 2 },
    ]);
  });

  it('trims the pattern key and refuses a reserved or malformed one at the key field', () => {
    expect(
      buildPatternVersionRequest(
        fields({ patternKey: '  profile-hero ' }),
        context,
      ).ok,
    ).toBe(true);
    for (const [patternKey, message] of [
      ['new', 'reserved'],
      ['nestable', 'reserved'],
      ['Bad Key', 'Use 2 to 64'],
    ] as const) {
      const result = buildPatternVersionRequest(
        fields({ patternKey }),
        context,
      );
      expect(targets(result)).toEqual([{ kind: 'field', field: 'patternKey' }]);
      expect(!result.ok && result.issues[0]?.message).toContain(message);
    }
  });

  it('refuses no content type, an unavailable one and over-long lists', () => {
    expect(
      targets(
        buildPatternVersionRequest(fields({ compatibleTypeIds: [] }), context),
      ),
    ).toEqual([{ kind: 'field', field: 'compatibleTypeIds' }]);
    expect(
      targets(
        buildPatternVersionRequest(
          fields({
            compatibleTypeIds: ['30000000-0000-4000-8000-0000000000ff'],
          }),
          context,
        ),
      ),
    ).toEqual([{ kind: 'field', field: 'compatibleTypeIds' }]);
  });

  it('names the node whose block is not registered or not chosen', () => {
    const result = buildPatternVersionRequest(
      fields({
        tree: [
          node('a', { blockRef: 'profile.gone@9' }),
          node('b', { blockRef: '' }),
        ],
      }),
      context,
    );
    expect(targets(result)).toEqual([
      { kind: 'node', uiId: 'id-a', member: 'blockRef' },
      { kind: 'node', uiId: 'id-b', member: 'blockRef' },
    ]);
  });

  it('names the node with unreadable props', () => {
    const result = buildPatternVersionRequest(
      fields({ tree: [node('a', { propsText: '{' })] }),
      context,
    );
    expect(targets(result)).toEqual([
      { kind: 'node', uiId: 'id-a', member: 'props' },
    ]);
    expect(!result.ok && result.issues[0]?.message).toBe(
      'Props must be valid JSON.',
    );
  });

  it('names the duplicate sibling, the deep node and the empty tree', () => {
    expect(
      targets(
        buildPatternVersionRequest(
          fields({ tree: [node('a'), node('a')] }),
          context,
        ),
      ),
    ).toEqual([{ kind: 'node', uiId: 'id-a', member: 'key' }]);
    let deep: EditableNode = node('leaf');
    for (let level = 8; level >= 1; level -= 1)
      deep = node(`n${level}`, { children: [deep] });
    const result = buildPatternVersionRequest(
      fields({ tree: [deep] }),
      context,
    );
    expect(targets(result)).toEqual([
      { kind: 'node', uiId: 'id-leaf', member: null },
    ]);
    expect(!result.ok && result.issues[0]?.message).toContain('8 levels');
    expect(
      targets(buildPatternVersionRequest(fields({ tree: [] }), context)),
    ).toEqual([{ kind: 'field', field: 'tree' }]);
  });

  it('refuses a body over 256 KiB at the tree', () => {
    const big = JSON.stringify({ text: 'x'.repeat(120_000) });
    const result = buildPatternVersionRequest(
      fields({
        tree: [
          node('a', { propsText: big }),
          node('b', { propsText: big }),
          node('c', { propsText: big }),
        ],
      }),
      context,
    );
    expect(targets(result)).toEqual([{ kind: 'field', field: 'form' }]);
    expect(!result.ok && result.issues[0]?.message).toContain('256 KiB');
  });

  it('refuses an unreadable parent version, including one past the 64-bit range', () => {
    for (const expectedVersion of ['0', '01', '9223372036854775808'])
      expect(
        targets(
          buildPatternVersionRequest(fields({ expectedVersion }), context),
        ),
      ).toEqual([{ kind: 'field', field: 'form' }]);
    expect(
      buildPatternVersionRequest(
        fields({ expectedVersion: '9223372036854775807' }),
        context,
      ).ok,
    ).toBe(true);
  });
});
