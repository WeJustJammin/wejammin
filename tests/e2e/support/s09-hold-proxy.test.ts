import http from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';

import { createHoldingProxy } from './s09-hold-proxy.mjs';

/**
 * Harness proof for the real-route front door: it forwards unchanged, holds a
 * request while the web server restarts instead of refusing it, retries only
 * what provably never ran, and never lets a gone client abort the upstream.
 */

const closers: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

const freePort = async (): Promise<number> => {
  const probe = http.createServer();
  await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const { port } = probe.address() as AddressInfo;
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  return port;
};

const startUpstream = async (
  port: number,
  handler: http.RequestListener,
): Promise<http.Server> => {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) =>
    server.listen(port, '127.0.0.1', resolve),
  );
  closers.push(
    () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  );
  return server;
};

const startProxy = async (
  options: Partial<Parameters<typeof createHoldingProxy>[0]> & {
    upstream: number;
  },
) => {
  const port = await freePort();
  const retries: string[] = [];
  const proxy = createHoldingProxy({
    port,
    upstreamPort: () => options.upstream,
    ready: options.ready ?? (() => Promise.resolve()),
    ...(options.holdMs === undefined ? {} : { holdMs: options.holdMs }),
    onRetry: (info) => retries.push(`${info.method} ${info.url} ${info.code}`),
  });
  await proxy.listen();
  closers.push(() => proxy.close());
  return { port, retries };
};

const request = (
  port: number,
  init: {
    method?: string;
    path?: string;
    body?: string;
    headers?: http.OutgoingHttpHeaders;
  } = {},
): Promise<{
  status: number;
  headers: http.IncomingHttpHeaders;
  rawHeaders: string[];
  body: string;
}> =>
  new Promise((resolve, reject) => {
    const outbound = http.request(
      {
        host: '127.0.0.1',
        port,
        method: init.method ?? 'GET',
        path: init.path ?? '/',
        headers: init.headers,
        agent: false,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () =>
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            rawHeaders: response.rawHeaders,
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
      },
    );
    outbound.on('error', reject);
    outbound.end(init.body);
  });

