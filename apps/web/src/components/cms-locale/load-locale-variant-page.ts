import {
  AuthoringContextReadSchema,
  EntryDraftDetailResourceSchema,
  LocaleVariantReadSchema,
  localeVariantReadAnswers,
  type AuthoringContextField,
  type EntryDraftDetailResource,
  type JsonValue,
} from '@wejammin/contracts';

import { cmsEditorialCsrfCookie } from '../../server/cms-editorial-platform-shared';
import { describeCmsAuthoringFields } from '../cms-editorial-fields/cms-field-descriptor-decode';
import type { CmsScalarDescriptor } from '../cms-editorial-fields/cms-field-descriptor';
import {
  cmsEditorialNoticeFor,
  cmsEditorialUnverifiedNotice,
  type CmsEditorialPageNotice,
} from '../cms-editorial-pages/cms-editorial-page-outcome';
import type { CmsEditorialPageOutcome } from '../cms-editorial-pages/cms-editorial-page-view';
import type { LocalePageReads } from './locale-variant-page-reads';
import { localeVariantPagePath } from './locale-variant-path';
import type {
  LocaleEntryFacts,
  LocaleFieldInit,
  LocaleFieldMode,
  LocaleResolution,
  LocaleVariantInit,
} from './locale-variant-types';

export interface LocaleVariantPageView {
  readonly entry: LocaleEntryFacts;
  /** The active version's fallback order for the locale (from the variant read), read-only and submitted unchanged. */
  readonly fallbackChain: readonly string[];
  readonly fields: readonly LocaleFieldInit[];
  /** Labels of localizable fields whose kind cannot be written by CMS-03C-04 yet (BE03c 205). */
  readonly unavailableFields: readonly string[];
  /** The CMS-03C-20 resolution of every localizable field, exactly as `cmsLocaleVariantRead` returned it (DEC-205). */
  readonly resolutions: readonly LocaleResolution[];
  /** The current variant: derived state, the stored values of the writable fields and its stale field ids. */
  readonly variant: LocaleVariantInit;
  readonly csrfToken: string;
  /** The page path: sign-in and reload links return to it. */
  readonly path: string;
}

/** The kinds `cms_author_locale_variant` can write (20260927580000: others are DEPENDENCY_UNAVAILABLE). */
const WRITABLE_KINDS: ReadonlySet<string> = new Set([
  'short_text',
  'long_text',
  'boolean',
  'integer',
  'decimal',
  'date',
  'datetime',
]);

const notice = (
  status: number,
  title: string,
  message: string,
  retryHref: string | null = null,
): CmsEditorialPageOutcome<never> => ({
  kind: 'notice',
  notice: {
    status,
    title,
    heading: title,
    message,
    retryHref,
    requestId: null,
  } satisfies CmsEditorialPageNotice,
});

/** The page-level 403: a visible entry the account cannot edit (AC-270), or a type it cannot author. */
const cannotTranslate = (): CmsEditorialPageOutcome<never> =>
  notice(403, 'Access denied', 'This account cannot translate this entry.');

const jsonOf = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
};

const sourceTextOf = (
  draft: EntryDraftDetailResource,
  fieldId: string,
): string | null => {
  const value = draft.fields.find((field) => field.fieldId === fieldId)?.value;
  return typeof value === 'string'
    ? value
    : typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : null;
};

/** The localizable fields the form can write, in authoring order, and the labels of those it cannot. */
const localizableFields = (
  definitions: readonly AuthoringContextField[],
  draft: EntryDraftDetailResource,
): Pick<LocaleVariantPageView, 'fields' | 'unavailableFields'> => {
  const modes = new Map<string, LocaleFieldMode>();
  const unavailable: string[] = [];
  const writable: AuthoringContextField[] = [];
  for (const field of definitions) {
    if (field.localizationMode === 'none') continue;
    if (WRITABLE_KINDS.has(field.kind)) {
      modes.set(field.stableFieldId, field.localizationMode);
      writable.push(field);
    } else unavailable.push(field.editorConfig.label);
  }
  const fields = describeCmsAuthoringFields(writable).flatMap(
    (descriptor): LocaleFieldInit[] => {
      const mode = modes.get(descriptor.fieldId);
      return mode === undefined || !('constraints' in descriptor)
        ? []
        : [
            {
              descriptor: descriptor as CmsScalarDescriptor,
              mode,
              // FE03 :1122: a `no_fallback` field never shows another locale's text, so its source text is
              // not even carried into the page data.
              sourceText:
                mode === 'localized'
                  ? sourceTextOf(draft, descriptor.fieldId)
                  : null,
            },
          ];
    },
  );
  return { fields, unavailableFields: unavailable };
};

