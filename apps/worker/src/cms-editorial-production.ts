import {
  normalizeAuthProductionOptions,
  type AuthProductionOptions,
} from './authentication/production-configuration';

import {
  configuredOriginList,
  createCmsEditorialSessionResolver,
  validateOriginList,
  type CmsEditorialPortInput,
} from './cms-editorial-production-session';
import { createRateLimiter } from './cms-editorial-production-rate';
import {
  createCmsEditorialRpcCaller,
  cmsEditorialRestorePort,
  cmsEditorialResourcePort,
  type CmsEditorialRestorePortValue,
} from './cms-editorial-production-ports';
import { errorResult } from './cms-editorial-production-errors';
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
  type CmsEditorialProductionOperationId,
  type CmsEditorialProductionOptions,
  type CmsEditorialProductionResult,
  type CmsEditorialRateLimitDecision,
  type CmsEditorialRateLimitInput,
  type CmsEditorialSession,
  type CmsEditorialServerSessionContext,
  type CmsEditorialTelemetryEvent,
} from './cms-editorial-production-types';
import type {
  AuthoringContextResource,
  ConflictDetailResource,
  EntryCreateResource,
  EntryDraftDetailResource,
  EntryListPage,
  EntryRevisionResource,
  RevisionHistoryPage,
} from '@wejammin/contracts';

/**
 * BE03b line 1300: concurrent revision writes cap at three per actor. The
 * fourth in-flight write for one actor is refused before any RPC call, and the
 * count is per acting user so one actor cannot exhaust another's budget.
 */
const MAX_CONCURRENT_REVISION_WRITES = 3;

/** One protected editorial port: a server-derived input in, a typed result out. */
type CmsEditorialPort<T> = (
  input: CmsEditorialPortInput,
  signal: AbortSignal,
) => Promise<CmsEditorialProductionResult<T>>;

/** Wrap a revision-write port with a deterministic per-actor concurrency cap. */
const withActorConcurrencyCap = <T>(
  port: CmsEditorialPort<T>,
): CmsEditorialPort<T> => {
  const inFlightByActor = new Map<string, number>();
  return async (input, signal) => {
    const actor = input.session?.userId ?? 'anonymous';
    const inFlight = inFlightByActor.get(actor) ?? 0;
    if (inFlight >= MAX_CONCURRENT_REVISION_WRITES)
      return errorResult(
        429,
        'RATE_LIMITED',
        'Too many concurrent CMS editorial requests.',
        { limit: MAX_CONCURRENT_REVISION_WRITES },
      );
    inFlightByActor.set(actor, inFlight + 1);
    try {
      return await port(input, signal);
    } finally {
      // The slot was counted before the call, so it is always present here.
      const remaining = (inFlightByActor.get(actor) as number) - 1;
      if (remaining <= 0) inFlightByActor.delete(actor);
      else inFlightByActor.set(actor, remaining);
    }
  };
};

export { CMS_EDITORIAL_RPC } from './cms-editorial-production-types';
export type { CmsEditorialProductionOperationId } from './cms-editorial-production-types';

/** Port map the route layer consumes; one member per declared operation. */
export type CmsEditorialPorts = Readonly<{
  appendRevision: CmsEditorialPort<EntryRevisionResource>;
  resolveConflict: CmsEditorialPort<EntryRevisionResource>;
  createEntry: CmsEditorialPort<EntryCreateResource>;
  getEntryDraft: CmsEditorialPort<EntryDraftDetailResource>;
  listRevisions: CmsEditorialPort<RevisionHistoryPage>;
  restoreRevision: CmsEditorialPort<CmsEditorialRestorePortValue>;
  getConflictDetail: CmsEditorialPort<ConflictDetailResource>;
  listEntries: CmsEditorialPort<EntryListPage>;
  getAuthoringContext: CmsEditorialPort<AuthoringContextResource>;
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
  ) => Promise<CmsEditorialProductionResult<CmsEditorialSession>>;
  rateLimit: (
    input: CmsEditorialRateLimitInput,
    signal: AbortSignal,
  ) => Promise<CmsEditorialProductionResult<CmsEditorialRateLimitDecision>>;
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
  // One RPC caller per declared operation; the deadline is the smaller of the
  // configured ceiling and the operation's own budget.
  const callerFor = (operationId: CmsEditorialProductionOperationId) =>
    createCmsEditorialRpcCaller(
      configuration,
      sessionContexts,
      operationId,
      Math.min(deadlineMs, CMS_EDITORIAL_DEADLINE_MS[operationId]),
    );
  const appendRevision = cmsEditorialResourcePort<EntryRevisionResource>(
    withActorConcurrencyCap(callerFor('CMS-03B-01')),
    'CMS-03B-01',
  );
  const resolveConflict = cmsEditorialResourcePort<EntryRevisionResource>(
    callerFor('CMS-03B-02'),
    'CMS-03B-02',
  );
  const createEntry = cmsEditorialResourcePort<EntryCreateResource>(
    callerFor('CMS-03B-10'),
    'CMS-03B-10',
  );
  const getEntryDraft = cmsEditorialResourcePort<EntryDraftDetailResource>(
    callerFor('CMS-03B-11'),
    'CMS-03B-11',
  );
  const listRevisions = cmsEditorialResourcePort<RevisionHistoryPage>(
    callerFor('CMS-03B-03'),
    'CMS-03B-03',
  );
  const restoreRevision = cmsEditorialRestorePort(callerFor('CMS-03B-04'));
  const getConflictDetail = cmsEditorialResourcePort<ConflictDetailResource>(
    callerFor('CMS-03B-12'),
    'CMS-03B-12',
  );
  const listEntries = cmsEditorialResourcePort<EntryListPage>(
    callerFor('CMS-03B-13'),
    'CMS-03B-13',
  );
  const getAuthoringContext =
    cmsEditorialResourcePort<AuthoringContextResource>(
      callerFor('CMS-03B-14'),
      'CMS-03B-14',
    );

  return {
    ports: {
      appendRevision,
      resolveConflict,
      createEntry,
      getEntryDraft,
      listRevisions,
      restoreRevision,
      getConflictDetail,
      listEntries,
      getAuthoringContext,
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
