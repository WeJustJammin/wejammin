import { describe, expect, it } from 'vitest';

import {
  CSRF,
  MERGE_ID,
  ORIGIN,
  REQUEST_ID,
} from './phase-02-slice-02.test-fixtures';
import { createApp } from './phase-02-slice-02.test-support';

/*
 * BE00 "Hono Middleware Order" puts same-origin, size, content type and the
 * session-bound CSRF check (step 2) before body validation (step 6). AUTH-API-03
 * names its mode in the body, so a request is treated as cookie-authenticated
 * when it carries the session cookie together with a credential only the
 * link/prove_merge modes send (X-CSRF-Token, Idempotency-Key or If-Match), and
 * any session-cookie request is origin-checked first. These tests prove a
 * refused request never makes the body reader pull a single chunk, and that the
 * public sign-in start keeps the documented order (shape before anything
 * else, no origin or CSRF gate).
 */

const SESSION_COOKIE = `wj_session_ref=slice02-session-ref; wj_csrf=${CSRF}`;
const LINK_BODY = {
  provider: 'google',
  intent: 'link',
  returnTo: '/settings/security',
};
const MERGE_BODY = { ...LINK_BODY, intent: 'prove_merge', mergeId: MERGE_ID };
const SIGN_IN_BODY = {
  provider: 'google',
  intent: 'sign_in',
  returnTo: '/app',
};

const cookieHeaders = (
  overrides: Record<string, string> = {},
): Record<string, string> => ({
  accept: 'application/json',
  origin: ORIGIN,
  cookie: SESSION_COOKIE,
  'x-csrf-token': CSRF,
  'x-request-id': REQUEST_ID,
  'content-type': 'application/json',
  'idempotency-key': 'be00-order-key-01',
  'if-match': '"7"',
  ...overrides,
});

type Probe = Readonly<{ response: Response; chunksPulled: number }>;

const send = async (
  headers: Record<string, string>,
  body: unknown,
): Promise<Probe> => {
  const bytes = new TextEncoder().encode(
    typeof body === 'string' ? body : JSON.stringify(body),
  );
  let chunksPulled = 0;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull: (controller) => {
        chunksPulled += 1;
        controller.enqueue(bytes);
        controller.close();
      },
    },
    { highWaterMark: 0 },
  );
  const { app } = createApp();
  const response = await app.request(
    new Request(`${ORIGIN}/api/v1/auth/oauth/start`, {
      method: 'POST',
      headers,
      body: stream,
      duplex: 'half',
    } as RequestInit),
  );
  return { response, chunksPulled };
};

const outcome = async (
  probe: Probe,
): Promise<{ status: number; code: unknown }> => ({
  status: probe.response.status,
  code: ((await probe.response.json()) as { code?: unknown }).code,
});

describe('AUTH-API-03 refuses at the transport boundary before the body is read', () => {
  for (const [mode, body] of [
    ['link', LINK_BODY],
    ['prove_merge', MERGE_BODY],
  ] as const)
    describe(mode, () => {
      it('accepts a clean request after reading the body exactly once', async () => {
        const probe = await send(cookieHeaders(), body);
        expect(probe.response.status).toBe(201);
        expect(probe.chunksPulled).toBeGreaterThan(0);
      });

      it.each([
        [
          'foreign origin',
          { origin: 'https://evil.example.test' },
          403,
          'FORBIDDEN',
        ],
        [
          'invalid CSRF token',
          { 'x-csrf-token': 'wrong-token' },
          403,
          'FORBIDDEN',
        ],
        [
          'oversize declared length',
          { 'content-length': String(256 * 1024 + 1) },
          413,
          'PAYLOAD_TOO_LARGE',
        ],
        [
          'wrong content type',
          { 'content-type': 'text/plain' },
          415,
          'UNSUPPORTED_MEDIA_TYPE',
        ],
      ] as const)(
        '%s is refused with the body untouched, even when the body is invalid JSON',
        async (_name, header, status, code) => {
          const probe = await send(cookieHeaders(header), '{not json');
          expect(await outcome(probe)).toEqual({ status, code });
          expect(probe.chunksPulled).toBe(0);
        },
      );

      it('refuses a link-mode credential set with no CSRF header before the body is read', async () => {
        const probe = await send(
          cookieHeaders({ 'x-csrf-token': '' }),
          '{not json',
        );
        expect(await outcome(probe)).toEqual({
          status: 403,
          code: 'FORBIDDEN',
        });
        expect(probe.chunksPulled).toBe(0);
      });

      it('refuses a foreign origin on a bare session-cookie request before the body is read', async () => {
        const probe = await send(
          {
            accept: 'application/json',
            origin: 'https://evil.example.test',
            cookie: SESSION_COOKIE,
            'content-type': 'application/json',
          },
          { ...body, unknown: true },
        );
        expect(await outcome(probe)).toEqual({
          status: 403,
          code: 'FORBIDDEN',
        });
        expect(probe.chunksPulled).toBe(0);
      });
    });

  describe('public sign_in keeps the documented order', () => {
    const publicHeaders = {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-request-id': REQUEST_ID,
    };

    it('reads the body, then validates its shape, with no origin or CSRF gate', async () => {
      const probe = await send(
        { ...publicHeaders, origin: 'https://evil.example.test' },
        { ...SIGN_IN_BODY, unknown: true },
      );
      expect(await outcome(probe)).toEqual({
        status: 422,
        code: 'VALIDATION_FAILED',
      });
      expect(probe.chunksPulled).toBeGreaterThan(0);
    });

    it('starts sign-in for a browser that still holds a session cookie but sends no CSRF header', async () => {
      const probe = await send(
        { ...publicHeaders, origin: ORIGIN, cookie: SESSION_COOKIE },
        SIGN_IN_BODY,
      );
      expect(probe.response.status).toBe(201);
      expect(probe.chunksPulled).toBeGreaterThan(0);
    });
  });
});
