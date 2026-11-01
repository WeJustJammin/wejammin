import { createProductionCmsTemplateDependencies } from '../../../apps/worker/src/cms-composition-production';
import { createProductionCmsLocaleDependencies } from '../../../apps/worker/src/cms-composition-production-locale';
import type { CmsLocaleDependencies } from '../../../apps/worker/src/cms-composition/locale-routes';
import type { CmsTemplateDependencies } from '../../../apps/worker/src/cms-composition/template-routes';
import type { S10RealBindings } from './s10-real-editorial';
import { claimsOf, options } from './s12-real-governed';

/**
 * The template (CMS-03C-01 and its two reads) and locale (CMS-03C-04) boundaries of the real-route
 * API Worker have two homes. The test-owned fixtures (`cms-template-fixture.ts`,
 * `cms-locale-fixture.ts`) answer lane and legacy fixture sessions, so the older real-route specs
 * and their fixture seams are untouched. A session that carries the Slice 11/12 claims (party,
 * person, capabilities) goes through the PRODUCTION composition over the local stack, exactly as
 * the Worker serves it. Without this a signed-in Slice 11/12 session was a 401 from the fixture
 * and the web loader redirected to sign-in in ~12 ms with no API request (pw5 run 1).
 *
 * The decision is made once per request, in `resolveSession`, and remembered by Request identity:
 * every later port call of that request (rate limit, read, write) follows it, so one request never
 * mixes the two homes. Telemetry has no request and stays with the base port.
 */
type Resolve = (request: Request, signal: AbortSignal) => Promise<unknown>;
type Port = (input: { request: Request }, signal: AbortSignal) => unknown;
type Routable = Readonly<{
  resolveSession: Resolve;
  humanOrigins: readonly string[];
}>;

const routedDependencies = <T extends Routable>(
  base: T,
  production: T,
  revokedSessionIds: ReadonlySet<string>,
  portNames: readonly string[],
): T => {
  const real = new WeakSet<Request>();
  const routed: Record<string, unknown> = {
    ...base,
    resolveSession: async (request: Request, signal: AbortSignal) => {
      if ((await claimsOf(request, revokedSessionIds)) === null)
        return base.resolveSession(request, signal);
      real.add(request);
      return production.resolveSession(request, signal);
    },
    humanOrigins: [
      ...new Set([...base.humanOrigins, ...production.humanOrigins]),
    ],
  };
  for (const name of portNames)
    routed[name] = (input: { request: Request }, signal: AbortSignal) => {
      const home = (real.has(input.request)
        ? production
        : base) as unknown as Record<string, Port>;
      return home[name]!(input, signal);
    };
  return routed as unknown as T;
};

export const createS12RealTemplate = (
  base: CmsTemplateDependencies,
  bindings: S10RealBindings,
  revokedSessionIds: ReadonlySet<string>,
): CmsTemplateDependencies =>
  routedDependencies(
    base,
    createProductionCmsTemplateDependencies(
      options(bindings, revokedSessionIds),
    ),
    revokedSessionIds,
    ['rateLimit', 'defineTemplate', 'readContext', 'readLatest'],
  );

export const createS12RealLocale = (
  base: CmsLocaleDependencies,
  bindings: S10RealBindings,
  revokedSessionIds: ReadonlySet<string>,
): CmsLocaleDependencies =>
  routedDependencies(
    base,
    createProductionCmsLocaleDependencies(options(bindings, revokedSessionIds)),
    revokedSessionIds,
    ['rateLimit', 'authorLocale', 'readLocaleVariant'],
  );
