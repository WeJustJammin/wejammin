import * as React from 'react';

import {
  CAPABILITY_GATE_SURFACES,
  type CapabilityGateSurface,
} from './capability-gate-surfaces';

export type CapabilityGateVariant =
  'full' | 'read-only' | 'partial-hidden' | 'disabled' | 'not-rendered';

export interface CapabilityGateProps {
  readonly variant: CapabilityGateVariant;
  /**
   * A typed server reason code (an `ApiError.code` or a capability refusal
   * code). Never a presentation variant name: when the server gave no code the
   * caller omits it and the surface's copy states the situation instead.
   */
  readonly reasonCode?: string | undefined;
  readonly recoveryHref?: string | undefined;
  readonly recoveryLabel?: string | undefined;
  /** Server-disclosed copy; the surface's own copy is used when absent. */
  readonly disclosure?: string | undefined;
  /** Which surface's heading, copy and layout hooks to use. */
  readonly surface?: CapabilityGateSurface | undefined;
}

/**
 * FE00 `<CapabilityGate>`: server-authoritative capability presentation shared
 * by every surface. `not-rendered` emits nothing, and neither does `full`
 * (nothing is withheld); `disabled` states the reason and recovery; a limited
 * variant discloses what stays readable. A 401 `STEP_UP_REQUIRED` never reaches
 * this component: it navigates to `/step-up?returnTo=` (DEC-111), see
 * `step-up-required.ts`.
 */
export function CapabilityGate({
  variant,
  reasonCode,
  recoveryHref,
  recoveryLabel = 'Review access',
  disclosure,
  surface = 'infrastructure',
}: CapabilityGateProps): React.ReactElement | null {
  if (variant === 'not-rendered' || variant === 'full') return null;
  const profile = CAPABILITY_GATE_SURFACES[surface];
  const disabled = variant === 'disabled';
  const Heading = profile.headingLevel === 2 ? 'h2' : 'h3';
  return (
    <section
      className={profile.className}
      role="status"
      aria-live="polite"
      aria-labelledby={profile.headingId}
      data-variant={variant}
      data-reason-code={reasonCode}
    >
      <Heading id={profile.headingId} tabIndex={disabled ? -1 : undefined}>
        {disabled ? profile.disabledHeading : profile.limitedHeading}
      </Heading>
      <p>
        {disclosure ?? (disabled ? profile.disabledCopy : profile.limitedCopy)}
      </p>
      {reasonCode === undefined ? null : (
        <p className={profile.reasonClassName}>
          {profile.reasonLabel} <code>{reasonCode}</code>
        </p>
      )}
      {recoveryHref === undefined ? null : (
        <a href={recoveryHref}>{recoveryLabel}</a>
      )}
    </section>
  );
}

export default CapabilityGate;
