import {
  normalizeAuthProductionOptions,
  type AuthProductionOptions,
} from './authentication/production-configuration';

import {
  configuredOriginList,
  createCmsEditorialSessionResolver,
  validateOriginList,
} from './cms-editorial-production-session';
import { createRateLimiter } from './cms-editorial-production-rate';
import {
  createCmsEditorialRpcCaller,
  cmsEditorialResourcePort,
} from './cms-editorial-production-ports';
import {
  defaultCmsEditorialLogger,
  productionCmsEditorialTelemetry,
} from './cms-editorial-production-telemetry';
import {
  CMS_EDITORIAL_DEADLINE_MS,
  DEFAULT_DEADLINE_MS,
  MAX_DEFAULT_RESPONSE_BYTES,
  CmsEditorialProductionConfigurationError,
  type CmsEditorialProductionConfiguration,
  type CmsEditorialProductionOptions,
  type CmsEditorialRateLimitInput,
  type CmsEditorialSession,
  type CmsEditorialServerSessionContext,
  type CmsEditorialTelemetryEvent,
} from './cms-editorial-production-types';
import type {
  EntryCreateResource,
  EntryDraftDetailResource,
  EntryRevisionResource,
  RevisionHistoryPage,
} from '@wejammin/contracts';

export { CMS_EDITORIAL_RPC } from './cms-editorial-production-types';
export type { CmsEditorialProductionOperationId } from './cms-editorial-production-types';

/** Port map the route layer consumes; one member per declared operation. */
export type CmsEditorialPorts = Readonly<{
  appendRevision: (
    input: import('./cms-editorial-production-session').CmsEditorialPortInput,
    signal: AbortSignal,
  ) => Promise<
    import('./cms-editorial-production-types').CmsEditorialProductionResult<EntryRevisionResource>
  >;
  resolveConflict: (
    input: import('./cms-editorial-production-session').CmsEditorialPortInput,
    signal: AbortSignal,
  ) => Promise<
    import('./cms-editorial-production-types').CmsEditorialProductionResult<EntryRevisionResource>
  >;
  createEntry: (
    input: import('./cms-editorial-production-session').CmsEditorialPortInput,
    signal: AbortSignal,
  ) => Promise<
    import('./cms-editorial-production-types').CmsEditorialProductionResult<EntryCreateResource>
  >;
  getEntryDraft: (
    input: import('./cms-editorial-production-session').CmsEditorialPortInput,
    signal: AbortSignal,
  ) => Promise<
    import('./cms-editorial-production-types').CmsEditorialProductionResult<EntryDraftDetailResource>
  >;
  listRevisions: (
    input: import('./cms-editorial-production-session').CmsEditorialPortInput,
    signal: AbortSignal,
  ) => Promise<
    import('./cms-editorial-production-types').CmsEditorialProductionResult<RevisionHistoryPage>
  >;
}>;

/**
 * Editorial dependency bundle. The route layer treats this as its server
 * boundary: session, rate, origin, and transport all resolve server-side.
 * The annotation is intentionally structural so it can be pinned to the
 * sibling `CmsEditorialDependencies` without editing this module's body.
 */
export type CmsEditorialProductionDependencies = Readonly<{
  ports: CmsEditorialPorts;
  resolveSession: (
    request: Request,
    signal: AbortSignal,
  ) => Promise<
    import('./cms-editorial-production-types').CmsEditorialProductionResult<CmsEditorialSession>
  >;
  rateLimit: (
    input: CmsEditorialRateLimitInput,
    signal: AbortSignal,
  ) => Promise<
    import('./cms-editorial-production-types').CmsEditorialProductionResult<
      import('./cms-editorial-production-types').CmsEditorialRateLimitDecision
    >
  >;
  humanOrigins: readonly string[];
  now?: () => number;
  deadlineMs?: number;
  telemetry?: (event: CmsEditorialTelemetryEvent) => void | Promise<void>;
}>;

/**
 * Compose the CMS-03B editorial dependency from the protected Supabase RPC
 * transport. Every authority input is derived here from the verified session;
 * no browser payload can name an actor, owner, assignee, capability, or version.
 */
