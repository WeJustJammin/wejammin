/**
 * SEC-1: the database authority gates must read the identity PostgREST really
 * sets (`request.jwt.claims`), proven through the real Kong -> PostgREST path.
 *
 * Every caller identity below is a signed JWT; no GUC is set by hand. The
 * suite COMMITS its fixtures (two auth users, one release principal). Run it
 * right after `pnpm db:reset` (`pnpm db:api-test`) and reset again afterwards.
 */
import { randomUUID } from 'node:crypto';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  type ApiFunction,
  bodyFor,
  callRpc,
  claimReadingApiFunctions,
  createAuthUser,
  listApiFunctions,
  psql,
  tokenFor,
  userToken,
} from './support/stack';

const GHOST_USER = '00000000-0000-4000-8000-0000000000ff';
const RELEASE_KEY = 'apigate-release-key';

let attacker = '';
let victim = '';
let functions: readonly ApiFunction[] = [];
let claimReaders: ReadonlySet<string> = new Set();

beforeAll(() => {
  attacker = createAuthUser(randomUUID());
  victim = createAuthUser(randomUUID());
  psql(`insert into platform_private.cfg_release_principals(principal_id, key_id)
        values ('${createAuthUser(randomUUID())}', '${RELEASE_KEY}') on conflict do nothing`);
  functions = listApiFunctions();
  claimReaders = claimReadingApiFunctions();
});

const forged = (): Readonly<Record<string, unknown>> => ({
  authUserId: victim,
  actorPersonId: victim,
  actingPartyId: victim,
});

describe('SEC-1 authenticated callers cannot assume another identity', () => {
  it('enumerates the exposed surface from the catalog', () => {
    expect(functions.length).toBeGreaterThan(150);
    expect(functions.filter((fn) => fn.authenticated).length).toBeGreaterThan(
      20,
    );
    expect(claimReaders.size).toBeGreaterThan(20);
  });

  it('every cms_ p_request function executable by authenticated refuses a forged victim context with UNAUTHENTICATED', async () => {
    const family = functions.filter(
      (fn) =>
        fn.authenticated &&
        fn.name.startsWith('cms_') &&
        fn.args.some((argument) => argument.name === 'p_request'),
    );
    expect(family.length).toBeGreaterThanOrEqual(5);
    const outcomes = await Promise.all(
      family.map(async (fn) => ({
        name: fn.name,
        outcome: await callRpc(
          fn.name,
          userToken(attacker),
          bodyFor(fn, forged()),
        ),
      })),
    );
    expect(
      outcomes
        .filter((entry) => entry.outcome.message !== 'UNAUTHENTICATED')
        .map((entry) => `${entry.name}:${entry.outcome.message}`),
    ).toEqual([]);
  });

  it('a forged actor person alone (own authUserId) is also refused for every cms_ function', async () => {
    const cms = functions.filter(
      (fn) => fn.authenticated && fn.name.startsWith('cms_'),
    );
    const outcomes = await Promise.all(
      cms.map(async (fn) => ({
        name: fn.name,
        outcome: await callRpc(
          fn.name,
          userToken(attacker),
          bodyFor(fn, { authUserId: attacker, actorPersonId: victim }),
        ),
      })),
    );
    expect(
      outcomes
        .filter((entry) => entry.outcome.message !== 'UNAUTHENTICATED')
        .map((entry) => entry.name),
    ).toEqual([]);
  });

  it('an honest context (own authUserId) passes the actor gate', async () => {
    const cms = functions.filter(
      (fn) => fn.authenticated && fn.name.startsWith('cms_'),
    );
    for (const fn of cms) {
      const outcome = await callRpc(
        fn.name,
        userToken(attacker),
        bodyFor(fn, { authUserId: attacker, actingPartyId: attacker }),
      );
      expect(outcome.message, fn.name).not.toBe('UNAUTHENTICATED');
    }
  });

  it('every claim-reading function executable by authenticated refuses a subject that is not a real auth user', async () => {
    const targets = functions.filter(
      (fn) => fn.authenticated && !fn.anon && claimReaders.has(fn.name),
    );
    expect(targets.length).toBeGreaterThan(20);
    const refused: Record<string, string> = {};
    for (const fn of targets) {
      const outcome = await callRpc(
        fn.name,
        userToken(GHOST_USER),
        bodyFor(fn, forged()),
      );
      refused[fn.name] = `${outcome.status}:${outcome.message}`;
    }
    // A function that validates its own request shape first may answer with
    // that validation, but none may ever succeed for a ghost subject.
    const succeeded = Object.entries(refused).filter(([, result]) =>
      result.startsWith('200:'),
    );
    expect(succeeded).toEqual([]);
    const allowed = new Set(['400:UNAUTHENTICATED', '400:INVALID_REQUEST']);
    expect(
      Object.entries(refused).filter(([, result]) => !allowed.has(result)),
    ).toEqual([]);
    expect(
      Object.values(refused).filter((r) => r === '400:UNAUTHENTICATED').length,
    ).toBeGreaterThanOrEqual(25);
  });

  it('the JWT subject is read: a real subject gets past the identity gate on every identity function', async () => {
    const identity = functions.filter(
      (fn) =>
        fn.authenticated &&
        !fn.anon &&
        !fn.serviceRole &&
        !fn.args.some((argument) => argument.name === 'p_request') &&
        (fn.name.startsWith('identity_') || fn.name.startsWith('rpc_')),
    );
    expect(identity.length).toBeGreaterThanOrEqual(15);
    const stuck: string[] = [];
    for (const fn of identity) {
      const outcome = await callRpc(
        fn.name,
        userToken(attacker),
        bodyFor(fn, {}),
      );
      if (outcome.message === 'UNAUTHENTICATED') stuck.push(fn.name);
    }
    expect(stuck).toEqual([]);
  });
});

