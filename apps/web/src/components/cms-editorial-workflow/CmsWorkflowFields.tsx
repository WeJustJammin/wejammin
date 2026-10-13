import * as React from 'react';

/**
 * The native controls of the Slice 11 command forms: a persistent visible label,
 * an optional hint and error tied to the control by `aria-describedby`, and
 * `aria-invalid` from either a local message or a server refusal naming the
 * control. Nothing here depends on colour; the error is a sentence.
 */
interface FieldBase {
  readonly id: string;
  readonly label: string;
  readonly hint?: string | undefined;
  /** A local validation sentence shown beside the control. */
  readonly error?: string | null | undefined;
  /** The control is named by a server refusal (the alert carries the sentence). */
  readonly invalid?: boolean | undefined;
}

const describedBy = (
  id: string,
  hint: string | undefined,
  error: string | null | undefined,
  extra: readonly string[] = [],
): string | undefined => {
  const ids = [
    ...(hint === undefined ? [] : [`${id}-hint`]),
    ...(error === undefined || error === null ? [] : [`${id}-error`]),
    ...extra,
  ];
  return ids.length === 0 ? undefined : ids.join(' ');
};

const Notes = ({
  id,
  hint,
  error,
}: Pick<FieldBase, 'id' | 'hint' | 'error'>): React.ReactElement => (
  <>
    {hint === undefined ? null : <p id={`${id}-hint`}>{hint}</p>}
    {error === undefined || error === null ? null : (
      <p id={`${id}-error`} className="cms-field-errors">
        {error}
      </p>
    )}
  </>
);

const invalidOf = (field: FieldBase): true | undefined =>
  field.invalid === true || (field.error !== undefined && field.error !== null)
    ? true
    : undefined;

export interface WorkflowTextFieldProps extends FieldBase {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly type?: 'text' | 'datetime-local';
  readonly autoComplete?: string;
  /** Names a `<datalist>` of suggestions rendered beside the control. */
  readonly listId?: string;
  readonly suggestions?: readonly string[];
}

export const WorkflowTextField = (
  field: WorkflowTextFieldProps,
): React.ReactElement => (
  <div>
    <label htmlFor={field.id}>{field.label}</label>
    <input
      id={field.id}
      name={field.id}
      type={field.type ?? 'text'}
      value={field.value}
      spellCheck={false}
      {...(field.autoComplete === undefined
        ? {}
        : { autoComplete: field.autoComplete })}
      {...(field.listId === undefined ? {} : { list: field.listId })}
      aria-invalid={invalidOf(field)}
      aria-describedby={describedBy(field.id, field.hint, field.error)}
      onChange={(event) => field.onChange(event.target.value)}
    />
    {field.listId === undefined ? null : (
      <datalist id={field.listId}>
        {(field.suggestions ?? []).map((suggestion) => (
          <option key={suggestion} value={suggestion} />
        ))}
      </datalist>
    )}
    <Notes id={field.id} hint={field.hint} error={field.error} />
  </div>
);

export interface WorkflowTextAreaProps extends FieldBase {
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** Unicode characters used of the maximum, announced with the field. */
  readonly counter?: { readonly used: number; readonly max: number };
}

export const WorkflowTextArea = (
  field: WorkflowTextAreaProps,
): React.ReactElement => (
  <div>
    <label htmlFor={field.id}>{field.label}</label>
    <textarea
      id={field.id}
      name={field.id}
      value={field.value}
      aria-invalid={invalidOf(field)}
      aria-describedby={describedBy(
        field.id,
        field.hint,
        field.error,
        field.counter === undefined ? [] : [`${field.id}-counter`],
      )}
      onChange={(event) => field.onChange(event.target.value)}
    />
    {field.counter === undefined ? null : (
      <p id={`${field.id}-counter`}>
        {field.counter.used} of {field.counter.max} characters
      </p>
    )}
    <Notes id={field.id} hint={field.hint} error={field.error} />
  </div>
);

export interface WorkflowOption {
  readonly value: string;
  readonly label: string;
}

export interface WorkflowSelectProps extends FieldBase {
  readonly value: string;
  readonly options: readonly WorkflowOption[];
  readonly onChange: (value: string) => void;
}

export const WorkflowSelect = (
  field: WorkflowSelectProps,
): React.ReactElement => (
  <div>
    <label htmlFor={field.id}>{field.label}</label>
    <select
      id={field.id}
      name={field.id}
      value={field.value}
      aria-invalid={invalidOf(field)}
      aria-describedby={describedBy(field.id, field.hint, field.error)}
      onChange={(event) => field.onChange(event.target.value)}
    >
      {field.options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
    <Notes id={field.id} hint={field.hint} error={field.error} />
  </div>
);

export interface WorkflowRadioGroupProps {
  readonly id: string;
  readonly legend: string;
  readonly name: string;
  readonly value: string;
  readonly options: readonly WorkflowOption[];
  readonly onChange: (value: string) => void;
  readonly error?: string | null | undefined;
}

export const WorkflowRadioGroup = (
  group: WorkflowRadioGroupProps,
): React.ReactElement => (
  <fieldset
    id={group.id}
    aria-describedby={describedBy(group.id, undefined, group.error)}
  >
    <legend>{group.legend}</legend>
    {group.options.map((option) => (
      <label key={option.value}>
        <input
          id={`${group.id}-${option.value}`}
          type="radio"
          name={group.name}
          value={option.value}
          checked={group.value === option.value}
          onChange={() => group.onChange(option.value)}
        />
        {option.label}
      </label>
    ))}
    <Notes id={group.id} hint={undefined} error={group.error} />
  </fieldset>
);
