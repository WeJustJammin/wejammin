/**
 * Guaranteed restoration for the SEC-1 mutation suite (claim-gate-mutation.apispec.ts).
 *
 * The suite COMMITS gate-less stubs, weakened helpers and widened grants to the live
 * database (PostgREST reads it from other connections, so a rolled-back transaction
 * would be invisible). A `finally` is not enough on its own: when a vitest test times
 * out, vitest fails the test but the async body KEEPS RUNNING, so it went on to mutate
 * the next entry while later tests ran, and a body that never reached its `finally`
 * left the catalog mutated for every later file (the 2026-10-10 diagnostic run).
 * This module makes the restoration independent of how a test ends:
 *
 *  - `MutationJournal.begin` snapshots a function (full definition, owner, comment,
 *    EXECUTE grants) BEFORE the mutation is applied and registers it; `end` restores
 *    it and verifies the restored fingerprint equals the snapshot.
 *  - `MutationGuard` owns one test body: `checkpoint()` stops a body that is past its
 *    own deadline or whose test already timed out, so no further mutation starts, and
 *    `settle()` (the afterEach hook) waits for the body to unwind, restores whatever
 *    is still journaled and compares a fingerprint of EVERY function in the gate
 *    schemas with the baseline taken before the first mutation.
 */
import { psql } from './stack';

const GATE_SCHEMAS = `'platform_api','platform_private','profile_api','profile_private','identity_private','identity_api','public_api'`;

/**
 * The per-function facts a restoration must reproduce (signature excluded: it is the
 * key), as four parts: a digest of the full definition, the owner, the EXECUTE ACL
 * (sorted; a NULL ACL is the owner/PUBLIC default, so it equals its explicit spelling)
 * and a digest of the comment.
 */
const PARTS = `md5(pg_get_functiondef(p.oid))
  || chr(31) || p.proowner::regrole::text
  || chr(31) || coalesce((select string_agg(a::text, ',' order by a::text)
                            from unnest(coalesce(p.proacl, acldefault('f', p.proowner))) as a), '')
  || chr(31) || md5(coalesce(obj_description(p.oid, 'pg_proc'), ''))`;

const PART_NAMES = ['definition', 'owner', 'ACL', 'comment'] as const;

/** One digest over every function of the gate schemas: signature plus the four parts of each. */
export const catalogFingerprint = (): string =>
  psql(`
    select md5(coalesce(string_agg(p.oid::regprocedure::text || chr(31) || ${PARTS}, chr(30)
                                   order by p.oid::regprocedure::text), ''))
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in (${GATE_SCHEMAS}) and p.prokind = 'f'`);

const functionParts = (target: string): string =>
  psql(
    `select ${PARTS} from pg_proc p where p.oid = '${target}'::regprocedure`,
  );

/** The names of the parts that differ between two `functionParts` values. */
const differingParts = (was: string, now: string): string[] => {
  const before = was.split('\u001f');
  const after = now.split('\u001f');
  return PART_NAMES.filter((_, index) => before[index] !== after[index]);
};

export type ApiTarget = Readonly<{
  /** regprocedure text, e.g. `platform_api.cms_x(jsonb)`. */
  target: string;
  /** `pg_get_function_arguments`, for rebuilding a function of the same signature. */
  signature: string;
}>;

/** The one `platform_api` overload of `name` (the suite never mutates an overloaded name). */
export const apiTarget = (name: string): ApiTarget => {
  const rows = psql(`
    select p.oid::regprocedure::text || chr(31) || pg_get_function_arguments(p.oid)
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'platform_api' and p.proname = '${name}'`)
    .split('\n')
    .filter((line) => line !== '');
  if (rows.length !== 1)
    throw new Error(
      `${name}: expected exactly one platform_api overload, found ${String(rows.length)}`,
    );
  const [target = '', signature = ''] = (rows[0] ?? '').split('\u001f');
  return { target, signature };
};

export type FunctionSnapshot = Readonly<{
  /** regprocedure text, e.g. `platform_api.cms_x(jsonb)`. */
  target: string;
  /** `pg_get_functiondef`, re-applied by `create or replace`. */
  definition: string;
  /** Roles (`public` or a role name) holding EXECUTE among public, anon, authenticated, service_role. */
  executeGrantees: readonly string[];
  /** `functionParts` at snapshot time. */
  parts: string;
}>;

const API_ROLES = ['anon', 'authenticated', 'service_role'] as const;

export const snapshotFunction = (target: string): FunctionSnapshot => {
  // chr(29) separates the three fields; `PARTS` uses chr(31) inside its own.
  const [parts = '', granted = '', definition = ''] = psql(`
    select ${PARTS}
      || chr(29) || coalesce((
           select string_agg(g.grantee, ',' order by g.grantee)
             from (select case when a.grantee = 0 then 'public' else r.rolname::text end as grantee
                     from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                     left join pg_roles r on r.oid = a.grantee
                    where a.privilege_type = 'EXECUTE'
                      and (a.grantee = 0 or r.rolname in ('anon', 'authenticated', 'service_role'))) g), '')
      || chr(29) || replace(pg_get_functiondef(p.oid), chr(10), chr(30))
      from pg_proc p where p.oid = '${target}'::regprocedure`).split('\u001d');
  return {
    target,
    definition: definition.replaceAll('\u001e', '\n'),
    executeGrantees: granted.split(',').filter((grantee) => grantee !== ''),
    parts,
  };
};

