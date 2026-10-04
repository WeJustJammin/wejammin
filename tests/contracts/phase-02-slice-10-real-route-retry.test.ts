import { createRequire } from 'node:module';

import { describe, expect, it, vi } from 'vitest';

type SuiteResult = Readonly<{ exitCode: number; output: string }>;
type RetryInfo = Readonly<{ attempt: number; maxAttempts: number }>;
type RetryDependencies = Readonly<{
  runOnce: () => Promise<SuiteResult>;
  readWranglerLog: (path: string) => Promise<string | null>;
  onRetry: (info: RetryInfo) => void;
  maxAttempts?: number;
}>;
type RetryModule = Readonly<{
  parseWranglerLogPath: (output: string) => string | null;
  isProxyDisconnect: (log: string) => boolean;
  isServerExitDisconnect: (output: string) => boolean;
  runRealRouteWithRetry: (deps: RetryDependencies) => Promise<number>;
}>;

const loadRetry = (): RetryModule =>
  createRequire(import.meta.url)(
    '../e2e/support/s09-real-suite-retry.cjs',
  ) as RetryModule;

const logPath = '/home/rob/.wrangler/logs/wrangler-2026-09-30_07-21-07_024.log';
const olderLogPath =
  '/home/rob/.wrangler/logs/wrangler-2026-09-30_07-00-00_000.log';
const crashOutput = `✘ [ERROR]\nLogs were written to "${logPath}"`;
const serverExitOutput =
  '[WebServer] S09 web server exited before teardown (code=1, signal=null); restarting (1/20)';
const proxyCrash =
  'Error in ProxyController: Error inside ProxyWorker\n' +
  "cause: { name: 'Error', message: 'Network connection lost.' }";

