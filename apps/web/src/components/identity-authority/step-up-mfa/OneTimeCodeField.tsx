import * as React from 'react';

import { ONE_TIME_CODE_MAX_LENGTH } from './one-time-code';

export interface OneTimeCodeFieldProps {
  children?: never;
  name: 'code';
  label: string;
  /** Id of the help paragraph this field renders and references. */
  describedBy: string;
  help: string;
  /** Id of the error paragraph; null when there is no error to show. */
  errorId: string | null;
  errorMessage: string | null;
  readOnly: boolean;
  value: string;
  onChange: (value: string) => void;
  inputRef?: React.Ref<HTMLInputElement>;
}

/**
 * One text input for a six-digit authenticator code: numeric keypad hint,
 * one-time-code autofill, paste allowed, and no pattern attribute so a pasted
 * "123 456" is not rejected natively. Spaces and hyphens are removed before
 * the six-digit check by the caller.
 */
export function OneTimeCodeField({
  name,
  label,
  describedBy,
  help,
  errorId,
  errorMessage,
  readOnly,
  value,
  onChange,
  inputRef,
}: OneTimeCodeFieldProps): React.ReactElement {
  const inputId = `${describedBy}-input`;
  const invalid = errorId !== null && errorMessage !== null;
  return (
    <div className="infra-field">
      <label htmlFor={inputId}>{label}</label>
      <input
        ref={inputRef}
        id={inputId}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={ONE_TIME_CODE_MAX_LENGTH}
        spellCheck={false}
        autoCapitalize="none"
        enterKeyHint="done"
        readOnly={readOnly}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        aria-describedby={invalid ? `${describedBy} ${errorId}` : describedBy}
        {...(invalid ? { 'aria-invalid': true } : {})}
      />
      <p id={describedBy} className="infra-help">
        {help}
      </p>
      {invalid && (
        <p id={errorId} role="alert" className="infra-error-text">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
