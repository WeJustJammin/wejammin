/**
 * The native controls of the Slice 11 command forms: a persistent visible label,
 * an optional hint and error tied to the control by `aria-describedby`, and
 * `aria-invalid` from either a local message or a server refusal naming the
 * control. Nothing here depends on colour; the error is a sentence. A control
 * of a region that loads on intent starts its state from what the person entered before the
 * form hydrated (`cms-lazy-intent.ts`).
 */
import * as React from 'react';

import {
  Notes,
  describedBy,
  invalidOf,
  useSeedFromPreHydration,
  type FieldBase,
} from './cms-workflow-field-parts';

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
): React.ReactElement => {
  useSeedFromPreHydration(field.id, field.value, field.onChange);
  return (
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
};

export interface WorkflowTextAreaProps extends FieldBase {
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** Unicode characters used of the maximum, announced with the field. */
  readonly counter?: { readonly used: number; readonly max: number };
}

export const WorkflowTextArea = (
  field: WorkflowTextAreaProps,
): React.ReactElement => {
  useSeedFromPreHydration(field.id, field.value, field.onChange);
  return (
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
};

export interface WorkflowOption {
  readonly value: string;
  readonly label: string;
  /** A placeholder or a state sentence, not a choice. */
  readonly disabled?: boolean;
}

export interface WorkflowSelectProps extends FieldBase {
  /** The options are still being read: `aria-busy` on the control. */
  readonly busy?: boolean;
  readonly value: string;
  readonly options: readonly WorkflowOption[];
  readonly onChange: (value: string) => void;
}

export const WorkflowSelect = (
  field: WorkflowSelectProps,
): React.ReactElement => {
  useSeedFromPreHydration(field.id, field.value, field.onChange);
  return (
    <div>
      <label htmlFor={field.id}>{field.label}</label>
      <select
        id={field.id}
        name={field.id}
        value={field.value}
        aria-invalid={invalidOf(field)}
        aria-busy={field.busy === true ? true : undefined}
        aria-describedby={describedBy(field.id, field.hint, field.error)}
        onChange={(event) => field.onChange(event.target.value)}
      >
        {field.options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
      <Notes id={field.id} hint={field.hint} error={field.error} />
    </div>
  );
};

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
): React.ReactElement => {
  useSeedFromPreHydration(`radio:${group.name}`, group.value, group.onChange);
  return (
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
};
