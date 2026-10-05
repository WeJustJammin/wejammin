import { createRequestId } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  MAX_JSON_BODY_BYTES,
  createSafeErrorResponse,
  parseAuthenticatedReadRequest,
  parseProtectedCommandRequest,
  parsePublicReadRequest,
} from './request-boundary';
import {
  verifyBrowserMutationSecurity,
  withOriginVariance,
} from './browser-security';
import {
  contentLengthExceedsLimit,
  invalid,
  isJsonContentType,
  issueDetails,
  jsonPointer,
  normalizedHeaderValue,
  parseQueryValues,
  payloadTooLarge,
  unsupportedMediaType,
} from './request-boundary-support';

const REQUEST_ID = createRequestId('11111111-1111-4111-8111-111111111111');
const TARGET_ID = '44444444-4444-4444-8444-444444444444';
const PARTY_ID = '33333333-3333-4333-8333-333333333333';
const CSRF_TOKEN = 'a'.repeat(32);
const COMMAND = {
  operation: 'update' as const,
  payload: { label: 'A safe value' },
  requestedPartyId: PARTY_ID,
  targetId: TARGET_ID,
};

const commandHeaders = (): Record<string, string> => ({
  'content-type': 'application/json',
  'idempotency-key': 'operation-key-0001',
  'if-match': '"1"',
  origin: 'https://wejamm.in',
  'x-csrf-token': CSRF_TOKEN,
  'x-request-id': REQUEST_ID,
});

const commandRequest = (
  body: unknown = COMMAND,
  headers: Record<string, string> = commandHeaders(),
): Request =>
  new Request('https://wejamm.in/api/v1/infrastructure/records', {
    body: JSON.stringify(body),
    headers,
    method: 'POST',
  });

const browserRequest = (token = CSRF_TOKEN): Request =>
  new Request('https://wejamm.in/api/v1/infrastructure/records', {
    headers: {
      origin: 'https://wejamm.in',
      'x-csrf-token': token,
    },
    method: 'POST',
  });

