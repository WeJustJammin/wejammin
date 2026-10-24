import { CmsUuidSchema } from '@wejammin/contracts';

import { validHumanSession } from './cms-editorial/admission-identity';
import { noteStage } from './cms-composition/observability-facts';
import { cmsEditorialContextFor } from './cms-editorial-production-session';
import type {
  CmsEditorialProductionConfiguration,
  CmsEditorialServerSessionContext,
  CmsEditorialSession,
} from './cms-editorial-production-types';

/** What the helper needs of a port input: the original Request, the request id and the session the route admitted. */
export type FreshContextInput = Readonly<{
  request: Request;
  requestId: string;
  session: CmsEditorialSession;
}>;
/** A refusal in the caller's own catalog: the helper only reads these members of it. */
type FreshContextRefusal = Readonly<{
  ok: false;
  status: number;
  details?: Readonly<Record<string, unknown>>;
  retryAfterSeconds?: number;
}>;
/** The three refusals the helper raises itself; any status the fresh resolution reports is also forwarded. */
type LocalStatus = 400 | 401 | 502;
type FreshContextOutcome<T, Refusal extends FreshContextRefusal> =
  Readonly<{ ok: true; value: T }> | Refusal;

export type FreshContextPorts<
  Input extends FreshContextInput,
  Refusal extends FreshContextRefusal,
> = Readonly<{
  contexts: WeakMap<Request, CmsEditorialServerSessionContext>;
  /** The session resolver of the boundary; its answer is judged by `validEnvelope`, so it is typed `unknown` here. */
  resolveSession: (request: Request, signal: AbortSignal) => Promise<unknown>;
  configuration: CmsEditorialProductionConfiguration;
  /** The caller's catalog constructor: the message and code of every refusal come from here, never from the helper. */
  failure: (
    status: LocalStatus | Refusal['status'],
    details?: Readonly<Record<string, unknown>>,
    retryAfterSeconds?: number,
  ) => Refusal;
  /** The caller's envelope guard for a settled answer (an object with a boolean `ok`, a status when refused). */
  validEnvelope: <T>(
    value: unknown,
  ) => value is FreshContextOutcome<T, Refusal>;
  /**
   * The capability decision, made on the REFRESHED session (never the admitted one): `null` admits, a refusal is
   * returned verbatim. It runs only after the identity re-proof has passed, so a drifted session is a 401, not a 403.
   */
  authorize: (session: CmsEditorialSession, input: Input) => Refusal | null;
}>;

/**
 * The request-bound server authority shared by every Slice 12 production RPC adapter (pattern update, pattern
 * definition, governed review). The RPC context is rebuilt from a FRESH resolution of the very Request the route
 * admitted: the same session, user, acting party and person must come back (anything else is a 401), the caller's
 * capability decision is taken on the refreshed session before any network, and the public body never names the actor,
 * party or capability. The database re-proves all of it under its own locks; this is the transport convenience, not the
 * authority.
 */
export const createFreshContextVerifier = <
  Input extends FreshContextInput,
  Refusal extends FreshContextRefusal,
>(
  ports: FreshContextPorts<Input, Refusal>,
): ((
  input: Input,
  signal: AbortSignal,
) => Promise<
  FreshContextOutcome<Readonly<Record<string, unknown>>, Refusal>
>) => {
  const { contexts, resolveSession, configuration, failure, authorize } = ports;
  return async (input, signal) => {
    // BE03c Observability trace stage: the fresh re-proof is the registry/projection refetch before the RPC.
    noteStage(input.request, 'registry_refetch');
    if (!CmsUuidSchema.safeParse(input.requestId).success) return failure(400);
    const header = input.request.headers.get('x-request-id');
    if (CmsUuidSchema.safeParse(header).success && header !== input.requestId)
      return failure(400);
    const old = contexts.get(input.request);
    if (
      old === undefined ||
      old.authUserId !== input.session.userId ||
      old.actingPartyId !== input.session.actingPartyId
    )
      return failure(401);
    const refreshed = await resolveSession(input.request, signal);
    if (!ports.validEnvelope<CmsEditorialSession>(refreshed))
      return failure(502);
    if (!refreshed.ok)
      return failure(
        refreshed.status,
        refreshed.details,
        refreshed.retryAfterSeconds,
      );
    const current = contexts.get(input.request);
    if (
      current === undefined ||
      current.authUserId !== old.authUserId ||
      current.sessionId !== old.sessionId ||
      current.actorPersonId !== old.actorPersonId ||
      current.actingPartyId !== old.actingPartyId ||
      validHumanSession(refreshed.value) !== null
    )
      return failure(401);
    const refusal = authorize(refreshed.value, input);
    if (refusal !== null) return refusal;
    return {
      ok: true,
      value: cmsEditorialContextFor(
        { ...input, session: refreshed.value },
        contexts,
        configuration.now,
      ),
    };
  };
};
