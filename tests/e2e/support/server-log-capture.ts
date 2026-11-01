/**
 * The reader half of the real-route server-log capture (the writer is `server-log-layout.mjs`, used by
 * `run-s09-real-servers.mjs`). It finds the live run's directory, reads what the API Worker (the production logger and
 * every `console` line), the web server (wrangler's own request and error lines) and the launcher wrote, and reports
 * which file holds a forbidden value. P2-S12-AC-273: "no diff value, canonical id or person id in the URL, storage,
 * logs or telemetry" (FE03 line 895).
 *
 * It fails CLOSED. A directory that is absent, belongs to a launcher that is no longer alive, or holds a log with no
 * captured output beyond its header throws, because a scan over nothing would pass without proving anything.
 * No Playwright import: unit-tested by `server-log-capture.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  SERVER_LOG_DIRECTORY_ENV,
  SERVER_LOG_FILES,
  SERVER_LOG_HEADER_PREFIX,
  serverLogPointerPath,
  type ServerLogKind,
} from './server-log-layout.mjs';

export type CapturedLog = Readonly<{
  kind: ServerLogKind;
  file: string;
  /** Everything after the launcher's header line. */
  text: string;
}>;

type Environment = Readonly<Record<string, string | undefined>>;

const processIsAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means the process exists but belongs to someone else.
    return (error as { code?: unknown }).code === 'EPERM';
  }
};

/**
 * The directory of the run the specs are driving: the environment override when set (no liveness check, the caller
 * owns that directory), else the launcher's pointer file, whose launcher process must still be alive.
 */
export const resolveServerLogDirectory = (
  projectRoot: string,
  env: Environment = process.env,
  isAlive: (pid: number) => boolean = processIsAlive,
): string => {
  const override = env[SERVER_LOG_DIRECTORY_ENV];
  if (override !== undefined && override !== '') return override;
  const pointer = serverLogPointerPath(projectRoot);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(pointer, 'utf8'));
  } catch {
    throw new Error(
      `No real-route server log capture is announced at ${pointer}. Start the servers with run-s09-real-servers.mjs (Playwright's webServer does), or set ${SERVER_LOG_DIRECTORY_ENV}.`,
    );
  }
  const record = parsed as { directory?: unknown; pid?: unknown };
  if (typeof record.directory !== 'string' || typeof record.pid !== 'number')
    throw new Error(`The server log pointer ${pointer} is malformed.`);
  if (!isAlive(record.pid))
    throw new Error(
      `The server log pointer ${pointer} names launcher pid ${String(record.pid)}, which is no longer running: the capture is stale.`,
    );
  return record.directory;
};

const readLog = (directory: string, kind: ServerLogKind): CapturedLog => {
  const file = join(directory, SERVER_LOG_FILES[kind]);
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    throw new Error(`Server log ${file} is missing.`);
  }
  const lines = raw.split('\n');
  const body =
    lines[0]?.startsWith(SERVER_LOG_HEADER_PREFIX) === true
      ? lines.slice(1).join('\n')
      : raw;
  return { kind, file, text: body };
};

/** One synchronous read of the three logs. API and web must hold captured output; the launcher log may be header-only. */
export const readServerLogs = (directory: string): CapturedLog[] => {
  const logs = (['api', 'web', 'launcher'] as const).map((kind) =>
    readLog(directory, kind),
  );
  for (const log of logs)
    if (log.kind !== 'launcher' && log.text.trim() === '')
      throw new Error(
        `Server log ${log.file} holds no captured output, so scanning it would prove nothing. The ${log.kind} server's stdout and stderr are not reaching the launcher's capture.`,
      );
  return logs;
};

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((done) => setTimeout(done, milliseconds));

/**
 * Reads the logs once their sizes stop changing: a server writes a request's log line a little after the response is
 * on the wire, and the launcher receives it through a pipe. Two equal readings `settleMs` apart end the wait; `maxMs`
 * bounds it so a chatty server cannot stall a journey.
 */
export const readServerLogsSettled = async (
  directory: string,
  options: { settleMs?: number; maxMs?: number } = {},
): Promise<CapturedLog[]> => {
  const settleMs = options.settleMs ?? 400;
  const maxMs = options.maxMs ?? 4_000;
  const sizeOf = (logs: CapturedLog[]): number =>
    logs.reduce((total, log) => total + log.text.length, 0);
  const deadline = Date.now() + maxMs;
  let logs = readServerLogs(directory);
  for (;;) {
    await sleep(settleMs);
    const next = readServerLogs(directory);
    const stable = sizeOf(next) === sizeOf(logs);
    logs = next;
    if (stable || Date.now() >= deadline) return logs;
  }
};

/** The spellings a value takes in a log line: raw, JSON-escaped (structured lines) and percent-encoded (request URLs). */
export const spellingsOf = (needle: string): string[] => {
  if (needle === '')
    throw new TypeError(
      'An empty value matches every log line; refusing to scan for it.',
    );
  const spellings = new Set<string>([
    needle,
    JSON.stringify(needle).slice(1, -1),
    encodeURIComponent(needle),
  ]);
  return [...spellings];
};

/** The captured logs (by file name) that hold `needle` in any spelling. Empty means the value did not leak. */
export const logFilesHolding = (
  needle: string,
  logs: readonly CapturedLog[],
): string[] => {
  const spellings = spellingsOf(needle);
  return logs
    .filter((log) => spellings.some((spelling) => log.text.includes(spelling)))
    .map((log) => SERVER_LOG_FILES[log.kind]);
};
