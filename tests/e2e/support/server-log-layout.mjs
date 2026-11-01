import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { join, resolve, sep } from 'node:path';

/**
 * Where the real-route servers' logs land, shared by the launcher
 * (`run-s09-real-servers.mjs`, which writes them) and the journeys' scan
 * (`server-log-capture.ts`, which reads them), so the two cannot drift.
 *
 * Layout: `<project>/.lane-logs/e2e-server-logs/<run>/{api-worker,web-server,launcher}.log`
 * plus `<project>/.lane-logs/e2e-server-logs/current.json` naming the live run. The directory is git-excluded and
 * deliberately NOT under `test-results/` (Playwright empties that at the start of every run).
 *
 * The API Worker runs in workerd, which has no host filesystem: its sink is its process stdout. The launcher pipes
 * every child's stdout and stderr into the file for that child and still echoes it, byte for byte, to its own
 * stdout and stderr (the suite runner's retry boundary reads those).
 */
export const SERVER_LOG_DIRECTORY_ENV = 'S09_SERVER_LOG_DIR';
export const SERVER_LOG_ROOT = '.lane-logs/e2e-server-logs';
export const SERVER_LOG_POINTER = 'current.json';
export const SERVER_LOG_FILES = Object.freeze({
  api: 'api-worker.log',
  web: 'web-server.log',
  launcher: 'launcher.log',
});
/** Written first into every log file, so a file is never empty and a reader can tell captured output from the header. */
export const SERVER_LOG_HEADER_PREFIX = '# s09-real-server-log ';

const forbiddenSegment = 'test-results';

const assertOutsideTestResults = (directory) => {
  if (directory.split(sep).includes(forbiddenSegment))
    throw new TypeError(
      `${SERVER_LOG_DIRECTORY_ENV} must not be under ${forbiddenSegment}/: Playwright empties it at the next run`,
    );
};

/** The directory a launcher with this token (or environment override) writes to. */
export const serverLogDirectoryFor = (
  projectRoot,
  runToken,
  env = process.env,
) => {
  const override = env[SERVER_LOG_DIRECTORY_ENV];
  const directory =
    override === undefined || override === ''
      ? join(projectRoot, SERVER_LOG_ROOT, runToken)
      : resolve(override);
  assertOutsideTestResults(directory);
  return directory;
};

export const serverLogPointerPath = (projectRoot) =>
  join(projectRoot, SERVER_LOG_ROOT, SERVER_LOG_POINTER);

/**
 * Opens the run directory and the three log files (truncating a reused override directory), announces the run in the
 * pointer file when no override names it, and returns the writers. Writes are synchronous so that a journey reading the
 * files straight after a request sees every byte the launcher has received.
 */
export const createServerLogCapture = ({
  projectRoot,
  runToken,
  env = process.env,
  pid = process.pid,
  now = () => new Date(),
}) => {
  const directory = serverLogDirectoryFor(projectRoot, runToken, env);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const usesPointer =
    env[SERVER_LOG_DIRECTORY_ENV] === undefined ||
    env[SERVER_LOG_DIRECTORY_ENV] === '';
  const descriptors = new Map();
  for (const [kind, name] of Object.entries(SERVER_LOG_FILES)) {
    const descriptor = openSync(join(directory, name), 'w', 0o600);
    descriptors.set(kind, descriptor);
    writeSync(
      descriptor,
      `${SERVER_LOG_HEADER_PREFIX}${kind} run=${runToken} pid=${String(pid)} opened=${now().toISOString()}\n`,
    );
  }
  const pointer = serverLogPointerPath(projectRoot);
  if (usesPointer) {
    writeFileSync(
      pointer,
      `${JSON.stringify({ directory, pid, runToken })}\n`,
      { encoding: 'utf8', mode: 0o600 },
    );
  }
  let closed = false;

  const append = (kind, chunk) => {
    const descriptor = descriptors.get(kind);
    if (descriptor === undefined || closed)
      throw new TypeError(`no open server log for "${String(kind)}"`);
    writeSync(descriptor, chunk);
  };

  return {
    directory,
    append,
    /** A launcher-owned line: written to launcher.log and to the console. */
    launcherLine: (text) => {
      if (!closed) append('launcher', `${text}\n`);
      console.error(text);
    },
    /** Echo `stream` to `destination` unchanged and append the same bytes to the log of `kind`. */
    tee: (kind, stream, destination) => {
      stream.on('data', (chunk) => {
        destination.write(chunk);
        if (!closed) append(kind, chunk);
      });
    },
    /** Remove the pointer if it is still ours and close the files. The logs stay on disk. */
    close: () => {
      if (closed) return;
      closed = true;
      if (usesPointer) {
        try {
          const current = JSON.parse(readFileSync(pointer, 'utf8'));
          if (current.runToken === runToken) rmSync(pointer, { force: true });
        } catch {
          // The pointer is already gone or belongs to a newer run.
        }
      }
      for (const descriptor of descriptors.values()) {
        try {
          closeSync(descriptor);
        } catch {
          // Already closed.
        }
      }
    },
  };
};
