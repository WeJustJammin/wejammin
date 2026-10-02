'use strict';
/* global module */

const parseWranglerLogPath = (output) => {
  const match = output.match(/Logs were written to "([^"\r\n]+)"/u);
  if (match === null) return null;
  const path = match[1];
  return /(?:^|[\\/])\.wrangler[\\/]logs[\\/]wrangler-[\w.-]+\.log$/u.test(path)
    ? path
    : null;
};

const isProxyDisconnect = (log) => {
  const marker = 'Error in ProxyController: Error inside ProxyWorker';
  const start = log.lastIndexOf(marker);
  return (
    start >= 0 &&
    log.slice(start, start + 3_500).includes('Network connection lost.')
  );
};

const runRealRouteWithRetry = async ({ runOnce, readWranglerLog, onRetry }) => {
  const first = await runOnce();
  if (first.exitCode === 0) return 0;

  const logPath = parseWranglerLogPath(first.output);
  if (logPath === null) return first.exitCode;

  let log;
  try {
    log = await readWranglerLog(logPath);
  } catch {
    return first.exitCode;
  }
  if (log === null || !isProxyDisconnect(log)) return first.exitCode;

  onRetry();
  const second = await runOnce();
  return second.exitCode;
};

module.exports = {
  parseWranglerLogPath,
  isProxyDisconnect,
  runRealRouteWithRetry,
};
