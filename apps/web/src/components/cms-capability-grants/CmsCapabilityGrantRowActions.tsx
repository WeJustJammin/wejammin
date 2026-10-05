import * as React from 'react';

import { capabilityLabel } from './cms-capability-grant-labels';
import { describedByWithReason } from './cms-capability-grant-reasons';
import type { CmsCapabilityGrantResource } from './cms-capability-grant-types';

type Item = CmsCapabilityGrantResource;

export interface CmsCapabilityGrantRowActionsProps {
  readonly grant: Item;
  readonly disabled: boolean;
  /** Id of the visible reason the commands are disabled, if any. */
  readonly disabledReasonId?: string | undefined;
  readonly onRenew: (grant: Item, trigger: HTMLButtonElement) => void;
  readonly onRevoke: (grant: Item, trigger: HTMLButtonElement) => void;
  readonly onGrantAgain: (grant: Item) => void;
}

/** The row commands of one grant; each is described by its person cell and any disabled reason. */
export default function CmsCapabilityGrantRowActions(
  props: CmsCapabilityGrantRowActionsProps,
): React.ReactElement {
  const { grant, disabled } = props;
  const label = capabilityLabel(grant.capability);
  const personId = `cms-grant-person-${grant.id}`;
  const describedBy = describedByWithReason(
    personId,
    disabled,
    props.disabledReasonId,
  );
  if (grant.state === 'revoked')
    return (
      <button
        type="button"
        data-action="grant-again"
        disabled={disabled}
        aria-describedby={describedBy}
        onClick={() => props.onGrantAgain(grant)}
      >
        Grant again
      </button>
    );
  const name = (verb: string): string =>
    `${verb} ${label} grant ending ${grant.validThrough}`;
  return (
    <>
      <button
        type="button"
        data-action="renew"
        disabled={disabled}
        aria-label={name('Renew')}
        aria-describedby={describedBy}
        onClick={(event) => props.onRenew(grant, event.currentTarget)}
      >
        Renew
      </button>
      <button
        type="button"
        data-action="revoke"
        disabled={disabled}
        aria-label={name('Revoke')}
        aria-describedby={describedBy}
        onClick={(event) => props.onRevoke(grant, event.currentTarget)}
      >
        Revoke
      </button>
    </>
  );
}
