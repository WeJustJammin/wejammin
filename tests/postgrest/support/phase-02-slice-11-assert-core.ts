/**
 * PURE strict-assertion core for the Slice 11 real-composition suites (lane
 * S11-4R). This module imports only `node:crypto`, `@wejammin/contracts`,
 * `@wejammin/contracts/time-authority`, `vitest` and the pure diagnostic helpers.
 * It has NO import of the stack (not even a type-only one): the response shape it
 * needs is a local STRUCTURAL type, so importing it triggers NO database or stack
 * module-load side effects. The DB/stack facade `phase-02-slice-11-assert.ts`
 * re-exports these values, so the controls exercise the SAME functions.
 */
import { createHash } from 'node:crypto';

import { ApiErrorSchema } from '@wejammin/contracts';
import { parseInstant } from '@wejammin/contracts/time-authority';
import { expect } from 'vitest';

import {
  SAFE_ERROR_CODES,
  deepEqual,
  valueDigest,
} from './phase-02-slice-11-safe-diagnostics';

/**
 * The structural shape of a captured HTTP response. Declared locally so this module
 * needs no stack import; the stack's `S11Response` is structurally assignable to it.
 */
export type AssertResponse = Readonly<{
  status: number;
  headers: Headers;
  body: Record<string, unknown>;
  text: string;
}>;

/**
 * Assert two values are EXACTLY equal (real deep equality) while exposing only a
 * boolean and the two value digests to the failure diagnostic. A schema-valid
 * forbidden payload (a synthetic token in `details`, a stray header, an
 * unexpected member) can therefore never be printed by a diff.
 */
export const expectSafeEqual = (
  actual: unknown,
  expected: unknown,
  summary: string,
): void => {
  // The equality oracle is EXACT deep equality (independent of any digest): it is
  // correct for -0/NaN, own __proto__ members, repeated-reference aliases and true
  // cycles. The digests are diagnostic only and are computed only when unequal.
  if (deepEqual(actual, expected)) return;
  expect(
    false,
    `${summary} (expectedSha=${valueDigest(expected)} actualSha=${valueDigest(
      actual,
    )})`,
  ).toBe(true);
};

/**
 * Parse one response body through the strict BE00 `ApiErrorSchema`. A schema
 * failure (for example an unknown key) is rethrown as a FIXED safe error, so the
 * raw Zod issues and the offending input can never reach a failure diagnostic.
 * Strict schema validation is retained; only the diagnostic is sanitized.
 */
export const parseApiError = (response: AssertResponse) => {
  const parsed = ApiErrorSchema.safeParse(response.body);
  if (!parsed.success)
    throw new Error('response body failed the strict ApiError schema');
  return parsed.data;
};

/**
 * A diagnostic summary of one response that never prints the raw body: the
 * status, a code from the DIAGNOSTIC allowlist, and a short digest of the body
 * text. A failure message built from this can never leak a preview token,
 * manifest or person identifier.
 */
export const safeResponse = (response: AssertResponse): string => {
  // Never print an arbitrary body string: only a code from the diagnostic set is
  // echoed. A body string that merely matches the code grammar is replaced by
  // `n/a`, so a syntax match can never leak.
  const rawCode = response.body.code;
  const code =
    typeof rawCode === 'string' && SAFE_ERROR_CODES.has(rawCode)
      ? rawCode
      : 'n/a';
  const bodySha = createHash('sha256')
    .update(response.text)
    .digest('hex')
    .slice(0, 16);
  return `status=${response.status} code=${code} bodySha256=${bodySha}`;
};

/**
 * Assert a response status without ever printing the raw body: a failing status
 * assertion is reported with the safe `safeResponse` summary.
 */
export const expectStatus = (
  response: AssertResponse,
  expected: number,
  label?: string,
): void => {
  const summary = safeResponse(response);
  const prefix = label === undefined ? summary : `${label}: ${summary}`;
  expect(
    response.status === expected,
    `${prefix} expectedStatus=${expected}`,
  ).toBe(true);
};

/**
 * Assert a response body does not contain `identifier`, reporting only the safe
 * label on failure (never the identifier or the raw body).
 */
export const expectAbsent = (
  response: AssertResponse,
  identifier: string,
  label: string,
): void => {
  const present = response.text.includes(identifier);
  expect(present, `${label} (present=${present})`).toBe(false);
};

export type SafeErrorExpectation = Readonly<{
  status: number;
  code: string;
  /**
   * The exact closed `details` (extra or missing keys fail). Supply either this
   * or `detailsKeys`; a `404` must always be `{}`.
   */
  details?: Readonly<Record<string, unknown>>;
  /**
   * The exact closed KEY SET of `details` (sorted), for a detail whose value is
   * not enumerable (for example a bounded `preflight` array). Extra or missing
   * keys fail; the caller asserts the individual values.
   */
  detailsKeys?: readonly string[];
  /** When supplied, the body requestId and the response header must equal it. */
  requestId?: string;
  /**
   * When true, the response must carry a `Retry-After` header whose value is a
   * non-empty run of digits. The check is on a derived boolean only; the raw
   * header value is never printed.
   */
  retryAfter?: boolean;
}>;