describe('Worker request boundary coverage branches', () => {
  it('covers shared helper edge branches and bounded values', () => {
    expect(jsonPointer([])).toBe('/');
    expect(jsonPointer(['a/b', '~value'])).toBe('/a~1b/~0value');
    expect(
      issueDetails([
        {
          code: 'c'.repeat(80),
          message: 'm'.repeat(320),
          path: [],
        },
      ]),
    ).toEqual({
      violations: [
        {
          code: 'c'.repeat(64),
          message: 'm'.repeat(300),
          path: '/',
        },
      ],
    });

    expect(invalid(REQUEST_ID, 'bad')).toMatchObject({
      error: { code: 'INVALID_REQUEST', status: 400 },
    });
    expect(invalid(REQUEST_ID, 'bad', {}, 422)).toMatchObject({
      error: { code: 'VALIDATION_FAILED', status: 422 },
    });
    expect(unsupportedMediaType(REQUEST_ID)).toMatchObject({
      error: { code: 'UNSUPPORTED_MEDIA_TYPE', status: 415 },
    });
    expect(payloadTooLarge(REQUEST_ID)).toMatchObject({
      error: { code: 'PAYLOAD_TOO_LARGE', status: 413 },
    });

    expect(
      parseQueryValues(new Request('https://wejamm.in/app?q=drums')),
    ).toMatchObject({
      ok: true,
      value: { q: 'drums' },
    });
    expect(
      parseQueryValues(new Request('https://wejamm.in/app?q=one&q=two')),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });

    expect(isJsonContentType(null)).toBe(false);
    expect(isJsonContentType('Application/JSON; charset=utf-8')).toBe(true);
    expect(isJsonContentType('text/plain')).toBe(false);
    expect(contentLengthExceedsLimit(new Request('https://wejamm.in'))).toBe(
      false,
    );
    expect(
      contentLengthExceedsLimit(
        new Request('https://wejamm.in', {
          headers: { 'content-length': 'not-a-number' },
        }),
      ),
    ).toBe(false);
    expect(
      contentLengthExceedsLimit(
        new Request('https://wejamm.in', {
          headers: { 'content-length': String(MAX_JSON_BODY_BYTES) },
        }),
      ),
    ).toBe(false);
    expect(
      contentLengthExceedsLimit(
        new Request('https://wejamm.in', {
          headers: { 'content-length': String(MAX_JSON_BODY_BYTES + 1) },
        }),
      ),
    ).toBe(true);
    expect(normalizedHeaderValue(null)).toBeUndefined();
    expect(normalizedHeaderValue('  preserve whitespace  ')).toBe(
      '  preserve whitespace  ',
    );
  });

  it('covers public and authenticated read rejection branches', () => {
    expect(
      parsePublicReadRequest(
        new Request('https://wejamm.in/app/infrastructure', { method: 'POST' }),
      ),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });
    expect(
      parsePublicReadRequest(
        new Request(
          'https://wejamm.in/app/infrastructure?q=' + 'x'.repeat(121),
        ),
      ),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });

    expect(
      parseAuthenticatedReadRequest(
        new Request('https://wejamm.in/app/infrastructure', { method: 'POST' }),
      ),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });
    expect(
      parseAuthenticatedReadRequest(
        new Request(
          'https://wejamm.in/app/infrastructure?q=drums&sort=label_asc&filter=active&cursor=next&tab=facts',
        ),
      ),
    ).toMatchObject({
      ok: true,
      value: {
        query: {
          cursor: 'next',
          filter: 'active',
          q: 'drums',
          sort: 'label_asc',
          tab: 'facts',
        },
      },
    });
    expect(
      parseAuthenticatedReadRequest(
        new Request(
          'https://wejammin.in/app/infrastructure?q=' + 'x'.repeat(121),
        ),
      ),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });
    expect(
      parseAuthenticatedReadRequest(
        new Request(
          'https://wejammin.in/app/infrastructure?requestedPartyId=bad',
        ),
      ),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });
    expect(
      parseAuthenticatedReadRequest(
        new Request('https://wejammin.in/app/infrastructure?q=drums&q=other'),
      ),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });
  });

  it('covers protected command body, header, and size failures', async () => {
    expect(
      await parseProtectedCommandRequest(
        commandRequest(COMMAND, {
          ...commandHeaders(),
          'content-length': String(MAX_JSON_BODY_BYTES + 1),
        }),
      ),
    ).toMatchObject({ ok: false, error: { code: 'PAYLOAD_TOO_LARGE' } });

    const malformedLength = commandRequest();
    Object.defineProperty(malformedLength, 'headers', {
      value: new Headers({
        ...commandHeaders(),
        'content-length': '-1',
      }),
    });
    expect(await parseProtectedCommandRequest(malformedLength)).toMatchObject({
      ok: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'The Content-Length header is invalid.',
        status: 400,
      },
    });

    const unreadable = commandRequest();
    Object.defineProperty(unreadable, 'body', {
      configurable: true,
      get: () => {
        throw new Error('body read failed');
      },
    });
    expect(await parseProtectedCommandRequest(unreadable)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_REQUEST' },
    });

    expect(
      await parseProtectedCommandRequest(
        new Request('https://wejamm.in/api/v1/infrastructure/records', {
          body: 'x'.repeat(MAX_JSON_BODY_BYTES + 1),
          headers: commandHeaders(),
          method: 'POST',
        }),
      ),
    ).toMatchObject({ ok: false, error: { code: 'PAYLOAD_TOO_LARGE' } });

    expect(
      await parseProtectedCommandRequest(commandRequest({}, commandHeaders())),
    ).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_FAILED', status: 422 },
    });
    const missingIdempotency = commandHeaders();
    delete missingIdempotency['idempotency-key'];
    expect(
      await parseProtectedCommandRequest(
        commandRequest(COMMAND, missingIdempotency),
      ),
    ).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_FAILED', status: 422 },
    });
    const missingIfMatch = commandHeaders();
    delete missingIfMatch['if-match'];
    expect(
      await parseProtectedCommandRequest(
        commandRequest(COMMAND, missingIfMatch),
      ),
    ).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_FAILED', status: 422 },
    });
  });

  it('sanitizes control characters in safe error responses', async () => {
    const response = createSafeErrorResponse(REQUEST_ID, {
      code: 'INVALID_REQUEST',
      details: {},
      message: 'unsafe\u0000message\u007f',
      status: 400,
    });

    await expect(response.json()).resolves.toMatchObject({
      message: 'unsafe message ',
    });
  });

  it('covers unequal token lengths and an existing Origin variance', () => {
    expect(
      verifyBrowserMutationSecurity(browserRequest(), {
        allowedOrigins: new Set(['https://wejamm.in']),
        expectedCsrfToken: 'a'.repeat(31),
      }),
    ).toMatchObject({ ok: false });
    expect(
      verifyBrowserMutationSecurity(browserRequest(), {
        allowedOrigins: new Set(['https://wejamm.in']),
        expectedCsrfToken: 'a'.repeat(33),
      }),
    ).toMatchObject({ ok: false });

    const response = withOriginVariance(
      new Response('body', {
        headers: { vary: 'Accept, Origin, , ' },
        status: 200,
      }),
    );
    expect(response.headers.get('vary')).toBe('Accept, Origin');
  });
});
