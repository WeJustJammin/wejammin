import { describe, expect, it } from 'vitest';

import { ContentTypeDraftRequestSchema } from './requests-human.ts';

// DEC-123 (owner, 2026-10-03): a new content type is created without a template
// binding; it gains one only through a successor version (CMS-03A-09), because a
// compatible template names the type id and the id exists only after the create.
// P2-S09-AC-003 / AC-045 / AC-049 therefore reduce, for CMS-03A-01, to "no
// default template and no template binding": a present value is a 422.
const template = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
const draft = {
  typeKey: 'release_notes',
  label: 'Release notes',
  ownerCapability: 'cms.schema_designer',
  sourceLocale: 'en-US',
  defaultLocale: 'en-US',
  supportedLocales: ['en-US'],
  fallbackChains: {},
  workflowKey: 'cms.standard',
  workflowVersion: '1',
  defaultTemplateVersionId: null,
  fields: [],
  relations: [],
  templateBindings: [],
  capabilityBindings: [],
};

const paths = (value: unknown): string[] => {
  const parsed = ContentTypeDraftRequestSchema.safeParse(value);
  return parsed.success
    ? []
    : parsed.error.issues.map((issue) => issue.path.join('.'));
};

describe('CMS-03A-01 creates a type without a template binding (DEC-123)', () => {
  it('[P2-S09-AC-045] accepts a null default template and nothing else', () => {
    expect(ContentTypeDraftRequestSchema.safeParse(draft).success).toBe(true);
    expect(paths({ ...draft, defaultTemplateVersionId: template })).toContain(
      'defaultTemplateVersionId',
    );
    for (const value of ['', 'nope', 7, {}, [], template.toUpperCase()])
      expect(
        paths({ ...draft, defaultTemplateVersionId: value }),
        String(value),
      ).toContain('defaultTemplateVersionId');
  });

  it('[P2-S09-AC-049] accepts an empty template binding list and nothing else', () => {
    expect(
      paths({
        ...draft,
        templateBindings: [{ templateVersionId: template }],
      }),
    ).toContain('templateBindings');
    expect(
      paths({
        ...draft,
        templateBindings: Array.from({ length: 32 }, () => ({
          templateVersionId: template,
        })),
      }),
    ).toContain('templateBindings');
    expect(
      paths({
        ...draft,
        templateBindings: Array.from({ length: 33 }, () => ({
          templateVersionId: template,
        })),
      }),
    ).toContain('templateBindings');
    for (const value of [null, {}, 'x', [template], [{}]])
      expect(
        paths({ ...draft, templateBindings: value }),
        JSON.stringify(value),
      ).toContain('templateBindings');
  });

  it('[P2-S09-AC-003] the refusal names only the template members and leaves a clean request valid', () => {
    expect(
      paths({
        ...draft,
        defaultTemplateVersionId: template,
        templateBindings: [{ templateVersionId: template }],
      }).sort(),
    ).toEqual(['defaultTemplateVersionId', 'templateBindings']);
    expect(ContentTypeDraftRequestSchema.parse(draft)).toEqual(draft);
  });
});