describe('SEC-1 service_role passes every service-role gate', () => {
  it('every release/migration-worker gated function reaches its own validation, never UNAUTHENTICATED', async () => {
    const gated = functions.filter(
      (fn) => fn.serviceRole && !fn.authenticated && claimReaders.has(fn.name),
    );
    const workerFamily = gated.filter((fn) =>
      /schema_migration|schema_activation|register_block|advance_block_lifecycle/u.test(
        fn.name,
      ),
    );
    expect(workerFamily.length).toBeGreaterThanOrEqual(19);
    const failing: string[] = [];
    for (const fn of workerFamily) {
      const outcome = await callRpc(
        fn.name,
        tokenFor('service_role'),
        bodyFor(
          fn,
          { releasePrincipalId: RELEASE_KEY, authUserId: attacker },
          { releaseKeyId: RELEASE_KEY },
        ),
      );
      if (outcome.message === 'UNAUTHENTICATED') failing.push(fn.name);
    }
    expect(failing).toEqual([]);
  });

  it('every service-role-only claim-reading function accepts a service_role token for a real actor context', async () => {
    const gated = functions.filter(
      (fn) => fn.serviceRole && !fn.authenticated && claimReaders.has(fn.name),
    );
    expect(gated.length).toBeGreaterThanOrEqual(19);
    const failing: string[] = [];
    for (const fn of gated) {
      const outcome = await callRpc(
        fn.name,
        tokenFor('service_role'),
        bodyFor(
          fn,
          {
            releasePrincipalId: RELEASE_KEY,
            authUserId: attacker,
            actorPersonId: attacker,
          },
          { releaseKeyId: RELEASE_KEY },
        ),
      );
      if (outcome.message === 'UNAUTHENTICATED') failing.push(fn.name);
    }
    expect(failing).toEqual([]);
  });

  it('service_role cannot be reached with an authenticated token', async () => {
    const serviceOnly = functions.filter(
      (fn) => fn.serviceRole && !fn.authenticated && !fn.anon,
    );
    const failing: string[] = [];
    for (const fn of serviceOnly) {
      const outcome = await callRpc(
        fn.name,
        userToken(attacker),
        bodyFor(fn, { authUserId: attacker }),
      );
      if (outcome.status !== 403 || outcome.code !== '42501')
        failing.push(`${fn.name}:${outcome.status}`);
    }
    expect(failing).toEqual([]);
  });
});

describe('SEC-1 anon reaches only its granted functions', () => {
  it('every function not granted to anon is permission denied for the anon role and for a missing token', async () => {
    const denied = functions.filter((fn) => !fn.anon);
    expect(denied.length).toBeGreaterThan(150);
    const failing: string[] = [];
    for (const fn of denied) {
      for (const token of [tokenFor('anon'), null]) {
        const outcome = await callRpc(
          fn.name,
          token,
          bodyFor(fn, { authUserId: attacker }),
        );
        if (outcome.status !== 401 || outcome.code !== '42501')
          failing.push(`${fn.name}:${outcome.status}`);
      }
    }
    expect(failing).toEqual([]);
  });

  it('the granted anon functions are callable by anon', async () => {
    const granted = functions.filter((fn) => fn.anon);
    expect(granted.length).toBeGreaterThanOrEqual(3);
    for (const fn of granted) {
      const outcome = await callRpc(fn.name, tokenFor('anon'), bodyFor(fn, {}));
      expect(outcome.code, fn.name).not.toBe('42501');
    }
  });
});

describe('SEC-1 profile-ownership step-up reads the real token aal', () => {
  const convert = (aal?: 'aal1' | 'aal2') =>
    callRpc(
      'rpc_convert_claim',
      tokenFor('service_role', aal === undefined ? {} : { aal }),
      {
        p_request: {
          context: { actorPersonId: attacker, actingPartyId: attacker },
          claimId: randomUUID(),
          headers: { idempotencyKey: `aal-${randomUUID()}`, ifMatch: '"1"' },
          body: { reasonCode: 'claim_conversion' },
        },
      },
    );

  it('aal1 is refused with STEP_UP_REQUIRED', async () => {
    expect((await convert('aal1')).message).toBe('STEP_UP_REQUIRED');
  });

  it('a token without aal is refused with STEP_UP_REQUIRED', async () => {
    expect((await convert()).message).toBe('STEP_UP_REQUIRED');
  });

  it('aal2 passes the step-up gate', async () => {
    const outcome = await convert('aal2');
    expect(outcome.message).not.toBe('STEP_UP_REQUIRED');
  });
});