describe('[P2-S09-AC-265] real-route holding proxy', () => {
  it('forwards the method, path, headers and body, and returns status, headers and body unchanged', async () => {
    const upstream = await freePort();
    const seen: {
      method?: string;
      url?: string;
      headers?: http.IncomingHttpHeaders;
      body: string;
    }[] = [];
    await startUpstream(upstream, (incoming, outgoing) => {
      const chunks: Buffer[] = [];
      incoming.on('data', (chunk: Buffer) => chunks.push(chunk));
      incoming.on('end', () => {
        seen.push({
          method: incoming.method,
          url: incoming.url,
          headers: incoming.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        });
        outgoing.writeHead(201, {
          'content-type': 'application/json',
          'cache-control': 'no-store',
          'set-cookie': ['a=1; Path=/; HttpOnly', 'b=2; Path=/'],
          'x-custom': 'kept',
        });
        outgoing.end('{"ok":true}');
      });
    });
    const { port } = await startProxy({ upstream });
    const response = await request(port, {
      method: 'POST',
      path: '/app/x?y=1',
      body: 'name=value',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: 'wj=1',
        'x-csrf-token': 'tok',
        host: `127.0.0.1:${port}`,
      },
    });
    expect(response.status).toBe(201);
    expect(response.body).toBe('{"ok":true}');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-custom']).toBe('kept');
    expect(response.headers['set-cookie']).toEqual([
      'a=1; Path=/; HttpOnly',
      'b=2; Path=/',
    ]);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      method: 'POST',
      url: '/app/x?y=1',
      body: 'name=value',
    });
    expect(seen[0]?.headers?.cookie).toBe('wj=1');
    expect(seen[0]?.headers?.['x-csrf-token']).toBe('tok');
    expect(seen[0]?.headers?.host).toBe(`127.0.0.1:${port}`);
    expect(seen[0]?.headers?.['content-length']).toBe('10');
  });

  it('does not forward hop-by-hop headers and asks the web server to close, so no keep-alive connection is reused', async () => {
    const upstream = await freePort();
    let headers: http.IncomingHttpHeaders = {};
    await startUpstream(upstream, (incoming, outgoing) => {
      headers = incoming.headers;
      outgoing.end('ok');
    });
    const { port } = await startProxy({ upstream });
    await request(port, {
      headers: {
        connection: 'keep-alive',
        'keep-alive': 'timeout=5',
        te: 'trailers',
      },
    });
    expect(headers.connection).toBe('close');
    expect(headers['keep-alive']).toBeUndefined();
    expect(headers.te).toBeUndefined();
  });

  it('holds a request while the web server is down and delivers it once the server is back, exactly once with its whole body', async () => {
    const upstream = await freePort();
    let up!: () => void;
    const ready = new Promise<void>((resolve) => {
      up = resolve;
    });
    const deliveries: string[] = [];
    const { port, retries } = await startProxy({
      upstream,
      ready: () => ready,
    });
    const pending = request(port, {
      method: 'POST',
      path: '/submit',
      body: 'payload=complete',
    });
    await new Promise((resolve) => setTimeout(resolve, 150));
    await startUpstream(upstream, (incoming, outgoing) => {
      const chunks: Buffer[] = [];
      incoming.on('data', (chunk: Buffer) => chunks.push(chunk));
      incoming.on('end', () => {
        deliveries.push(Buffer.concat(chunks).toString('utf8'));
        outgoing.end('delivered');
      });
    });
    up();
    const response = await pending;
    expect(response).toMatchObject({ status: 200, body: 'delivered' });
    expect(deliveries).toEqual(['payload=complete']);
    expect(retries).toEqual(['POST /submit ECONNREFUSED']);
  });

  it('retries a bodiless read that the web server dropped mid-restart', async () => {
    const upstream = await freePort();
    let hits = 0;
    await startUpstream(upstream, (incoming, outgoing) => {
      hits += 1;
      if (hits === 1) {
        incoming.socket.destroy();
        return;
      }
      outgoing.end('second try');
    });
    const { port, retries } = await startProxy({ upstream });
    const response = await request(port, { path: '/read' });
    expect(response).toMatchObject({ status: 200, body: 'second try' });
    expect(hits).toBe(2);
    expect(retries).toHaveLength(1);
  });

  it('never replays a write that the web server may have started: a dropped POST is a 502 and ran once', async () => {
    const upstream = await freePort();
    let hits = 0;
    await startUpstream(upstream, (incoming) => {
      hits += 1;
      incoming.socket.destroy();
    });
    const { port, retries } = await startProxy({ upstream });
    const response = await request(port, { method: 'POST', body: 'a=b' });
    expect(response.status).toBe(502);
    expect(response.body).toContain('Upstream unavailable');
    expect(hits).toBe(1);
    expect(retries).toEqual([]);
  });

  it('answers 503 when the web server does not recover within the hold', async () => {
    const upstream = await freePort();
    const { port } = await startProxy({
      upstream,
      ready: () => new Promise(() => undefined),
      holdMs: 200,
    });
    const response = await request(port, { path: '/never' });
    expect(response.status).toBe(503);
  });

  it('lets the upstream finish its response when the client goes away mid-response', async () => {
    const upstream = await freePort();
    let finished = false;
    await startUpstream(upstream, (_incoming, outgoing) => {
      outgoing.writeHead(200, { 'content-type': 'text/plain' });
      outgoing.write('first');
      setTimeout(() => {
        outgoing.end('last', () => {
          finished = true;
        });
      }, 150);
    });
    const { port } = await startProxy({ upstream });
    await new Promise<void>((resolve) => {
      const outbound = http.get(
        { host: '127.0.0.1', port, path: '/', agent: false },
        (response) => {
          response.once('data', () => {
            outbound.destroy();
            resolve();
          });
        },
      );
      outbound.on('error', () => undefined);
    });
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(finished).toBe(true);
  });
});
