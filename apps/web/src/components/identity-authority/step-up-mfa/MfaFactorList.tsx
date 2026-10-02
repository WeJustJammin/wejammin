import * as React from 'react';

import type { MfaFactorSummary } from './step-up-phase';

export interface MfaFactorListProps {
  factors: readonly MfaFactorSummary[];
  busy: boolean;
  onRemove: (factorId: string) => void;
  onStartAgain: (name: string) => void;
  onCancelSetup: (factorId: string) => void;
  onRefresh: () => void;
}

const STATUS = {
  verified: 'Active',
  pending: 'Setup not finished',
  reconciling: 'Checking status',
} as const;

const when = (value: string | null): React.ReactNode =>
  value === null ? (
    <>
      <span aria-hidden="true">&mdash;</span>
      <span className="infra-visually-hidden">Not available</span>
    </>
  ) : (
    <time dateTime={value}>{new Date(value).toLocaleDateString()}</time>
  );

const Hidden = ({ name }: Readonly<{ name: string }>): React.ReactElement => (
  <span className="infra-visually-hidden"> {name}</span>
);

function Actions({
  factor,
  busy,
  props,
}: Readonly<{
  factor: MfaFactorSummary;
  busy: boolean;
  props: MfaFactorListProps;
}>): React.ReactElement {
  if (factor.state === 'pending')
    return (
      <>
        <button
          type="button"
          disabled={busy}
          onClick={() => props.onStartAgain(factor.friendlyName)}
        >
          Start again
          <Hidden name={factor.friendlyName} />
        </button>{' '}
        <button
          type="button"
          disabled={busy}
          onClick={() => props.onCancelSetup(factor.id)}
        >
          Cancel setup
          <Hidden name={factor.friendlyName} />
        </button>
      </>
    );
  if (factor.state === 'reconciling')
    return (
      <button type="button" disabled={busy} onClick={props.onRefresh}>
        Refresh status
        <Hidden name={factor.friendlyName} />
      </button>
    );
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => props.onRemove(factor.id)}
    >
      Remove
      <Hidden name={factor.friendlyName} />
    </button>
  );
}

/** Semantic table of the account's authenticators, one action per row state. */
export function MfaFactorList(props: MfaFactorListProps): React.ReactElement {
  if (props.factors.length === 0) return <p>No authenticator is set up.</p>;
  return (
    <div className="mfa-table-wrap">
      <table className="mfa-table">
        <caption className="infra-visually-hidden">Your authenticators</caption>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Status</th>
            <th scope="col">Added</th>
            <th scope="col">Last used</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {props.factors.map((factor) => (
            <tr key={factor.id}>
              <th scope="row">{factor.friendlyName}</th>
              <td>{STATUS[factor.state]}</td>
              <td>{when(factor.verifiedAt)}</td>
              <td>{when(factor.lastUsedAt)}</td>
              <td>
                <Actions factor={factor} busy={props.busy} props={props} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
