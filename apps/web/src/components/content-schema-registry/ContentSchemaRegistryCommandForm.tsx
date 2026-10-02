import * as React from 'react';

import ContentSchemaRegistryActionBar from './ContentSchemaRegistryActionBar';
export {
  CheckboxField,
  JsonField,
  SelectField,
  TextField,
} from './ContentSchemaRegistryFormFields';
import type {
  ContentSchemaRegistryCommandState,
  ContentSchemaRegistryOperationId,
  ContentSchemaRegistryUiError,
} from './content-schema-registry-types';

export interface ContentSchemaRegistryCommandFormProps {
  readonly action: string;
  readonly csrfToken: string;
  readonly idempotencyKey: string;
  readonly ifMatch?: string | undefined;
  readonly expectedVersion?: string | undefined;
  readonly state?: ContentSchemaRegistryCommandState;
  readonly error?: ContentSchemaRegistryUiError | undefined;
  readonly operationId: ContentSchemaRegistryOperationId;
  readonly formId: string;
  readonly children: React.ReactNode;
  readonly consequence: string;
  readonly instanceKey?: string | undefined;
  readonly onSubmit?: React.ComponentProps<'form'>['onSubmit'];
}

const safeErrorMessage = (error: ContentSchemaRegistryUiError): string => {
  if (error.code === 'VALIDATION_FAILED')
    return 'Check the highlighted fields.';
  if (error.code === 'INVALID_REQUEST') {
    return 'This request could not be read. Review the form and try again.';
  }
  return error.code === 'RATE_LIMITED'
    ? 'Too many requests. Try again shortly.'
    : 'The schema change could not be completed.';
};

export const ContentSchemaRegistryTransportFields = ({
  csrfToken,
  idempotencyKey,
  ifMatch,
}: Pick<
  ContentSchemaRegistryCommandFormProps,
  'csrfToken' | 'idempotencyKey' | 'ifMatch'
>): React.ReactElement => {
  const keyField = React.useRef<HTMLInputElement>(null);
  // After a step-up detour the draft restore pins the ORIGINAL key on this
  // field (`data-pinned-key`). A hidden input's `value` is its content
  // attribute and React rewrites it from props on every commit (for example the
  // canonical refetch a step-up success triggers), so re-apply the pin after
  // each commit and the resubmission keeps the original Idempotency-Key.
  React.useLayoutEffect(() => {
    const field = keyField.current;
    const pinned = field?.dataset.pinnedKey;
    if (field !== null && pinned !== undefined && field.value !== pinned)
      field.value = pinned;
  });
  return (
    <>
      <input type="hidden" name="csrf" value={csrfToken} />
      <input
        ref={keyField}
        type="hidden"
        name="idempotency-key"
        value={idempotencyKey}
      />
      {ifMatch === undefined ? null : (
        <input type="hidden" name="if-match" value={ifMatch} />
      )}
    </>
  );
};

export default function ContentSchemaRegistryCommandForm({
  action,
  csrfToken,
  idempotencyKey,
  ifMatch,
  expectedVersion,
  state = 'idle',
  error,
  operationId,
  formId,
  children,
  consequence,
  instanceKey,
  onSubmit,
}: ContentSchemaRegistryCommandFormProps): React.ReactElement {
  return (
    <form
      id={formId}
      className="content-schema-registry-command-form"
      data-cms-command-form="true"
      data-operation-id={operationId}
      data-retry-delays="250,750"
      data-status-reconciliation="same-idempotency-key"
      method="post"
      action={action}
      onSubmit={onSubmit}
    >
      <input type="hidden" name="operationId" value={operationId} />
      <ContentSchemaRegistryTransportFields
        csrfToken={csrfToken}
        idempotencyKey={idempotencyKey}
        {...(ifMatch === undefined ? {} : { ifMatch })}
      />
      {error === undefined ? null : (
        <section
          className="content-schema-registry-command-error"
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
        >
          <h3>Schema change needs attention</h3>
          <p>{safeErrorMessage(error)}</p>
        </section>
      )}
      <fieldset disabled={state === 'pending'}>{children}</fieldset>
      <ContentSchemaRegistryActionBar
        formId={formId}
        operationId={operationId}
        expectedVersion={expectedVersion ?? null}
        state={state}
        consequence={consequence}
        {...(instanceKey === undefined ? {} : { instanceKey })}
      />
    </form>
  );
}
