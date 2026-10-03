import http from 'node:http';

/**
 * Loopback front door of the real-route web server.
 *
 * `wrangler dev` treats any network error its ProxyWorker meets while
 * forwarding to the user Worker as fatal to the whole dev session (the
 * ProxyController re-throws it and the process exits), and the Slice 09 suite
 * has seen that exit between two tests. The web Worker is stateless (the lane
 * world lives in the API session), so the launcher restarts it; this proxy
 * makes the restart invisible to the browser by holding each request until the
 * web server is ready again instead of refusing it.
 *
 * Nothing is rewritten: the method, path, headers and body reach the web
 * server as sent and the status, headers and body come back unchanged. A
 * request is retried only when it provably never reached the server (refused
 * connection) or is a bodiless idempotent read that the server dropped.
 */

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

const IDEMPOTENT = new Set(['GET', 'HEAD', 'OPTIONS']);
const NEVER_DELIVERED = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EHOSTUNREACH']);
const DROPPED = new Set(['ECONNRESET', 'EPIPE', 'ECONNABORTED']);

const collect = (request) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });

const forwardedHeaders = (headers, body) => {
  const result = {};
  for (const [name, value] of Object.entries(headers)) {
    if (HOP_BY_HOP.has(name.toLowerCase())) continue;
    result[name] = value;
  }
  // The body was buffered, so its length is known exactly.
  delete result['content-length'];
  if (body.length > 0) result['content-length'] = String(body.length);
  result.connection = 'close';
  return result;
};

/**
 * @param {{
 *   port: number,
 *   host?: string,
 *   upstreamPort: () => number,
 *   ready: () => Promise<void>,
 *   holdMs?: number,
 *   maxAttempts?: number,
 *   onRetry?: (info: { method: string, url: string, code: string, attempt: number }) => void,
 * }} options
 */
export const createHoldingProxy = ({
  port,
  host = '127.0.0.1',
  upstreamPort,
  ready,
  holdMs = 90_000,
  onRetry = () => undefined,
}) => {
  const hold = async () => {
    let timer;
    try {
      await Promise.race([
        ready(),
        new Promise((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error('upstream did not become ready in time')),
            holdMs,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };

  const refuse = (response, status, message) => {
    if (response.headersSent) {
      response.destroy();
      return;
    }
    response.writeHead(status, {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    });
    response.end(message);
  };

  const sleep = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));

  /** `deadline` is when this request stops waiting for the web server. */
  const attempt = (request, response, body, number, clientGone, deadline) => {
    const outbound = http.request(
      {
        host,
        port: upstreamPort(),
        method: request.method,
        path: request.url,
        headers: forwardedHeaders(request.headers, body),
        agent: false,
      },
      (inbound) => {
        const headers = {};
        for (const [name, value] of Object.entries(inbound.headers)) {
          if (!HOP_BY_HOP.has(name.toLowerCase())) headers[name] = value;
        }
        response.writeHead(
          inbound.statusCode ?? 502,
          inbound.statusMessage,
          headers,
        );
        // A client that has gone away must not abort the upstream response:
        // drain it so the web server never sees a cancelled stream.
        if (clientGone.value) inbound.resume();
        else inbound.pipe(response);
      },
    );
    outbound.on('error', (error) => {
      const code = error.code ?? '';
      const retriable =
        Date.now() < deadline &&
        !response.headersSent &&
        (NEVER_DELIVERED.has(code) ||
          (DROPPED.has(code) &&
            IDEMPOTENT.has(request.method ?? '') &&
            body.length === 0));
      if (!retriable) {
        refuse(
          response,
          502,
          `Upstream unavailable (${code || error.message}).`,
        );
        return;
      }
      onRetry({
        method: request.method ?? '',
        url: request.url ?? '',
        code,
        attempt: number,
      });
      // `ready` may still describe the session that just died, so back off
      // before each retry instead of spinning on a stale promise.
      hold()
        .then(() => sleep(Math.min(500, 50 * number)))
        .then(
          () =>
            attempt(request, response, body, number + 1, clientGone, deadline),
          () =>
            refuse(response, 503, 'The web server did not recover in time.'),
        );
    });
    outbound.end(body);
  };

  const server = http.createServer((request, response) => {
    const clientGone = { value: false };
    response.on('close', () => {
      clientGone.value = true;
    });
    collect(request).then(
      (body) =>
        attempt(request, response, body, 1, clientGone, Date.now() + holdMs),
      () => refuse(response, 400, 'The request could not be read.'),
    );
  });
  // Keep-alive from the browser is fine; idle sockets must not hold the process.
  server.keepAliveTimeout = 5_000;

  return {
    listen: () =>
      new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.off('error', reject);
          resolve();
        });
      }),
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
};
