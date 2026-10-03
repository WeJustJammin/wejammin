import * as React from 'react';

import CmsCapabilityGrantRenewForm from './CmsCapabilityGrantRenewForm';
import CmsCapabilityGrantRevokeConfirmation from './CmsCapabilityGrantRevokeConfirmation';
import type { GrantCommandKind } from './cms-capability-grant-commands';
import type { CmsCapabilityGrantResource } from './cms-capability-grant-types';
import type {
  CmsCapabilityGrantTermBounds,
  GrantFieldErrors,
} from './cms-capability-grant-validation';

export interface CmsCapabilityGrantRowFormProps {
  readonly kind: 'renew' | 'revoke';
  readonly grant: CmsCapabilityGrantResource;
  readonly csrfToken: string;
  readonly epoch: number;
  readonly termWindow: CmsCapabilityGrantTermBounds;
  readonly disabled: boolean;
  readonly disabledReasonId?: string | undefined;
  readonly pending: GrantCommandKind | null;
  readonly serverErrors: GrantFieldErrors;
  readonly onCancel: () => void;
  readonly onSubmit: (form: HTMLFormElement) => void;
}

const key = (operation: string, grantId: string, epoch: number): string =>
  `cms-grant-${operation}-${grantId}-${epoch}`.slice(0, 128);

/** The inline form under a row: renew (16) or the revoke confirmation (17). */
export default function CmsCapabilityGrantRowForm(
  props: CmsCapabilityGrantRowFormProps,
): React.ReactElement {
  const shared = {
    grant: props.grant,
    csrfToken: props.csrfToken,
    disabled: props.disabled,
    disabledReasonId: props.disabledReasonId,
    serverErrors: props.serverErrors,
    onCancel: props.onCancel,
    onSubmit: props.onSubmit,
  };
  return props.kind === 'revoke' ? (
    <CmsCapabilityGrantRevokeConfirmation
      {...shared}
      idempotencyKey={key('17', props.grant.id, props.epoch)}
      pending={props.pending === 'revoke'}
    />
  ) : (
    <CmsCapabilityGrantRenewForm
      {...shared}
      idempotencyKey={key('16', props.grant.id, props.epoch)}
      termWindow={props.termWindow}
      pending={props.pending === 'renew'}
    />
  );
}
