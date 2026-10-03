import * as React from 'react';

import {
  draftFromSourceTemplates,
  templateFieldId,
  templatePayload,
  validateTemplateDraft,
  type SourceTemplates,
  type TemplateDraft,
  type TemplateField,
  type TemplateIssue,
  type TemplatePayload,
} from './content-schema-registry-template-binding';

export type TemplateChoice = 'keep' | 'change';

export interface TemplateChoiceController {
  readonly formId: string;
  readonly choice: TemplateChoice;
  readonly draft: TemplateDraft;
  /** Validation is shown only after the first blur or submit attempt. */
  readonly revealed: boolean;
  readonly issues: readonly TemplateIssue[];
  readonly payload: TemplatePayload;
  keep: () => void;
  change: () => void;
  edit: (field: TemplateField, value: string) => void;
  reveal: () => void;
  /** Returns true when the form may submit; otherwise reveals and focuses. */
  guardSubmit: () => boolean;
}

/**
 * Owns the DEC-123 template choice for one successor form. Keeping sends both
 * members null; choosing sends both present, prefilled from the source version.
 */
export const useTemplateChoice = (
  formId: string,
  source: SourceTemplates,
): TemplateChoiceController => {
  const [choice, setChoice] = React.useState<TemplateChoice>('keep');
  const [draft, setDraft] = React.useState<TemplateDraft>(() =>
    draftFromSourceTemplates(source),
  );
  const [revealed, setRevealed] = React.useState(false);
  const issues = React.useMemo(() => validateTemplateDraft(draft), [draft]);
  const payload = React.useMemo(() => templatePayload(draft), [draft]);
  const keep = React.useCallback(() => {
    setChoice('keep');
    setRevealed(false);
    setDraft(draftFromSourceTemplates(source));
  }, [source]);
  const change = React.useCallback(() => setChoice('change'), []);
  const edit = React.useCallback((field: TemplateField, value: string) => {
    setDraft((current) =>
      field === 'defaultTemplateVersionId'
        ? { ...current, defaultTemplateVersionId: value }
        : { ...current, bindingsText: value },
    );
  }, []);
  const reveal = React.useCallback(() => setRevealed(true), []);
  const guardSubmit = React.useCallback((): boolean => {
    if (choice === 'keep' || issues.length === 0) return true;
    setRevealed(true);
    const first = issues[0];
    if (first !== undefined)
      document.getElementById(templateFieldId(formId, first.field))?.focus();
    return false;
  }, [choice, issues, formId]);
  return {
    formId,
    choice,
    draft,
    revealed,
    issues,
    payload,
    keep,
    change,
    edit,
    reveal,
    guardSubmit,
  };
};
