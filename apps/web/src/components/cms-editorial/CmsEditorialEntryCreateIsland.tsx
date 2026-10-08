import * as React from 'react';

import CmsFieldEditor from '../cms-editorial-fields/CmsFieldEditor';
import CmsFieldErrorSummary from '../cms-editorial-fields/CmsFieldErrorSummary';
import CmsEditorialStatus from './CmsEditorialStatus';
import {
  useCmsEditorialEntryCreate,
  type CmsEditorialEntryCreateOptions,
} from './use-cms-editorial-entry-create';

const RELATION_AT_CREATE = 'Links can be added after the entry is created.';

const signInHref = (): string =>
  `/auth/sign-in?returnTo=${encodeURIComponent(
    `${window.location.pathname}${window.location.search}`,
  )}`;

/**
 * The CMS-03B-10 create form as one bounded island. The author types values in
 * native controls typed by the compiled schema; the frozen evidence from the
 * authoring-context projection is echoed back unmodified by the submitter and
 * never rendered as an input. Local validation runs before any request and a
 * linked error summary takes focus; a refusal or a lost response keeps every
 * typed value, and an unknown outcome locks the form and replays the identical
 * request under the same key so it can never create a duplicate.
 */
export default function CmsEditorialEntryCreateIsland(
  options: CmsEditorialEntryCreateOptions,
): React.ReactElement {
  const form = useCmsEditorialEntryCreate(options);
  const summaryRef = React.useRef<HTMLDivElement>(null);
  const submitRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (form.summaryToken > 0) summaryRef.current?.focus();
  }, [form.summaryToken]);
  React.useEffect(() => {
    // An unknown outcome locks the fields; focus that was on one of them would
    // drop to <body>, so it moves to the control that retries the same request.
    if (form.locked) submitRef.current?.focus();
  }, [form.locked]);
  return (
    <form
      noValidate
      data-cms-editorial-entry-create=""
      aria-busy={form.submitting}
      onSubmit={(event) => {
        event.preventDefault();
        void form.submit();
      }}
    >
      <CmsEditorialStatus
        regionId="cms-editorial-create-status"
        message={form.statusMessage}
      />
      {form.unauthenticated ? (
        <p>
          <a href={signInHref()}>Sign in again</a> to create this entry. Your
          values stay in this form.
        </p>
      ) : null}
      {form.summaryItems.length > 0 ? (
        <CmsFieldErrorSummary
          ref={summaryRef}
          id="cms-editorial-create-summary"
          heading="Check these fields before creating the entry"
          items={form.summaryItems}
        />
      ) : null}
      <div>
        <label htmlFor="entry-locale">Locale</label>
        <select
          id="entry-locale"
          value={form.locale}
          disabled={form.locked}
          onChange={(event) => form.setLocale(event.currentTarget.value)}
        >
          {options.type.supportedLocales.map((locale) => (
            <option key={locale} value={locale}>
              {locale}
            </option>
          ))}
        </select>
      </div>
      <fieldset disabled={form.locked} className="cms-editorial-fields">
        <legend>Fields</legend>
        {form.descriptors.map((descriptor) => (
          <CmsFieldEditor
            key={descriptor.fieldId}
            descriptor={descriptor}
            value={form.values[descriptor.fieldId] ?? null}
            issues={form.issuesFor(descriptor.fieldId)}
            readOnlyNotice={
              descriptor.kind === 'relation' ? RELATION_AT_CREATE : undefined
            }
            onChange={(value) => form.setValue(descriptor.fieldId, value)}
            onInputError={(message) =>
              form.setInputError(descriptor.fieldId, message)
            }
            onBlur={() => form.touch(descriptor.fieldId)}
          />
        ))}
      </fieldset>
      {/*
        Never disabled while the create is in flight: disabling the focused
        button makes the browser drop focus to <body>. The state machine refuses
        a second submit while one is in flight, so a repeated activation sends
        nothing. One button, so focus survives the switch to "Retry create".
      */}
      <button
        ref={submitRef}
        type="submit"
        aria-busy={form.submitting ? true : undefined}
      >
        {form.locked ? 'Retry create' : 'Create entry'}
      </button>
    </form>
  );
}
