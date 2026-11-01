import { CmsUuidSchema } from '@wejammin/contracts';

import { normalizeAuthProductionOptions } from './authentication/production-configuration';
import {
  cmsEditorialContextFor,
  createCmsEditorialSessionResolver,
} from './cms-editorial-production-session';
import type { CmsEditorialSession } from './cms-editorial/types';
import type {
  CmsEditorialProductionConfiguration,
  CmsEditorialProductionOptions,
  CmsEditorialServerSessionContext,
} from './cms-editorial-production-types';
import {
  boundedBytes,
  failure,
  MIN_TAXONOMY_ERROR_BYTES,
  operationAuthority,
  validEnvelope,
} from './cms-composition/taxonomy-definition-shared';
import {
  createTaxonomyDefinitionRpc,
  type TaxonomyContextVerifier,
  type TaxonomyRpc,
} from './cms-composition-production-taxonomy-definition-versions';

/**
 * Request-bound server authority of every taxonomy RPC (CMS-03C-03, -16, -17 and the two reads). The RPC context is
 * rebuilt from a FRESH session resolution of the very Request the route admitted: the same session and acting party
 * must come back (a different one is a 401), the operation's capability is proved again (a revoked grant is a 403
 * before any network), and the public body never names the actor, party or capability. The database re-proves all of it
 * under its own locks regardless; this is the transport convenience, not the authority.
 */
export const createTaxonomyContextVerifier =
  (
    contexts: WeakMap<Request, CmsEditorialServerSessionContext>,
    resolveSession: ReturnType<typeof createCmsEditorialSessionResolver>,
    configuration: CmsEditorialProductionConfiguration,
  ): TaxonomyContextVerifier =>
  async (input, signal) => {
    if (!CmsUuidSchema.safeParse(input.requestId).success) return failure(400);
    const header = input.request.headers.get('x-request-id');
    if (CmsUuidSchema.safeParse(header).success && header !== input.requestId)
      return failure(400);
    const old = contexts.get(input.request);
    if (
      old === undefined ||
      old.authUserId !== input.session?.userId ||
      old.actingPartyId !== input.session?.actingPartyId
    )
      return failure(401);
    const refreshed = await resolveSession(input.request, signal);
    if (!validEnvelope<CmsEditorialSession>(refreshed)) return failure(502);
    if (!refreshed.ok)
      return failure(
        refreshed.status,
        refreshed.details,
        refreshed.retryAfterSeconds,
      );
    const current = contexts.get(input.request);
    if (
      current === undefined ||
      current.sessionId !== old.sessionId ||
      current.authUserId !== old.authUserId ||
      current.actingPartyId !== old.actingPartyId ||
      current.actorPersonId !== old.actorPersonId
    )
      return failure(401);
    const authority = operationAuthority(refreshed.value, input.operationId);
    if (authority !== null) return authority;
    return {
      ok: true,
      value: cmsEditorialContextFor(
        { ...input, session: refreshed.value },
        contexts,
        configuration.now,
      ),
    };
  };

export type TaxonomyTransport = Readonly<{
  configuration: CmsEditorialProductionConfiguration;
  deadlineMs: number;
  resolveSession: ReturnType<typeof createCmsEditorialSessionResolver>;
  rpc: TaxonomyRpc;
}>;

/**
 * One taxonomy transport per production boundary: the protected Supabase RPC configuration (the 256 KiB response ceiling
 * is never raised by an option; a budget that cannot carry a typed envelope, or a non-positive deadline, is refused at
 * composition), the request-bound session resolver, the fresh-context verifier and the named-RPC caller. The 15,000 ms
 * ceiling is the command deadline; each operation narrows it to its own (reads 8,000 ms).
 */
export const createTaxonomyTransport = (
  options: CmsEditorialProductionOptions,
): TaxonomyTransport => {
  const normalized = normalizeAuthProductionOptions({
    environment: options.environment,
    ...(options.fetchImpl === undefined
      ? {}
      : { fetchImpl: options.fetchImpl }),
  });
  if (
    (options.maxResponseBytes !== undefined &&
      (!Number.isSafeInteger(options.maxResponseBytes) ||
        options.maxResponseBytes < MIN_TAXONOMY_ERROR_BYTES)) ||
    (options.deadlineMs !== undefined &&
      (!Number.isSafeInteger(options.deadlineMs) || options.deadlineMs < 1))
  )
    throw new Error('Invalid CMS taxonomy configuration.');
  const deadlineMs = Math.min(options.deadlineMs ?? 15000, 15000);
  const configuration: CmsEditorialProductionConfiguration = {
    baseUrl: normalized.baseUrl,
    secret: normalized.secret,
    fetchImpl: normalized.fetchImpl,
    maxResponseBytes: boundedBytes(options.maxResponseBytes),
    now: options.now ?? Date.now,
  };
  const contexts = new WeakMap<Request, CmsEditorialServerSessionContext>();
  const resolveSession = createCmsEditorialSessionResolver(
    options,
    configuration,
    contexts,
  );
  const verify = createTaxonomyContextVerifier(
    contexts,
    resolveSession,
    configuration,
  );
  return {
    configuration,
    deadlineMs,
    resolveSession,
    rpc: createTaxonomyDefinitionRpc(configuration, verify, deadlineMs),
  };
};
