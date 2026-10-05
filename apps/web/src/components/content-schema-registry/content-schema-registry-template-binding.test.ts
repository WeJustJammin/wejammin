import { describe, expect, it } from 'vitest';

import {
  TEMPLATE_BINDING_LIMIT,
  draftFromSourceTemplates,
  templatePayload,
  validateTemplateDraft,
} from './content-schema-registry-template-binding';

/**
 * DEC-123 completion: the successor form edits the default template and the
 * template bindings as two plain fields. These tests pin the pure rules the
 * form shows per field before anything is posted.
 */

const A = '018f0c45-73fe-4dc2-9c09-68f7ecf132da';
const B = '028f0c45-73fe-4dc2-9c09-68f7ecf132db';
const C = '038f0c45-73fe-4dc2-9c09-68f7ecf132dc';

describe('template draft from the source version', () => {
  it('[P2-S09-AC-045] is empty when the source has no template', () => {
    expect(
      draftFromSourceTemplates({
        defaultTemplateVersionId: null,
        bindings: [],
      }),
    ).toEqual({
      defaultTemplateVersionId: '',
      bindingsText: '',
    });
  });

  it('[P2-S09-AC-049] lists the source bindings one per line in position order', () => {
    expect(
      draftFromSourceTemplates({
        defaultTemplateVersionId: A,
        bindings: [
          { templateVersionId: B, position: 1 },
          { templateVersionId: A, position: 0 },
        ],
      }),
    ).toEqual({ defaultTemplateVersionId: A, bindingsText: `${A}\n${B}` });
  });
});

describe('template draft validation', () => {
  it('[P2-S09-AC-045] accepts a default with no further bindings', () => {
    expect(
      validateTemplateDraft({ defaultTemplateVersionId: A, bindingsText: '' }),
    ).toEqual([]);
    expect(
      templatePayload({ defaultTemplateVersionId: A, bindingsText: '' }),
    ).toEqual({ defaultTemplateVersionId: A, templateBindings: [] });
  });

  it('[P2-S09-AC-045] requires a default template and a canonical lowercase id', () => {
    expect(
      validateTemplateDraft({ defaultTemplateVersionId: '', bindingsText: '' }),
    ).toEqual([
      {
        field: 'defaultTemplateVersionId',
        line: null,
        message: 'Enter the default template version ID.',
      },
    ]);
    for (const value of ['nope', A.toUpperCase(), `${A} x`])
      expect(
        validateTemplateDraft({
          defaultTemplateVersionId: value,
          bindingsText: '',
        }),
        value,
      ).toEqual([
        {
          field: 'defaultTemplateVersionId',
          line: null,
          message:
            'Enter the default template version ID as a lowercase UUID, for example 018f0c45-73fe-4dc2-9c09-68f7ecf132da.',
        },
      ]);
  });

  it('[P2-S09-AC-049] names the line of an invalid or repeated binding', () => {
    expect(
      validateTemplateDraft({
        defaultTemplateVersionId: A,
        bindingsText: `${A}\nnope\n\n${B}\n${A}`,
      }),
    ).toEqual([
      {
        field: 'templateBindings',
        line: 2,
        message: 'Line 2: enter a lowercase template version ID.',
      },
      {
        field: 'templateBindings',
        line: 5,
        message: 'Line 5: this template version is already listed on line 1.',
      },
    ]);
  });

  it('[P2-S09-AC-049] refuses more than 32 template versions', () => {
    const ids = Array.from(
      { length: TEMPLATE_BINDING_LIMIT + 1 },
      (_, index) =>
        `${String(index).padStart(8, '0')}-73fe-4dc2-9c09-68f7ecf132da`,
    );
    expect(
      validateTemplateDraft({
        defaultTemplateVersionId: A,
        bindingsText: ids.join('\n'),
      }),
    ).toContainEqual({
      field: 'templateBindings',
      line: null,
      message: 'List at most 32 template versions.',
    });
  });

  it('[P2-S09-AC-049] builds the request members from trimmed, non-blank lines', () => {
    expect(
      templatePayload({
        defaultTemplateVersionId: ` ${A} `,
        bindingsText: `  ${B}  \r\n\r\n${C}\n`,
      }),
    ).toEqual({
      defaultTemplateVersionId: A,
      templateBindings: [{ templateVersionId: B }, { templateVersionId: C }],
    });
  });
});