describe('production-built Chrome suite retry boundary', () => {
  it('accepts only the newest Wrangler-owned log path from the child output', () => {
    const { parseWranglerLogPath } = loadRetry();
    expect(parseWranglerLogPath(crashOutput)).toBe(logPath);
    expect(
      parseWranglerLogPath(
        `Logs were written to "${olderLogPath}"\nLogs were written to "${logPath}"`,
      ),
    ).toBe(logPath);
    expect(
      parseWranglerLogPath('Logs were written to "/tmp/unrelated.log"'),
    ).toBeNull();
    expect(parseWranglerLogPath('No Wrangler log')).toBeNull();
  });

  it('recognizes the exact local ProxyWorker disconnect, not a generic worker failure', () => {
    const { isProxyDisconnect } = loadRetry();
    expect(isProxyDisconnect(proxyCrash)).toBe(true);
    expect(
      isProxyDisconnect('Error in ProxyController: Error inside ProxyWorker'),
    ).toBe(false);
    expect(isProxyDisconnect('Network connection lost.')).toBe(false);
  });

  it('recognizes the explicit S09 web server exit line, not an unrelated stop', () => {
    const { isServerExitDisconnect } = loadRetry();
    expect(isServerExitDisconnect(serverExitOutput)).toBe(true);
    expect(
      isServerExitDisconnect(
        '[WebServer] S09 web server exited after teardown',
      ),
    ).toBe(false);
    expect(isServerExitDisconnect('112 passed')).toBe(false);
  });

  it('runs the full suite only once when all real-route checks pass', async () => {
    const runOnce = vi.fn().mockResolvedValue({ exitCode: 0, output: '' });
    const readWranglerLog = vi.fn();
    const onRetry = vi.fn();
    expect(
      await loadRetry().runRealRouteWithRetry({
        runOnce,
        readWranglerLog,
        onRetry,
      }),
    ).toBe(0);
    expect(runOnce).toHaveBeenCalledTimes(1);
    expect(readWranglerLog).not.toHaveBeenCalled();
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('preserves an application assertion failure without retrying', async () => {
    const runOnce = vi
      .fn()
      .mockResolvedValue({ exitCode: 1, output: '1 failed: expected 200' });
    const readWranglerLog = vi.fn();
    const onRetry = vi.fn();
    expect(
      await loadRetry().runRealRouteWithRetry({
        runOnce,
        readWranglerLog,
        onRetry,
      }),
    ).toBe(1);
    expect(runOnce).toHaveBeenCalledTimes(1);
    expect(readWranglerLog).not.toHaveBeenCalled();
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('does not retry an unrelated Wrangler failure', async () => {
    const runOnce = vi.fn().mockResolvedValue({
      exitCode: 1,
      output: crashOutput,
    });
    const readWranglerLog = vi.fn().mockResolvedValue('Error: invalid config');
    const onRetry = vi.fn();
    expect(
      await loadRetry().runRealRouteWithRetry({
        runOnce,
        readWranglerLog,
        onRetry,
      }),
    ).toBe(1);
    expect(runOnce).toHaveBeenCalledTimes(1);
    expect(readWranglerLog).toHaveBeenCalledWith(logPath);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('fails closed when the Wrangler log cannot be read', async () => {
    const runOnce = vi.fn().mockResolvedValue({
      exitCode: 1,
      output: crashOutput,
    });
    const readWranglerLog = vi.fn().mockResolvedValue(null);
    const onRetry = vi.fn();
    expect(
      await loadRetry().runRealRouteWithRetry({
        runOnce,
        readWranglerLog,
        onRetry,
      }),
    ).toBe(1);
    expect(runOnce).toHaveBeenCalledTimes(1);
    expect(readWranglerLog).toHaveBeenCalledWith(logPath);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('restarts the complete suite after a recognized proxy crash on each attempt', async () => {
    const runOnce = vi
      .fn()
      .mockResolvedValueOnce({ exitCode: 1, output: crashOutput })
      .mockResolvedValueOnce({ exitCode: 1, output: crashOutput })
      .mockResolvedValueOnce({ exitCode: 0, output: '112 passed' });
    const readWranglerLog = vi.fn().mockResolvedValue(proxyCrash);
    const onRetry = vi.fn();
    expect(
      await loadRetry().runRealRouteWithRetry({
        runOnce,
        readWranglerLog,
        onRetry,
      }),
    ).toBe(0);
    expect(runOnce).toHaveBeenCalledTimes(3);
    expect(readWranglerLog).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, { attempt: 1, maxAttempts: 3 });
    expect(onRetry).toHaveBeenNthCalledWith(2, { attempt: 2, maxAttempts: 3 });
  });

  it('retries on the explicit S09 web server exit line even without a log path', async () => {
    const runOnce = vi
      .fn()
      .mockResolvedValueOnce({
        exitCode: 1,
        output: `1 failed\n${serverExitOutput}`,
      })
      .mockResolvedValueOnce({ exitCode: 0, output: '112 passed' });
    const readWranglerLog = vi.fn();
    const onRetry = vi.fn();
    expect(
      await loadRetry().runRealRouteWithRetry({
        runOnce,
        readWranglerLog,
        onRetry,
      }),
    ).toBe(0);
    expect(runOnce).toHaveBeenCalledTimes(2);
    expect(readWranglerLog).not.toHaveBeenCalled();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('keeps the gate red after bounded proxy crashes are exhausted', async () => {
    const runOnce = vi
      .fn()
      .mockResolvedValue({ exitCode: 1, output: crashOutput });
    const readWranglerLog = vi.fn().mockResolvedValue(proxyCrash);
    const onRetry = vi.fn();
    expect(
      await loadRetry().runRealRouteWithRetry({
        runOnce,
        readWranglerLog,
        onRetry,
      }),
    ).toBe(1);
    expect(runOnce).toHaveBeenCalledTimes(3);
    expect(readWranglerLog).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('fails closed on a normal assertion failure after a retried proxy crash', async () => {
    const runOnce = vi
      .fn()
      .mockResolvedValueOnce({ exitCode: 1, output: crashOutput })
      .mockResolvedValueOnce({ exitCode: 7, output: 'No Wrangler log' });
    const readWranglerLog = vi.fn().mockResolvedValue(proxyCrash);
    const onRetry = vi.fn();
    expect(
      await loadRetry().runRealRouteWithRetry({
        runOnce,
        readWranglerLog,
        onRetry,
      }),
    ).toBe(7);
    expect(runOnce).toHaveBeenCalledTimes(2);
    expect(readWranglerLog).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith({ attempt: 1, maxAttempts: 3 });
  });

  it('honors an explicit smaller attempt budget and still fails closed', async () => {
    const runOnce = vi
      .fn()
      .mockResolvedValue({ exitCode: 1, output: crashOutput });
    const readWranglerLog = vi.fn().mockResolvedValue(proxyCrash);
    const onRetry = vi.fn();
    expect(
      await loadRetry().runRealRouteWithRetry({
        runOnce,
        readWranglerLog,
        onRetry,
        maxAttempts: 2,
      }),
    ).toBe(1);
    expect(runOnce).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith({ attempt: 1, maxAttempts: 2 });
  });
});
