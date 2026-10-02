import * as React from 'react';

import {
  ADMIN_RESET_COPY,
  REASON_MAX_LENGTH,
  type ResetFieldErrors,
  type ResetValues,
} from './admin-mfa-reset-values';

export const PERSON_ID = 'admin-mfa-reset-person';
export const REASON_ID = 'admin-mfa-reset-reason';

export interface AdminMfaResetFieldsProps {
  children?: never;
  values: ResetValues;
  errors: ResetFieldErrors;
  readOnly: boolean;
  personRef: React.Ref<HTMLInputElement>;
  reasonRef: React.Ref<HTMLTextAreaElement>;
  onChange: (field: 'reason' | 'targetPersonId', value: string) => void;
  onBlurPerson: () => void;
}

/** The two native fields of the FE05 reset form, each with a persistent label. */
export function AdminMfaResetFields({
  values,
  errors,
  readOnly,
  personRef,
  reasonRef,
  onChange,
  onBlurPerson,
}: AdminMfaResetFieldsProps): React.ReactElement {
  const personError = errors.targetPersonId;
  const reasonError = errors.reason;
  return (
    <>
      <div className="infra-field">
        <label htmlFor={PERSON_ID}>Person ID</label>
        <p id={`${PERSON_ID}-help`} className="infra-help">
          {ADMIN_RESET_COPY.personHelp}
        </p>
        <input
          ref={personRef}
          id={PERSON_ID}
          name="targetPersonId"
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          readOnly={readOnly}
          value={values.targetPersonId}
          aria-invalid={personError === undefined ? undefined : true}
          aria-describedby={
            personError === undefined
              ? `${PERSON_ID}-help`
              : `${PERSON_ID}-help ${PERSON_ID}-error`
          }
          onChange={(event) =>
            onChange('targetPersonId', event.currentTarget.value)
          }
          onBlur={onBlurPerson}
        />
        {personError !== undefined && (
          <p id={`${PERSON_ID}-error`} className="infra-error">
            {personError}
          </p>
        )}
      </div>
      <div className="infra-field">
        <label htmlFor={REASON_ID}>Reason</label>
        <textarea
          ref={reasonRef}
          id={REASON_ID}
          name="reason"
          rows={4}
          readOnly={readOnly}
          value={values.reason}
          aria-invalid={reasonError === undefined ? undefined : true}
          aria-describedby={
            reasonError === undefined
              ? `${REASON_ID}-count`
              : `${REASON_ID}-error ${REASON_ID}-count`
          }
          onChange={(event) => onChange('reason', event.currentTarget.value)}
        />
        {reasonError !== undefined && (
          <p id={`${REASON_ID}-error`} className="infra-error">
            {reasonError}
          </p>
        )}
        <p id={`${REASON_ID}-count`} className="infra-help">
          {`${values.reason.length} / ${REASON_MAX_LENGTH}`}
        </p>
      </div>
    </>
  );
}
