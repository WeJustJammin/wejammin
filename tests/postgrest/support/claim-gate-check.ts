/**
 * SEC-1 manifest checks for the real-API gate suites.
 *
 * `CLAIM_GATED_API_FUNCTIONS` (claim-gate-manifest.ts) is the checked-in list of
 * security-sensitive `platform_api` functions and the gate each must enforce.
 * Two independent checks keep it honest:
 *
 *  - `manifestDrift` compares the manifest with the live catalog (exact equality
 *    both ways, and the gate against the EXECUTE grants). The catalog scan is an
 *    ORACLE for drift only; it never chooses what gets tested.
 *  - `gateBehaviourFailures` calls every manifest entry through the real
 *    Kong -> PostgREST path. The entries are exercised whatever their current body
 *    says, so a function that loses its gate fails here instead of dropping out of
 *    the test set.
 */
import {
  CLAIM_GATED_API_FUNCTIONS,
  type ClaimGate,
} from './claim-gate-manifest';
import {
  type ApiFunction,
  bodyFor,
  callRpc,
  psql,
  tokenFor,
  userToken,
} from './stack';

const JWT_ROLE_ROOTS = String.raw`request\.jwt\.claim|request_jwt_claim`;

/**
 * ORACLE ONLY. Names of the `platform_api` functions whose body, directly or
 * through any function it calls (matched by name across the internal schemas),
 * reads the caller's JWT claims. Used to detect drift from the manifest, never to
 * select what the suites exercise.
 */
export const catalogClaimReaders = (): ReadonlySet<string> => {
  const rows = psql(`
    with recursive internal as (
      select p.oid, p.proname::text as name, n.nspname::text as schema, p.prosrc
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname in ('platform_api','platform_private','profile_api','profile_private',
                           'identity_private','identity_api','public_api')
         and p.prokind = 'f'
    ), reach(oid) as (
      select oid from internal where prosrc ~ '${JWT_ROLE_ROOTS}'
      union
      select i.oid from internal i join reach r on true
        join internal callee on callee.oid = r.oid
       where i.prosrc ~ ('\\m' || callee.name || '\\M')
    )
    select distinct i.name from internal i join reach r on r.oid = i.oid
     where i.schema = 'platform_api' order by 1`);
  return new Set(rows.split('\n').filter((line) => line !== ''));
};

/** The gate class an EXECUTE grant matrix implies, or null for a matrix the manifest cannot name. */
export const gateFromGrants = (fn: ApiFunction): ClaimGate | null => {
  if (fn.anon && fn.authenticated && !fn.serviceRole) return 'public-subject';
  if (!fn.anon && fn.authenticated && fn.serviceRole)
    return 'subject-or-service';
  if (!fn.anon && fn.authenticated) return 'authenticated-subject';
  if (!fn.anon && fn.serviceRole) return 'service-role';
  if (!fn.anon && !fn.authenticated && !fn.serviceRole) return 'ungranted';
  return null;
};

export type ManifestDrift = Readonly<{
  /** Read claims in the catalog but are not in the manifest. */
  unlisted: readonly string[];
  /** In the manifest, exposed, but no longer read claims in the catalog. */
  noLongerClaimReading: readonly string[];
  /** In the manifest but absent from the exposed surface. */
  absent: readonly string[];
  /** In the manifest with a gate that disagrees with the EXECUTE grants. */
  gateMismatch: readonly string[];
}>;

/** Exact equality of the manifest with the catalog, both directions. */
export const manifestDrift = (
  functions: readonly ApiFunction[],
  readers: ReadonlySet<string> = catalogClaimReaders(),
  manifest: Readonly<Record<string, ClaimGate>> = CLAIM_GATED_API_FUNCTIONS,
): ManifestDrift => {
  const exposed = new Map(functions.map((fn) => [fn.name, fn]));
  const names = Object.keys(manifest).sort();
  return {
    unlisted: [...readers]
      .filter((name) => manifest[name] === undefined)
      .sort(),
    noLongerClaimReading: names.filter(
      (name) => exposed.has(name) && !readers.has(name),
    ),
    absent: names.filter((name) => !exposed.has(name)),
    gateMismatch: names.flatMap((name) => {
      const fn = exposed.get(name);
      if (fn === undefined) return [];
      const implied = gateFromGrants(fn);
      return implied === manifest[name]
        ? []
        : [
            `${name}: manifest ${String(manifest[name])}, grants imply ${String(implied)}`,
          ];
    }),
  };
};