/**
 * Re-applies what differs from the snapshot: the definition (`create or replace`
 * keeps the owner, the comment and the ACL) and, only when the ACL differs, the
 * EXECUTE grants of public and the API roles exactly as recorded. Throws, naming the
 * parts, when the restored function does not reproduce the snapshot. Returns true
 * when something had to be repaired.
 */
export const restoreFunction = (snapshot: FunctionSnapshot): boolean => {
  const current = functionParts(snapshot.target);
  if (current === snapshot.parts) return false;
  const differing = differingParts(snapshot.parts, current);
  if (differing.includes('definition')) psql(snapshot.definition);
  if (differing.includes('ACL')) {
    const roles = API_ROLES.filter((role) =>
      snapshot.executeGrantees.includes(role),
    );
    psql(
      `revoke all on function ${snapshot.target} from public, anon, authenticated, service_role;
       ${snapshot.executeGrantees.includes('public') ? `grant execute on function ${snapshot.target} to public;` : ''}
       ${roles.length === 0 ? '' : `grant execute on function ${snapshot.target} to ${roles.join(', ')};`}`,
    );
  }
  const stillDiffering = differingParts(
    snapshot.parts,
    functionParts(snapshot.target),
  );
  if (stillDiffering.length > 0)
    throw new Error(
      `${snapshot.target}: restoration did not reproduce the original ${stillDiffering.join(', ')} (run pnpm db:reset before any other suite)`,
    );
  return true;
};

/** Every function currently mutated by the suite, snapshotted before it was touched. */
export class MutationJournal {
  readonly #open = new Map<string, FunctionSnapshot>();

  /** Snapshot and register BEFORE the mutation runs, so a half-applied mutation is still undone. */
  begin(target: string): FunctionSnapshot {
    if (this.#open.has(target))
      throw new Error(`${target}: already mutated; mutations never nest`);
    const snapshot = snapshotFunction(target);
    this.#open.set(target, snapshot);
    return snapshot;
  }

  /** Restores one target, verifies it, and removes it from the journal. */
  end(snapshot: FunctionSnapshot): void {
    restoreFunction(snapshot);
    this.#open.delete(snapshot.target);
  }

  /**
   * The safety net: restores every journaled target, one failing restoration never
   * stopping the others; returns the targets that needed repair and throws one error
   * naming every target that could not be restored.
   */
  restoreAll(): readonly string[] {
    const repaired: string[] = [];
    const failed: string[] = [];
    for (const snapshot of [...this.#open.values()]) {
      try {
        if (restoreFunction(snapshot)) repaired.push(snapshot.target);
        this.#open.delete(snapshot.target);
      } catch (error) {
        failed.push(
          `${snapshot.target}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    if (failed.length > 0)
      throw new Error(
        `could not restore ${failed.join('; ')} (run pnpm db:reset before any other suite)`,
      );
    return repaired;
  }

  get open(): readonly string[] {
    return [...this.#open.keys()];
  }
}

/**
 * Runs `body` with `target` mutated by `apply`, and restores it whatever happens.
 * The snapshot precedes `apply`; the restoration is verified.
 */
export const withMutation = async <T>(
  journal: MutationJournal,
  target: string,
  apply: (original: FunctionSnapshot) => void,
  body: () => Promise<T>,
): Promise<T> => {
  const snapshot = journal.begin(target);
  try {
    apply(snapshot);
    return await body();
  } finally {
    journal.end(snapshot);
  }
};

export class MutationAborted extends Error {}

/**
 * One test body at a time. `run` records the body, `checkpoint` is called between
 * mutations (and inside every loop) and throws `MutationAborted` once the body is past
 * `deadlineMs` or its test has timed out, and `settle` (the afterEach hook) stops the
 * body, waits for it to unwind, restores anything still journaled and compares the
 * whole catalog with the baseline.
 */
export class MutationGuard {
  readonly journal = new MutationJournal();
  #baseline: string | null = null;
  #inflight: Promise<unknown> = Promise.resolve();
  #stopped = false;
  #deadline = Number.POSITIVE_INFINITY;

  /** Records the catalog every test must leave behind. Call once, before the first mutation. */
  baseline(): string {
    this.#baseline = catalogFingerprint();
    return this.#baseline;
  }

  run<T>(deadlineMs: number, body: () => Promise<T>): Promise<T> {
    this.#stopped = false;
    this.#deadline = Date.now() + deadlineMs;
    const running = body();
    this.#inflight = running.then(
      () => undefined,
      () => undefined,
    );
    return running;
  }

  checkpoint(label = 'the test'): void {
    if (this.#stopped)
      throw new MutationAborted(`${label}: stopped because its test timed out`);
    if (Date.now() > this.#deadline)
      throw new MutationAborted(
        `${label}: past its own deadline; the open mutations are restored and nothing further is mutated`,
      );
  }

  async settle(unwindMs = 45_000): Promise<void> {
    this.#stopped = true;
    let timer: NodeJS.Timeout | undefined;
    const unwound = await Promise.race([
      this.#inflight.then(() => true),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => {
          resolve(false);
        }, unwindMs);
      }),
    ]);
    if (timer !== undefined) clearTimeout(timer);
    const repaired = this.journal.restoreAll();
    if (this.#baseline !== null) {
      const now = catalogFingerprint();
      if (now !== this.#baseline)
        throw new Error(
          'the catalog differs from the baseline after the test; run pnpm db:reset before any other suite',
        );
    }
    if (!unwound)
      throw new Error(
        `a mutation body did not unwind within ${String(unwindMs)} ms; the catalog was restored (${repaired.join(', ') || 'nothing to repair'})`,
      );
  }
}
