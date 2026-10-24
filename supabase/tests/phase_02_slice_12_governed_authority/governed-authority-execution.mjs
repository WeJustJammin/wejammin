/** Owned async query facade and finite, tracked cleanup; no shared execution helper is called. */
import {
  beginCleanup,
  outcomeOf,
  reapChild,
  requireOwned,
  sql,
  startSession,
  trackedSessions,
} from './governed-authority-processes.mjs';

const execute = async (script, label) => {
  const session = startSession(label, script);
  const outcome = await outcomeOf(session);
  if (outcome.code !== 0)
    throw new Error(
      `${session.app}: query failed: ${outcome.stderr.slice(-2_000)}`,
    );
  return outcome.stdout;
};

export const queryValue = async (statement, label = 'probe') => {
  const stdout = await execute(statement, label);
  return (
    stdout
      .trim()
      .split('\n')
      .filter((line) => line && !line.startsWith('owned-backend:'))
      .at(-1) ?? ''
  );
};

export const queryScript = async (script, label) => {
  const stdout = await execute(script, label);
  const line = stdout
    .split('\n')
    .filter((value) => value.startsWith('{') && !value.includes('|'))
    .at(-1);
  if (line === undefined)
    throw new Error(`${label}: script did not return its JSON result`);
  return JSON.parse(line);
};

/**
 * A controller verifies all target backends absent, then terminates ITS OWN backend. The
 * required 57P01 acknowledgement closes the final verifier without recursively creating another.
 * Controllers have startup 5s server timeouts and an 8s client deadline, and remain registered.
 */
const controller = async (targets) => {
  targets.forEach(requireOwned);
  const apps = [...new Set(targets.map((session) => session.app))];
  const predicate = `application_name = any(array[${apps.map(sql).join(',')}]::text[]) and pid <> pg_backend_pid()`;
  const control = startSession(
    'cleanup',
    `
    do $cleanup$
    declare deadline timestamptz := clock_timestamp() + interval '4 seconds';
    begin
      perform pg_catalog.pg_terminate_backend(pid) from pg_stat_activity where ${predicate};
      loop
        perform pg_catalog.pg_stat_clear_snapshot();
        exit when not exists (select 1 from pg_stat_activity where ${predicate});
        if clock_timestamp() >= deadline then raise exception 'owned backend survived cleanup'; end if;
        perform pg_catalog.pg_sleep(0.05);
      end loop;
    end $cleanup$;
    select 'owned-backends-absent';
    select pg_catalog.pg_terminate_backend(pg_backend_pid());`,
    { control: true },
  );
  const errors = [];
  try {
    const outcome = await outcomeOf(control);
    if (
      outcome.code === 0 ||
      !outcome.stdout.split('\n').includes('owned-backends-absent') ||
      !/FATAL:\s+57P01:\s+terminating connection due to administrator command/u.test(
        outcome.stderr,
      )
    ) {
      throw new Error(
        `${control.app}: absence/self-termination not acknowledged: ${outcome.stderr.slice(-2_000)}`,
      );
    }
  } catch (error) {
    errors.push(error);
  }
  try {
    await reapChild(control);
  } catch (error) {
    errors.push(error);
  }
  if (errors.length)
    throw new AggregateError(
      errors,
      `${control.app}: cleanup controller failed`,
    );
};

const cleanupTargets = async (targets) => {
  const errors = [];
  const attempt = async () => {
    // Include every previous cleanup controller, including one whose client previously timed out.
    const owned = [
      ...new Set([
        ...targets,
        ...trackedSessions().filter((session) => session.control),
      ]),
    ];
    try {
      await controller(owned);
    } catch (error) {
      errors.push(error);
    }
    const reaped = await Promise.allSettled(owned.map(reapChild));
    errors.push(
      ...reaped
        .filter((result) => result.status === 'rejected')
        .map((result) => result.reason),
    );
  };
  await attempt();
  // A second finite pass catches a backend that connected while the first pass reaped its client.
  await attempt();
  if (errors.length)
    throw new AggregateError(
      errors,
      'owned database cleanup failed; absence not fully proven',
    );
};

export const releaseSession = (session) => cleanupTargets([session]);

export const cleanupSessions = async () => {
  beginCleanup();
  await cleanupTargets(trackedSessions());
};
