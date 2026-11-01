import { CMS_BLOCK_KEY_PATTERN } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import { BLOCK_KEY_REGEX } from '../cms-pattern-designer/pattern-tree-rules';
import {
  CONTEXT_BLOCK_KEY_REGEX,
  readTemplateContext,
  verifiedTemplateContext,
} from './cms-template-context-read';
import { registryChanges, selectorLabel } from './cms-registry-changes';

const TYPE = {
  id: '018f0c45-73fe-7dc2-9c09-68f7ecf132da',
  typeKey: 'release_note',
  activeVersionId: '018f0c45-73fe-7dc2-9c09-68f7ecf132db',
  activeVersion: 2,
  sourceLocale: 'en-US',
};
const BLOCK = { blockKey: 'profile.text', blockVersion: 3 };
const valid = { contentTypes: [TYPE], registeredBlocks: [BLOCK] };
const answer = (body: unknown, init: ResponseInit = { status: 200 }) =>
  vi.fn<typeof fetch>().mockResolvedValue(Response.json(body, init));

describe('verifiedTemplateContext (zod-free repeat of TemplateDesignerContextSchema)', () => {
  it('accepts the strict context', () => {
    expect(verifiedTemplateContext(valid)).toEqual(valid);
  });

  it.each([
    ['a non-object', 'x'],
    ['an array', []],
    ['an extra member', { ...valid, extra: 1 }],
    ['a missing member', { contentTypes: [TYPE] }],
    ['contentTypes that is not a list', { ...valid, contentTypes: {} }],
    ['registeredBlocks that is not a list', { ...valid, registeredBlocks: {} }],
    [
      'more than 64 content types',
      { ...valid, contentTypes: Array.from({ length: 65 }, () => TYPE) },
    ],
    [
      'more than 128 blocks',
      { ...valid, registeredBlocks: Array.from({ length: 129 }, () => BLOCK) },
    ],
    ['a content type that is not an object', { ...valid, contentTypes: [1] }],
    [
      'a content type with an extra member',
      { ...valid, contentTypes: [{ ...TYPE, extra: 1 }] },
    ],
    [
      'an id that is not a uuid',
      { ...valid, contentTypes: [{ ...TYPE, id: 'x' }] },
    ],
    [
      'an active version id that is not a uuid',
      { ...valid, contentTypes: [{ ...TYPE, activeVersionId: 'x' }] },
    ],
    [
      'a type key out of grammar',
      { ...valid, contentTypes: [{ ...TYPE, typeKey: 'Bad Key' }] },
    ],
    [
      'an active version of zero',
      { ...valid, contentTypes: [{ ...TYPE, activeVersion: 0 }] },
    ],
    [
      'a source locale that is not canonical',
      { ...valid, contentTypes: [{ ...TYPE, sourceLocale: 'EN-us' }] },
    ],
    ['a block that is not an object', { ...valid, registeredBlocks: [1] }],
    [
      'a block with an extra member',
      { ...valid, registeredBlocks: [{ ...BLOCK, extra: 1 }] },
    ],
    [
      'a block key out of grammar',
      { ...valid, registeredBlocks: [{ ...BLOCK, blockKey: 'Bad Key' }] },
    ],
    [
      'a block version of zero',
      { ...valid, registeredBlocks: [{ ...BLOCK, blockVersion: 0 }] },
    ],
  ])('refuses %s', (_name, body) => {
    expect(verifiedTemplateContext(body)).toBeNull();
  });
});

describe('the block key grammar of the reader', () => {
  it('is the pattern designer rule and the contract grammar, character for character', () => {
    expect(CONTEXT_BLOCK_KEY_REGEX.source).toBe(BLOCK_KEY_REGEX.source);
    expect(CONTEXT_BLOCK_KEY_REGEX.flags).toBe(BLOCK_KEY_REGEX.flags);
    // And the contract itself, not only through the pattern designer's copy of it (review V20 n3).
    expect(CONTEXT_BLOCK_KEY_REGEX.source).toBe(CMS_BLOCK_KEY_PATTERN.source);
    expect(CONTEXT_BLOCK_KEY_REGEX.flags).toBe(CMS_BLOCK_KEY_PATTERN.flags);
  });
});

describe('readTemplateContext (cmsTemplateContextRead)', () => {
  it('reads the verified context without cache and without a body', async () => {
    const fetcher = answer(valid);
    expect(await readTemplateContext(fetcher)).toEqual({
      kind: 'loaded',
      context: valid,
    });
    expect(fetcher.mock.calls[0]![0]).toBe('/api/v1/cms/templates/context');
    expect(fetcher.mock.calls[0]![1]).toMatchObject({
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
    });
  });

  it.each([401, 403] as const)('names a %i', async (status) => {
    expect(
      await readTemplateContext(answer({ code: 'X' }, { status })),
    ).toEqual({ kind: 'rejected', status });
  });

  it('carries a 429 with its stated wait, or without one', async () => {
    expect(
      await readTemplateContext(
        answer(
          { code: 'RATE_LIMITED', details: { retryAfterSeconds: 7 } },
          { status: 429, headers: { 'retry-after': '7' } },
        ),
      ),
    ).toEqual({ kind: 'rejected', status: 429, retryAfterSeconds: 7 });
    expect(
      await readTemplateContext(
        answer({ code: 'RATE_LIMITED' }, { status: 429 }),
      ),
    ).toEqual({ kind: 'rejected', status: 429 });
  });

  it('is unavailable for another status, an unreadable or unverified body, a thrown fetch', async () => {
    expect(
      await readTemplateContext(answer({ code: 'X' }, { status: 500 })),
    ).toEqual({ kind: 'unavailable' });
    expect(
      await readTemplateContext(
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(new Response('{', { status: 200 })),
      ),
    ).toEqual({ kind: 'unavailable' });
    expect(await readTemplateContext(answer({ nope: 1 }))).toEqual({
      kind: 'unavailable',
    });
    expect(
      await readTemplateContext(
        vi.fn<typeof fetch>().mockRejectedValue(new Error('offline')),
      ),
    ).toEqual({ kind: 'unavailable' });
  });
});

describe('registryChanges', () => {
  it('names the selectors gained and lost, in a stable order', () => {
    const before = [
      { blockKey: 'b', blockVersion: 1 },
      { blockKey: 'a', blockVersion: 1 },
    ];
    const after = [
      { blockKey: 'a', blockVersion: 1 },
      { blockKey: 'c', blockVersion: 2 },
      { blockKey: 'b', blockVersion: 2 },
    ];
    expect(registryChanges(before, after)).toEqual({
      added: ['b@2', 'c@2'],
      removed: ['b@1'],
    });
    expect(registryChanges(after, before)).toEqual({
      added: ['b@1'],
      removed: ['b@2', 'c@2'],
    });
    expect(
      registryChanges([], [after[1]!, after[2]!, after[0]!]).added,
    ).toEqual(['a@1', 'b@2', 'c@2']);
    expect(selectorLabel(after[0]!)).toBe('a@1');
  });

  it('is empty when nothing changed', () => {
    expect(registryChanges([BLOCK], [BLOCK])).toEqual({
      added: [],
      removed: [],
    });
  });
});
