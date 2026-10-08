import type { JsonValue } from '@wejammin/contracts';
import * as React from 'react';

import type {
  CmsScalarConstraints,
  CmsScalarKind,
} from './cms-field-descriptor';
import {
  cmsDatetimeToLocalInput,
  cmsLocalInputToDatetime,
} from './cms-field-value';

export interface CmsScalarControlProps {
  readonly id: string;
  readonly kind: CmsScalarKind;
  readonly constraints: CmsScalarConstraints;
  readonly value: JsonValue | null;
  readonly required: boolean;
  readonly invalid: boolean;
  /** Accessible name when no visible `<label for>` points at the control. */
  readonly label?: string | undefined;
  readonly labelledBy?: string | undefined;
  readonly describedBy?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly onChange: (value: JsonValue | null) => void;
  /** Raw control text that cannot become a value (a partial or bad entry). */
  readonly onInputError?: ((message: string | null) => void) | undefined;
  readonly onBlur?: (() => void) | undefined;
}

const NUMBER_PATTERN = /^-?(\d+\.?\d*|\.\d+)$/u;

const textFor = (kind: CmsScalarKind, value: JsonValue | null): string => {
  if (value === null) return '';
  if (kind === 'datetime')
    return typeof value === 'string' ? cmsDatetimeToLocalInput(value) : '';
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : '';
};

/**
 * One native scalar control. Free text and calendar controls keep their raw
 * text locally: text that cannot become a value (a half-typed number, a partial
 * date) is reported through `onInputError` and never emitted, so a bad
 * keystroke can neither erase the stored value nor be sent to the server.
 */
export default function CmsScalarControl(
  props: CmsScalarControlProps,
): React.ReactElement {
  const { id, kind, constraints, value, required, invalid } = props;
  const [text, setText] = React.useState(() => textFor(kind, value));
  const emitted = React.useRef<JsonValue | null>(value);

  React.useEffect(() => {
    // Only a change the parent made (not the author's own echo) resets the text.
    if (value === emitted.current) return;
    emitted.current = value;
    setText(textFor(kind, value));
  }, [kind, value]);

  const common = {
    id,
    'aria-label': props.label,
    'aria-labelledby': props.labelledBy,
    'aria-describedby': props.describedBy,
    'aria-required': required ? ('true' as const) : undefined,
    'aria-invalid': invalid ? ('true' as const) : undefined,
    disabled: props.disabled,
    onBlur: props.onBlur,
  };

  const emit = (next: JsonValue | null, error: string | null): void => {
    props.onInputError?.(error);
    if (error !== null) return;
    emitted.current = next;
    props.onChange(next);
  };

  if (kind === 'boolean')
    return (
      <input
        {...common}
        type="checkbox"
        checked={value === true}
        onChange={(event) => emit(event.currentTarget.checked, null)}
      />
    );

  if (kind === 'enum')
    return (
      <select
        {...common}
        value={typeof value === 'string' ? value : ''}
        onChange={(event) =>
          emit(
            event.currentTarget.value === '' ? null : event.currentTarget.value,
            null,
          )
        }
      >
        <option value="">Choose a value</option>
        {(constraints.enumValues ?? []).map((choice) => (
          <option key={choice} value={choice}>
            {choice}
          </option>
        ))}
      </select>
    );

  if (kind === 'long_text')
    return (
      <textarea
        {...common}
        rows={5}
        value={text}
        onChange={(event) => {
          setText(event.currentTarget.value);
          emit(
            event.currentTarget.value === '' ? null : event.currentTarget.value,
            null,
          );
        }}
      />
    );

  const onText = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const raw = event.currentTarget.value;
    setText(raw);
    const badInput = event.currentTarget.validity.badInput;
    if (kind === 'integer' || kind === 'decimal') {
      if (raw === '' && !badInput) return emit(null, null);
      if (badInput || !NUMBER_PATTERN.test(raw))
        return emit(null, 'Enter a number.');
      const parsed = Number(raw);
      if (kind === 'integer' && !Number.isSafeInteger(parsed))
        return emit(null, 'Enter a whole number.');
      return emit(parsed, null);
    }
    if (kind === 'date') {
      if (raw === '' && !badInput) return emit(null, null);
      return badInput ? emit(null, 'Enter a complete date.') : emit(raw, null);
    }
    if (kind === 'datetime') {
      if (raw === '' && !badInput) return emit(null, null);
      const instant = cmsLocalInputToDatetime(raw);
      return instant === null
        ? emit(null, 'Enter a complete date and time.')
        : emit(instant, null);
    }
    return emit(raw === '' ? null : raw, null);
  };

  // Numbers are text with a numeric keyboard hint, not type=number: browsers
  // disagree on what a half-typed "1." or "-" reports, and the control must
  // keep exactly what the author typed while only emitting a parsed value.
  const type =
    kind === 'date' ? 'date' : kind === 'datetime' ? 'datetime-local' : 'text';
  return (
    <input
      {...common}
      type={type}
      value={text}
      step={kind === 'datetime' ? 1 : undefined}
      inputMode={
        kind === 'integer'
          ? 'numeric'
          : kind === 'decimal'
            ? 'decimal'
            : undefined
      }
      onChange={onText}
    />
  );
}
