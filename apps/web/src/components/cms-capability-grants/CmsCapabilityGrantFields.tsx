import * as React from 'react';

import {
  CMS_CAPABILITY_GROUPS,
  capabilityOptionText,
} from './cms-capability-grant-labels';
import {
  GRANT_PERSON_HELPER,
  GRANT_TERM_HELPER,
  MAX_REASON_LENGTH,
} from './cms-capability-grant-validation';

interface FieldProps {
  readonly id: string;
  readonly label: string;
  readonly error: string | null | undefined;
  readonly help?: string;
  readonly children: (describedBy: string) => React.ReactNode;
}

/** Persistent label, help and error IDs wired through aria-describedby. */
export function Field({
  id,
  label,
  error,
  help,
  children,
}: FieldProps): React.ReactElement {
  const ids = [
    ...(help === undefined ? [] : [`${id}-help`]),
    ...(error ? [`${id}-error`] : []),
  ].join(' ');
  return (
    <div className="content-schema-registry-field">
      <label htmlFor={id}>{label}</label>
      {children(ids)}
      {help === undefined ? null : (
        <p id={`${id}-help`} className="content-schema-registry-help">
          {help}
        </p>
      )}
      {error ? (
        <p
          id={`${id}-error`}
          className="content-schema-registry-field-error"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface ControlProps {
  readonly id: string;
  readonly value: string;
  readonly error: string | null | undefined;
  readonly onChange: (value: string) => void;
  readonly onBlur?: () => void;
}

export function PersonField(props: ControlProps): React.ReactElement {
  return (
    <Field
      id={props.id}
      label="Person ID"
      error={props.error}
      help={GRANT_PERSON_HELPER}
    >
      {(describedBy) => (
        <input
          id={props.id}
          name="subjectPersonId"
          type="text"
          required
          autoComplete="off"
          spellCheck={false}
          className="cms-capability-grant-mono"
          value={props.value}
          aria-invalid={props.error ? 'true' : undefined}
          aria-describedby={describedBy}
          onChange={(event) => props.onChange(event.target.value)}
          onBlur={props.onBlur}
        />
      )}
    </Field>
  );
}

export function CapabilityField(props: ControlProps): React.ReactElement {
  return (
    <Field id={props.id} label="Capability" error={props.error}>
      {(describedBy) => (
        <select
          id={props.id}
          name="capability"
          required
          value={props.value}
          aria-invalid={props.error ? 'true' : undefined}
          aria-describedby={describedBy || undefined}
          onChange={(event) => props.onChange(event.target.value)}
          onBlur={props.onBlur}
        >
          <option value="">Choose a capability</option>
          {CMS_CAPABILITY_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.capabilities.map((capability) => (
                <option key={capability} value={capability}>
                  {capabilityOptionText(capability)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      )}
    </Field>
  );
}

export function TermField(
  props: ControlProps & {
    readonly minDate: string;
    readonly maxDate: string;
  },
): React.ReactElement {
  return (
    <Field
      id={props.id}
      label="Valid through (UTC)"
      error={props.error}
      help={GRANT_TERM_HELPER}
    >
      {(describedBy) => (
        <input
          id={props.id}
          name="validThrough"
          type="date"
          required
          min={props.minDate}
          max={props.maxDate}
          value={props.value}
          aria-invalid={props.error ? 'true' : undefined}
          aria-describedby={describedBy}
          onChange={(event) => props.onChange(event.target.value)}
          onBlur={props.onBlur}
        />
      )}
    </Field>
  );
}

export function ReasonField(props: ControlProps): React.ReactElement {
  const remaining = MAX_REASON_LENGTH - props.value.length;
  return (
    <Field
      id={props.id}
      label="Reason (optional)"
      error={props.error}
      help={`${Math.max(remaining, 0)} characters remaining`}
    >
      {(describedBy) => (
        <textarea
          id={props.id}
          name="reason"
          rows={2}
          maxLength={MAX_REASON_LENGTH}
          value={props.value}
          aria-invalid={props.error ? 'true' : undefined}
          aria-describedby={describedBy}
          onChange={(event) => props.onChange(event.target.value)}
          onBlur={props.onBlur}
        />
      )}
    </Field>
  );
}
