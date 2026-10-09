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
 *    Kong -> PostgREST path with that entry's VALID request
 *    (claim-gate-fixtures*.ts: every member checked before the gate is present
 *    and well formed, so the gate is the first thing that can refuse it). Each
 *    outcome is compared exactly: the ghost and forged subjects must get the
 *    gate's own UNAUTHENTICATED (a request-validation refusal never counts), the
 *    non-granted roles the exact permission error, and a real caller the
 *    function's own next outcome. The entries are exercised whatever their
 *    current body says, so a function that loses its gate fails here instead of
 *    dropping out of the test set.
 */
import {
  CLAIM_GATED_API_FUNCTIONS,
  type ClaimGate,
} from './claim-gate-manifest';
import { type ApiFunction, psql } from './stack';

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

export { probesFor, gateBehaviourFailures } from './claim-gate-probes';
export type { GateContext } from './claim-gate-probes';
