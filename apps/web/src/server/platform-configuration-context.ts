import {
  ActingContextListResponseSchema,
  ConfigurationKeySchema,
  ConfigurationUuidSchema,
  PersonIdentityResponseSchema,
  createRequestId,
} from '@wejammin/contracts';

import type {
  PlatformConfigurationAccess,
  PlatformConfigurationError,
  PlatformConfigurationVariant,
} from '../components/platform-configuration/platform-configuration-workbench-types';
import { sanitizeConfigurationValue } from '../components/platform-configuration/platform-configuration-presentation-security';
import { parsePlatformConfigurationApiError } from './platform-configuration-api-error';
import { parseEffectiveValue } from './platform-configuration-app-state';
import type { Cfg05a02EffectiveValueResponse } from './platform-configuration-app-state';
import {
  filterPlatformConfigurationCookies,
  forwardPlatformConfigurationRequest,
  hasPlatformConfigurationSession,
  parsePlatformConfigurationCapabilities,
  resolvePlatformConfigurationBinding,
} from './platform-configuration-platform-api';
import type { PlatformConfigurationCapabilityResolutionInput } from './platform-configuration-platform-api';
import { forwardIdentityAuthorityRequest } from './identity-authority-platform-api';
import { readWorkerCapabilitySnapshot } from './platform-configuration-capability-snapshot';

export type PlatformConfigurationPageState = Readonly<{
  state: 'ready' | 'forbidden' | 'degraded';
  variant: PlatformConfigurationVariant;
  access: PlatformConfigurationAccess;
  actorId: string | null;
  actingPartyId: string | null;
  capabilitySnapshot: readonly string[];
  csrfToken: string;
  requestId: string;
  key: string | null;
  effective: Cfg05a02EffectiveValueResponse | null;
  etag: string | null;
  lastVerifiedAt: string | null;
  notDisclosed: boolean;
  error?: PlatformConfigurationError;
}>;

export type PlatformConfigurationPageResult =
  | Readonly<{ kind: 'unauthenticated' }>
  | Readonly<{ kind: 'not_found' }>
  | Readonly<{ kind: 'invalid_key' }>
  | Readonly<{ kind: 'invalid_record' }>
  | Readonly<{ kind: 'ready'; page: PlatformConfigurationPageState }>;

type Surface = 'index' | 'detail';

const readJson = async (response: Response): Promise<unknown | null> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const csrfCookie = (request: Request): string => {
  const cookies = filterPlatformConfigurationCookies(
    request.headers.get('cookie'),
  );
  if (cookies === null) return '';
  return (
    cookies
      .split('; ')
      .find((part) => part.startsWith('wj_csrf='))
      ?.slice('wj_csrf='.length) ?? ''
  );
};

const requestWithPath = (request: Request, path: string): Request => {
  const target = new URL(path, request.url);
  // Identity and acting-context reads have no UI query contract. In
  // particular, role/projection labels must not cross the authority boundary.
  target.search = '';
  return new Request(target, { method: 'GET', headers: request.headers });
};

const errorFromResponse = async (
  response: Response,
  requestId: string,
): Promise<PlatformConfigurationError> => {
  const parsed = parsePlatformConfigurationApiError(await readJson(response));
  if (parsed !== null) return parsed;
  return {
    code: response.status >= 500 ? 'DEPENDENCY_UNAVAILABLE' : 'INVALID_REQUEST',
    message:
      response.status >= 500
        ? 'Platform configuration is temporarily unavailable.'
        : 'This configuration response could not be read safely.',
    requestId,
  };
};

