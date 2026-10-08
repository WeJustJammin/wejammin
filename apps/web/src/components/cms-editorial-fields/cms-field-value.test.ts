import { describe, expect, it } from 'vitest';

import {
  describeCmsAuthoringFields,
  type CmsFieldDescriptor,
} from './cms-field-descriptor';
import {
  cmsDatetimeToLocalInput,
  cmsLocalInputToDatetime,
  initialCmsFieldValue,
  isCmsFieldValueEmpty,
  validateCmsFieldValue,
} from './cms-field-value';
import { allKindFields, fieldUuid } from './cms-field-fixtures.test-support';
import { CMS_EDITORIAL_REASON_COPY } from '../cms-editorial/cms-editorial-reason-copy';
import { editableCmsFieldIds } from '../cms-editorial/cms-editorial-entry-editor-state';

const byKey = (key: string): CmsFieldDescriptor => {
  const found = describeCmsAuthoringFields(allKindFields()).find(
    (descriptor) => descriptor.key === key,
  );
  if (found === undefined) throw new Error(`fixture missing ${key}`);
  return found;
};

const codes = (descriptor: CmsFieldDescriptor, value: unknown): string[] =>
  validateCmsFieldValue(descriptor, value as never).map((issue) => issue.code);

const richText = (text: string) => ({
  format: 'rich_text.v1',
  blocks: [
    {
      type: 'paragraph',
      spans: text === '' ? [] : [{ text, marks: [] }],
    },
  ],
});

describe('validateCmsFieldValue: scalar kinds', () => {
  it('requires a value only where the field is required, and treats empty text as no value', () => {
    expect(codes(byKey('title'), null)).toEqual(['required']);
    expect(codes(byKey('title'), '')).toEqual(['required']);
    expect(codes(byKey('blurb'), null)).toEqual([]);
    expect(codes(byKey('blurb'), '')).toEqual([]);
  });

  it('enforces text length in Unicode characters, not UTF-16 units', () => {
    expect(codes(byKey('title'), 'a')).toEqual(['too_short']);
    expect(codes(byKey('title'), 'ab')).toEqual([]);
    expect(codes(byKey('title'), 'x'.repeat(41))).toEqual(['too_long']);
    // 20 astral characters are 40 UTF-16 units but 20 characters.
    expect(codes(byKey('title'), '😀'.repeat(40))).toEqual([]);
    expect(codes(byKey('title'), '😀'.repeat(41))).toEqual(['too_long']);
  });

  it('enforces integer, decimal and range semantics', () => {
    expect(codes(byKey('rating'), 5)).toEqual([]);
    expect(codes(byKey('rating'), 0)).toEqual(['below_minimum']);
    expect(codes(byKey('rating'), 11)).toEqual(['above_maximum']);
    expect(codes(byKey('rating'), 2.5)).toEqual(['not_integer']);
    expect(codes(byKey('price'), 2.5)).toEqual([]);
    expect(codes(byKey('price'), Number.NaN)).toEqual(['not_a_number']);
  });

  it('accepts only a real calendar date and an RFC 3339 instant', () => {
    expect(codes(byKey('published_on'), '2026-02-28')).toEqual([]);
    expect(codes(byKey('published_on'), '2026-02-30')).toEqual([
      'invalid_date',
    ]);
    expect(codes(byKey('published_on'), '02/28/2026')).toEqual([
      'invalid_date',
    ]);
    expect(codes(byKey('starts_at'), '2026-10-05T14:30:00Z')).toEqual([]);
    expect(codes(byKey('starts_at'), '2026-10-05T14:30:00.250+02:00')).toEqual(
      [],
    );
    expect(codes(byKey('starts_at'), '2026-10-05T14:30')).toEqual([
      'invalid_datetime',
    ]);
  });

  it('accepts only a member of the declared choice set', () => {
    expect(codes(byKey('category'), 'news')).toEqual([]);
    expect(codes(byKey('category'), 'other')).toEqual(['not_in_choices']);
  });
});