export const driftFindings = (drift: ManifestDrift): readonly string[] => [
  ...drift.unlisted.map(
    (name) => `${name}: reads claims but is not in the manifest`,
  ),
  ...drift.noLongerClaimReading.map(
    (name) => `${name}: listed but no longer reads claims`,
  ),
  ...drift.absent.map((name) => `${name}: listed but absent from platform_api`),
  ...drift.gateMismatch,
];

export type GateContext = Readonly<{
  /** A real auth user holding a valid token. */
  attacker: string;
  /** Another real auth user the attacker names in the request. */
  victim: string;
  /** A subject that is not an auth user. */
  ghost: string;
  /** A registered release principal key. */
  releaseKey: string;
}>;

const ACCEPTED_REFUSALS = new Set([
  '400:UNAUTHENTICATED',
  '400:INVALID_REQUEST',
]);

/**
 * Calls the named manifest entries (all of them by default) through the real API
 * and returns what is wrong, as `name: finding`. Nothing is derived from a body.
 */
export const gateBehaviourFailures = async (
  functions: readonly ApiFunction[],
  context: GateContext,
  only?: readonly string[],
): Promise<readonly string[]> => {
  const exposed = new Map(functions.map((fn) => [fn.name, fn]));
  const names = Object.keys(CLAIM_GATED_API_FUNCTIONS)
    .filter((name) => only === undefined || only.includes(name))
    .sort();
  const failures: string[] = [];
  const forged = {
    authUserId: context.victim,
    actorPersonId: context.victim,
    actingPartyId: context.victim,
  };
  for (const name of names) {
    const fn = exposed.get(name);
    const gate = CLAIM_GATED_API_FUNCTIONS[name];
    if (fn === undefined || gate === undefined) {
      failures.push(`${name}: absent from platform_api`);
      continue;
    }
    const call = (token: string | null, ctx: Record<string, unknown>) =>
      callRpc(
        name,
        token,
        bodyFor(fn, ctx, { releaseKeyId: context.releaseKey }),
      );
    const finding = (text: string): void => {
      failures.push(`${name}: ${text}`);
    };

    // Callers the grants must keep out: a non-granted role is permission denied.
    if (gate !== 'public-subject') {
      const anon = await call(tokenFor('anon'), forged);
      if (anon.status !== 401 || anon.code !== '42501')
        finding(`anon reached it (${anon.status})`);
    }
    if (gate === 'service-role' || gate === 'ungranted') {
      const human = await call(userToken(context.attacker), {
        authUserId: context.attacker,
      });
      if (human.status !== 403 || human.code !== '42501')
        finding(`an authenticated token reached it (${human.status})`);
    }
    if (gate === 'ungranted') {
      const worker = await call(tokenFor('service_role'), forged);
      if (worker.status !== 403 || worker.code !== '42501')
        finding(`service_role reached it (${worker.status})`);
      continue;
    }

    // Authenticated callers: the subject must be a real auth user, and the function
    // must not act for the victim the request names.
    if (gate !== 'service-role' && gate !== 'public-subject') {
      const ghost = await call(userToken(context.ghost), forged);
      const result = `${ghost.status}:${ghost.message}`;
      if (!ACCEPTED_REFUSALS.has(result))
        finding(`a ghost subject got ${result}, not a refusal`);
      if (fn.args.some((argument) => argument.name === 'p_request')) {
        const impostor = await call(userToken(context.attacker), forged);
        if (impostor.status === 200)
          finding('an authenticated caller naming another actor succeeded');
      }
    }
    if (gate === 'public-subject') {
      const ghost = await call(userToken(context.ghost), forged);
      if (ghost.status === 200) finding('a ghost subject succeeded');
    }

    // Service role: a real actor context reaches the function's own validation,
    // a ghost actor never succeeds.
    if (gate === 'service-role' || gate === 'subject-or-service') {
      const real = await call(tokenFor('service_role'), {
        releasePrincipalId: context.releaseKey,
        authUserId: context.attacker,
        actorPersonId: context.attacker,
      });
      if (real.message === 'UNAUTHENTICATED')
        finding('service_role with a real actor context was UNAUTHENTICATED');
      const ghost = await call(tokenFor('service_role'), {
        authUserId: context.ghost,
        actorPersonId: context.ghost,
        actingPartyId: context.ghost,
      });
      if (ghost.status === 200)
        finding('service_role with a ghost actor context succeeded');
    }
  }
  return failures;
};
