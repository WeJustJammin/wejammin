import * as React from 'react';

import { ReasonField } from './CmsCapabilityGrantFields';
import { capabilityLabel } from './cms-capability-grant-labels';
import { CMS_CAPABILITY_GRANT_CONSOLE_PATH } from './cms-capability-grant-url';
import {
  validateRevocationFields,
  type GrantFieldErrors,
} from './cms-capability-grant-validation';
import type { CmsCapabilityGrantResource } from './cms-capability-grant-types';

export interface CmsCapabilityGrantRevokeConfirmationProps {
  readonly grant: CmsCapabilityGrantResource;
  readonly csrfToken: string;
  readonly idempotencyKey: string;
  readonly disabled: boolean;
  readonly disabledReasonId?: string | undefined;
  readonly pending: boolean;
  readonly serverErrors: GrantFieldErrors;
  readonly onSubmit: (form: HTMLFormElement) => void;
  /** Escape or Cancel: nothing was committed. */
  readonly onCancel: () => void;
}

/**
 * CMS-03A-17: an inline confirmation naming the immediate, irreversible-
 * without-regrant consequence. Commit is enabled only after acknowledgement;
 * Escape cancels before any commit.
 */
export default function CmsCapabilityGrantRevokeConfirmation(
  props: CmsCapabilityGrantRevokeConfirmationProps,
): React.ReactElement {
  const { grant } = props;
  const [reason, setReason] = React.useState('');
  const [confirmed, setConfirmed] = React.useState(false);
  const [errors, setErrors] = React.useState<GrantFieldErrors>({});
  const heading = React.useRef<HTMLHeadingElement | null>(null);
  React.useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  const label = capabilityLabel(grant.capability);
  const shown: GrantFieldErrors = { ...props.serverErrors, ...errors };
  const onSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    if (props.disabled || props.pending || !confirmed) return;
    const found = validateRevocationFields({ reason });
    setErrors(found);
    if (found.reason !== undefined) return;
    props.onSubmit(event.currentTarget);
  };
  return (
    <form
      className="content-schema-registry-command-form"
      data-cms-command-form="true"
      data-operation-id="CMS-03A-17"
      data-revoke-confirmation="true"
      method="post"
      action={CMS_CAPABILITY_GRANT_CONSOLE_PATH}
      noValidate
      onSubmit={onSubmit}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        props.onCancel();
      }}
    >
      <input type="hidden" name="operationId" value="CMS-03A-17" />
      <input type="hidden" name="csrf" value={props.csrfToken} />
      <input
        type="hidden"
        name="idempotency-key"
        value={props.idempotencyKey}
      />
      <input type="hidden" name="grantId" value={grant.id} />
      <input type="hidden" name="expectedVersion" value={grant.version} />
      <input type="hidden" name="if-match" value={`"${grant.version}"`} />
      <h3 ref={heading} tabIndex={-1}>
        Confirm revoke
      </h3>
      <p>
        Revoke {label} now. It takes effect immediately and cannot be undone;
        grant it again to restore it.
      </p>
      <p className="content-schema-registry-help">
        Escape cancels before commit.
      </p>
      <fieldset disabled={props.disabled || props.pending}>
        <ReasonField
          id={`cms-revoke-${grant.id}-reason`}
          value={reason}
          error={shown.reason}
          onChange={setReason}
        />
        <label htmlFor={`cms-revoke-${grant.id}-confirmed`}>
          <input
            id={`cms-revoke-${grant.id}-confirmed`}
            type="checkbox"
            name="confirmed"
            value="true"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />{' '}
          I understand this revokes access immediately.
        </label>
      </fieldset>
      <div className="content-schema-registry-actions">
        <button
          type="submit"
          disabled={props.disabled || props.pending || !confirmed}
          aria-describedby={props.disabled ? props.disabledReasonId : undefined}
          aria-busy={props.pending ? 'true' : undefined}
        >
          {props.pending ? 'Revoking' : 'Revoke grant'}
        </button>
        <button
          type="button"
          className="secondary-action"
          disabled={props.pending}
          onClick={props.onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
