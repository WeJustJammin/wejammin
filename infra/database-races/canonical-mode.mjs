/**
 * The single opt-in that moves a Slice 12 race module from its root-run ALT mode to the
 * canonical `pnpm db:verify` mode.  `infra/run-database-race-runners.mjs` sets
 * `WEJAMMIN_CANONICAL_RACE=1` for every module it launches (after `pnpm db:reset`);
 * nothing else does, so a module started by hand keeps its explicit ALT release asserts.
 *
 * Canonical mode targets the container the Slice 10 and 11 modules use
 * (`S10_RACE_DB_CONTAINER`, then `AC217_DB_CONTAINER`, then `supabase_db_wejammin`).  The
 * protected primary checkout is refused in ALT mode only (`assertRaceCheckout`, DEC-225): it
 * is a lane-safety rule for root-run ALT races, while the owner runs `pnpm db:verify`, hence
 * the canonical races, from that checkout.  Canonical mode and an ALT release are
 * mutually exclusive: a stale exported release variable fails loudly instead of silently
 * deciding which database a race runs against.  This module opens no database or process.
 */
import assert from 'node:assert/strict';

export const CANONICAL_RACE_ENV = 'WEJAMMIN_CANONICAL_RACE';
export const PROTECTED_PRIMARY_CHECKOUT = '/home/rob/Projects/WeJammin';
const NAMED_SUPABASE_CONTAINER = /^supabase_db_[a-z0-9_-]+$/iu;

/** True only for the exact value `1`, so a typo or `0` never selects canonical mode. */
export const isCanonicalRace = (env = process.env) =>
  env[CANONICAL_RACE_ENV] === '1';

/** The container resolution of `infra/database-races/race-kit.mjs`, verbatim. */
export const canonicalContainer = (env = process.env) =>
  env.S10_RACE_DB_CONTAINER ?? env.AC217_DB_CONTAINER ?? 'supabase_db_wejammin';

/**
 * The one place of the protected-primary-checkout rule.  `root` is the real path of the checkout
 * the module belongs to.  ALT mode (no canonical opt-in): the primary checkout is refused.
 * Canonical mode (DEC-225): any checkout, the primary included, is allowed.
 */
export function assertRaceCheckout({ root, env = process.env }) {
  if (isCanonicalRace(env)) return;
  assert.notEqual(
    root,
    PROTECTED_PRIMARY_CHECKOUT,
    'protected primary checkout is forbidden',
  );
}

/**
 * Asserts a canonical-mode run before any database access and returns its container.
 * `altEnvNames` lists the module's ALT release variables, none of which may be set.
 */
export function assertCanonicalTarget({ altEnvNames = [], env = process.env }) {
  assert.equal(
    env[CANONICAL_RACE_ENV],
    '1',
    `canonical mode requires ${CANONICAL_RACE_ENV}=1`,
  );
  assert.deepEqual(
    altEnvNames.filter((name) => env[name] !== undefined),
    [],
    `canonical mode and an ALT release are mutually exclusive; unset the ALT variables or ${CANONICAL_RACE_ENV}`,
  );
  const container = canonicalContainer(env);
  assert.match(
    container,
    NAMED_SUPABASE_CONTAINER,
    'named local Supabase container required',
  );
  return container;
}
