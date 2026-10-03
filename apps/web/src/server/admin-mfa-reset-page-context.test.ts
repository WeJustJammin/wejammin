import { describe, expect, it, vi } from 'vitest';

import type { PlatformConfigurationPageResult } from './platform-configuration-context';
import type { MfaFactorsRead } from './step-up-mfa-read';
import {
  ADMIN_MFA_RESET_CAPABILITY,
  ADMIN_MFA_RESET_ROUTE,
  resolveAdminMfaResetPage,
} from './admin-mfa-reset-page-context';
import {
  REQUEST_ID,
  factorsResource,
  pageRequest,
} from './step-up-mfa-context.test-support';

const configuration = (
  capabilitySnapshot: readonly string[],
  state: 'degraded' | 'forbidden' | 'ready' = 'ready',
): PlatformConfigurationPageResult =>
  ({
    kind: 'ready',
    page: {
      state,
      capabilitySnapshot,
      actorId: 'private-actor',
      actingPartyId: 'private-party',
    },
  }) as unknown as PlatformConfigurationPageResult;

const mfa = (fresh: boolean): MfaFactorsRead => ({
  kind: 'ok',
  resource: factorsResource({
    stepUp: { fresh, freshUntil: fresh ? '2026-10-02T12:10:00Z' : null },
  }),
  etagVersion: '4',
});

const resolve = (
  config: PlatformConfigurationPageResult,
  read: MfaFactorsRead = mfa(true),
) => {
  const readMfa = vi.fn(() => Promise.resolve(read));
  const resolveConfiguration = vi.fn(() => Promise.resolve(config));
  return {
    readMfa,
    resolveConfiguration,
    promise: resolveAdminMfaResetPage(
      {
        request: pageRequest(ADMIN_MFA_RESET_ROUTE),
        binding: {},
        requestId: REQUEST_ID,
      },
      { readMfa, resolveConfiguration },
    ),
  };
};

/** FE05 `AdminMfaFactorResetForm` rendering and access rules. */
describe('resolveAdminMfaResetPage', () => {
  it('[P2-S09-AC-1108] renders the form only when the projection holds admin.identity.mfa_reset and step-up is fresh', async () => {
    const { promise } = resolve(configuration([ADMIN_MFA_RESET_CAPABILITY]));
    expect(await promise).toEqual({
      kind: 'ready',
      variant: 'adminStepUp',
      stepUp: { fresh: true, freshUntil: '2026-10-02T12:10:00Z' },
      requestId: REQUEST_ID,
    });
  });

  it('[P2-S09-AC-1109] shows the prerequisite variant when the capability is held without fresh step-up', async () => {
    const { promise } = resolve(
      configuration([ADMIN_MFA_RESET_CAPABILITY]),
      mfa(false),
    );
    expect(await promise).toMatchObject({
      kind: 'ready',
      variant: 'disabledPrerequisite',
    });
  });

  it('[P2-S09-AC-1108] returns a disclosure-safe not_found without the capability and never reads factors', async () => {
    const { promise, readMfa } = resolve(configuration(['admin.inbox.read']));
    expect(await promise).toEqual({ kind: 'not_found' });
    expect(readMfa).not.toHaveBeenCalled();
  });

  it('treats a forbidden or unresolvable configuration page as not_found', async () => {
    expect(
      await resolve(configuration([ADMIN_MFA_RESET_CAPABILITY], 'forbidden'))
        .promise,
    ).toEqual({
      kind: 'not_found',
    });
    expect(await resolve({ kind: 'not_found' }).promise).toEqual({
      kind: 'not_found',
    });
  });

  it('is degraded when the configuration page is degraded', async () => {
    expect(await resolve(configuration([], 'degraded')).promise).toEqual({
      kind: 'degraded',
      requestId: REQUEST_ID,
    });
  });

  it('redirects to sign-in carrying this route when either read is unauthenticated', async () => {
    const location = `/auth/sign-in?returnTo=${encodeURIComponent(ADMIN_MFA_RESET_ROUTE)}`;
    expect(await resolve({ kind: 'unauthenticated' }).promise).toEqual({
      kind: 'unauthenticated',
      location,
    });
    expect(
      await resolve(configuration([ADMIN_MFA_RESET_CAPABILITY]), {
        kind: 'unauthenticated',
      }).promise,
    ).toEqual({ kind: 'unauthenticated', location });
  });

  it('falls back to the prerequisite variant when the factor read is unavailable', async () => {
    const { promise } = resolve(configuration([ADMIN_MFA_RESET_CAPABILITY]), {
      kind: 'unavailable',
    });
    expect(await promise).toMatchObject({
      kind: 'ready',
      variant: 'disabledPrerequisite',
    });
  });

  it('never carries actor or party identifiers into the page props', async () => {
    const { promise } = resolve(configuration([ADMIN_MFA_RESET_CAPABILITY]));
    expect(JSON.stringify(await promise)).not.toMatch(/private-(actor|party)/u);
  });
});

describe('[P2-S09-AC-1108] the workbench entry for the reset', () => {
  it('[P2-S09-AC-1108] shows only for a snapshot that names the capability exactly', async () => {
    const { showsAdminMfaResetEntry } =
      await import('./admin-mfa-reset-page-context');
    expect(showsAdminMfaResetEntry(['admin.identity.mfa_reset'])).toBe(true);
    expect(
      showsAdminMfaResetEntry(['admin.inbox.read', 'admin.identity.mfa_reset']),
    ).toBe(true);
    expect(showsAdminMfaResetEntry([])).toBe(false);
    expect(showsAdminMfaResetEntry(['admin.inbox.read'])).toBe(false);
    // Never a substring, a case variant or a role label.
    expect(showsAdminMfaResetEntry(['admin.identity.mfa_reset.extra'])).toBe(
      false,
    );
    expect(showsAdminMfaResetEntry(['ADMIN.IDENTITY.MFA_RESET'])).toBe(false);
    expect(showsAdminMfaResetEntry(['admin'])).toBe(false);
  });
});
