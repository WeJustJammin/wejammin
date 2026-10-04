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
import { CLAIM_GATE_FIXTURES, type GateFixture } from './claim-gate-fixtures';
import { SUCCESS_CONTROLS } from './claim-gate-success';
import { requestOf } from './claim-gate-fixtures-types';
import {
  CLAIM_ACTOR_FAMILY,
  CLAIM_GATED_API_FUNCTIONS,
  type ActorFamily,
  type ClaimGate,
} from './claim-gate-manifest';
import {
  type ApiFunction,
  callRpc,
  callWithClaims,
  psql,
  tokenFor,
  userToken,
  type CmsOwner,
  type RpcOutcome,
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
  /** A real auth user holding a valid token (and no person). */
  attacker: string;
  /** Another real auth user the attacker names in the request. */
  victim: string;
  /** A subject that is not an auth user. */
  ghost: string;
  /** A registered release principal key. */
  releaseKey: string;
  /** A real person with an organization, for the success controls. */
  owner?: CmsOwner;
}>;

const outcomeOf = (outcome: RpcOutcome): string =>
  `${String(outcome.status)}:${outcome.message}`;

const UNAUTHENTICATED = '400:UNAUTHENTICATED';

type Probe = Readonly<{
  label: string;
  run: () => Promise<string>;
  expected: string;
}>;

const asNamed = (subject: string): Record<string, unknown> => ({
  authUserId: subject,
  actorPersonId: subject,
});

