import {
  CapabilitySchema,
  CmsReleaseKeyIdSchema,
  CorrelationIdSchema,
} from '@wejammin/contracts';

import type { ServerEnvironment } from '@wejammin/config/environment';

import type {
  ContentSchemaRegistryPortInput,
  ContentSchemaRegistryResult,
  ReleasePrincipal,
} from './types';
import {
  deadlineExceeded,
  invalidResponse,
  isAbortError,
  unavailable,
} from './production-errors';
import {
  HASH_PATTERN,
  MAX_ORIGIN_LENGTH,
  type CapabilityResolver,
  type ServerSessionContext,
} from './production-types';

export const configuredOriginList = (
  value: string | undefined,
): readonly string[] =>
  value === undefined || value.trim() === ''
    ? []
    : value.split(',').map((origin) => origin.trim());

export const correlationFor = (
  input: ContentSchemaRegistryPortInput,
): string => {
  const candidate = input.request.headers.get('x-correlation-id');
  const parsed = CorrelationIdSchema.safeParse(candidate);
  return parsed.success ? parsed.data : input.requestId;
};

/**
 * Operations whose RPC rechecks the caller's validated acting-context binding
 * (activation, review submission, decision and assignment, and the owner
 * capability grant commands and list). The binding id is private: it is
 * projected into these RPC contexts only, never into any other operation,
 * response, header, log, or telemetry projection.
 */
const PRIVATE_BINDING_OPERATIONS: ReadonlySet<string> = new Set([
  'CMS-03A-04',
  'CMS-03A-11',
  'CMS-03A-12',
  'CMS-03A-14',
  'CMS-03A-15',
  'CMS-03A-16',
  'CMS-03A-17',
  'CMS-03A-18',
]);

export const contextFor = (
  input: ContentSchemaRegistryPortInput,
  contexts: WeakMap<Request, ServerSessionContext>,
  now: () => number,
): Readonly<Record<string, unknown>> => {
  const fromServer = contexts.get(input.request);
  const userId = fromServer?.authUserId ?? input.session?.userId;
  const actingPartyId =
    fromServer?.actingPartyId ?? input.session?.actingPartyId ?? null;
  const sessionId = fromServer?.sessionId;
  const actorPersonId = fromServer?.actorPersonId;
  const actingContextId =
    PRIVATE_BINDING_OPERATIONS.has(input.operationId) &&
    typeof fromServer?.actingContextId === 'string' &&
    fromServer.actingContextId.length > 0
      ? fromServer.actingContextId
      : undefined;
  return {
    ...(userId === undefined ? {} : { authUserId: userId }),
    ...(sessionId === undefined ? {} : { sessionId }),
    ...(actorPersonId === undefined ? {} : { actorPersonId }),
    actingPartyId,
    ...(actingContextId === undefined ? {} : { actingContextId }),
    ...(fromServer === undefined
      ? { stepUpVerified: input.session?.mfaFresh ?? false }
      : {
          stepUpVerified:
            fromServer.stepUpAt !== null &&
            Number.isFinite(Date.parse(fromServer.stepUpAt)) &&
            Date.parse(fromServer.stepUpAt) <= now(),
          stepUpAt: fromServer.stepUpAt,
        }),
    ...(input.principal === undefined
      ? {}
      : { releasePrincipalId: input.principal.keyId }),
    requestId: input.requestId,
    correlationId: correlationFor(input),
  };
};

export const rpcBodyFor = (
  input: ContentSchemaRegistryPortInput,
  contexts: WeakMap<Request, ServerSessionContext>,
  now: () => number,
): Readonly<Record<string, unknown>> => ({
  ...(input.body ?? {}),
  ...(input.query ?? {}),
  ...(input.path ?? {}),
  ...(input.idempotencyKey === undefined
    ? {}
    : { idempotencyKey: input.idempotencyKey }),
  ...(input.ifMatch === undefined
    ? {}
    : { expectedVersion: input.ifMatch, ifMatch: input.ifMatch }),
  context: contextFor(input, contexts, now),
  ...(input.principal === undefined
    ? {}
    : {
        releaseKeyId: input.principal.keyId,
        releaseNonce: input.release?.headers.nonce,
        releaseIssuedAt: input.release?.headers.issuedAt,
        releaseRawBodyHash: input.principal.rawBodyHash,
        releaseSignatureHash: input.principal.signatureHash,
        releaseSignature: input.release?.headers.signature,
        releaseVerifiedAt: input.principal.verifiedAt,
      }),
});

