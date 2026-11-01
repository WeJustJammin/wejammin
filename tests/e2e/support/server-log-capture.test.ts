import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';

import { afterEach, describe, expect, it } from 'vitest';

import {
  logFilesHolding,
  readServerLogs,
  readServerLogsSettled,
  resolveServerLogDirectory,
  spellingsOf,
} from './server-log-capture';
import {
  SERVER_LOG_DIRECTORY_ENV,
  SERVER_LOG_FILES,
  createServerLogCapture,
  serverLogDirectoryFor,
  serverLogPointerPath,
} from './server-log-layout.mjs';

/**
 * Harness proof for the real-route server-log scan (P2-S12-AC-273 "logs or telemetry"): the writer lays the files down,
 * the reader finds the live run, and a seeded sink with a leaked value FAILS the scan while a clean sink passes it.
 */

const roots: string[] = [];
const newRoot = (): string => {
  const root = mkdtempSync(join(tmpdir(), 'server-log-capture-'));
  roots.push(root);
  return root;
};
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

const PERSON = '2f6b0c2e-6f0e-4d1d-9d57-0a6a4f8c1111';
const REASON = 'Decision reason run-7f3a "quoted" é';

const seed = (root: string, runToken: string, api: string, web: string) => {
  const capture = createServerLogCapture({
    projectRoot: root,
    runToken,
    env: {},
  });
  capture.append('api', api);
  capture.append('web', web);
  return capture;
};

describe('the writer', () => {
  it('lays the run under .lane-logs/e2e-server-logs, never under test-results, and announces it', () => {
    const root = newRoot();
    const capture = seed(root, 'run-1', 'api line\n', 'web line\n');
    expect(capture.directory).toBe(
      join(root, '.lane-logs/e2e-server-logs/run-1'),
    );
    expect(capture.directory).not.toContain('test-results');
    for (const name of Object.values(SERVER_LOG_FILES))
      expect(existsSync(join(capture.directory, name))).toBe(true);
    const pointer = JSON.parse(
      readFileSync(serverLogPointerPath(root), 'utf8'),
    );
    expect(pointer).toMatchObject({
      directory: capture.directory,
      pid: process.pid,
      runToken: 'run-1',
    });
    capture.close();
    expect(existsSync(serverLogPointerPath(root))).toBe(false);
    expect(existsSync(join(capture.directory, SERVER_LOG_FILES.api))).toBe(
      true,
    );
  });

  it('refuses an override directory under test-results', () => {
    const root = newRoot();
    expect(() =>
      serverLogDirectoryFor(root, 'run-1', {
        [SERVER_LOG_DIRECTORY_ENV]: join(root, 'test-results', 'logs'),
      }),
    ).toThrow(/test-results/);
  });

  it('tees a stream unchanged to the destination and into the log, synchronously', () => {
    const root = newRoot();
    const capture = createServerLogCapture({
      projectRoot: root,
      runToken: 'run-2',
      env: {},
    });
    const source = new PassThrough();
    const echoed: Buffer[] = [];
    capture.tee('api', source, { write: (chunk) => echoed.push(chunk) });
    source.write(Buffer.from('first\nsecond\n'));
    expect(Buffer.concat(echoed).toString()).toBe('first\nsecond\n');
    expect(
      readFileSync(join(capture.directory, SERVER_LOG_FILES.api), 'utf8'),
    ).toContain('first\nsecond\n');
    capture.close();
  });

  it("leaves a newer run's pointer alone when an older launcher closes", () => {
    const root = newRoot();
    const older = createServerLogCapture({
      projectRoot: root,
      runToken: 'old',
      env: {},
    });
    const newer = createServerLogCapture({
      projectRoot: root,
      runToken: 'new',
      env: {},
    });
    older.close();
    expect(
      JSON.parse(readFileSync(serverLogPointerPath(root), 'utf8')).runToken,
    ).toBe('new');
    newer.close();
  });
});

