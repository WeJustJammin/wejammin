import type { ServerEnvironment } from '@wejammin/config/environment';

import type { AuthenticationResult } from './authentication/types';
import {
  contextUnavailable,
  deadlineExceeded,
  errorResult,
  isAbortError,
  mapAuthenticationFailure,
  sessionUnavailable,
} from './cms-editorial-production-errors';
import {
  UUID_PATTERN,
  type CmsEditorialProductionConfiguration,
  type CmsEditorialProductionOptions,
  type CmsEditorialSession,
  type CmsEditorialServerSessionContext,
} from './cms-editorial-production-types';
import { stepUpIsFresh } from './cms-editorial-production-session';
import { validCapabilities } from './cms-editorial-production-session-capabilities';

const resolveCapabilitySet = async (
  options: CmsEditorialProductionOptions,
  session: import('./authentication/types').AuthenticationSession,
  request: Request,
  signal: AbortSignal,
): Promise<readonly string[] | null> => {
  const seam = options.resolveCapabilities;
  if (seam === undefined) return null;
  if (Array.isArray(seam)) return validCapabilities(seam) ? seam : null;
  const environment: ServerEnvironment = options.environment;
  let resolved: unknown;
  try {
    resolved = await (
      seam as (
        session: import('./authentication/types').AuthenticationSession,
        request: Request,
        env: ServerEnvironment,
        signal: AbortSignal,
      ) => readonly string[] | Promise<readonly string[]>
    )(session, request, environment, signal);
  } catch {
    return null;
  }
  return validCapabilities(resolved) ? resolved : null;
};

/**
 * Resolve the editorial session from server authorities only. Every value the
 * RPC receives is derived here; a browser payload can never name the actor,
 * the acting party, the capability set, or the step-up proof.
 */
export const createCmsEditorialSessionResolver = (
  options: CmsEditorialProductionOptions,
  configuration: CmsEditorialProductionConfiguration,
  contexts: WeakMap<Request, CmsEditorialServerSessionContext>,
): ((
  request: Request,
  signal: AbortSignal,
) => Promise<
  | Readonly<{ ok: true; value: CmsEditorialSession }>
  | ReturnType<typeof sessionUnavailable>
>) => {
  if (options.resolveSession !== undefined) return options.resolveSession;
  return async (request, signal) => {
    const authentication = options.auth;
    if (authentication === undefined) return sessionUnavailable();
    let result: AuthenticationResult<
      import('./authentication/types').AuthenticationSession
    >;
    try {
      result = await authentication.resolveSession(
        request,
        options.environment,
        signal,
      );
    } catch (error) {
      return isAbortError(error) || signal.aborted
        ? deadlineExceeded('authentication')
        : sessionUnavailable();
    }
    if (!result.ok) return mapAuthenticationFailure(result);
    if (
      result.value.accountState !== 'active' &&
      result.value.accountState !== 'claimed'
    )
      return errorResult(403, 'FORBIDDEN', 'The action is not allowed.', {});
    const expiresAt = Date.parse(result.value.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= configuration.now())
      return errorResult(
        401,
        'UNAUTHENTICATED',
        'The authentication session is invalid.',
        { recoveryAction: 'reauthenticate' },
      );
    if (!UUID_PATTERN.test(result.value.authUserId))
      return errorResult(
        401,
        'UNAUTHENTICATED',
        'The authentication session is invalid.',
        { recoveryAction: 'reauthenticate' },
      );

    const capabilities = await resolveCapabilitySet(
      options,
      result.value,
      request,
      signal,
    );
    if (capabilities === null) return contextUnavailable();

    const mfaFresh = stepUpIsFresh(result.value.stepUpAt, configuration.now());
    contexts.set(request, {
      authUserId: result.value.authUserId,
      sessionId: result.value.sessionId,
      actorPersonId: result.value.personId,
      actingPartyId: result.value.actingPartyId,
      stepUpAt: result.value.stepUpAt,
    });
    return {
      ok: true,
      value: {
        userId: result.value.authUserId,
        actingPartyId: result.value.actingPartyId,
        capabilities,
        mfaFresh,
      },
    };
  };
};
