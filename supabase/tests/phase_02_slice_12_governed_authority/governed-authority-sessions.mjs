/** Deterministic barriers over the owned async execution facade. */
import { queryValue, releaseSession } from './governed-authority-execution.mjs';
import { sleep, sql, startSession } from './governed-authority-processes.mjs';

const blockedEdge = (waiter, blocker) => `exists (
  select 1 from pg_stat_activity w join pg_stat_activity b
    on b.pid = any(pg_catalog.pg_blocking_pids(w.pid))
  where w.application_name = ${sql(waiter.app)} and b.application_name = ${sql(blocker.app)})`;

const observe = async (predicate, participants, timeoutMs = 8_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (participants.some((session) => session.settled)) return false;
    if ((await queryValue(`select ${predicate};`, 'barrier-probe')) === 't')
      return true;
    await sleep(150);
  }
  return false;
};

export const observedBlockedBy = (waiter, blocker) =>
  observe(blockedEdge(waiter, blocker), [waiter, blocker]);

/** Both edges must exist in the SAME probe: revoker -> writer -> subject holder. */
export const observedWaitChain = (revoker, writer, holder) =>
  observe(
    `${blockedEdge(revoker, writer)} and ${blockedEdge(writer, holder)}`,
    [revoker, writer, holder],
  );

export const holdSubjectLock = async (subjectId) => {
  const holder = startSession(
    'subject-holder',
    `begin;
    do $hold$ begin
      perform 1 from platform_private.cms_template_versions
        where id = ${sql(subjectId)}::uuid for update;
      if not found then raise exception 'race subject missing'; end if;
    end $hold$;
    select pg_catalog.pg_sleep(900);`,
  );
  try {
    const ready = await observe(
      `exists (
      select 1 from pg_stat_activity where application_name = ${sql(holder.app)}
        and state = 'active' and wait_event_type = 'Timeout' and wait_event = 'PgSleep')`,
      [holder],
    );
    if (!ready)
      throw new Error('subject holder failed readiness before the race');
  } catch (error) {
    try {
      await releaseSession(holder);
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        'holder readiness and cleanup failed',
      );
    }
    throw error;
  }
  return Object.assign(holder, { release: () => releaseSession(holder) });
};

export const responseOf = (outcome) => {
  const line = outcome.stdout
    .split('\n')
    .filter(
      (candidate) => candidate.startsWith('{') && !candidate.includes('|'),
    )
    .at(-1);
  return line === undefined ? null : JSON.parse(line);
};

export const sqlError = (outcome) => {
  const match = /ERROR:\s+([0-9A-Z]{5}):\s+([^\n]*)/u.exec(outcome.stderr);
  return match ? { state: match[1], message: match[2].trim() } : null;
};

export const ranAsServiceRole = (outcome) =>
  outcome.stdout.split('\n').includes('transport-role:service_role');