/**
 * Assert one error response is exactly the expected safe BE00 envelope: the
 * status, the strict `code`, the exact closed `details` (no extra key), and --
 * when a request id was supplied -- that the body `requestId` and the
 * `x-request-id` response header both echo it. A 404 must carry empty details.
 */
export const expectSafeError = (
  response: AssertResponse,
  expected: SafeErrorExpectation,
): void => {
  const summary = safeResponse(response);
  expect(
    response.status === expected.status,
    `${summary} expectedStatus=${expected.status}`,
  ).toBe(true);
  const error = parseApiError(response);
  expect(
    error.code === expected.code,
    `${summary} expectedCode=${expected.code}`,
  ).toBe(true);
  if (expected.details !== undefined)
    expectSafeEqual(error.details, expected.details, `${summary} details`);
  if (expected.detailsKeys !== undefined)
    expectSafeEqual(
      Object.keys(error.details).sort(),
      [...expected.detailsKeys].sort(),
      `${summary} detailsKeys`,
    );
  // A 404 conceals: it never carries detail beyond the empty object.
  if (expected.status === 404) {
    expectSafeEqual(Object.keys(error.details), [], `${summary} 404 details`);
  } else if (
    expected.details === undefined &&
    expected.detailsKeys === undefined
  ) {
    throw new Error(
      'expectSafeError requires details or detailsKeys for a non-404 error',
    );
  }
  // Every safe error is no-store JSON, and the body requestId echoes the header.
  expect(
    response.headers.get('cache-control') === 'no-store',
    `${summary} cache-control`,
  ).toBe(true);
  // The proper MIME boundary: `application/json` optionally followed by a
  // `;`-separated parameter, NOT a prefix of `application/json-not-json`.
  expect(
    /^application\/json(?:\s*;|\s*$)/u.test(
      response.headers.get('content-type') ?? '',
    ),
    `${summary} content-type`,
  ).toBe(true);
  expect(
    response.headers.get('x-request-id') === error.requestId,
    `${summary} request-id header`,
  ).toBe(true);
  if (expected.requestId !== undefined) {
    expect(
      error.requestId === expected.requestId,
      `${summary} expectedRequestId`,
    ).toBe(true);
  }
  if (expected.retryAfter === true) {
    // A derived boolean only: a required Retry-After must be a non-empty run of
    // digits. The raw header value is never printed (it could be a marker).
    const retryAfterValid = /^\d+$/u.test(
      response.headers.get('retry-after') ?? '',
    );
    expect(retryAfterValid, `${summary} retry-after`).toBe(true);
  }
};

/**
 * True when two ISO instants denote the exact same point in time at nanosecond
 * resolution (the pinned time-authority parser, no `Date` truncation).
 */
export const sameInstant = (left: string, right: string): boolean => {
  const a = parseInstant(left);
  const b = parseInstant(right);
  return (
    a !== null && b !== null && a.seconds === b.seconds && a.nanos === b.nanos
  );
};

/** Assert two ISO instants are the same point in time, with a readable message. */
export const expectSameInstant = (
  actual: string,
  expected: string,
  label: string,
): void => {
  expect(
    sameInstant(actual, expected),
    `${label}: ${actual} vs ${expected}`,
  ).toBe(true);
};

/**
 * Assert a recorded command-wire request carries a PRESENT evidence object (a
 * healthy Worker proof, not null and not the absent key `undefined`).
 */
export const expectEvidencePresent = (
  request: Record<string, unknown>,
): void => {
  const evidence = request.evidence;
  const shape =
    typeof evidence === 'object' && evidence !== null
      ? `object(${Object.keys(evidence).length} keys)`
      : typeof evidence;
  expect(
    typeof evidence === 'object' && evidence !== null,
    `evidence must be a present object, saw ${shape}`,
  ).toBe(true);
};

/**
 * Assert a recorded command-wire request carries an EXACT null evidence (an
 * outage or event-less branch): not a missing key, not undefined. The failure
 * diagnostic is boolean only, so an object-valued non-null evidence (which could
 * carry a token) is never printed.
 */
export const expectEvidenceNull = (request: Record<string, unknown>): void => {
  // OWN membership only: an inherited `evidence` member (from the prototype) is not
  // a null wire member and must be rejected, so `Object.hasOwn` (never `in`).
  const present = Object.hasOwn(request, 'evidence');
  const isNull = present && request.evidence === null;
  expect(
    isNull,
    `evidence must be an exact null member (present=${present} isNull=${isNull})`,
  ).toBe(true);
};
