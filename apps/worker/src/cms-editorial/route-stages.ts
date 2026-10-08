import type { CmsEditorialDependencies } from './types';

/**
 * Which pipeline stages a request actually entered (BE03b "Observability":
 * traces cover validation -> principal -> rate limit -> RPC -> response). The
 * route never has to remember to mark a stage: the injected seams are wrapped
 * once at registration and record, per request object, that they were reached.
 * Telemetry therefore cannot claim an RPC or an acceptance for a request that
 * was refused before the database was called.
 */

export type RouteStage = 'authority' | 'rate_limit' | 'rpc';

const entered = new WeakMap<Request, Set<RouteStage>>();

const mark = (request: Request, stage: RouteStage): void => {
  const stages = entered.get(request) ?? new Set<RouteStage>();
  stages.add(stage);
  entered.set(request, stages);
};

export const stagesEntered = (request: Request): ReadonlySet<RouteStage> =>
  entered.get(request) ?? new Set<RouteStage>();

/** The acting-context class of the verified session, never an identifier. */
export type ActingContextClass = 'none' | 'party';

const actingContexts = new WeakMap<Request, ActingContextClass>();

export const actingContextOf = (request: Request): ActingContextClass =>
  actingContexts.get(request) ?? 'none';

type PortFunction = (
  input: { request: Request },
  signal: AbortSignal,
) => Promise<unknown>;

const instrumentPorts = (
  ports: CmsEditorialDependencies['ports'],
): CmsEditorialDependencies['ports'] =>
  // Every member of `ports` is a function: the optional ports are absent, never
  // `undefined` (exactOptionalPropertyTypes), and `Object.entries` lists only
  // own members that exist. So each one is wrapped and no member needs a
  // pass-through branch.
  Object.fromEntries(
    Object.entries(ports).map(([name, port]) => [
      name,
      (input: { request: Request }, signal: AbortSignal) => {
        mark(input.request, 'rpc');
        return (port as PortFunction)(input, signal);
      },
    ]),
  ) as unknown as CmsEditorialDependencies['ports'];

export const instrumentDependencies = (
  dependencies: CmsEditorialDependencies,
): CmsEditorialDependencies => ({
  ...dependencies,
  ports: instrumentPorts(dependencies.ports),
  resolveSession: async (request, signal) => {
    mark(request, 'authority');
    const result = await dependencies.resolveSession(request, signal);
    if (result.ok)
      actingContexts.set(
        request,
        result.value.actingPartyId === null ? 'none' : 'party',
      );
    return result;
  },
  rateLimit: (input, signal) => {
    mark(input.request, 'rate_limit');
    return dependencies.rateLimit(input, signal);
  },
});