const sameTag = (a: string, b: string): boolean =>
  a.toLowerCase() === b.toLowerCase();

/**
 * The protected locale variant page (FE03 :1073, :1641; AC-270). The address is `:entryId` and `:locale`
 * only: a malformed id or tag, or ANY query, is a 400 before a read. The draft is read first (CMS-03B-11): a
 * missing session is the 303 sign-in redirect, a concealed entry the disclosure-safe 404, an entry the account
 * cannot read a 403. The author-safe definitions of the draft's own schema version follow (CMS-03B-14), then
 * `cmsLocaleVariantRead` (DEC-205), which is also the edit-authority gate: a visible entry the account cannot
 * edit is the page-level 403, a hidden entry or a locale outside the active version's `supportedLocales` the
 * same 404. The source locale itself, or a draft head that is not a source-locale revision, is that 404 too. No
 * form is built from an answer the strict contracts did not verify.
 */
export const loadLocaleVariantPage = async (input: {
  readonly request: Request;
  readonly entryId: string;
  readonly locale: string;
  readonly reads: LocalePageReads;
}): Promise<CmsEditorialPageOutcome<LocaleVariantPageView>> => {
  const { request, entryId, locale, reads } = input;
  const path = localeVariantPagePath(entryId, locale);
  if (path === null || new URL(request.url).search !== '')
    return notice(
      400,
      'Invalid request',
      'This request could not be read. Check the address and try again.',
    );
  const context = {
    subject: 'entry' as const,
    returnTo: path,
    retryHref: path,
  };
  const unavailable = (): CmsEditorialPageOutcome<never> =>
    notice(404, 'Not found', 'This language is not available for this entry.');

  const draftResponse = await reads.draftDetail(request, entryId);
  if (draftResponse.status !== 200)
    return cmsEditorialNoticeFor(draftResponse, context);
  const draftRead = EntryDraftDetailResourceSchema.safeParse(
    await jsonOf(draftResponse),
  );
  if (!draftRead.success || draftRead.data.entry.id !== entryId)
    return cmsEditorialUnverifiedNotice('Translate');
  const draft = draftRead.data;

  const contextResponse = await reads.authoringContext(
    request,
    draft.schemaVersionId,
  );
  if (contextResponse.status === 403) return cannotTranslate();
  if (contextResponse.status !== 200)
    return cmsEditorialNoticeFor(contextResponse, context);
  const definitions = AuthoringContextReadSchema.safeParse({
    query: { contentTypeVersionId: draft.schemaVersionId },
    resource: await jsonOf(contextResponse),
  });
  const selected = definitions.success
    ? definitions.data.resource.selectedType
    : null;
  if (!definitions.success || selected === null)
    return cmsEditorialUnverifiedNotice('Translate');

  // DEC-205: the one read of the current variant, the resolutions, the author-safe order and the edit authority.
  const variantResponse = await reads.localeVariant(request, entryId, locale);
  if (variantResponse.status === 403) return cannotTranslate();
  if (variantResponse.status === 404) return unavailable();
  if (variantResponse.status !== 200)
    return cmsEditorialNoticeFor(variantResponse, context);
  const variantRead = LocaleVariantReadSchema.safeParse(
    await jsonOf(variantResponse),
  );
  if (
    !variantRead.success ||
    !localeVariantReadAnswers(variantRead.data, entryId, locale)
  )
    return cmsEditorialUnverifiedNotice('Translate');
  const read = variantRead.data;

  if (
    sameTag(locale, selected.sourceLocale) ||
    !sameTag(draft.locale, selected.sourceLocale)
  )
    return unavailable();

  const localizable = localizableFields(
    definitions.data.resource.fields,
    draft,
  );
  const writable = new Set(
    localizable.fields.map((field) => field.descriptor.fieldId),
  );
  const values: Record<string, JsonValue | null> = {};
  for (const stored of read.fields)
    if (writable.has(stored.fieldId)) values[stored.fieldId] = stored.value;

  return {
    kind: 'view',
    status: 200,
    title: 'Translate',
    heading: 'Translate',
    description:
      'Translate the localizable fields and see how each one resolves.',
    view: {
      entry: {
        entryId,
        locale,
        sourceLocale: selected.sourceLocale,
        version: draft.entry.version,
        sourceRevisionId: draft.revision.id,
        sourceHash: draft.contentHash,
      },
      fallbackChain: [...read.activeFallbackChain],
      ...localizable,
      resolutions: read.resolutions,
      variant: {
        state: read.variant === null ? 'untranslated' : read.variant.state,
        values,
        staleFieldIds:
          read.variant === null ? [] : [...read.variant.staleFieldIds],
      },
      csrfToken: cmsEditorialCsrfCookie(request) ?? '',
      path,
    },
  };
};
