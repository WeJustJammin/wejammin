import { TaxonomyTermActionRequestSchema } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  PARENT_ID,
  SURVIVOR_ID,
  TAXONOMY_ID,
  TERM_ID,
} from '../../server/cms-taxonomy-platform.test-support';
import {
  buildTermActionRequest,
  type TermActionContext,
  type TermFormFields,
} from './term-action-request';
import type { TermFacts } from './taxonomy-terms-read';

const target: TermFacts = {
  termId: TERM_ID,
  termKey: 'guitar',
  lifecycle: 'active',
  version: '2',
  parentId: PARENT_ID,
  successorId: null,
  labels: [
    { locale: 'en', label: 'Guitar' },
    { locale: 'fr', label: 'Guitare' },
  ],
  aliases: ['axe'],
};
const context = (
  overrides: Partial<TermActionContext> = {},
): TermActionContext => ({
  taxonomyId: TAXONOMY_ID,
  shape: 'hierarchical',
  activeVersion: '4',
  target,
  ...overrides,
});
const fields = (overrides: Partial<TermFormFields> = {}): TermFormFields => ({
  action: 'create',
  termKey: 'organ',
  parentId: '',
  survivorId: '',
  labels: [{ locale: 'en', label: 'Organ' }],
  aliases: [],
  ...overrides,
});
const built = (
  f: TermFormFields,
  c: TermActionContext = context({ target: null }),
) => {
  const result = buildTermActionRequest(f, c);
  if (!result.ok)
    throw new Error(`expected a request, got ${JSON.stringify(result.issues)}`);
  return result;
};
const issuesOf = (
  f: TermFormFields,
  c: TermActionContext = context({ target: null }),
) => {
  const result = buildTermActionRequest(f, c);
  if (result.ok) throw new Error('expected issues');
  return result.issues.map(({ code, field }) => [code, field]);
};

describe('buildTermActionRequest: create', () => {
  it('builds exactly the contract request, with the active version as the operand', () => {
    const result = built(
      fields({ aliases: ['pipe organ'], parentId: PARENT_ID }),
    );
    expect(result.value).toEqual({
      taxonomyId: TAXONOMY_ID,
      action: 'create',
      termKey: 'organ',
      parentId: PARENT_ID,
      survivorId: null,
      labels: [{ locale: 'en', label: 'Organ' }],
      aliases: ['pipe organ'],
      expectedVersion: '4',
    });
    expect(
      TaxonomyTermActionRequestSchema.safeParse(result.value).success,
    ).toBe(true);
    expect(Object.keys(result.value)).toEqual(
      Object.keys(TaxonomyTermActionRequestSchema.shape),
    );
    expect(result.body).toBe(JSON.stringify(result.value));
  });

  it('trims, normalizes to NFC and keeps the entry order of labels', () => {
    const result = built(
      fields({
        termKey: ' organ ',
        labels: [
          { locale: ' fr ', label: ' Orgue ' },
          { locale: 'en', label: 'Café' },
        ],
        aliases: ['  pipe organ '],
      }),
    );
    expect(result.value.termKey).toBe('organ');
    expect(result.value.labels).toEqual([
      { locale: 'fr', label: 'Orgue' },
      { locale: 'en', label: 'Café' },
    ]);
    expect(result.value.aliases).toEqual(['pipe organ']);
  });

  it('sends no parent for a flat vocabulary and refuses one the form should not have', () => {
    expect(
      built(fields(), context({ shape: 'flat', target: null })).value.parentId,
    ).toBeNull();
    expect(
      issuesOf(
        fields({ parentId: PARENT_ID }),
        context({ shape: 'flat', target: null }),
      ),
    ).toEqual([['parent_not_allowed', 'parentId']]);
  });

  it('names each problem at its field, with the row of a label', () => {
    expect(issuesOf(fields({ termKey: 'Organ', labels: [] }))).toEqual([
      ['term_key_invalid', 'termKey'],
      ['labels_required', 'labels'],
    ]);
    expect(
      buildTermActionRequest(
        fields({
          labels: [
            { locale: 'en', label: 'Fine' },
            { locale: 'e', label: 'Locale wrong' },
            { locale: 'fr', label: '' },
            { locale: 'de', label: 'x'.repeat(161) },
          ],
        }),
        context({ target: null }),
      ),
    ).toMatchObject({
      ok: false,
      issues: [
        { code: 'label_locale_invalid', field: 'labels', row: 1 },
        { code: 'label_text_invalid', field: 'labels', row: 2 },
        { code: 'label_text_invalid', field: 'labels', row: 3 },
      ],
    });
  });

  it('refuses more than 64 labels or aliases and an alias outside 1 to 160 characters', () => {
    const many = Array.from({ length: 65 }, (_, index) => ({
      locale: 'en',
      label: `L${index}`,
    }));
    expect(issuesOf(fields({ labels: many }))).toEqual([
      ['labels_exceeded', 'labels'],
    ]);
    expect(
      issuesOf(
        fields({ aliases: Array.from({ length: 65 }, (_, i) => `a${i}`) }),
      ),
    ).toEqual([['aliases_exceeded', 'aliases']]);
    expect(issuesOf(fields({ aliases: ['x'.repeat(161)] }))).toEqual([
      ['alias_invalid', 'aliases'],
    ]);
    expect(issuesOf(fields({ aliases: ['  '] }))).toEqual([
      ['alias_invalid', 'aliases'],
    ]);
  });

  it('refuses an unreadable active version', () => {
    expect(
      issuesOf(fields(), context({ target: null, activeVersion: '0' })),
    ).toEqual([['version_invalid', 'form']]);
    expect(
      issuesOf(
        fields(),
        context({ target: null, activeVersion: '9223372036854775808' }),
      ),
    ).toEqual([['version_invalid', 'form']]);
  });
});

