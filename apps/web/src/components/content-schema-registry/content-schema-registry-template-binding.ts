/**
 * DEC-123 completion: the pure rules behind the successor form's template
 * choice (CMS-03A-09). The default template is one identifier and the template
 * list is one identifier per line; this module turns the two text fields into
 * the request members and names every problem on the field and line that
 * causes it. The database resolver still decides whether each template names
 * the content type; nothing here reads a template.
 */

export const TEMPLATE_BINDING_LIMIT = 32;

/** The identifier shape the database accepts: canonical lowercase UUID. */
const TEMPLATE_VERSION_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export interface TemplateDraft {
  readonly defaultTemplateVersionId: string;
  /** One template version identifier per line; blank lines are ignored. */
  readonly bindingsText: string;
}

export interface SourceTemplates {
  readonly defaultTemplateVersionId: string | null;
  readonly bindings: readonly {
    readonly templateVersionId: string;
    readonly position: number;
  }[];
}

export type TemplateField = 'defaultTemplateVersionId' | 'templateBindings';

export interface TemplateIssue {
  readonly field: TemplateField;
  /** One-based line of the bindings field, or null for a whole-field issue. */
  readonly line: number | null;
  readonly message: string;
}

export interface TemplatePayload {
  readonly defaultTemplateVersionId: string;
  readonly templateBindings: readonly { readonly templateVersionId: string }[];
}

export const EMPTY_TEMPLATE_DRAFT: TemplateDraft = {
  defaultTemplateVersionId: '',
  bindingsText: '',
};

export const draftFromSourceTemplates = (
  source: SourceTemplates,
): TemplateDraft => ({
  defaultTemplateVersionId: source.defaultTemplateVersionId ?? '',
  bindingsText: [...source.bindings]
    .sort((left, right) => left.position - right.position)
    .map((binding) => binding.templateVersionId)
    .join('\n'),
});

interface BindingLine {
  readonly line: number;
  readonly value: string;
}

const bindingLines = (text: string): readonly BindingLine[] =>
  text
    .split(/\r?\n/u)
    .map((value, index) => ({ line: index + 1, value: value.trim() }))
    .filter((entry) => entry.value !== '');

export const validateTemplateDraft = (
  draft: TemplateDraft,
): readonly TemplateIssue[] => {
  const issues: TemplateIssue[] = [];
  const defaultId = draft.defaultTemplateVersionId.trim();
  if (defaultId === '')
    issues.push({
      field: 'defaultTemplateVersionId',
      line: null,
      message: 'Enter the default template version ID.',
    });
  else if (!TEMPLATE_VERSION_ID.test(defaultId))
    issues.push({
      field: 'defaultTemplateVersionId',
      line: null,
      message:
        'Enter the default template version ID as a lowercase UUID, for example 018f0c45-73fe-4dc2-9c09-68f7ecf132da.',
    });
  const lines = bindingLines(draft.bindingsText);
  const firstSeen = new Map<string, number>();
  for (const { line, value } of lines) {
    if (!TEMPLATE_VERSION_ID.test(value)) {
      issues.push({
        field: 'templateBindings',
        line,
        message: `Line ${line}: enter a lowercase template version ID.`,
      });
      continue;
    }
    const earlier = firstSeen.get(value);
    if (earlier === undefined) firstSeen.set(value, line);
    else
      issues.push({
        field: 'templateBindings',
        line,
        message: `Line ${line}: this template version is already listed on line ${earlier}.`,
      });
  }
  if (lines.length > TEMPLATE_BINDING_LIMIT)
    issues.push({
      field: 'templateBindings',
      line: null,
      message: `List at most ${TEMPLATE_BINDING_LIMIT} template versions.`,
    });
  return issues;
};

export const templatePayload = (draft: TemplateDraft): TemplatePayload => ({
  defaultTemplateVersionId: draft.defaultTemplateVersionId.trim(),
  templateBindings: bindingLines(draft.bindingsText).map((entry) => ({
    templateVersionId: entry.value,
  })),
});

/** DOM id of a template field; the island and the refusal summary share it. */
export const templateFieldId = (formId: string, field: TemplateField): string =>
  `${formId}-template-${field === 'defaultTemplateVersionId' ? 'default' : 'bindings'}`;
