import * as React from 'react';

import {
  bodyFor,
  newIdempotencyKey,
  readCommandResult,
  type ProfileOwnershipOperation,
} from './profile-ownership-command-transport';
import { navigateToStepUp } from '../step-up-required';

export type { ProfileOwnershipOperation } from './profile-ownership-command-transport';

export type CommandFormProps = Readonly<{
  operation: ProfileOwnershipOperation;
  action: string;
  label: string;
  expectedVersion: string;
  csrfToken: string;
  disabled?: boolean;
  anonymous?: boolean;
  children: React.ReactNode;
  onStatus: (message: string) => void;
  onSuccess?: (operation: ProfileOwnershipOperation, payload: unknown) => void;
}>;

export const CommandForm = ({
  operation,
  action,
  label,
  expectedVersion,
  csrfToken,
  disabled = false,
  anonymous = false,
  children,
  onStatus,
  onSuccess,
}: CommandFormProps): React.ReactElement => {
  const submit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    const form = event.currentTarget;
    const endpoint = form.getAttribute('action');
    if (endpoint === null || endpoint.length === 0) {
      onStatus('The command endpoint is unavailable.');
      return;
    }
    onStatus('Submitting request…');
    const headers = new Headers({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Idempotency-Key': newIdempotencyKey(operation),
    });
    if (!anonymous) {
      headers.set('X-CSRF-Token', csrfToken);
      headers.set('If-Match', expectedVersion);
    }
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: anonymous ? 'omit' : 'same-origin',
        headers,
        body: JSON.stringify(bodyFor(operation, form)),
      });
      const outcome = await readCommandResult(response, operation);
      onStatus(outcome.message);
      if (outcome.stepUp === true) navigateToStepUp();
      if (outcome.payload !== undefined)
        onSuccess?.(operation, outcome.payload);
    } catch {
      onStatus(
        'The service is temporarily unavailable. Retry or review the request.',
      );
    }
  };

  return (
    <form
      method="post"
      action={action}
      data-operation={operation}
      data-json-body="true"
      data-csrf={anonymous ? 'not-required' : 'required'}
      data-idempotency="required"
      data-if-match={anonymous ? 'not-required' : 'required'}
      data-authentication={anonymous ? 'anonymous' : 'session'}
      onSubmit={submit}
    >
      {children}
      <button type="submit" disabled={disabled}>
        {label}
      </button>
    </form>
  );
};

export const TextField = ({
  id,
  name,
  label,
  value,
  required = true,
  inputMode,
  maxLength,
  invalid = false,
  describedBy,
}: Readonly<{
  id: string;
  name: string;
  label: string;
  value?: string;
  required?: boolean;
  inputMode?: 'numeric' | 'text';
  maxLength?: number;
  invalid?: boolean;
  describedBy?: string;
}>): React.ReactElement => (
  <label htmlFor={id}>
    {label}
    <input
      id={id}
      name={name}
      defaultValue={value}
      required={required}
      inputMode={inputMode}
      maxLength={maxLength}
      aria-invalid={invalid ? 'true' : undefined}
      aria-describedby={describedBy}
    />
  </label>
);