describe('validateCmsFieldValue: structured kinds', () => {
  it('bounds rich text by its total character count', () => {
    expect(codes(byKey('body'), richText('Hello'))).toEqual([]);
    expect(codes(byKey('body'), richText('x'.repeat(501)))).toEqual([
      'too_long',
    ]);
    expect(codes(byKey('body'), { format: 'html', blocks: [] })).toEqual([
      'rich_text_not_canonical',
    ]);
  });

  it('validates each list item against its declared itemKind and the list length cap', () => {
    expect(codes(byKey('tags'), ['a', 'b'])).toEqual([]);
    expect(
      validateCmsFieldValue(byKey('tags'), ['ok', 'x'.repeat(13)]),
    ).toEqual([expect.objectContaining({ code: 'too_long', index: 1 })]);
    expect(
      codes(
        byKey('tags'),
        Array.from({ length: 129 }, () => 'a'),
      ),
    ).toEqual(['too_many_items']);
    expect(codes(byKey('tags'), 'not-a-list')).toEqual(['invalid_list']);
  });

  it('validates each object property with the property it belongs to', () => {
    const meta = byKey('meta');
    expect(
      codes(meta, { headline: 'Launch', tone: 'formal', priority: 3 }),
    ).toEqual([]);
    const issues = validateCmsFieldValue(meta, {
      headline: 'x',
      tone: 'loud',
      priority: 9,
      stray: 'unknown',
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'too_short', propertyKey: 'headline' }),
        expect.objectContaining({
          code: 'not_in_choices',
          propertyKey: 'tone',
        }),
        expect.objectContaining({
          code: 'above_maximum',
          propertyKey: 'priority',
        }),
        expect.objectContaining({
          code: 'unknown_property',
          propertyKey: 'stray',
        }),
      ]),
    );
    expect(validateCmsFieldValue(meta, { tone: 'formal' })).toEqual([
      expect.objectContaining({ code: 'required', propertyKey: 'headline' }),
    ]);
  });

  it('bounds relation targets by the definition and refuses malformed or duplicate targets', () => {
    const related = byKey('related');
    const target = (n: number) => ({
      targetId: fieldUuid(n),
      expectedTargetVersion: null,
    });
    expect(codes(related, { targets: [target(1), target(2)] })).toEqual([]);
    expect(
      codes(related, { targets: [target(1), target(2), target(3), target(4)] }),
    ).toEqual(['too_many_targets']);
    expect(codes(related, { targets: [target(1), target(1)] })).toEqual([
      'duplicate_target',
    ]);
    expect(
      codes(related, {
        targets: [{ targetId: 'nope', expectedTargetVersion: null }],
      }),
    ).toEqual(['invalid_uuid']);
    expect(
      codes(related, {
        targets: [{ targetId: fieldUuid(1), expectedTargetVersion: '0' }],
      }),
    ).toEqual(['invalid_target_version']);
  });

  it('never reports an issue for the kinds that have no producer yet', () => {
    expect(codes(byKey('topics'), { termIds: [] })).toEqual([]);
    expect(codes(byKey('cover'), null)).toEqual([]);
  });
});

describe('emptiness and initial values', () => {
  it('knows when a value is the absence of a value', () => {
    expect(isCmsFieldValueEmpty(byKey('title'), '')).toBe(true);
    expect(isCmsFieldValueEmpty(byKey('title'), 'x')).toBe(false);
    expect(isCmsFieldValueEmpty(byKey('tags'), [])).toBe(true);
    expect(isCmsFieldValueEmpty(byKey('meta'), {})).toBe(true);
    expect(isCmsFieldValueEmpty(byKey('related'), { targets: [] })).toBe(true);
    expect(isCmsFieldValueEmpty(byKey('body'), richText(''))).toBe(true);
    expect(isCmsFieldValueEmpty(byKey('body'), richText('x'))).toBe(false);
    expect(isCmsFieldValueEmpty(byKey('featured'), false)).toBe(false);
    expect(isCmsFieldValueEmpty(byKey('rating'), 0)).toBe(false);
    expect(isCmsFieldValueEmpty(byKey('rating'), null)).toBe(true);
  });

  it('starts from the stored value or from nothing, never from an invented default', () => {
    expect(initialCmsFieldValue(byKey('title'), 'Stored')).toBe('Stored');
    expect(initialCmsFieldValue(byKey('title'), undefined)).toBeNull();
    expect(initialCmsFieldValue(byKey('title'), null)).toBeNull();
  });
});

describe('datetime control conversion', () => {
  it('round-trips a control value through the UTC instant without drifting', () => {
    const local = '2026-10-05T14:30:15';
    const instant = cmsLocalInputToDatetime(local);
    expect(instant).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/u,
    );
    expect(cmsDatetimeToLocalInput(instant ?? '')).toBe(local);
  });

  it('renders any stored offset as the same instant in the control', () => {
    const fromZulu = cmsDatetimeToLocalInput('2026-10-05T12:00:00Z');
    const fromOffset = cmsDatetimeToLocalInput('2026-10-05T14:00:00+02:00');
    expect(fromOffset).toBe(fromZulu);
  });

  it('treats an empty or unparsable control value as no value', () => {
    expect(cmsLocalInputToDatetime('')).toBeNull();
    expect(cmsLocalInputToDatetime('not a date')).toBeNull();
    expect(cmsDatetimeToLocalInput('garbage')).toBe('');
  });
});

/**
 * Orchestrator follow-up to Codex review s10-ts-2, M3: every string a field
 * editor submits must pass the shared well-formed-Unicode predicate
 * (`isWellFormedAuthoredString` from @wejammin/contracts: no lone surrogate, no
 * NUL), because PostgreSQL `jsonb` refuses both. The author sees the field's own
 * message and nothing is sent.
 */
