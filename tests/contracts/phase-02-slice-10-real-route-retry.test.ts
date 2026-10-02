import { createRequire } from 'node:module';

import { describe, expect, it, vi } from 'vitest';

type SuiteResult = Readonly<{ exitCode: number; output: string }>;
type RetryDependencies = Readonly<{
  runOnce: () => Promise<SuiteResult>;
  readWranglerLog: (path: string) => Promise<string | null>;
  onRetry: () => void;
}>;
type RetryModule = Readonly<{
  parseWranglerLogPath: (output: string) => string | null;
  isProxyDisconnect: (log: string) => boolean;
  runRealRouteWithRetry: (deps: RetryDependencies) => Promise<number>;
}>;

const loadRetry = (): RetryModule =>
  createRequire(import.meta.url)(
    '../e2e/support/s09-real-suite-retry.cjs',
  ) as RetryModule;

const logPath = '/home/rob/.wrangler/logs/wrangler-2026-09-30_07-21-07_024.log';
const crashOutput = `✘ [ERROR]\nLogs were written to "${logPath}"`;
const proxyCrash =
  'Error in ProxyController: Error inside ProxyWorker\n' +
  "cause: { name: 'Error', message: 'Network connection lost.' }";

describe('production-built Chrome suite retry boundary', () => {
  it('accepts only a Wrangler-owned log path from the child output', () => {
    const { parseWranglerLogPath } = loadRetry();
    expect(parseWranglerLogPath(crashOutput)).toBe(logPath);
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

  it('restarts the complete suite once after only the known proxy crash', async () => {
    const runOnce = vi
      .fn()
      .mockResolvedValueOnce({ exitCode: 1, output: crashOutput })
      .mockResolvedValueOnce({ exitCode: 0, output: '10 passed' });
    const readWranglerLog = vi.fn().mockResolvedValue(proxyCrash);
    const onRetry = vi.fn();
    expect(
      await loadRetry().runRealRouteWithRetry({
        runOnce,
        readWranglerLog,
        onRetry,
      }),
    ).toBe(0);
    expect(runOnce).toHaveBeenCalledTimes(2);
    expect(readWranglerLog).toHaveBeenCalledWith(logPath);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('keeps the gate red if the second complete suite fails', async () => {
    const runOnce = vi
      .fn()
      .mockResolvedValueOnce({ exitCode: 1, output: crashOutput })
      .mockResolvedValueOnce({ exitCode: 1, output: crashOutput });
    const readWranglerLog = vi.fn().mockResolvedValue(proxyCrash);
    const onRetry = vi.fn();
    expect(
      await loadRetry().runRealRouteWithRetry({
        runOnce,
        readWranglerLog,
        onRetry,
      }),
    ).toBe(1);
    expect(runOnce).toHaveBeenCalledTimes(2);
    expect(readWranglerLog).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
