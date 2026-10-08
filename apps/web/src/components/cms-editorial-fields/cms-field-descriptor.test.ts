import { describe, expect, it } from 'vitest';

import {
  describeCmsAuthoringFields,
  describeCmsConstraints,
  humanizeCmsKey,
} from './cms-field-descriptor';
import {
  OBJECT_STRUCTURE,
  allKindFields,
  authoringField,
  fieldUuid,
} from './cms-field-fixtures.test-support';

describe('describeCmsAuthoringFields', () => {
  it('describes every one of the fourteen kinds with the typed shape its editor needs', () => {
    const descriptors = describeCmsAuthoringFields(allKindFields());
    expect(descriptors.map((descriptor) => descriptor.kind)).toEqual([
      'short_text',
      'long_text',
      'rich_text',
      'boolean',
      'integer',
      'decimal',
      'date',
      'datetime',
      'enum',
      'list',
      'object',
      'relation',
      'taxonomy',
      'media',
    ]);
    const title = descriptors[0];
    expect(title).toMatchObject({
      fieldId: fieldUuid(1),
      label: 'Title',
      required: true,
      constraints: { minLength: 2, maxLength: 40 },
    });
    const category = descriptors.find((entry) => entry.key === 'category');
    expect(category).toMatchObject({
      kind: 'enum',
      constraints: { enumValues: ['news', 'tutorial', 'event'] },
    });
    const tags = descriptors.find((entry) => entry.key === 'tags');
    expect(tags).toMatchObject({
      kind: 'list',
      itemKind: 'short_text',
      constraints: { maxLength: 12 },
    });
  });

  it('exposes the DEC-133 object structure as one typed descriptor per property', () => {
    const meta = describeCmsAuthoringFields(allKindFields()).find(
      (entry) => entry.key === 'meta',
    );
    expect(meta?.kind).toBe('object');
    if (meta?.kind !== 'object') return;
    expect(meta.properties.map((property) => property.key)).toEqual(
      OBJECT_STRUCTURE.properties.map((property) => property.key),
    );
    // The structure declares no label or help member, so the label is derived
    // from the stable key and nothing else is invented.
    expect(meta.properties[0]).toMatchObject({
      key: 'headline',
      label: 'Headline',
      kind: 'scalar',
      required: true,
      constraints: { minLength: 3, maxLength: 20 },
    });
    expect(meta.properties[2]).toMatchObject({
      kind: 'enum',
      constraints: { enumValues: ['formal', 'casual'] },
    });
  });

  it('reads the relation bounds from the immutable relation definition', () => {
    const related = describeCmsAuthoringFields(allKindFields()).find(
      (entry) => entry.key === 'related',
    );
    expect(related).toMatchObject({
      kind: 'relation',
      targetKind: 'content',
      min: 0,
      max: 3,
      ordered: true,
    });
  });

  it('orders by editorConfig.order and then the stable key', () => {
    const ordered = describeCmsAuthoringFields([
      authoringField({ n: 3, key: 'zeta', kind: 'short_text', order: 1 }),
      authoringField({ n: 1, key: 'beta', kind: 'short_text', order: 1 }),
      authoringField({ n: 2, key: 'alpha', kind: 'short_text', order: 0 }),
    ]);
    expect(ordered.map((entry) => entry.key)).toEqual([
      'alpha',
      'beta',
      'zeta',
    ]);
  });

  it('fails closed to an unsupported descriptor when the projection is not usable', () => {
    const [noStructure, noItemKind, noRelation, badConstraints] =
      describeCmsAuthoringFields([
        authoringField({ n: 1, key: 'meta', kind: 'object', constraints: {} }),
        authoringField({ n: 2, key: 'tags', kind: 'list', constraints: {} }),
        authoringField({ n: 3, key: 'related', kind: 'relation' }),
        authoringField({
          n: 4,
          key: 'title',
          kind: 'short_text',
          constraints: { minLength: 9, maxLength: 2 },
        }),
      ]);
    for (const descriptor of [
      noStructure,
      noItemKind,
      noRelation,
      badConstraints,
    ])
      expect(descriptor?.kind).toBe('unsupported');
  });
});

describe('describeCmsConstraints', () => {
  it('states declared length and range constraints in plain language', () => {
    expect(
      describeCmsConstraints(
        { minLength: 3, maxLength: 20 },
        { required: true },
      ),
    ).toBe('Required. Between 3 and 20 characters.');
    expect(describeCmsConstraints({ maxLength: 5 }, { required: false })).toBe(
      'At most 5 characters.',
    );
    expect(describeCmsConstraints({ minimum: 1 }, { required: false })).toBe(
      'At least 1.',
    );
    expect(
      describeCmsConstraints(
        { minimum: 1, maximum: 5 },
        { required: true, includeRequired: false },
      ),
    ).toBe('Between 1 and 5.');
    expect(describeCmsConstraints({}, { required: false })).toBe('');
  });

  it('derives a readable label from a stable key', () => {
    expect(humanizeCmsKey('release_notes')).toBe('Release notes');
    expect(humanizeCmsKey('x')).toBe('X');
  });
});
