import type { JsonValue } from '@wejammin/contracts';
import * as React from 'react';

import CmsFieldEditor, {
  type CmsFieldEditorProps,
} from '../cms-editorial-fields/CmsFieldEditor';
import type { CmsFieldDescriptor } from '../cms-editorial-fields/cms-field-descriptor';
import type { CmsFieldIssue } from '../cms-editorial-fields/cms-field-issue';

/**
 * The draft editor's field map: one `CmsFieldEditor` per descriptor, each given
 * the draft host's taxonomy context (the server-derived type key and locale, the
 * island's fetcher and the refusal-driven refresh token) so a taxonomy field can
 * address its own CMS-03C-17 selector. Only the field map moved out of the island,
 * which keeps its file within the component cap; the rendering is unchanged.
 */
export interface CmsEditorialEntryFieldsProps {
  readonly descriptors: readonly CmsFieldDescriptor[];
  readonly values: Readonly<Record<string, JsonValue | null>>;
  readonly fieldRevisions: Readonly<Record<string, number>>;
  readonly readOnlyNotices: Readonly<Record<string, string>>;
  /** Whether the form is non-editable; the fieldset owns the disabled state. */
  readonly disabled: boolean;
  readonly taxonomyContext: CmsFieldEditorProps['taxonomyContext'];
  readonly issuesFor: (fieldId: string) => readonly CmsFieldIssue[];
  readonly onChange: (fieldId: string, value: JsonValue | null) => void;
  readonly onInputError: (fieldId: string, message: string | null) => void;
}

export default function CmsEditorialEntryFields(
  props: CmsEditorialEntryFieldsProps,
): React.ReactElement {
  return (
    <fieldset disabled={props.disabled} className="cms-editorial-fields">
      <legend>Draft fields</legend>
      {props.descriptors.map((descriptor) => (
        <CmsFieldEditor
          key={`${descriptor.fieldId}-${props.fieldRevisions[descriptor.fieldId] ?? 0}`}
          descriptor={descriptor}
          value={props.values[descriptor.fieldId] ?? null}
          issues={props.issuesFor(descriptor.fieldId)}
          readOnlyNotice={props.readOnlyNotices[descriptor.fieldId]}
          taxonomyContext={props.taxonomyContext}
          onChange={(value) => props.onChange(descriptor.fieldId, value)}
          onInputError={(message) =>
            props.onInputError(descriptor.fieldId, message)
          }
        />
      ))}
    </fieldset>
  );
}