/** The probes one entry must pass, derived from its family, its grant class and its fixture. */
export const probesFor = (
  name: string,
  fn: ApiFunction,
  gate: ClaimGate,
  family: ActorFamily,
  fixture: GateFixture,
  context: GateContext,
): readonly Probe[] => {
  const hasRequest = fn.args.some((argument) => argument.name === 'p_request');
  const body = (
    caller: Record<string, unknown> | null,
    extra: Record<string, unknown> = {},
  ): Record<string, unknown> =>
    hasRequest
      ? {
          p_request: {
            ...requestOf(fixture.request),
            ...extra,
            ...(caller === null ? {} : { context: caller }),
          },
        }
      : { ...requestOf(fixture.request) };
  const call = async (
    token: string | null,
    caller: Record<string, unknown> | null,
    extra: Record<string, unknown> = {},
  ): Promise<string> =>
    outcomeOf(await callRpc(name, token, body(caller, extra)));
  const denied = (status: number): string =>
    `${String(status)}:permission denied for function ${name}`;
  const probes: Probe[] = [];
  const add = (
    label: string,
    expected: string,
    run: () => Promise<string>,
  ): void => {
    probes.push({ label, expected, run });
  };
  const service = tokenFor('service_role');
  const user = (subject: string): string => userToken(subject);
  const takesContext = family === 'cfg-actor' || family === 'profile-claims';
  const ctx = (subject: string): Record<string, unknown> | null =>
    takesContext ? asNamed(subject) : null;

  // The grant layer: roles the function is not granted to get the exact refusal.
  if (gate !== 'public-subject')
    add('anon', denied(401), () => call(tokenFor('anon'), ctx(context.ghost)));
  if (gate === 'service-role' || gate === 'ungranted')
    add('an authenticated token', denied(403), () =>
      call(user(context.attacker), ctx(context.attacker)),
    );
  if (gate === 'authenticated-subject' || gate === 'ungranted')
    add('service_role', denied(403), () =>
      call(service, ctx(context.attacker)),
    );
  if (gate === 'ungranted') return probes;

  const success = SUCCESS_CONTROLS[name];
  if (success !== undefined && context.owner !== undefined) {
    const owner = context.owner;
    const token = success.caller === 'user' ? user(owner.authUserId) : service;
    const named = success.context?.(owner) ?? null;
    add('a real person succeeds', '200:', async () =>
      outcomeOf(
        await callRpc(
          name,
          token,
          hasRequest
            ? {
                p_request: {
                  ...requestOf(fixture.request),
                  ...(named === null ? {} : { context: named }),
                },
              }
            : { ...(success.request?.(owner) ?? requestOf(fixture.request)) },
        ),
      ),
    );
  }

  switch (family) {
    case 'cfg-actor':
      if (gate === 'subject-or-service') {
        add('a ghost subject', UNAUTHENTICATED, () =>
          call(user(context.ghost), asNamed(context.ghost)),
        );
        add('a forged victim context', UNAUTHENTICATED, () =>
          call(user(context.attacker), asNamed(context.victim)),
        );
        add('a real subject', fixture.real, () =>
          call(user(context.attacker), asNamed(context.attacker)),
        );
      }
      add('service_role with a ghost actor', UNAUTHENTICATED, () =>
        call(service, asNamed(context.ghost)),
      );
      add(
        'service_role with a real actor',
        fixture.svcReal ?? fixture.real,
        () => call(service, asNamed(context.attacker)),
      );
      break;
    case 'identity-auth-user':
      add('a ghost subject', UNAUTHENTICATED, () =>
        call(user(context.ghost), null),
      );
      add('a real subject', fixture.real, () =>
        call(user(context.attacker), null),
      );
      break;
    case 'profile-subject':
      add('a ghost subject', UNAUTHENTICATED, () =>
        call(user(context.ghost), null),
      );
      add('a real subject', fixture.real, () =>
        call(user(context.attacker), null),
      );
      add('service_role (no token subject)', UNAUTHENTICATED, () =>
        call(service, null),
      );
      break;
    case 'profile-claims':
      add('service_role naming no actor', UNAUTHENTICATED, () =>
        call(service, {}),
      );
      add('service_role naming a real actor', fixture.real, () =>
        call(service, asNamed(context.attacker)),
      );
      break;
    case 'release-worker':
      add('service_role', fixture.real, () => call(service, null));
      probes.push({
        label: 'claims whose role is not service_role',
        expected: 'UNAUTHENTICATED',
        run: () =>
          Promise.resolve(
            callWithClaims(
              name,
              { role: 'authenticated', sub: context.attacker },
              requestOf(fixture.request),
            ).message,
          ),
      });
      break;
    case 'release-principal': {
      const bound = (key: string, extra: Record<string, unknown> = {}) =>
        call(
          service,
          { releasePrincipalId: key, ...extra },
          { releaseKeyId: key },
        );
      add('a registered release key', fixture.real, () =>
        bound(context.releaseKey),
      );
      add('an unregistered release key', UNAUTHENTICATED, () =>
        bound('unregistered-release-key'),
      );
      add(
        'a request key that differs from the bound key',
        UNAUTHENTICATED,
        () =>
          call(
            service,
            { releasePrincipalId: context.releaseKey },
            { releaseKeyId: 'another-release-key' },
          ),
      );
      add('a named human actor', '400:FORBIDDEN', () =>
        bound(context.releaseKey, { authUserId: context.attacker }),
      );
      break;
    }
    case 'public-read':
      add('anon', fixture.real, () => call(tokenFor('anon'), null));
      add('a ghost subject', UNAUTHENTICATED, () =>
        call(user(context.ghost), null),
      );
      add('a real subject', '400:PERSON_NOT_FOUND', () =>
        call(user(context.attacker), null),
      );
      break;
  }
  return probes;
};

/**
 * Calls the named manifest entries (all of them by default) through the real API
 * and returns what is wrong, as `name: finding`. Nothing is derived from a body;
 * a manifest entry without a family or a fixture is itself a finding.
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
  for (const name of names) {
    const fn = exposed.get(name);
    const gate = CLAIM_GATED_API_FUNCTIONS[name];
    const family = CLAIM_ACTOR_FAMILY[name];
    const fixture = CLAIM_GATE_FIXTURES[name];
    if (fn === undefined || gate === undefined) {
      failures.push(`${name}: absent from platform_api`);
      continue;
    }
    if (family === undefined || fixture === undefined) {
      failures.push(`${name}: no actor family or no valid-request fixture`);
      continue;
    }
    for (const probe of probesFor(name, fn, gate, family, fixture, context)) {
      const actual = await probe.run();
      if (actual !== probe.expected)
        failures.push(
          `${name}: ${probe.label}: expected ${probe.expected}, got ${actual}`,
        );
    }
  }
  return failures;
};