const blankPage = (input: {
  readonly requestId: string;
  readonly actorId: string | null;
  readonly actingPartyId: string | null;
  readonly csrfToken: string;
  readonly state: 'forbidden' | 'degraded';
  readonly access?: PlatformConfigurationAccess;
  readonly error?: PlatformConfigurationError;
}): PlatformConfigurationPageState => ({
  state: input.state,
  variant: input.state === 'degraded' ? 'degradedPage' : 'forbiddenHidden',
  access:
    input.access ?? (input.state === 'forbidden' ? 'not-rendered' : 'disabled'),
  actorId: input.actorId,
  actingPartyId: input.actingPartyId,
  capabilitySnapshot: [],
  csrfToken: input.csrfToken,
  requestId: input.requestId,
  key: null,
  effective: null,
  etag: null,
  lastVerifiedAt: null,
  notDisclosed: input.state === 'forbidden',
  ...(input.error === undefined ? {} : { error: input.error }),
});

const readIdentity = (request: Request, binding: unknown): Promise<Response> =>
  forwardIdentityAuthorityRequest(
    requestWithPath(request, '/api/v1/me/identity'),
    binding,
    '/api/v1/me/identity',
    'GET',
  );

const readContexts = (request: Request, binding: unknown): Promise<Response> =>
  forwardIdentityAuthorityRequest(
    requestWithPath(request, '/api/v1/me/acting-contexts'),
    binding,
    '/api/v1/me/acting-contexts',
    'GET',
  );

/**
 * Capability names are deliberately explicit (BE05a settings editor authority
 * projection). A generic role, facet, provider claim or legacy alias must never
 * be enough to select an administrative projection.
 *
 * - Read: `settings.read`, or any command authority below.
 * - Edit: the definition's own `ownerCapability` (CFG-05A-02), which CFG-05A-03
 *   requires on write; it is derived per definition, never from a fixed list.
 * - Approve, release and rollback: the exact keys the BE05a command RPCs
 *   authorize against.
 */
const READ_CAPABILITY = 'settings.read';
const COMMAND_CAPABILITIES = [
  'settings.approve',
  'settings.release',
  'settings.rollback',
] as const;

const hasCommandCapability = (
  capabilities: readonly string[],
  ownerCapability: string | null,
): boolean =>
  (ownerCapability !== null && capabilities.includes(ownerCapability)) ||
  COMMAND_CAPABILITIES.some((capability) => capabilities.includes(capability));

const classifyCapabilities = (
  capabilities: readonly string[],
  ownerCapability: string | null,
  responseReadVerified: boolean,
  resolverConfigured: boolean,
): Readonly<{
  readonly access: PlatformConfigurationAccess;
  readonly variant: PlatformConfigurationVariant;
  readonly readGranted: boolean;
}> => {
  const commandGranted = hasCommandCapability(capabilities, ownerCapability);
  const explicitRead = capabilities.includes(READ_CAPABILITY) || commandGranted;
  const readGranted =
    explicitRead || (responseReadVerified && !resolverConfigured);
  if (!readGranted) {
    return {
      access: 'not-rendered',
      variant: 'forbiddenHidden',
      readGranted: false,
    };
  }
  return {
    access: commandGranted ? 'full' : 'read-only',
    variant: 'adminStepUp',
    readGranted: true,
  };
};

type CapabilityResolution = Readonly<{
  readonly configured: boolean;
  readonly available: boolean;
  readonly capabilities: readonly string[];
}>;

const capabilityResolver = (
  binding: unknown,
):
  | ((input: PlatformConfigurationCapabilityResolutionInput) => unknown)
  | null => {
  // Own property only: a service binding on a modern compatibility date is an
  // RPC stub that answers `in` and property reads for ANY name, so a prototype
  // or proxy member is never the trusted server-side resolver.
  if (
    typeof binding !== 'object' ||
    binding === null ||
    !Object.hasOwn(binding, 'resolveCapabilities') ||
    typeof (binding as { resolveCapabilities?: unknown }).resolveCapabilities !==
      'function'
  ) {
    return null;
  }
  return (
    binding as {
      resolveCapabilities: (
        input: PlatformConfigurationCapabilityResolutionInput,
      ) => unknown;
    }
  ).resolveCapabilities;
};

const capabilityResolverRequestHeaders = [
  'accept',
  'cookie',
  'x-correlation-id',
  'x-request-id',
] as const;