describe('buildTermActionRequest: actions on an existing term', () => {
  it('rename sends the new labels and the chosen parent, null meaning the root', () => {
    const rename = built(
      fields({
        action: 'rename',
        termKey: 'ignored',
        parentId: PARENT_ID,
        labels: [{ locale: 'en', label: 'Electric guitar' }],
      }),
      context(),
    );
    expect(rename.value).toMatchObject({
      action: 'rename',
      termKey: 'guitar',
      parentId: PARENT_ID,
      survivorId: null,
      labels: [{ locale: 'en', label: 'Electric guitar' }],
      aliases: [],
    });
    expect(
      built(fields({ action: 'rename', parentId: '' }), context()).value
        .parentId,
    ).toBeNull();
  });

  it("alias sends the new aliases with the term's own labels and requires at least one", () => {
    const alias = built(
      fields({ action: 'alias', aliases: ['six-string'] }),
      context(),
    );
    expect(alias.value).toMatchObject({
      action: 'alias',
      termKey: 'guitar',
      parentId: null,
      survivorId: null,
      labels: target.labels,
      aliases: ['six-string'],
    });
    expect(
      issuesOf(fields({ action: 'alias', aliases: [] }), context()),
    ).toEqual([['alias_required', 'aliases']]);
  });

  it("deprecate sends the term's key and own labels and nothing to change", () => {
    expect(built(fields({ action: 'deprecate' }), context()).value).toEqual({
      taxonomyId: TAXONOMY_ID,
      action: 'deprecate',
      termKey: 'guitar',
      parentId: null,
      survivorId: null,
      labels: target.labels,
      aliases: [],
      expectedVersion: '4',
    });
  });

  it('merge names the survivor and refuses none, the term itself, or a form with no target', () => {
    expect(
      built(fields({ action: 'merge', survivorId: SURVIVOR_ID }), context())
        .value,
    ).toMatchObject({
      action: 'merge',
      termKey: 'guitar',
      survivorId: SURVIVOR_ID,
      parentId: null,
      aliases: [],
    });
    expect(issuesOf(fields({ action: 'merge' }), context())).toEqual([
      ['survivor_required', 'survivorId'],
    ]);
    expect(
      issuesOf(fields({ action: 'merge', survivorId: TERM_ID }), context()),
    ).toEqual([['survivor_same', 'survivorId']]);
    expect(
      issuesOf(fields({ action: 'rename' }), context({ target: null })),
    ).toEqual([['target_missing', 'form']]);
  });

  it('an action on an existing term never reads the typed key', () => {
    expect(
      built(fields({ action: 'deprecate', termKey: 'Not Valid' }), context())
        .value.termKey,
    ).toBe('guitar');
  });

  it('every problem carries fixed copy that differs', () => {
    const result = buildTermActionRequest(
      fields({ termKey: '', labels: [] }),
      context({ target: null }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(new Set(result.issues.map((issue) => issue.message)).size).toBe(
      result.issues.length,
    );
    for (const issue of result.issues)
      expect(issue.message.length).toBeGreaterThan(10);
  });
});
