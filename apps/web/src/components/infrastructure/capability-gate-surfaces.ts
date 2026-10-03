/**
 * Per-surface presentation of the one FE00 `<CapabilityGate>`. A surface keeps
 * its own heading copy, heading level, ids and class so its layout and its
 * focus target do not change; the gate behavior (which variants render, what a
 * reason code is, when a recovery link shows) is shared and lives in
 * `CapabilityGate.tsx`. Plain data, so the registry's imperative renderer can
 * read the same copy.
 */

export type CapabilityGateSurface =
  'infrastructure' | 'platform-configuration' | 'content-schema-registry';

export interface CapabilityGateSurfaceProfile {
  readonly className: string;
  readonly headingId: string;
  readonly headingLevel: 2 | 3;
  readonly disabledHeading: string;
  readonly limitedHeading: string;
  readonly disabledCopy: string;
  readonly limitedCopy: string;
  /** Label before a typed reason code, when the caller supplies one. */
  readonly reasonLabel: string;
  /** Extra class for the reason-code paragraph, when the surface styles it. */
  readonly reasonClassName?: string;
}

export const CAPABILITY_GATE_SURFACES: Readonly<
  Record<CapabilityGateSurface, CapabilityGateSurfaceProfile>
> = {
  infrastructure: {
    className: 'infra-capability-gate',
    headingId: 'capability-gate-heading',
    headingLevel: 2,
    disabledHeading: 'Action unavailable',
    limitedHeading: 'Access is limited',
    disabledCopy: 'A server capability prerequisite is not satisfied.',
    limitedCopy: 'This context can read only the disclosed projection.',
    reasonLabel: 'Reason code:',
  },
  'platform-configuration': {
    className: 'platform-configuration-capability-gate',
    headingId: 'platform-configuration-capability-heading',
    headingLevel: 2,
    disabledHeading: 'Action unavailable',
    limitedHeading: 'Access is limited',
    disabledCopy: 'A server capability prerequisite is not satisfied.',
    limitedCopy:
      'This context can read only the disclosed configuration projection.',
    reasonLabel: 'Reason code:',
    reasonClassName: 'platform-configuration-help',
  },
  'content-schema-registry': {
    className: 'content-schema-registry-capability-gate',
    headingId: 'content-schema-registry-capability-heading',
    headingLevel: 3,
    disabledHeading: 'Schema changes unavailable',
    limitedHeading: 'Read-only registry access',
    disabledCopy: 'A server capability prerequisite is not satisfied.',
    limitedCopy:
      'This context can inspect the disclosed registry projection but cannot change schemas.',
    reasonLabel: 'Reason:',
  },
};