const authorityRequest = (request: Request): Request => {
  const target = new URL(request.url);
  target.search = '';
  const headers = new Headers();
  for (const name of capabilityResolverRequestHeaders) {
    const value =
      name === 'cookie'
        ? filterPlatformConfigurationCookies(request.headers.get(name))
        : request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  // Capability/role/provider headers are intentionally not copied. A
  // server-only resolver receives verified session context, never caller
  // authority claims from the browser request.
  return new Request(target, { method: 'GET', headers });
};

const readServerCapabilities = async (
  binding: unknown,
  input: PlatformConfigurationCapabilityResolutionInput,
  projectFromWorker: boolean,
): Promise<CapabilityResolution> => {
  const resolver = capabilityResolver(binding);
  if (resolver === null) {
    // A production service binding exposes only `fetch`. When a page asks for
    // the capability projection, the protected Worker snapshot is the bridge;
    // any failure there is an empty list, which fails closed at the caller.
    return {
      configured: false,
      available: true,
      capabilities: projectFromWorker
        ? await readWorkerCapabilitySnapshot(input.request, binding)
        : [],
    };
  }
  try {
    const result = await resolver(input);
    const values = Array.isArray(result)
      ? result
      : typeof result === 'object' &&
          result !== null &&
          'capabilities' in result &&
          Array.isArray(result.capabilities)
        ? result.capabilities
        : [];
    return {
      configured: true,
      available: true,
      capabilities: parsePlatformConfigurationCapabilities(values),
    };
  } catch {
    return { configured: true, available: false, capabilities: [] };
  }
};

/**
 * Resolve protected Astro state in a fixed order: session, identity, acting
 * context, then effective value. URL role labels are intentionally ignored.
 */
export const resolvePlatformConfigurationPage = async (input: {
  readonly request: Request;
  readonly binding: unknown;
  readonly localApiOrigin?: string;
  readonly key?: string | null;
  readonly recordId?: string | null;
  readonly requestId?: string;
  readonly surface?: Surface;
  /**
   * Opt in to the acting-party-bound capability projection on a key-less
   * index read. A keyed index read always projects, because its command
   * affordances depend on it. The projection is the Worker's CFG-05B-07 answer
   * (or the trusted server-only resolver's) for the verified actor and acting
   * party; it is never derived from the request. Other pages keep the empty
   * snapshot.
   */
  readonly projectCapabilities?: boolean;
}): Promise<PlatformConfigurationPageResult> => {
  const requestId =
    input.requestId ??
    createRequestId(input.request.headers.get('x-request-id') ?? undefined);
  const key = input.key ?? null;
  const surface = input.surface ?? 'index';
  if (key !== null && !ConfigurationKeySchema.safeParse(key).success) {
    return { kind: 'invalid_key' };
  }
  const recordId = input.recordId ?? null;
  if (
    recordId !== null &&
    !ConfigurationUuidSchema.safeParse(recordId).success
  ) {
    return { kind: 'invalid_record' };
  }
  if (!hasPlatformConfigurationSession(input.request)) {
    return { kind: 'unauthenticated' };
  }

  const binding = resolvePlatformConfigurationBinding(
    input.binding,
    input.localApiOrigin,
  );
  const csrfToken = csrfCookie(input.request);
  let identityResponse: Response;
  try {
    identityResponse = await readIdentity(input.request, binding);
  } catch {
    return {
      kind: 'ready',
      page: blankPage({
        requestId,
        actorId: null,
        actingPartyId: null,
        csrfToken,
        state: 'degraded',
        error: {
          code: 'DEPENDENCY_UNAVAILABLE',
          message: 'Identity authority is temporarily unavailable.',
          requestId,
        },
      }),
    };
  }
  if (identityResponse.status === 401) return { kind: 'unauthenticated' };
  if (identityResponse.status === 403) {
    return {
      kind: 'ready',
      page: blankPage({
        requestId,
        actorId: null,
        actingPartyId: null,
        csrfToken,
        state: 'forbidden',
      }),
    };
  }
  if (!identityResponse.ok) {
    return {
      kind: 'ready',
      page: blankPage({
        requestId,
        actorId: null,
        actingPartyId: null,
        csrfToken,
        state: 'degraded',
        error: await errorFromResponse(identityResponse, requestId),
      }),
    };
  }
  const identity = PersonIdentityResponseSchema.safeParse(
    await readJson(identityResponse),
  );
  if (!identity.success) {
    return {
      kind: 'ready',
      page: blankPage({
        requestId,
        actorId: null,
        actingPartyId: null,
        csrfToken,
        state: 'degraded',
        error: {
          code: 'INVALID_REQUEST',
          message: 'Identity response failed validation.',
          requestId,
        },
      }),
    };
  }
  const actorId = identity.data.personId;

  let contextsResponse: Response;
  try {
    contextsResponse = await readContexts(input.request, binding);
  } catch {
    return {
      kind: 'ready',
      page: blankPage({
        requestId,
        actorId,
        actingPartyId: null,
        csrfToken,
        state: 'degraded',
        error: {
          code: 'DEPENDENCY_UNAVAILABLE',
          message: 'Acting context is temporarily unavailable.',
          requestId,
        },
      }),
    };
  }
  if (contextsResponse.status === 401) return { kind: 'unauthenticated' };
  if (contextsResponse.status === 403) {
    return {
      kind: 'ready',
      page: blankPage({
        requestId,
        actorId,
        actingPartyId: null,
        csrfToken,
        state: 'forbidden',
      }),
    };
  }
  if (!contextsResponse.ok) {
    return {
      kind: 'ready',
      page: blankPage({
        requestId,
        actorId,
        actingPartyId: null,
        csrfToken,
        state: 'degraded',
        error: await errorFromResponse(contextsResponse, requestId),
      }),
    };
  }
  const contexts = ActingContextListResponseSchema.safeParse(
    await readJson(contextsResponse),
  );
  if (!contexts.success) {
    return {
      kind: 'ready',
      page: blankPage({
        requestId,
        actorId,
        actingPartyId: null,
        csrfToken,
        state: 'degraded',
        error: {
          code: 'INVALID_REQUEST',
          message: 'Acting context response failed validation.',
          requestId,
        },
      }),
    };
  }
  const actingPartyId = contexts.data.items.find(
    (item) => item.selectable,
  )?.partyId;
  if (actingPartyId === undefined) {
    return {
      kind: 'ready',
      page: blankPage({
        requestId,
        actorId,
        actingPartyId: null,
        csrfToken,
        state: 'forbidden',
      }),
    };
  }

  const capabilityResolution = await readServerCapabilities(
    binding,
    {
      request: authorityRequest(input.request),
      actorId,
      actingPartyId,
      key,
      surface,
    },
    surface === 'index' && (key !== null || input.projectCapabilities === true),
  );
  if (!capabilityResolution.available) {
    return {
      kind: 'ready',
      page: blankPage({
        requestId,
        actorId,
        actingPartyId,
        csrfToken,
        state: 'degraded',
        error: {
          code: 'DEPENDENCY_UNAVAILABLE',
          message: 'Authorization is temporarily unavailable.',
          requestId,
        },
      }),
    };
  }

  // A detail URL has no read contract in BE05a. Keep it safe and truthful.
  if (surface === 'detail' || key === null) {
    return {
      kind: 'ready',
      page: {
        state: 'ready',
        variant: 'adminStepUp',
        access: 'read-only',
        actorId,
        actingPartyId,
        capabilitySnapshot:
          input.projectCapabilities === true && surface === 'index'
            ? capabilityResolution.capabilities
            : [],
        csrfToken,
        requestId,
        key,
        effective: null,
        etag: null,
        lastVerifiedAt: null,
        notDisclosed: surface === 'detail',
      },
    };
  }

  const path = `/api/v1/config/${encodeURIComponent(key)}/effective`;
  const effectiveRequest = requestWithPath(input.request, path);
  const sourceUrl = new URL(input.request.url);
  const targetUrl = new URL(effectiveRequest.url);
  const queryNames = [
    'environment',
    'partyId',
    'siteId',
    'route',
    'feature',
    'userId',
    'consumerKey',
    'supportedDefinitionVersions',
    'at',
  ];
  for (const name of queryNames) {
    for (const value of sourceUrl.searchParams.getAll(name))
      targetUrl.searchParams.append(name, value);
  }
  if (!targetUrl.searchParams.has('consumerKey'))
    targetUrl.searchParams.set('consumerKey', 'web.platform-configuration');
  if (!targetUrl.searchParams.has('supportedDefinitionVersions'))
    targetUrl.searchParams.set('supportedDefinitionVersions', '1');
  const canonicalRequest = new Request(targetUrl, {
    method: 'GET',
    headers: input.request.headers,
  });
  let effectiveResponse: Response;
  try {
    effectiveResponse = await forwardPlatformConfigurationRequest(
      canonicalRequest,
      binding,
      path,
      'GET',
    );
  } catch {
    effectiveResponse = new Response(null, { status: 503 });
  }
  if (effectiveResponse.status === 401) return { kind: 'unauthenticated' };
  if (effectiveResponse.status === 403) {
    return {
      kind: 'ready',
      page: blankPage({
        requestId,
        actorId,
        actingPartyId,
        csrfToken,
        state: 'forbidden',
      }),
    };
  }
  if (effectiveResponse.status === 404) {
    return {
      kind: 'ready',
      page: {
        state: 'forbidden',
        variant: 'forbiddenHidden',
        access: 'not-rendered',
        actorId,
        actingPartyId,
        capabilitySnapshot: [],
        csrfToken,
        requestId,
        key,
        effective: null,
        etag: null,
        lastVerifiedAt: null,
        notDisclosed: true,
      },
    };
  }
  if (!effectiveResponse.ok) {
    return {
      kind: 'ready',
      page: {
        state: 'degraded',
        variant: 'degradedPage',
        access: 'disabled',
        actorId,
        actingPartyId,
        capabilitySnapshot: [],
        csrfToken,
        requestId,
        key,
        effective: null,
        etag: null,
        lastVerifiedAt: null,
        notDisclosed: false,
        error: await errorFromResponse(effectiveResponse, requestId),
      },
    };
  }
  const capabilities = [...new Set(capabilityResolution.capabilities)];
  const parsedEffective = parseEffectiveValue(
    await readJson(effectiveResponse),
  );
  const presentation = classifyCapabilities(
    capabilities,
    parsedEffective?.ownerCapability ?? null,
    effectiveResponse.ok,
    capabilityResolution.configured,
  );
  if (!presentation.readGranted) {
    return {
      kind: 'ready',
      page: blankPage({
        requestId,
        actorId,
        actingPartyId,
        csrfToken,
        state: 'forbidden',
        access: 'not-rendered',
      }),
    };
  }
  if (parsedEffective === null) {
    return {
      kind: 'ready',
      page: {
        state: 'degraded',
        variant: 'degradedPage',
        access: 'disabled',
        actorId,
        actingPartyId,
        capabilitySnapshot: [],
        csrfToken,
        requestId,
        key,
        effective: null,
        etag: null,
        lastVerifiedAt: null,
        notDisclosed: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Effective configuration response failed validation.',
          requestId,
        },
      },
    };
  }
  const effective = {
    ...parsedEffective,
    // Keep the page state disclosure-safe even before the app-state projection
    // applies its second sanitization pass.
    typedValue: sanitizeConfigurationValue(
      parsedEffective.typedValue,
    ) as Cfg05a02EffectiveValueResponse['typedValue'],
  };
  return {
    kind: 'ready',
    page: {
      state: 'ready',
      variant: presentation.variant,
      access: presentation.access,
      actorId,
      actingPartyId,
      capabilitySnapshot: capabilities,
      csrfToken,
      requestId,
      key,
      effective,
      etag: effectiveResponse.headers.get('etag'),
      lastVerifiedAt: effective.evaluatedAt,
      notDisclosed: false,
    },
  };
};

export { hasPlatformConfigurationSession };
