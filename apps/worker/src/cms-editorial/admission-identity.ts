import {
  cmsEditorialCapabilitiesSatisfied,
  type CmsEditorialCapability,
  type CmsEditorialCapabilityMode,
} from '@wejammin/contracts';

import { UUID_PATTERN } from './admission-common';
import type { CmsEditorialError, CmsEditorialSession } from './types';

/**
 * Structural validation of the server-derived session. The browser can never
 * supply this value, so a malformed resolver result fails closed as 401 rather
 * than becoming an authenticated request.
 */
export const validHumanSession = (
  session: CmsEditorialSession,
): CmsEditorialError | null => {
  const value = session as unknown as Record<string, unknown>;
  const capabilities = value.capabilities;
  const valid =
    typeof value.userId === 'string' &&
    UUID_PATTERN.test(value.userId) &&
    (value.actingPartyId === null ||
      (typeof value.actingPartyId === 'string' &&
        UUID_PATTERN.test(value.actingPartyId))) &&
    Array.isArray(capabilities) &&
    capabilities.every((capability) => typeof capability === 'string') &&
    typeof value.mfaFresh === 'boolean';
  return valid
    ? null
    : {
        ok: false,
        status: 401,
        code: 'UNAUTHENTICATED',
        message: 'The authentication context is invalid.',
        details: { recoveryAction: 'reauthenticate' },
      };
};

/**
 * Capability gate. BE03b CMS-03B-01 declares cms.author OR cms.editor, and the
 * locked predicate fails closed on an empty requirement, so a session holding
 * no editorial capability is refused before the RPC.
 *
 * A null actingPartyId is deliberately not a gate here: the assignment foreign
 * key is the canonical person party while acting context may be an alias or an
 * organization, so only the RPC may decide whether acting context is required.
 */
export const requireEditorialCapability = (
  session: CmsEditorialSession,
  required: readonly CmsEditorialCapability[],
  mode: CmsEditorialCapabilityMode,
): CmsEditorialError | null =>
  cmsEditorialCapabilitiesSatisfied(required, mode, session.capabilities)
    ? null
    : {
        ok: false,
        status: 403,
        code: 'FORBIDDEN',
        message: 'The required CMS editorial capability is not granted.',
        details: { reasonCode: 'CAPABILITY_REQUIRED' },
      };
