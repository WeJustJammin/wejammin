import * as React from 'react';

import ContentSchemaRegistryStepUpDisclosure from './ContentSchemaRegistryStepUpDisclosure';

export type ContentSchemaRegistryStepUpState =
  'required' | 'pending' | 'verified';

export interface ContentSchemaRegistryConfirmationStepProps {
  readonly consequence: string;
  readonly affectedScope: string;
  readonly expectedVersion: string;
  readonly stepUpState: ContentSchemaRegistryStepUpState;
  readonly idempotencyKey: string;
  /**
   * Human-readable acting-context label resolved server-side from the
   * authorized identity read. Raw identifiers are never passed here.
   */
  readonly actingContextLabel?: string;
  /** Server-derived expiry of the verified step-up disclosure window. */
  readonly stepUpFreshUntil?: string;
  readonly onCancel?: () => void;
  readonly triggerRef?: React.RefObject<HTMLElement | null>;
}

/** Inline confirmation; Escape clears confirmation before a commit can occur. */
export function ContentSchemaRegistryConfirmationStep({
  consequence,
  affectedScope,
  expectedVersion,
  stepUpState,
  idempotencyKey,
  actingContextLabel,
  stepUpFreshUntil,
  onCancel,
  triggerRef,
}: ContentSchemaRegistryConfirmationStepProps): React.ReactElement {
  const headingRef = React.useRef<HTMLHeadingElement | null>(null);
  const [confirmed, setConfirmed] = React.useState(false);
  React.useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);
  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>): void => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    setConfirmed(false);
    onCancel?.();
    triggerRef?.current?.focus({ preventScroll: true });
  };
  // A verified window that expires while mounted must drop acknowledgement.
  const handleStepUpExpired = React.useCallback((): void => {
    setConfirmed(false);
  }, []);
  return (
    <section
      className="content-schema-registry-confirmation"
      aria-labelledby="content-schema-registry-confirmation-heading"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <h3
        id="content-schema-registry-confirmation-heading"
        ref={headingRef}
        tabIndex={-1}
      >
        Confirm schema activation
      </h3>
      <p>Escape cancels before commit.</p>
      <dl>
        <dt>Consequence</dt>
        <dd>{consequence}</dd>
        <dt>Affected scope</dt>
        <dd>{affectedScope}</dd>
        <dt>Expected version</dt>
        <dd>
          <code>{expectedVersion}</code>
        </dd>
        <dt>Acting context</dt>
        <dd>
          {actingContextLabel === undefined || actingContextLabel.length === 0
            ? 'Server-verified acting context unavailable'
            : actingContextLabel}
        </dd>
        <dt>Step-up</dt>
        <dd>
          {stepUpState === 'pending' ? (
            'Verification pending'
          ) : stepUpState === 'verified' ? (
            <ContentSchemaRegistryStepUpDisclosure
              freshUntil={stepUpFreshUntil}
              onExpired={handleStepUpExpired}
            />
          ) : (
            'Step-up required before commit'
          )}
        </dd>
        <dt>Idempotency key</dt>
        <dd>
          <code>{idempotencyKey}</code>
        </dd>
      </dl>
      <label htmlFor="content-schema-registry-confirmed">
        <input
          id="content-schema-registry-confirmed"
          name="confirmed"
          type="checkbox"
          value="true"
          required
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />{' '}
        I understand the consequence and affected scope.
      </label>
      <p className="content-schema-registry-help">
        Commit is enabled only after confirmation and verified step-up.
      </p>
    </section>
  );
}

export default ContentSchemaRegistryConfirmationStep;
