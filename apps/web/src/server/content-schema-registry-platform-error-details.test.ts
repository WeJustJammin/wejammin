import { describe, expect, it } from 'vitest';

import { parseContentSchemaRegistryErrorMetadata } from './content-schema-registry-platform-error-details';

const REQUEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const RESET_AT = '2026-09-02T10:41:00.000Z';

const envelope = (
  status: number,
  code: string,
  details: Record<string, unknown>,
  headers: Record<string, string> = {},
): Response =>
  new Response(
    JSON.stringify({
      code,
      message: 'Request refused.',
      requestId: REQUEST_ID,
      details,
    }),
    {
      status,
      headers: { 'content-type': 'application/json', ...headers },
    },
  );

const detailsOf = async (
  status: number,
  code: string,
  details: Record<string, unknown>,
): Promise<Readonly<Record<string, unknown>> | null> =>
  (
    await parseContentSchemaRegistryErrorMetadata(
      envelope(status, code, details),
    )
  ).apiError?.details ?? null;

describe('BE00 429 RATE_LIMITED details at the registry web boundary', () => {
  it('[P2-S09-AC-311] keeps limit, retryAfterSeconds and the RFC 3339 resetAt string the Worker emits', async () => {
    expect(
      await detailsOf(429, 'RATE_LIMITED', {
        limit: 30,
        resetAt: RESET_AT,
        retryAfterSeconds: 43,
      }),
    ).toEqual({ limit: 30, resetAt: RESET_AT, retryAfterSeconds: 43 });
  });

  it('[P2-S09-AC-311] drops a numeric resetAt because BE00 declares resetAt a string', async () => {
    expect(
      await detailsOf(429, 'RATE_LIMITED', {
        limit: 30,
        resetAt: 1_788_345_660,
        retryAfterSeconds: 43,
      }),
    ).toEqual({ limit: 30, retryAfterSeconds: 43 });
  });

  it.each([
    ['an epoch digit string', '1788345660'],
    ['a calendar-impossible month', '2026-13-02T10:41:00.000Z'],
    ['a calendar-impossible day', '2026-02-30T10:41:00.000Z'],
    ['an hour past 23', '2026-09-02T24:41:00.000Z'],
    ['a numeric offset instead of Z', '2026-09-02T10:41:00+02:00'],
    ['a local time without a zone', '2026-09-02T10:41:00'],
    ['four fraction digits', '2026-09-02T10:41:00.1234Z'],
    ['free text', 'tomorrow'],
    ['an empty string', ''],
    ['an oversized string', `${RESET_AT}${'0'.repeat(300)}`],
  ])('[P2-S09-AC-311] drops a resetAt that is %s', async (_label, value) => {
    expect(
      await detailsOf(429, 'RATE_LIMITED', {
        limit: 30,
        resetAt: value,
        retryAfterSeconds: 43,
      }),
    ).toEqual({ limit: 30, retryAfterSeconds: 43 });
  });

  it('[P2-S09-AC-311] accepts a whole-second RFC 3339 instant without a fraction', async () => {
    expect(
      await detailsOf(429, 'RATE_LIMITED', {
        limit: 30,
        resetAt: '2026-09-02T10:41:00Z',
        retryAfterSeconds: 43,
      }),
    ).toEqual({
      limit: 30,
      resetAt: '2026-09-02T10:41:00Z',
      retryAfterSeconds: 43,
    });
  });

  it('[P2-S09-AC-311] never copies a key outside the 429 allowlist', async () => {
    expect(
      await detailsOf(429, 'RATE_LIMITED', {
        limit: 30,
        resetAt: RESET_AT,
        retryAfterSeconds: 43,
        bucketDigest: 'abc',
        actor: 'person',
      }),
    ).toEqual({ limit: 30, resetAt: RESET_AT, retryAfterSeconds: 43 });
  });
});

describe('BE00 FieldViolation { path, code, message } at the registry web boundary', () => {
  it('[P2-S09-AC-1182] keeps the path, code and message of a 422 violation', async () => {
    expect(
      await detailsOf(422, 'VALIDATION_FAILED', {
        violations: [
          {
            path: '/fallbackChains/fr-FR',
            code: 'fallback_chain_length',
            message: 'fallback chain must have 1 to 16 entries',
          },
        ],
      }),
    ).toEqual({
      violations: [
        {
          path: '/fallbackChains/fr-FR',
          code: 'fallback_chain_length',
          message: 'fallback chain must have 1 to 16 entries',
        },
      ],
    });
  });

  it('[P2-S09-AC-1182] drops a violation that names its member pointer instead of path', async () => {
    expect(
      await detailsOf(422, 'VALIDATION_FAILED', {
        violations: [{ pointer: '/label', message: 'Label is required' }],
      }),
    ).toEqual({});
  });

  it('[P2-S09-AC-1182] drops a violation without a message', async () => {
    expect(
      await detailsOf(400, 'INVALID_REQUEST', {
        violations: [{ path: '/label' }],
      }),
    ).toEqual({});
  });

  it('[P2-S09-AC-1182] keeps at most 50 violations', async () => {
    const details = await detailsOf(422, 'VALIDATION_FAILED', {
      violations: Array.from({ length: 60 }, (_, index) => ({
        path: `/field${index}`,
        message: 'bad',
      })),
    });
    expect((details?.violations as readonly unknown[]).length).toBe(50);
  });
});

describe('BE00 409 CONFLICT details at the registry web boundary', () => {
  it('[P2-S09-AC-527] keeps the registered conflict kind and the recovery action token the Worker emits, so the console can follow the direction', async () => {
    expect(
      await detailsOf(409, 'CONFLICT', {
        conflict: 'INVALID_TRANSITION',
        recoveryAction: 'renew',
      }),
    ).toEqual({ conflict: 'INVALID_TRANSITION', recoveryAction: 'renew' });
    expect(
      await detailsOf(409, 'CONFLICT', {
        conflict: 'VERSION_MISMATCH',
        recoveryAction: 'reload',
        expectedVersion: '1',
        currentVersion: '2',
      }),
    ).toEqual({
      conflict: 'VERSION_MISMATCH',
      recoveryAction: 'reload',
      expectedVersion: '1',
      currentVersion: '2',
    });
  });

  it('[P2-S09-AC-527] drops a conflict kind outside the three BE00 values and a recovery action that is not a lowercase token', async () => {
    expect(
      await detailsOf(409, 'CONFLICT', {
        conflict: 'SOMETHING_ELSE',
        recoveryAction: 'Renew The Grant!',
        sql: 'select 1',
      }),
    ).toEqual({});
    expect(
      await detailsOf(409, 'CONFLICT', {
        conflict: 'IDEMPOTENCY_MISMATCH',
        recoveryAction: 'x'.repeat(40),
      }),
    ).toEqual({ conflict: 'IDEMPOTENCY_MISMATCH' });
  });
});
