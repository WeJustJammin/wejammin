import * as React from 'react';

import { LOCALE_CONFIG_MESSAGES } from '@wejammin/contracts';

import { localeControlId } from './content-schema-registry-locale-config';
import type { LocaleDraftController } from './use-locale-config-draft';

const Select = ({
  controller,
  control,
  name,
  label,
  help,
  value,
  pending,
  onChange,
  message,
}: {
  readonly controller: LocaleDraftController;
  readonly control: 'source' | 'default';
  readonly name: string;
  readonly label: string;
  readonly help?: string;
  readonly value: string;
  readonly pending: boolean;
  readonly onChange: (tag: string) => void;
  readonly message: string | null;
}): React.ReactElement => {
  const id = localeControlId(controller.formId, { control });
  const describedBy = [
    ...(help === undefined ? [] : [`${id}-help`]),
    ...(message === null ? [] : [`${id}-error`]),
  ].join(' ');
  return (
    <div className="content-schema-registry-field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        name={name}
        required
        value={value}
        disabled={pending}
        aria-invalid={message === null ? undefined : 'true'}
        aria-describedby={describedBy === '' ? undefined : describedBy}
        onChange={(event) => onChange(event.target.value)}
        onBlur={controller.reveal}
      >
        <option value="">Select a language</option>
        {controller.draft.supportedLocales.map((tag) => (
          <option key={tag} value={tag}>
            {tag}
          </option>
        ))}
      </select>
      {help === undefined ? null : (
        <p id={`${id}-help`} className="content-schema-registry-help">
          {help}
        </p>
      )}
      {message === null ? null : (
        <p
          id={`${id}-error`}
          className="content-schema-registry-field-error"
          role="alert"
        >
          {message}
        </p>
      )}
    </div>
  );
};

const messageFor = (
  controller: LocaleDraftController,
  needle: string,
): string | null =>
  controller.issues.find(
    (issue) => issue.path[0] === 'supportedLocales' && issue.message === needle,
  )?.message ?? null;

/** FE03 "Source language" and "Default language": native selects over the tags. */
export default function ContentSchemaRegistryLocaleSelects({
  controller,
  pending,
}: {
  readonly controller: LocaleDraftController;
  readonly pending: boolean;
}): React.ReactElement {
  return (
    <>
      <Select
        controller={controller}
        control="source"
        name="sourceLocale"
        label="Source language"
        value={controller.draft.sourceLocale}
        pending={pending}
        onChange={controller.chooseSource}
        message={messageFor(controller, LOCALE_CONFIG_MESSAGES.missingSource)}
      />
      <Select
        controller={controller}
        control="default"
        name="defaultLocale"
        label="Default language"
        help="The language every fallback order ends at"
        value={controller.draft.defaultLocale}
        pending={pending}
        onChange={controller.chooseDefault}
        message={messageFor(controller, LOCALE_CONFIG_MESSAGES.missingDefault)}
      />
    </>
  );
}

/** CMS-03A-09 inherits both; they are shown, never edited or submitted. */
export const ContentSchemaRegistryLocaleInherited = ({
  sourceLocale,
  defaultLocale,
}: {
  readonly sourceLocale: string;
  readonly defaultLocale: string;
}): React.ReactElement => (
  <>
    <p>{`Source language: ${sourceLocale} (inherited, cannot change)`}</p>
    <p>{`Default language: ${defaultLocale} (inherited, cannot change)`}</p>
  </>
);
