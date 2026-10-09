/**
 * The SEC-1 behaviour probes: they call every manifest entry through the real
 * Kong -> PostgREST path with that entry's VALID request (claim-gate-fixtures*.ts:
 * every member checked before the gate is present and well formed, so the gate is
 * the first thing that can refuse it). Each outcome is compared exactly: the ghost
 * and forged subjects must get the gate's own UNAUTHENTICATED (a request-validation
 * refusal never counts), the non-granted roles the exact permission error, and a
 * real caller the function's own next outcome. The entries are exercised whatever
 * their current body says, so a function that loses its gate fails here instead of
 * dropping out of the test set.
 *
 * Split out of claim-gate-check.ts to keep each support module within the 300-line
 * utility limit; claim-gate-check.ts re-exports these so every import site is
 * unchanged.
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
  tokenFor,
  userToken,
  type CmsOwner,
  type RpcOutcome,
} from './stack';

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
    case 'service-principal':
      // An actorless internal operation: it resolves no caller, so there is no
      // ghost/forged caller to bind. The service credential reaches the
      // function's own next step; the grant layer above already refused anon and
      // an authenticated caller. The principal boundary (DEC-156) is the ACL plus
      // the Worker module boundary, proven separately.
      add('service_role (the Worker credential)', fixture.real, () =>
        call(service, null),
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