export const createProductionCmsEditorialDependencies = (
  options: CmsEditorialProductionOptions,
): CmsEditorialProductionDependencies => {
  let authConfiguration: CmsEditorialProductionConfiguration;
  try {
    const authOptions: AuthProductionOptions = {
      environment: options.environment,
      ...(options.fetchImpl === undefined
        ? {}
        : { fetchImpl: options.fetchImpl }),
    };
    const normalized = normalizeAuthProductionOptions(authOptions);
    authConfiguration = {
      baseUrl: normalized.baseUrl,
      secret: normalized.secret,
      fetchImpl: normalized.fetchImpl,
      maxResponseBytes: MAX_DEFAULT_RESPONSE_BYTES,
      now: options.now ?? Date.now,
    };
  } catch (error) {
    throw new CmsEditorialProductionConfigurationError(
      error instanceof Error ? error.message : undefined,
    );
  }

  const deadlineMs = options.deadlineMs ?? DEFAULT_DEADLINE_MS;
  const maxResponseBytes =
    options.maxResponseBytes ?? MAX_DEFAULT_RESPONSE_BYTES;
  if (
    !Number.isSafeInteger(deadlineMs) ||
    deadlineMs < 1 ||
    deadlineMs > DEFAULT_DEADLINE_MS ||
    !Number.isSafeInteger(maxResponseBytes) ||
    maxResponseBytes < 1
  )
    throw new CmsEditorialProductionConfigurationError();

  const configuration: CmsEditorialProductionConfiguration = {
    ...authConfiguration,
    maxResponseBytes,
  };
  const telemetry =
    options.telemetry ??
    productionCmsEditorialTelemetry(
      options.logger ?? defaultCmsEditorialLogger(options.environment),
    );
  const humanOrigins = validateOriginList(
    options.humanOrigins ??
      configuredOriginList(options.environment.CMS_HUMAN_ORIGINS),
    CmsEditorialProductionConfigurationError,
  );

  const sessionContexts = new WeakMap<
    Request,
    CmsEditorialServerSessionContext
  >();
  const resolveSession = createCmsEditorialSessionResolver(
    options,
    configuration,
    sessionContexts,
  );
  const rateLimit = createRateLimiter(options);
  const appendRevision = cmsEditorialResourcePort<EntryRevisionResource>(
    createCmsEditorialRpcCaller(
      configuration,
      sessionContexts,
      'CMS-03B-01',
      Math.min(deadlineMs, CMS_EDITORIAL_DEADLINE_MS['CMS-03B-01']),
    ),
    'CMS-03B-01',
  );
  const resolveConflict = cmsEditorialResourcePort<EntryRevisionResource>(
    createCmsEditorialRpcCaller(
      configuration,
      sessionContexts,
      'CMS-03B-02',
      Math.min(deadlineMs, CMS_EDITORIAL_DEADLINE_MS['CMS-03B-02']),
    ),
    'CMS-03B-02',
  );
  const createEntry = cmsEditorialResourcePort<EntryCreateResource>(
    createCmsEditorialRpcCaller(
      configuration,
      sessionContexts,
      'CMS-03B-10',
      Math.min(deadlineMs, CMS_EDITORIAL_DEADLINE_MS['CMS-03B-10']),
    ),
    'CMS-03B-10',
  );
  const getEntryDraft = cmsEditorialResourcePort<EntryDraftDetailResource>(
    createCmsEditorialRpcCaller(
      configuration,
      sessionContexts,
      'CMS-03B-11',
      Math.min(deadlineMs, CMS_EDITORIAL_DEADLINE_MS['CMS-03B-11']),
    ),
    'CMS-03B-11',
  );
  const listRevisions = cmsEditorialResourcePort<RevisionHistoryPage>(
    createCmsEditorialRpcCaller(
      configuration,
      sessionContexts,
      'CMS-03B-03',
      Math.min(deadlineMs, CMS_EDITORIAL_DEADLINE_MS['CMS-03B-03']),
    ),
    'CMS-03B-03',
  );

  return {
    ports: {
      appendRevision,
      resolveConflict,
      createEntry,
      getEntryDraft,
      listRevisions,
    },
    resolveSession,
    rateLimit,
    humanOrigins,
    now: configuration.now,
    deadlineMs,
    telemetry,
  };
};

export type { CmsEditorialProductionOptions } from './cms-editorial-production-types';
export { CmsEditorialProductionConfigurationError } from './cms-editorial-production-types';
