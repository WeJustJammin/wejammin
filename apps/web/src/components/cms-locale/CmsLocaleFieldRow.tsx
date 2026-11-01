import type { JsonValue } from '@wejammin/contracts';
import * as React from 'react';

import CmsFieldEditor from '../cms-editorial-fields/CmsFieldEditor';
import type { CmsFieldIssue } from '../cms-editorial-fields/cms-field-issue';
import { NO_FALLBACK_SOURCE_NOTE } from './locale-variant-copy';
import { fieldRuleText, resolutionText } from './locale-resolution-text';
import type { LocaleFieldInit, LocaleResolution } from './locale-variant-types';

interface Props {
  readonly field: LocaleFieldInit;
  readonly sourceLocale: string;
  /** The source text to translate; null for a no_fallback field or an empty source. */
  readonly sourceText: string | null;
  readonly value: JsonValue | null;
  readonly issues: readonly CmsFieldIssue[];
  readonly resolution: LocaleResolution | null;
  readonly saved: boolean;
  readonly reportedStale: boolean;
  readonly onChange: (value: JsonValue | null) => void;
  readonly onInputError: (message: string | null) => void;
}

/**
 * One localizable field: the typed control of the draft editor, the source text beside it (fallback-permitted
 * fields only), its standing rule and its resolution as text. A translation is optional per field, so the
 * control is never "(required)".
 */
export default function CmsLocaleFieldRow(props: Props): React.ReactElement {
  const { field } = props;
  const descriptor = { ...field.descriptor, required: false };
  const status = resolutionText(props.resolution, props.reportedStale);
  return (
    <div
      className="cms-locale-field"
      role="group"
      aria-label={`${field.descriptor.label} translation`}
    >
      {field.mode === 'no_fallback' ? (
        <p className="cms-locale-source">{NO_FALLBACK_SOURCE_NOTE}</p>
      ) : props.sourceText !== null ? (
        <p className="cms-locale-source">
          <span className="cms-locale-source-label">
            Source text ({props.sourceLocale})
          </span>{' '}
          <span lang={props.sourceLocale}>{props.sourceText}</span>
        </p>
      ) : null}
      <CmsFieldEditor
        descriptor={descriptor}
        value={props.value}
        issues={props.issues}
        onChange={props.onChange}
        onInputError={props.onInputError}
      />
      <p className="cms-locale-rule">{fieldRuleText(field.mode)}</p>
      {status === null ? null : (
        <p className="cms-locale-resolution">{status}</p>
      )}
      {props.saved ? (
        <p className="cms-locale-saved">Saved in this draft.</p>
      ) : null}
    </div>
  );
}
