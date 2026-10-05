import * as React from 'react';

import { ReasonField, TermField } from './CmsCapabilityGrantFields';
import { capabilityLabel } from './cms-capability-grant-labels';
import { CMS_CAPABILITY_GRANT_CONSOLE_PATH } from './cms-capability-grant-url';
import {
  validateRenewalFields,
  type CmsCapabilityGrantTermBounds,
  type GrantFieldErrors,
} from './cms-capability-grant-validation';
import type { CmsCapabilityGrantResource } from './cms-capability-grant-types';

export interface CmsCapabilityGrantRenewFormProps {
  readonly grant: CmsCapabilityGrantResource;
  readonly csrfToken: string;
  readonly idempotencyKey: string;
  readonly termWindow: CmsCapabilityGrantTermBounds;
  readonly disabled: boolean;
  readonly disabledReasonId?: string | undefined;
  readonly pending: boolean;
  readonly serverErrors: GrantFieldErrors;
  readonly onSubmit: (form: HTMLFormElement) => void;
  readonly onCancel: () => void;
}

/**
 * CMS-03A-16: a renewal restarts a fresh term from today. The row's version is
 * the strong If-Match; the grant id is bound by the route, never typed.
 */
export default function CmsCapabilityGrantRenewForm(
  props: CmsCapabilityGrantRenewFormProps,
): React.ReactElement {
  const { grant } = props;
  const [values, setValues] = React.useState({ validThrough: '', reason: '' });
  const [errors, setErrors] = React.useState<GrantFieldErrors>({});
  const shown: GrantFieldErrors = { ...props.serverErrors, ...errors };
  const heading = React.useRef<HTMLHeadingElement | null>(null);
  React.useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  const id = `cms-renew-${grant.id}`;
  const onSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    if (props.disabled || props.pending) return;
    const found = validateRenewalFields(values, props.termWindow);
    setErrors(found);
    if (found.validThrough !== undefined) {
      event.currentTarget
        .querySelector<HTMLElement>('input[name="validThrough"]')
        ?.focus();
      return;
    }
    props.onSubmit(event.currentTarget);
  };
  return (
    <form
      className="content-schema-registry-command-form"
      data-cms-command-form="true"
      data-operation-id="CMS-03A-16"
      method="post"
      action={CMS_CAPABILITY_GRANT_CONSOLE_PATH}
      noValidate
      onSubmit={onSubmit}
      onKeyDown={(event) => {
        if (event.key === 'Escape') props.onCancel();
      }}
    >
      <input type="hidden" name="operationId" value="CMS-03A-16" />
      <input type="hidden" name="csrf" value={props.csrfToken} />
      <input
        type="hidden"
        name="idempotency-key"
        value={props.idempotencyKey}
      />
      <input type="hidden" name="grantId" value={grant.id} />
      <input type="hidden" name="expectedVersion" value={grant.version} />
      <input type="hidden" name="if-match" value={`"${grant.version}"`} />
      <fieldset disabled={props.disabled || props.pending}>
        <legend>
          <span ref={heading} tabIndex={-1}>
            Renew {capabilityLabel(grant.capability)} grant
          </span>
        </legend>
        <TermField
          id={`${id}-valid-through`}
          value={values.validThrough}
          error={shown.validThrough}
          minDate={props.termWindow.minDate}
          maxDate={props.termWindow.maxDate}
          onChange={(validThrough) => setValues({ ...values, validThrough })}
        />
        <ReasonField
          id={`${id}-reason`}
          value={values.reason}
          error={shown.reason}
          onChange={(reason) => setValues({ ...values, reason })}
        />
      </fieldset>
      <p className="content-schema-registry-help">
        Consequence: the term restarts from today and ends at the end of the
        chosen date.
      </p>
      <div className="content-schema-registry-actions">
        <button
          type="submit"
          disabled={props.disabled || props.pending}
          aria-describedby={props.disabled ? props.disabledReasonId : undefined}
          aria-busy={props.pending ? 'true' : undefined}
        >
          {props.pending ? 'Renewing' : 'Renew grant'}
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
