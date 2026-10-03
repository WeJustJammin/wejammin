import * as React from 'react';

import {
  CapabilityField,
  PersonField,
  ReasonField,
  TermField,
} from './CmsCapabilityGrantFields';
import { CMS_CAPABILITY_GRANT_CONSOLE_PATH } from './cms-capability-grant-url';
import {
  validateGrantFields,
  type CmsCapabilityGrantTermBounds,
  type GrantFieldErrors,
  type GrantFieldName,
} from './cms-capability-grant-validation';

export interface CmsCapabilityGrantFormProps {
  readonly csrfToken: string;
  readonly idempotencyKey: string;
  readonly termWindow: CmsCapabilityGrantTermBounds;
  readonly disabled: boolean;
  /** Id of the visible reason the command is disabled, if any. */
  readonly disabledReasonId?: string | undefined;
  readonly pending: boolean;
  /** Server 422 field errors for the last attempt, mapped by the console. */
  readonly serverErrors: GrantFieldErrors;
  readonly initial: {
    readonly subjectPersonId: string;
    readonly capability: string;
  };
  readonly onSubmit: (form: HTMLFormElement) => void;
}

const FIELD_ORDER: readonly GrantFieldName[] = [
  'person',
  'capability',
  'validThrough',
  'reason',
];
const FIELD_IDS: Readonly<Record<GrantFieldName, string>> = {
  person: 'cms-grant-person',
  capability: 'cms-grant-capability',
  validThrough: 'cms-grant-valid-through',
  reason: 'cms-grant-reason',
};

/**
 * CMS-03A-15: one native form. Values live only in island memory; nothing is
 * persisted, so a person ID never reaches storage, a URL or telemetry.
 */
export default function CmsCapabilityGrantForm(
  props: CmsCapabilityGrantFormProps,
): React.ReactElement {
  const [values, setValues] = React.useState({
    subjectPersonId: props.initial.subjectPersonId,
    capability: props.initial.capability,
    validThrough: '',
    reason: '',
  });
  const [errors, setErrors] = React.useState<GrantFieldErrors>({});
  const shown: GrantFieldErrors = { ...props.serverErrors, ...errors };
  const set = (patch: Partial<typeof values>): void =>
    setValues((previous) => ({ ...previous, ...patch }));
  const check = (name: GrantFieldName, next = values): void =>
    setErrors((previous) => {
      const found = validateGrantFields(next, props.termWindow);
      const rest: { -readonly [K in GrantFieldName]?: string } = {
        ...previous,
      };
      delete rest[name];
      return found[name] === undefined
        ? rest
        : { ...rest, [name]: found[name] };
    });
  const onSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    if (props.disabled || props.pending) return;
    const found = validateGrantFields(values, props.termWindow);
    setErrors(found);
    const first = FIELD_ORDER.find((name) => found[name] !== undefined);
    if (first !== undefined) {
      event.currentTarget
        .querySelector<HTMLElement>(`#${FIELD_IDS[first]}`)
        ?.focus();
      return;
    }
    props.onSubmit(event.currentTarget);
  };
  return (
    <form
      id="cms-grant-form"
      className="content-schema-registry-command-form"
      data-cms-command-form="true"
      data-operation-id="CMS-03A-15"
      method="post"
      action={CMS_CAPABILITY_GRANT_CONSOLE_PATH}
      noValidate
      onSubmit={onSubmit}
    >
      <input type="hidden" name="operationId" value="CMS-03A-15" />
      <input type="hidden" name="csrf" value={props.csrfToken} />
      <input
        type="hidden"
        name="idempotency-key"
        value={props.idempotencyKey}
      />
      <fieldset disabled={props.disabled || props.pending}>
        <legend>Grant a capability</legend>
        <PersonField
          id={FIELD_IDS.person}
          value={values.subjectPersonId}
          error={shown.person}
          onChange={(subjectPersonId) => set({ subjectPersonId })}
          onBlur={() => check('person')}
        />
        <CapabilityField
          id={FIELD_IDS.capability}
          value={values.capability}
          error={shown.capability}
          onChange={(capability) => {
            set({ capability });
            check('capability', { ...values, capability });
          }}
        />
        <TermField
          id={FIELD_IDS.validThrough}
          value={values.validThrough}
          error={shown.validThrough}
          minDate={props.termWindow.minDate}
          maxDate={props.termWindow.maxDate}
          onChange={(validThrough) => set({ validThrough })}
          onBlur={() => check('validThrough')}
        />
        <ReasonField
          id={FIELD_IDS.reason}
          value={values.reason}
          error={shown.reason}
          onChange={(reason) => set({ reason })}
          onBlur={() => check('reason')}
        />
      </fieldset>
      <p className="content-schema-registry-help">
        Consequence: the person holds this capability until the end of the
        chosen date, at most 90 days. Changes need a verified identity.
      </p>
      <button
        type="submit"
        disabled={props.disabled || props.pending}
        aria-describedby={props.disabled ? props.disabledReasonId : undefined}
        aria-busy={props.pending ? 'true' : undefined}
      >
        {props.pending ? 'Granting' : 'Grant capability'}
      </button>
    </form>
  );
}
