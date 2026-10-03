import * as React from 'react';

import {
  addIntermediate,
  addTag,
  cycleParticipants,
  issueControlTarget,
  localeControlId,
  moveIntermediate,
  removeIntermediate,
  removeTag,
  setDefaultLocale,
  setSourceLocale,
  validateDraft,
  type LocaleConfigDraft,
  type LocaleIssue,
  type TagError,
} from './content-schema-registry-locale-config';

export interface LocaleDraftController {
  readonly formId: string;
  readonly draft: LocaleConfigDraft;
  readonly tagText: string;
  readonly tagError: TagError | null;
  readonly announcement: string;
  /** Validation is shown only after the first blur or submit. */
  readonly revealed: boolean;
  readonly issues: readonly LocaleIssue[];
  readonly cycle: readonly string[];
  setTagText: (value: string) => void;
  commitTag: () => void;
  /** Blur of the tag input: shows the issue for the typed text, never edits it. */
  checkTag: () => void;
  applySuggestion: (suggestion: string) => void;
  dropTag: (tag: string) => void;
  chooseSource: (tag: string) => void;
  chooseDefault: (tag: string) => void;
  insertIntermediate: (target: string, tag: string) => void;
  dropIntermediate: (target: string, tag: string) => void;
  shiftIntermediate: (target: string, tag: string, direction: -1 | 1) => void;
  reveal: () => void;
  /** Returns true when the form may submit; otherwise reveals and focuses. */
  guardSubmit: () => boolean;
  /** Replace the draft (for example when the replacement choice changes). */
  replace: (draft: LocaleConfigDraft) => void;
}

/**
 * Owns the OD-4 editing state for one form. The draft only ever changes
 * through the pure transitions of `content-schema-registry-locale-config`, and
 * focus moves are requested here and applied after the render that needs them.
 */
export const useLocaleConfigDraft = (
  formId: string,
  initial: LocaleConfigDraft,
): LocaleDraftController => {
  const [draft, setDraft] = React.useState(initial);
  const [tagText, setTagText] = React.useState('');
  const [tagError, setTagError] = React.useState<TagError | null>(null);
  const [announcement, setAnnouncement] = React.useState('');
  const [revealed, setRevealed] = React.useState(false);
  const [focusId, setFocusId] = React.useState<string | null>(null);
  const inputId = localeControlId(formId, { control: 'tags' });

  React.useEffect(() => {
    if (focusId === null) return;
    document.getElementById(focusId)?.focus();
    setFocusId(null);
  }, [focusId]);

  const issues = React.useMemo(() => validateDraft(draft), [draft]);
  const cycle = React.useMemo(() => cycleParticipants(draft), [draft]);
  const update = (next: LocaleConfigDraft): void => {
    setDraft(next);
    setAnnouncement('');
  };

  return {
    formId,
    draft,
    tagText,
    tagError,
    announcement,
    revealed,
    issues: revealed ? issues : [],
    cycle,
    setTagText: (value) => {
      setTagText(value);
      setTagError(null);
    },
    commitTag: () => {
      const result = addTag(draft, tagText);
      setTagError(result.error);
      if (result.error === null) {
        update(result.draft);
        setTagText('');
      }
      setFocusId(inputId);
    },
    checkTag: () => {
      if (tagText.trim() === '') {
        setRevealed(true);
        return;
      }
      setTagError(addTag(draft, tagText).error);
    },
    applySuggestion: (suggestion) => {
      setTagText(suggestion);
      setTagError(null);
      setFocusId(inputId);
    },
    dropTag: (tag) => {
      const index = draft.supportedLocales.indexOf(tag);
      const result = removeTag(draft, tag);
      setDraft(result.draft);
      setAnnouncement(result.announcement);
      const remaining = result.draft.supportedLocales.length;
      setFocusId(index < remaining ? `${inputId}-remove-${index}` : inputId);
    },
    chooseSource: (tag) => update(setSourceLocale(draft, tag)),
    chooseDefault: (tag) => update(setDefaultLocale(draft, tag)),
    insertIntermediate: (target, tag) =>
      update(addIntermediate(draft, target, tag)),
    dropIntermediate: (target, tag) => {
      const chainId = localeControlId(formId, { control: 'chain', target });
      const entries = draft.intermediates[target] ?? [];
      const index = entries.indexOf(tag);
      update(removeIntermediate(draft, target, tag));
      // FE03: focus moves to the next entry, or to the Add input when none remains.
      setFocusId(
        index >= 0 && index < entries.length - 1
          ? `${chainId}-remove-${index}`
          : `${chainId}-add`,
      );
    },
    shiftIntermediate: (target, tag, direction) => {
      const result = moveIntermediate(draft, target, tag, direction);
      setDraft(result.draft);
      setAnnouncement(result.announcement ?? '');
    },
    reveal: () => setRevealed(true),
    guardSubmit: () => {
      setRevealed(true);
      if (issues.length === 0) return true;
      setFocusId(localeControlId(formId, { control: 'summary' }));
      return false;
    },
    replace: (next) => {
      setDraft(next);
      setTagText('');
      setTagError(null);
      setAnnouncement('');
      setRevealed(false);
    },
  };
};

/** The control id an issue's summary link should move focus to. */
export const issueFocusId = (formId: string, issue: LocaleIssue): string =>
  localeControlId(formId, issueControlTarget(issue.path));
