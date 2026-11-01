import type { JsonValue } from '@wejammin/contracts';

import type { CmsScalarDescriptor } from '../cms-editorial-fields/cms-field-descriptor';
import type {
  LocaleSubmitResult,
  SavedLocaleVariant,
} from './locale-variant-submit';

/** The localization modes that put a field in scope of a locale variant (BE03a, BE03c 1526). */
export type LocaleFieldMode = 'localized' | 'no_fallback';

/**
 * One localizable field of the entry's content type, as the page loader verified it. `sourceText` is the
 * source-locale value shown beside the control as the thing being translated, for a fallback-permitted
 * field only; a `no_fallback` field never shows another locale's text (FE03 :891, :1122), so its
 * `sourceText` is always null.
 */
export interface LocaleFieldInit {
  readonly descriptor: CmsScalarDescriptor;
  readonly mode: LocaleFieldMode;
  readonly sourceText: string | null;
}

/** The entry and source the request is bound to (BE03c 385, 1530). */
export interface LocaleEntryFacts {
  readonly entryId: string;
  readonly locale: string;
  readonly sourceLocale: string;
  /** The entry aggregate `version`: the strong `If-Match` and the body `expectedVersion`. */
  readonly version: string;
  readonly sourceRevisionId: string;
  /** The source revision `contentHash`, which is the request's `sourceHash`. */
  readonly sourceHash: string;
}

/**
 * The CMS-03C-20 `LocaleFieldResolution` (packages/contracts `LocaleFieldResolutionSchema`): identifiers,
 * enums and booleans only, never locale text. `cmsLocaleVariantRead` returns one per localizable field (DEC-205).
 */
export interface LocaleResolution {
  readonly fieldId: string;
  readonly locale: string;
  readonly mode: 'none' | 'localized' | 'no_fallback';
  readonly outcome: 'resolved' | 'missing';
  readonly provenance: 'authored' | 'localized_fallback' | 'missing';
  readonly resolvedFromLocale: string | null;
  readonly stale: boolean;
  readonly blocking: boolean;
  readonly reasonCode: 'no_fallback_missing' | 'no_fallback_stale' | null;
}

/** The variant states the browser shows; `review` and `approved` are derived (BE03c 1532). */
export type LocaleVariantState =
  'untranslated' | 'draft' | 'review' | 'approved' | 'stale';

/**
 * What `cmsLocaleVariantRead` says of the entry's current variant for this language (DEC-205): its derived state,
 * the stored values of the fields this page can write (the form starts from them, so a save keeps what an earlier
 * save translated) and the fields it lists as stale. An untranslated language has no values and no stale field.
 */
export interface LocaleVariantInit {
  readonly state: LocaleVariantState;
  readonly values: Readonly<Record<string, JsonValue | null>>;
  readonly staleFieldIds: readonly string[];
}

/** The form's status: what the one focusable result region renders. */
export type LocaleStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'invalid'; readonly issues: readonly LocaleIssue[] }
  | { readonly kind: 'pending' }
  | { readonly kind: 'saved'; readonly saved: SavedLocaleVariant }
  | {
      readonly kind: 'result';
      readonly result: Exclude<LocaleSubmitResult, { kind: 'saved' }>;
    };

export type LocaleIssueCode =
  | 'entry_invalid'
  | 'locale_invalid'
  | 'source_invalid'
  | 'hash_invalid'
  | 'version_invalid'
  | 'chain_invalid'
  | 'nothing_to_save'
  | 'too_many_fields'
  | 'field_invalid'
  | 'module_unavailable';

export interface LocaleIssue {
  readonly code: LocaleIssueCode;
  /** The summary line: for a field it names the field. */
  readonly message: string;
  /** What is wrong with a field, for the message beside its control. */
  readonly detail?: string;
  /** A field id, or `form` for an issue about the request as a whole. */
  readonly target: string;
}
