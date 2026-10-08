import type { JsonValue } from '@wejammin/contracts';
import * as React from 'react';

import CmsRichTextEditor from '../cms-rich-text/CmsRichTextEditor';
import CmsFieldFrame from './CmsFieldFrame';
import CmsListEditor from './CmsListEditor';
import CmsObjectEditor from './CmsObjectEditor';
import CmsRelationEditor from './CmsRelationEditor';
import CmsScalarControl from './CmsScalarControl';
import CmsUnavailableField from './CmsUnavailableField';
import {
  describeCmsConstraints,
  isCmsUnavailableDescriptor,
  type CmsFieldDescriptor,
} from './cms-field-descriptor';
import type { CmsFieldIssue } from './cms-field-issue';
import { CMS_EMPTY_RICH_TEXT } from './cms-field-value';

export interface CmsFieldEditorProps {
  readonly descriptor: CmsFieldDescriptor;
  readonly value: JsonValue | null;
  /** The issues to show, already gated by the host (touched / submitted). */
  readonly issues: readonly CmsFieldIssue[];
  readonly disabled?: boolean | undefined;
  /** When set, the field shows this typed unavailable notice, no controls. */
  readonly readOnlyNotice?: string | undefined;
  readonly onChange: (value: JsonValue | null) => void;
  /** Raw control text that cannot become a value; null clears the error. */
  readonly onInputError?: ((message: string | null) => void) | undefined;
  readonly onBlur?: (() => void) | undefined;
}

const wholeFieldIssues = (
  issues: readonly CmsFieldIssue[],
): readonly CmsFieldIssue[] =>
  issues.filter(
    (issue) => issue.index === undefined && issue.propertyKey === undefined,
  );

/**
 * The one editor every authoring surface uses for a field: it picks the native
 * control for the field's kind (never a raw JSON box) and frames it with a
 * persistent label, the declared constraints as a description, and its errors.
 */
export default function CmsFieldEditor(
  props: CmsFieldEditorProps,
): React.ReactElement {
  const { descriptor, value, issues, onChange } = props;
  if (props.readOnlyNotice !== undefined)
    return (
      <CmsUnavailableField
        descriptor={descriptor}
        notice={props.readOnlyNotice}
      />
    );
  if (isCmsUnavailableDescriptor(descriptor))
    return <CmsUnavailableField descriptor={descriptor} notice={undefined} />;
  const shared = {
    disabled: props.disabled,
    onBlur: props.onBlur,
    onChange,
    value,
    issues,
  };
  if (descriptor.kind === 'list')
    return (
      <CmsListEditor
        descriptor={descriptor}
        onInputError={props.onInputError}
        {...shared}
      />
    );
  if (descriptor.kind === 'object')
    return (
      <CmsObjectEditor
        descriptor={descriptor}
        onInputError={props.onInputError}
        {...shared}
      />
    );
  if (descriptor.kind === 'relation')
    return <CmsRelationEditor descriptor={descriptor} {...shared} />;
  if (descriptor.kind === 'rich_text')
    return (
      <CmsFieldFrame
        field={descriptor}
        mode="embedded"
        hint={describeCmsConstraints(descriptor.constraints, {
          required: descriptor.required,
          includeRequired: false,
        })}
        issues={wholeFieldIssues(issues)}
      >
        {({ labelText }) => (
          <CmsRichTextEditor
            value={value ?? CMS_EMPTY_RICH_TEXT}
            label={labelText}
            onChange={(next) => onChange(next as JsonValue)}
          />
        )}
      </CmsFieldFrame>
    );
  return (
    <CmsFieldFrame
      field={descriptor}
      mode={descriptor.kind === 'boolean' ? 'checkbox' : 'label'}
      hint={describeCmsConstraints(descriptor.constraints, {
        required: descriptor.required,
        includeRequired: false,
      })}
      issues={wholeFieldIssues(issues)}
    >
      {({ controlId, describedBy, invalid }) => (
        <CmsScalarControl
          id={controlId}
          kind={descriptor.kind}
          constraints={descriptor.constraints}
          value={value}
          required={descriptor.required}
          invalid={invalid}
          describedBy={describedBy}
          disabled={props.disabled}
          onBlur={props.onBlur}
          onInputError={props.onInputError}
          onChange={onChange}
        />
      )}
    </CmsFieldFrame>
  );
}
