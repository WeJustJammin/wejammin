import {
  CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANTS,
  RequestContextSchema,
} from '@wejammin/contracts';

import type {
  AuthenticationResult,
  AuthenticationSession,
} from '../authentication/types';
import type { ContentSchemaRegistryDependencies } from './types';
import { capabilitiesFromResolver } from './production-context';
import {
  contextUnavailable,
  deadlineExceeded,
  errorResult,
  isAbortError,
  mapAuthResult,
  sessionUnavailable,
} from './production-errors';
import {
  UUID_PATTERN,
  type ContentSchemaRegistryProductionOptions,
  type ProductionConfiguration,
  type ServerSessionContext,
} from './production-types';

export const createSessionResolver = (
  options: ContentSchemaRegistryProductionOptions,
  configuration: ProductionConfiguration,
  sessionContexts: WeakMap<Request, ServerSessionContext>,
): ContentSchemaRegistryDependencies['resolveSession'] =>
  options.resolveSession ??
  (async (request, signal) => {
    const authentication = options.auth;
    if (authentication === undefined) return sessionUnavailable();
    let result: AuthenticationResult<AuthenticationSession>;
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
    if (!result.ok) return mapAuthResult(result);
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

    let capabilities: readonly string[];
    if (options.resolveRequestContext !== undefined) {
      let candidate: unknown;
      try {
        candidate = await options.resolveRequestContext(
          request,
          options.environment,
          signal,
          result.value,
        );
      } catch (error) {
        return isAbortError(error) || signal.aborted
          ? deadlineExceeded('request_context')
          : contextUnavailable();
      }
      const parsed = RequestContextSchema.safeParse(candidate);
      if (!parsed.success)
        return errorResult(
          401,
          'UNAUTHENTICATED',
          'The authentication context is invalid.',
          { recoveryAction: 'reauthenticate' },
        );
      if (
        parsed.data.userId !== result.value.authUserId ||
        parsed.data.actingPartyId !== result.value.actingPartyId
      )
        return errorResult(
          403,
          'FORBIDDEN',
          'The acting context is not allowed.',
        );
      capabilities = parsed.data.capabilities;
    } else if (options.resolveCapabilities !== undefined) {
      const resolved = await capabilitiesFromResolver(
        options.resolveCapabilities,
        result.value,
        request,
        options.environment,
        signal,
      );
      if (!resolved.ok) return resolved;
      capabilities = resolved.value;
    } else {
      return contextUnavailable();
    }
    let presentationVariant:
      | (typeof CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANTS)[number]
      | undefined;
    if (options.resolvePresentationVariant !== undefined) {
      let resolvedVariant:
        (typeof CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANTS)[number] | null;
      try {
        resolvedVariant = await options.resolvePresentationVariant(
          result.value,
          request,
          options.environment,
          signal,
        );
      } catch (error) {
        return isAbortError(error) || signal.aborted
          ? deadlineExceeded('request_context')
          : contextUnavailable();
      }
      if (
        resolvedVariant !== null &&
        !CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANTS.includes(resolvedVariant)
      )
        return errorResult(
          401,
          'UNAUTHENTICATED',
          'The authentication context is invalid.',
          { recoveryAction: 'reauthenticate' },
        );
      presentationVariant = resolvedVariant ?? undefined;
    }
    const stepUpAt = result.value.stepUpAt;
    const stepUpMs = stepUpAt === null ? Number.NaN : Date.parse(stepUpAt);
    const now = configuration.now();
    const mfaFresh =
      Number.isFinite(stepUpMs) &&
      stepUpMs <= now &&
      now - stepUpMs <= 10 * 60 * 1000;
    const stepUpFreshUntil = mfaFresh
      ? new Date(stepUpMs + 10 * 60 * 1000).toISOString()
      : undefined;
    sessionContexts.set(request, {
      authUserId: result.value.authUserId,
      sessionId: result.value.sessionId,
      actorPersonId: result.value.personId,
      actingPartyId: result.value.actingPartyId,
      stepUpAt: result.value.stepUpAt,
      actingContextId: result.value.actingContextId ?? null,
    });
    return {
      ok: true,
      value: {
        userId: result.value.authUserId,
        actingPartyId: result.value.actingPartyId,
        capabilities,
        mfaFresh,
        ...(stepUpFreshUntil === undefined ? {} : { stepUpFreshUntil }),
        ...(presentationVariant === undefined ? {} : { presentationVariant }),
      },
    };
  });
