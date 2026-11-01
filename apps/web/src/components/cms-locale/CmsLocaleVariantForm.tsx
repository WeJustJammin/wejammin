import * as React from 'react';

import CmsTemplateLateEditNotice from '../cms-composition/CmsTemplateLateEditNotice';
import { cmsFieldIds } from '../cms-editorial-fields/cms-field-ids';
import CmsLocaleFallbackOrder from './CmsLocaleFallbackOrder';
import CmsLocaleFieldRow from './CmsLocaleFieldRow';
import CmsLocaleSourceReview from './CmsLocaleSourceReview';
import CmsLocaleStatus from './CmsLocaleStatus';
import type { refreshLocaleSource } from './locale-source-refresh';
import {
  ENTRY_MOVED_NOTICE,
  LOCALE_RESULT_HEADING_ID,
  SAVE_WARNING,
  variantStateText,
} from './locale-variant-copy';
import type { submitLocaleVariant } from './locale-variant-submit';
import type {
  LocaleEntryFacts,
  LocaleFieldInit,
  LocaleResolution,
  LocaleVariantInit,
} from './locale-variant-types';
import { useLocaleVariantForm } from './use-locale-variant-form';

export interface CmsLocaleVariantFormProps {
  readonly entry: LocaleEntryFacts;
  /** The active version's fallback order for the locale: read-only, submitted unchanged. */
  readonly fallbackChain: readonly string[];
  /** The localizable fields this page can write. */
  readonly fields: readonly LocaleFieldInit[];
  /** Labels of localizable fields this page cannot write yet. */
  readonly unavailableFields: readonly string[];
  /** The CMS-03C-20 resolution of every localizable field, from `cmsLocaleVariantRead` (DEC-205). */
  readonly resolutions: readonly LocaleResolution[];
  /** The current variant: derived state, stored values to start from, stale field ids. */
  readonly variant: LocaleVariantInit;
  readonly csrfToken: string;
  /** The page's own path: sign-in and reload links return to it. */
  readonly returnTo: string;
  /** Seams for a test. */
  readonly submit?: typeof submitLocaleVariant;
  readonly refresh?: typeof refreshLocaleSource;
}

/**
 * Translate the localizable fields of one entry into one language (CMS-03C-04, FE03 :891). Everything is form
 * state: nothing but `:entryId` and `:locale` reaches the URL. The fallback order is text, never a control; a
 * `no_fallback` field never shows another language's text; the standing rule and the resolution of each field
 * (from `cmsLocaleVariantRead`, DEC-205) are stated in words, and the form starts from the stored translation.
 */
export default function CmsLocaleVariantForm(
  props: CmsLocaleVariantFormProps,
): React.ReactElement {
  const { entry, fields, resolutions, csrfToken, returnTo } = props;
  const form = useLocaleVariantForm({
    entry,
    fallbackChain: props.fallbackChain,
    fields,
    resolutions,
    variant: props.variant,
    csrfToken,
    submit: props.submit,
    refresh: props.refresh,
  });
  const resolutionOf = (fieldId: string): LocaleResolution | null =>
    resolutions.find((resolution) => resolution.fieldId === fieldId) ?? null;
  const controlIdFor = (target: string): string =>
    target === 'form' ? LOCALE_RESULT_HEADING_ID : cmsFieldIds(target).control;
  return (
    <form
      className="cms-locale-variant"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.save();
      }}
    >
      <dl className="cms-locale-facts">
        <div>
          <dt>Entry</dt>
          <dd>
            <code>{entry.entryId}</code>
          </dd>
        </div>
        <div>
          <dt>Language</dt>
          <dd>{entry.locale}</dd>
        </div>
        <div>
          <dt>Source language</dt>
          <dd>{entry.sourceLocale}</dd>
        </div>
        <div>
          <dt>Entry version</dt>
          <dd>{form.version}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{variantStateText(form.variantState)}</dd>
        </div>
      </dl>
      <CmsLocaleFallbackOrder locale={entry.locale} chain={form.chain} />
      <p>{SAVE_WARNING}</p>
      <CmsLocaleStatus
        status={form.status}
        locale={entry.locale}
        returnTo={returnTo}
        controlIdFor={controlIdFor}
      />
      {form.lateEdits ? <CmsTemplateLateEditNotice /> : null}
      {form.entryMoved ? <p role="status">{ENTRY_MOVED_NOTICE}</p> : null}
      {form.reviewShown ? (
        <CmsLocaleSourceReview
          state={form.review.state}
          pending={form.pending}
          onReload={
            form.review.required
              ? () => void form.review.read()
              : form.reloadSource
          }
          onAdopt={form.adopt}
        />
      ) : null}
      {props.unavailableFields.length > 0 ? (
        <p>
          These localizable fields cannot be translated on this page yet:{' '}
          {props.unavailableFields.join(', ')}.
        </p>
      ) : null}
      {fields.length === 0 ? (
        <p>
          This entry’s content type has no field that can be translated on this
          page.
        </p>
      ) : (
        <fieldset className="cms-locale-fields">
          <legend>Localizable fields</legend>
          {fields.map((field) => {
            const fieldId = field.descriptor.fieldId;
            return (
              <CmsLocaleFieldRow
                key={fieldId}
                field={field}
                sourceLocale={entry.sourceLocale}
                sourceText={form.texts[fieldId] ?? null}
                value={form.values[fieldId] ?? null}
                issues={form.issuesFor(fieldId)}
                resolution={resolutionOf(fieldId)}
                saved={form.savedIds.includes(fieldId)}
                reportedStale={form.staleIds.includes(fieldId)}
                onChange={(value) => form.change(fieldId, value)}
                onInputError={(message) => form.inputError(fieldId, message)}
              />
            );
          })}
        </fieldset>
      )}
      {fields.length === 0 ? null : (
        <div className="cms-locale-submit">
          <button type="submit" disabled={form.pending || form.blocked}>
            {form.pending ? 'Saving…' : 'Save translation'}
          </button>
          {form.anyStale ? (
            <button
              type="button"
              disabled={form.pending || form.blocked}
              onClick={() => void form.save()}
            >
              Revalidate translation
            </button>
          ) : null}
          {csrfToken.length === 0 ? (
            <p className="cms-locale-error">
              Saving is unavailable because this page has no security token.
              Reload the page.
            </p>
          ) : null}
          {form.rateWaiting ? (
            <p role="status">Waiting before you can save again.</p>
          ) : null}
        </div>
      )}
    </form>
  );
}
