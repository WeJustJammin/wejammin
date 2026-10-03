import * as React from 'react';

import type {
  GrantCommandKind,
  GrantCommandState,
} from './cms-capability-grant-commands';
import { stepUpHref } from './cms-capability-grant-navigation';
import type { GrantFieldErrors } from './cms-capability-grant-validation';

export interface CmsCapabilityGrantCommandResultProps {
  readonly kind: GrantCommandKind;
  readonly state: Exclude<GrantCommandState, { status: 'idle' | 'pending' }>;
  readonly returnTo: string;
  /** Changes with every command outcome so a repeated 429 restarts its countdown. */
  readonly sequence: number;
  readonly fieldTargets: Readonly<Record<keyof GrantFieldErrors, string>>;
  readonly onShowExisting: () => void;
  readonly onRetry: () => void;
  /** Persists the interrupted command before the link opens /step-up. */
  readonly onVerifyIdentity: () => void;
}

const Countdown = ({
  seconds,
}: {
  readonly seconds: number;
}): React.ReactElement => {
  const [left, setLeft] = React.useState(seconds);
  React.useEffect(() => {
    const timer = setInterval(
      () => setLeft((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, []);
  return (
    <p role="timer" aria-live="off">
      {left > 0
        ? `You can try again in ${left} ${left === 1 ? 'second' : 'seconds'}.`
        : 'You can try again now.'}
    </p>
  );
};

/** The latest command outcome; the result heading receives focus on success. */
export default function CmsCapabilityGrantCommandResult(
  props: CmsCapabilityGrantCommandResultProps,
): React.ReactElement {
  const { state } = props;
  const heading = React.useRef<HTMLHeadingElement | null>(null);
  React.useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [state]);
  if (state.status === 'success')
    return (
      <section data-command-result aria-labelledby="cms-grants-result-heading">
        <h3 id="cms-grants-result-heading" ref={heading} tabIndex={-1}>
          {state.heading}
        </h3>
        <p>{state.announcement}</p>
      </section>
    );
  const fields = Object.keys(state.fieldErrors) as (keyof GrantFieldErrors)[];
  return (
    <section
      data-command-error
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className="content-schema-registry-command-error"
    >
      <h3 ref={heading} tabIndex={-1}>
        {props.kind === 'revoke'
          ? 'Revoke needs attention'
          : 'This change needs attention'}
      </h3>
      <p>{state.message}</p>
      {fields.length === 0 ? null : (
        <ul>
          {fields.map((field) => (
            <li key={field}>
              <a href={`#${props.fieldTargets[field]}`}>
                {state.fieldErrors[field]}
              </a>
            </li>
          ))}
        </ul>
      )}
      {state.requestId === null ? null : (
        <p>
          Request ID: <code>{state.requestId}</code>
        </p>
      )}
      {state.retryAfterSeconds === null ? null : (
        <Countdown key={props.sequence} seconds={state.retryAfterSeconds} />
      )}
      {state.action === 'step-up' ? (
        <a
          data-action="verify-identity"
          href={stepUpHref(props.returnTo)}
          onClick={props.onVerifyIdentity}
        >
          Verify identity
        </a>
      ) : null}
      {state.action === 'filter-capability' ? (
        <button
          type="button"
          data-action="filter-capability"
          onClick={props.onShowExisting}
        >
          Show existing grants for this capability
        </button>
      ) : null}
      {state.action === 'retry' ? (
        <button
          type="button"
          data-action="retry-command"
          onClick={props.onRetry}
        >
          Retry after the list refreshes
        </button>
      ) : null}
    </section>
  );
}
