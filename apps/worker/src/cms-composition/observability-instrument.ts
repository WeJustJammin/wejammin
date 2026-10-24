import { noteFacts, noteStage } from './observability-facts';

type Seam = (input: unknown, signal: AbortSignal) => unknown;

/** Port names of a family: a write reserves an idempotency key in its RPC, a read does not. */
export type InstrumentedPorts<Dependencies> = Readonly<{
  writes?: readonly (keyof Dependencies & string)[];
  reads?: readonly (keyof Dependencies & string)[];
}>;

const requestOf = (input: unknown): Request | null => {
  const request =
    typeof input === 'object' && input !== null
      ? (input as { request?: unknown }).request
      : undefined;
  return request instanceof Request ? request : null;
};

/** Observation is non-authoritative: a result the route will reject (or that throws on access) reads as unknown. */
const actingContextOf = (result: unknown): 'none' | 'party' | null => {
  try {
    if (typeof result !== 'object' || result === null) return null;
    const { ok, value } = result as { ok?: unknown; value?: unknown };
    if (ok !== true || typeof value !== 'object' || value === null) return null;
    return (value as { actingPartyId?: unknown }).actingPartyId === null
      ? 'none'
      : 'party';
  } catch {
    return null;
  }
};

/**
 * Wraps a Slice 12 route family's seams once, at registration, so its request event lists only the stages the
 * request really reached (the Slice 11 `instrumentDependencies` approach): the session resolver is the
 * principal/assignment stage, a write port is the idempotency and RPC stages, a read port the RPC stage. A
 * refusal before a seam is called therefore never claims it. The wrappers pass every argument and result
 * through unchanged.
 */
export const instrumentComposition = <Dependencies extends object>(
  dependencies: Dependencies,
  ports: InstrumentedPorts<Dependencies>,
): Dependencies => {
  const source = dependencies as unknown as Record<string, unknown>;
  const wrapped: Record<string, unknown> = { ...source };
  const resolve = source.resolveSession as
    ((request: Request, signal: AbortSignal) => Promise<unknown>) | undefined;
  if (resolve !== undefined)
    wrapped.resolveSession = async (request: Request, signal: AbortSignal) => {
      noteStage(request, 'principal_assignment');
      const result = await resolve(request, signal);
      const acting = actingContextOf(result);
      if (acting !== null) noteFacts(request, { actingContext: acting });
      return result;
    };
  const wrap = (name: string, write: boolean): void => {
    const port = source[name] as Seam | undefined;
    if (port === undefined) return;
    wrapped[name] = (input: unknown, signal: AbortSignal) => {
      const request = requestOf(input);
      if (request !== null) {
        if (write) noteStage(request, 'idempotency');
        noteStage(request, 'rpc');
      }
      return port(input, signal);
    };
  };
  for (const name of ports.writes ?? []) wrap(name, true);
  for (const name of ports.reads ?? []) wrap(name, false);
  return wrapped as Dependencies;
};