export const capabilitiesFromResolver = async (
  resolver: CapabilityResolver,
  session: import('../authentication/types').AuthenticationSession,
  request: Request,
  environment: ServerEnvironment,
  signal: AbortSignal,
): Promise<ContentSchemaRegistryResult<readonly string[]>> => {
  try {
    const values = await resolver(session, request, environment, signal);
    if (
      !Array.isArray(values) ||
      values.length > 64 ||
      values.some((value) => !CapabilitySchema.safeParse(value).success) ||
      new Set(values).size !== values.length
    )
      return invalidResponse();
    return { ok: true, value: values };
  } catch (error) {
    return isAbortError(error) || signal.aborted
      ? deadlineExceeded('request_context')
      : unavailable('request_context');
  }
};

export const validateOriginList = (
  origins: readonly string[] | undefined,
  ConfigurationError: new (message?: string) => Error,
): readonly string[] => {
  const values = origins ?? [];
  if (!Array.isArray(values))
    throw new ConfigurationError('Origin allowlists must be arrays.');
  for (const origin of values) {
    if (
      typeof origin !== 'string' ||
      origin.length === 0 ||
      origin.length > MAX_ORIGIN_LENGTH ||
      origin === '*' ||
      [...origin].some((character) => {
        const codePoint = character.codePointAt(0);
        return (
          codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f)
        );
      })
    )
      throw new ConfigurationError(
        'Origin allowlists must contain explicit HTTP(S) origins.',
      );
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new ConfigurationError(
        'Origin allowlists must contain explicit HTTP(S) origins.',
      );
    }
    if (
      (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
      parsed.username !== '' ||
      parsed.password !== '' ||
      parsed.pathname !== '/' ||
      parsed.search !== '' ||
      parsed.hash !== ''
    )
      throw new ConfigurationError(
        'Origin allowlists must contain explicit HTTP(S) origins.',
      );
  }
  return Object.freeze([...values]);
};

export const validReleasePrincipal = (
  value: unknown,
): value is ReleasePrincipal =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  typeof (value as Record<string, unknown>).principalId === 'string' &&
  ((value as Record<string, unknown>).principalId as string).length > 0 &&
  ((value as Record<string, unknown>).principalId as string).length <= 128 &&
  typeof (value as Record<string, unknown>).keyId === 'string' &&
  CmsReleaseKeyIdSchema.safeParse((value as Record<string, unknown>).keyId)
    .success &&
  Array.isArray((value as Record<string, unknown>).capabilities) &&
  ((value as Record<string, unknown>).capabilities as unknown[]).length > 0 &&
  ((value as Record<string, unknown>).capabilities as unknown[]).length <= 16 &&
  ((value as Record<string, unknown>).capabilities as unknown[]).every(
    (capability) =>
      typeof capability === 'string' &&
      CapabilitySchema.safeParse(capability).success,
  ) &&
  typeof (value as Record<string, unknown>).verifiedAt === 'string' &&
  Number.isFinite(
    Date.parse((value as Record<string, unknown>).verifiedAt as string),
  ) &&
  typeof (value as Record<string, unknown>).rawBodyHash === 'string' &&
  HASH_PATTERN.test((value as Record<string, unknown>).rawBodyHash as string) &&
  typeof (value as Record<string, unknown>).signatureHash === 'string' &&
  HASH_PATTERN.test(
    (value as Record<string, unknown>).signatureHash as string,
  ) &&
  typeof (value as Record<string, unknown>).nonceHash === 'string' &&
  HASH_PATTERN.test((value as Record<string, unknown>).nonceHash as string);