describe('finding the run', () => {
  it('reads the pointer of a live launcher and honours an override', () => {
    const root = newRoot();
    const capture = seed(root, 'run-3', 'x\n', 'y\n');
    expect(resolveServerLogDirectory(root, {})).toBe(capture.directory);
    expect(
      resolveServerLogDirectory(root, {
        [SERVER_LOG_DIRECTORY_ENV]: '/elsewhere',
      }),
    ).toBe('/elsewhere');
    capture.close();
  });

  it('fails closed on a missing, stale or malformed pointer', () => {
    const root = newRoot();
    expect(() => resolveServerLogDirectory(root, {})).toThrow(
      /No real-route server log capture/,
    );
    const capture = seed(root, 'run-4', 'x\n', 'y\n');
    expect(() => resolveServerLogDirectory(root, {}, () => false)).toThrow(
      /stale/,
    );
    writeFileSync(serverLogPointerPath(root), '{"directory":1}\n');
    expect(() => resolveServerLogDirectory(root, {})).toThrow(/malformed/);
    capture.close();
  });
});

describe('the scan', () => {
  it('passes a sink that holds neither the person id nor the reason', () => {
    const root = newRoot();
    const capture = seed(
      root,
      'clean',
      '{"eventName":"cms.template.command","outcome":"success","entityIdHash":"sha256:' +
        'a'.repeat(64) +
        '"}\n',
      'GET /app/cms-content-modeling/templates 200 OK (4ms)\n',
    );
    const logs = readServerLogs(capture.directory);
    expect(logFilesHolding(PERSON, logs)).toEqual([]);
    expect(logFilesHolding(REASON, logs)).toEqual([]);
    capture.close();
  });

  it('FAILS a sink that leaked a person id into the API log, naming the file', () => {
    const root = newRoot();
    const capture = seed(
      root,
      'leak-person',
      `{"actor":"${PERSON}"}\n`,
      'GET / 200 OK\n',
    );
    expect(logFilesHolding(PERSON, readServerLogs(capture.directory))).toEqual([
      SERVER_LOG_FILES.api,
    ]);
    capture.close();
  });

  it('FAILS a sink that leaked a reason in JSON-escaped, percent-encoded or raw form, in the web log', () => {
    const root = newRoot();
    for (const [index, spelling] of spellingsOf(REASON).entries()) {
      const capture = seed(
        root,
        `leak-reason-${String(index)}`,
        'ok\n',
        `GET /x?why=${spelling} 200 OK\n`,
      );
      expect(
        logFilesHolding(REASON, readServerLogs(capture.directory)),
      ).toEqual([SERVER_LOG_FILES.web]);
      capture.close();
    }
  });

  it('FAILS a value the launcher itself logged', () => {
    const root = newRoot();
    const capture = seed(root, 'leak-launcher', 'ok\n', 'ok\n');
    capture.launcherLine(`S09 held GET /patterns/${PERSON} (ECONNRESET)`);
    expect(logFilesHolding(PERSON, readServerLogs(capture.directory))).toEqual([
      SERVER_LOG_FILES.launcher,
    ]);
    capture.close();
  });

  it('refuses an empty needle instead of matching every line', () => {
    expect(() => spellingsOf('')).toThrow(/empty/);
  });

  it('fails closed on a log with no captured output or a missing file', () => {
    const root = newRoot();
    const capture = seed(root, 'empty', '', 'web\n');
    expect(() => readServerLogs(capture.directory)).toThrow(
      /holds no captured output/,
    );
    rmSync(join(capture.directory, SERVER_LOG_FILES.web));
    expect(() => readServerLogs(capture.directory)).toThrow(/missing/);
    capture.close();
  });

  it('waits for a late line before it reads', async () => {
    const root = newRoot();
    const capture = seed(root, 'late', 'first\n', 'web\n');
    setTimeout(() => capture.append('api', `late ${PERSON}\n`), 100);
    const logs = await readServerLogsSettled(capture.directory, {
      settleMs: 250,
      maxMs: 2_000,
    });
    expect(logFilesHolding(PERSON, logs)).toEqual([SERVER_LOG_FILES.api]);
    capture.close();
  });
});
