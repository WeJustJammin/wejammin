'use strict';
/* global module */

// Smallest recognized Wrangler-owned log path in the child output. The newest
// match wins because a run can restart the web session and print more than one.
const parseWranglerLogPath = (output) => {
  const matches = output.match(
    /Logs were written to "([^"\r\n]+)"/gu,
  );
  if (matches === null) return null;
  const last = matches[matches.length - 1];
  const path = last.slice(last.indexOf('"') + 1, last.lastIndexOf('"'));
  return /(?:^|[\\/])\.wrangler[\\/]logs[\\/]wrangler-[\w.-]+\.log$/u.test(
    path,
  )
    ? path
    : null;
};

// The recognized local ProxyWorker disconnect: the ProxyController error frame
// followed closely by the transport loss it reports. A generic worker failure
// without the transport cause stays unrecognized.
const isProxyDisconnect = (log) => {
  const marker = 'Error in ProxyController: Error inside ProxyWorker';
  const start = log.lastIndexOf(marker);
  return (
    start >= 0 &&
    log.slice(start, start + 3_500).includes('Network connection lost.')
  );
};

// The explicit launcher line for a web Wrangler session that exited before
// teardown. This is a second recognized infrastructure signature: the restart
// happens, but a test in flight can lose hydration before the session recovers.
const isServerExitDisconnect = (output) =>
  /S09 web server exited before teardown \(code=\d+, signal=\w+\); restarting \(\d+\/\d+\)/u.test(
    output,
  );

const recognizeInfrastructureDisconnect = async ({
  result,
  readWranglerLog,
}) => {
  if (isServerExitDisconnect(result.output)) return true;
  const logPath = parseWranglerLogPath(result.output);
  if (logPath === null) return false;
  let log;
  try {
    log = await readWranglerLog(logPath);
  } catch {
    return false;
  }
  return log !== null && isProxyDisconnect(log);
};

// Fail-closed bound: at most three complete-suite attempts. Each retry is gated
// by an independently proven infrastructure disconnect in that attempt, an
// assertion failure or unrelated error stops the loop immediately, and
// exhaustion returns the last failing exit code.
const runRealRouteWithRetry = async ({
  runOnce,
  readWranglerLog,
  onRetry,
  maxAttempts = 3,
}) => {
  let lastExitCode = 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await runOnce();
    if (result.exitCode === 0) return 0;
    lastExitCode = result.exitCode;

    const recognized = await recognizeInfrastructureDisconnect({
      result,
      readWranglerLog,
    });
    if (!recognized) break;
    if (attempt < maxAttempts) onRetry({ attempt, maxAttempts });
  }
  return lastExitCode;
};

module.exports = {
  parseWranglerLogPath,
  isProxyDisconnect,
  isServerExitDisconnect,
  runRealRouteWithRetry,
};
