import { describe, expect, it } from 'vitest';

import { SchemaSuccessorRequestSchema } from './requests-human.ts';

// DEC-123 completion (owner, 2026-10-03): a new content type is created without
// a template; it gains one only through the first successor version (CMS-03A-09).
// SchemaSuccessorRequest therefore carries the template members with the same
// both-null (clone the source default template and bindings) / both-present
// (replace them) semantics as the OD-4 locale pair.
const first = '018f0c45-73fe-4dc2-9c09-68f7ecf132da';
const second = '028f0c45-73fe-4dc2-9c09-68f7ecf132db';
const clone = {
  expectedVersion: '3',
  supportedLocales: null,
  fallbackChains: null,
  defaultTemplateVersionId: null,
  templateBindings: null,
};
const replace = {
  ...clone,
  defaultTemplateVersionId: first,
  templateBindings: [
    { templateVersionId: first },
    { templateVersionId: second },
  ],
};

const issues = (
  value: unknown,
): ReadonlyArray<{ path: string; message: string }> => {
  const parsed = SchemaSuccessorRequestSchema.safeParse(value);
  return parsed.success
    ? []
    : parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
};

describe('CMS-03A-09 successor template binding (DEC-123)', () => {
  it('[P2-S09-AC-003] accepts both template members null (clone the source default template and bindings)', () => {
    expect(SchemaSuccessorRequestSchema.parse(clone)).toEqual(clone);
  });

  it('[P2-S09-AC-003] accepts both template members present (replace them)', () => {
    expect(SchemaSuccessorRequestSchema.parse(replace)).toEqual(replace);
    expect(
      SchemaSuccessorRequestSchema.parse({ ...replace, templateBindings: [] }),
    ).toMatchObject({ templateBindings: [] });
  });

  it('[P2-S09-AC-045] refuses a default template without bindings and bindings without a default', () => {
    const pair =
      'defaultTemplateVersionId and templateBindings must be both null or both present';
    expect(
      issues({ ...clone, defaultTemplateVersionId: first }),
    ).toContainEqual({ path: 'templateBindings', message: pair });
    expect(
      issues({ ...clone, templateBindings: [{ templateVersionId: first }] }),
    ).toContainEqual({ path: 'templateBindings', message: pair });
    expect(
      issues({ ...replace, defaultTemplateVersionId: null }),
    ).toContainEqual({ path: 'templateBindings', message: pair });
  });

  it('[P2-S09-AC-045] refuses a malformed default template version id', () => {
    for (const value of ['', 'nope', 7, {}, [], first.toUpperCase()])
      expect(
        issues({ ...replace, defaultTemplateVersionId: value }).map(
          (issue) => issue.path,
        ),
        String(value),
      ).toContain('defaultTemplateVersionId');
  });

  it('[P2-S09-AC-049] bounds template bindings: at most 32, unique, strict members', () => {
    const many = (
      count: number,
    ): ReadonlyArray<{ templateVersionId: string }> =>
      Array.from({ length: count }, (_, index) => ({
        templateVersionId: `${String(index).padStart(8, '0')}-73fe-4dc2-9c09-68f7ecf132da`,
      }));
    expect(
      SchemaSuccessorRequestSchema.safeParse({
        ...replace,
        defaultTemplateVersionId: many(32)[0]?.templateVersionId,
        templateBindings: many(32),
      }).success,
    ).toBe(true);
    expect(
      issues({
        ...replace,
        defaultTemplateVersionId: many(33)[0]?.templateVersionId,
        templateBindings: many(33),
      }).map((issue) => issue.path),
    ).toContain('templateBindings');
    expect(
      issues({
        ...replace,
        templateBindings: [
          { templateVersionId: first },
          { templateVersionId: first },
        ],
      }),
    ).toContainEqual({
      path: 'templateBindings.1.templateVersionId',
      message: 'templateBindings must be unique',
    });
    expect(
      issues({
        ...replace,
        templateBindings: [{ templateVersionId: first.toUpperCase() }],
      }).map((issue) => issue.path),
    ).toContain('templateBindings.0.templateVersionId');
    for (const value of [
      {},
      'x',
      [first],
      [{}],
      [{ templateVersionId: 'x' }],
      [{ templateVersionId: first, position: 1 }],
    ])
      expect(
        issues({ ...replace, templateBindings: value }).map(
          (issue) => issue.path.split('.')[0],
        ),
        JSON.stringify(value),
      ).toContain('templateBindings');
  });

  it('[P2-S09-AC-003] stays strict and requires both template members to be named', () => {
    expect(
      SchemaSuccessorRequestSchema.safeParse({ ...clone, extra: 1 }).success,
    ).toBe(false);
    for (const omitted of ['defaultTemplateVersionId', 'templateBindings'])
      expect(
        SchemaSuccessorRequestSchema.safeParse(
          Object.fromEntries(
            Object.entries(clone).filter(([key]) => key !== omitted),
          ),
        ).success,
        omitted,
      ).toBe(false);
  });

  it('[P2-S09-AC-003] a template pair violation does not hide the locale pair violation', () => {
    expect(
      issues({
        ...clone,
        supportedLocales: ['en-US'],
        defaultTemplateVersionId: first,
      }).map((issue) => issue.path),
    ).toEqual(expect.arrayContaining(['fallbackChains', 'templateBindings']));
  });
});