describe('validateCmsFieldValue: text PostgreSQL cannot store is refused client-side', () => {
  const MESSAGE =
    'This text contains a character that cannot be saved. Remove it and try again.';
  const BAD_TEXT: readonly string[] = [
    'ab\uD800',
    '\uDC00ab',
    'a\uD800\uD800b',
    'ab\u0000',
  ];

  const issuesOf = (descriptor: CmsFieldDescriptor, value: unknown) =>
    validateCmsFieldValue(descriptor, value as never);

  for (const text of BAD_TEXT) {
    const shown = JSON.stringify(text);

    it(`short_text, long_text and enum refuse ${shown} with the field message`, () => {
      expect(issuesOf(byKey('title'), text)).toEqual([
        expect.objectContaining({
          code: 'invalid_characters',
          message: MESSAGE,
        }),
      ]);
      expect(issuesOf(byKey('blurb'), text)).toEqual([
        expect.objectContaining({
          code: 'invalid_characters',
          message: MESSAGE,
        }),
      ]);
      expect(issuesOf(byKey('category'), text)).toEqual([
        expect.objectContaining({
          code: 'invalid_characters',
          message: MESSAGE,
        }),
      ]);
    });

    it(`date and datetime refuse ${shown}`, () => {
      for (const key of ['published_on', 'starts_at'])
        expect(issuesOf(byKey(key), text)).toEqual([
          expect.objectContaining({ code: 'invalid_characters' }),
        ]);
    });

    it(`a list item refuses ${shown} and names the item`, () => {
      expect(issuesOf(byKey('tags'), ['fine', text])).toEqual([
        expect.objectContaining({
          code: 'invalid_characters',
          message: MESSAGE,
          index: 1,
        }),
      ]);
    });

    it(`object scalar and enum property strings refuse ${shown} and name the property`, () => {
      const meta = byKey('meta');
      expect(
        issuesOf(meta, { headline: `Launch${text}`, tone: 'formal' }),
      ).toEqual([
        expect.objectContaining({
          code: 'invalid_characters',
          message: MESSAGE,
          propertyKey: 'headline',
        }),
      ]);
      expect(issuesOf(meta, { headline: 'Launch', tone: text })).toEqual([
        expect.objectContaining({
          code: 'invalid_characters',
          propertyKey: 'tone',
        }),
      ]);
    });

    it(`rich text refuses ${shown} in span text and in a link target`, () => {
      expect(codes(byKey('body'), richText(text))).toEqual([
        'rich_text_not_canonical',
      ]);
      expect(
        codes(byKey('body'), {
          format: 'rich_text.v1',
          blocks: [
            {
              type: 'paragraph',
              spans: [
                {
                  text: 'link',
                  marks: [],
                  link: { kind: 'internal', route: `/a/${text}` },
                },
              ],
            },
          ],
        }),
      ).toEqual(['rich_text_not_canonical']);
    });

    it(`a relation target id and pinned version refuse ${shown}`, () => {
      const related = byKey('related');
      expect(
        codes(related, {
          targets: [
            { targetId: `${fieldUuid(1)}${text}`, expectedTargetVersion: null },
          ],
        }),
      ).toEqual(['invalid_uuid']);
      expect(
        codes(related, {
          targets: [
            { targetId: fieldUuid(1), expectedTargetVersion: `1${text}` },
          ],
        }),
      ).toEqual(['invalid_target_version']);
    });
  }

  it('still accepts astral characters, which are well-formed surrogate pairs', () => {
    expect(issuesOf(byKey('title'), 'Hi \u{1F600}')).toEqual([]);
    expect(issuesOf(byKey('tags'), ['\u{1F600}'])).toEqual([]);
    expect(
      issuesOf(byKey('meta'), { headline: 'Launch \u{1F600}', tone: 'formal' }),
    ).toEqual([]);
  });

  it('reports the unstorable character before any length rule', () => {
    expect(codes(byKey('title'), '\uD800')).toEqual(['invalid_characters']);
  });

  it('has no editor, and so submits no free-text id, for taxonomy and media', () => {
    const descriptors = describeCmsAuthoringFields(allKindFields());
    const editable = editableCmsFieldIds(descriptors, { readOnlyNotices: {} });
    const unavailable = descriptors
      .filter((descriptor) => ['taxonomy', 'media'].includes(descriptor.kind))
      .map((descriptor) => descriptor.fieldId);
    expect(unavailable).toHaveLength(2);
    for (const fieldId of unavailable) expect(editable).not.toContain(fieldId);
  });
});

describe('AC-084: the field validation names a refused rich text with the PostgreSQL reason token and the one fixed copy', () => {
  it('returns rich_text_not_canonical with the same copy the server reason maps to', () => {
    const issues = validateCmsFieldValue(byKey('body'), {
      format: 'html',
      blocks: [],
    } as never);
    expect(issues).toEqual([
      expect.objectContaining({
        code: 'rich_text_not_canonical',
        message: CMS_EDITORIAL_REASON_COPY.rich_text_not_canonical,
      }),
    ]);
  });

  it('uses the same token for an object property holding a refused rich text', () => {
    const issues = validateCmsFieldValue(byKey('meta'), {
      headline: 'Launch',
      tone: 'formal',
      summary: { format: 'rich_text.v1', blocks: [{ type: 'html' }] },
    } as never);
    expect(issues).toEqual([
      expect.objectContaining({
        code: 'rich_text_not_canonical',
        propertyKey: 'summary',
      }),
    ]);
  });
});
