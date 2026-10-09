/**
 * Strict assertion helpers for the Slice 11 real-composition suites (lane
 * S11-4R, first action3). They close the weak-oracle gaps named by
 * `codex/s11-api-assertion-audit-2026-10-09.md`:

 *   * `parseApiError` / `expectSafeError` parse the error envelope through the
 *     strict `ApiErrorSchema` and pin the exact status, code, request identity
 *     and the CLOSED safe `details`, instead of a partial `toMatchObject` that a
 *     wrong code or an extra key could survive.
 *   * `sameInstant` compares two instants by their epoch value, so a second- and
 *     a millisecond-precision ISO spelling of one instant are equal without a
 *     string-equality oracle (the SQL/Worker formatting is never asserted).

 * The durable-effect snapshot helpers (`snapshotDigest`, `decodeSnapshot`, the
 * idempotency projection) live in the focused `phase-02-slice-11-effect.ts`
 * module and are re-exported here for existing consumers.
 */
import { createHash } from 'node:crypto';

import { ApiErrorSchema } from '@wejammin/contracts';
import { parseInstant } from '@wejammin/contracts/time-authority';
import { expect } from 'vitest';

import type { S11Response } from './phase-02-slice-11-stack';

export {
  EFFECT_TABLES,
  IDEMPOTENCY_TABLE,
  decodeSnapshot,
  expectUnchanged,
  idempotencyHashByteLength,
  idempotencyProjectedHashByteLength,
  idempotencyProjectionRowText,
  resourceDigest,
  snapshotDigest,
} from './phase-02-slice-11-effect';
export type {
  EffectSnapshot,
  RowTextOverrides,
  SnapshotOptions,
} from './phase-02-slice-11-effect';

/** The strict BE00 `ApiError` of one response body. */
export const parseApiError = (response: S11Response) =>
  ApiErrorSchema.parse(response.body);

/**
 * Assert a response status without ever printing the raw body: a failing status
 * assertion is reported with the safe `safeResponse` summary (status, closed-
 * grammar code, body digest) and never a token, manifest or identifier.
 */
export const expectStatus = (
  response: S11Response,
  expected: number,
  label?: string,
): void => {
  const summary = safeResponse(response);
  expect(
    response.status,
    label === undefined ? summary : `${label}: ${summary}`,
  ).toBe(expected);
};

/**
 * Assert a response body does not contain `identifier`, reporting only the safe
 * label on failure (never the identifier or the raw body).
 */
export const expectAbsent = (
  response: S11Response,
  identifier: string,
  label: string,
): void => {
  expect(response.text.includes(identifier), label).toBe(false);
};

/**
 * A diagnostic summary of one response that never prints the raw body: the
 * status, the safe `code` when present, and a short digest of the body text. A
 * failure message built from this can never leak a preview token, manifest or
 * person identifier that a 201/200 body would otherwise expose.
 */
export const safeResponse = (response: S11Response): string => {
  // Never print an arbitrary body string: only a code matching the closed BE00
  // grammar is echoed, everything else (a resource body, an unexpected shape) is
  // replaced by a marker and covered by the digest below.
  const rawCode = response.body.code;
  const code =
    typeof rawCode === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/u.test(rawCode)
      ? rawCode
      : 'n/a';
  const bodySha = createHash('sha256')
    .update(response.text)
    .digest('hex')
    .slice(0, 16);
  return `status=${response.status} code=${code} bodySha256=${bodySha}`;
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
}>;

/**
 * Assert one error response is exactly the expected safe BE00 envelope: the
 * status, the strict `code`, the exact closed `details` (no extra key), and --
 * when a request id was supplied -- that the body `requestId` and the
 * `x-request-id` response header both echo it. A 404 must carry empty details.
 */
export const expectSafeError = (
  response: S11Response,
  expected: SafeErrorExpectation,
): void => {
  const summary = safeResponse(response);
  expect(response.status, summary).toBe(expected.status);
  const error = parseApiError(response);
  expect(error.code, summary).toBe(expected.code);
  if (expected.details !== undefined)
    expect(error.details, summary).toEqual(expected.details);
  if (expected.detailsKeys !== undefined)
    expect(Object.keys(error.details).sort(), summary).toEqual(
      [...expected.detailsKeys].sort(),
    );
  // A 404 conceals: it never carries detail beyond the empty object.
  if (expected.status === 404) {
    expect(Object.keys(error.details), summary).toEqual([]);
  } else if (
    expected.details === undefined &&
    expected.detailsKeys === undefined
  ) {
    throw new Error(
      'expectSafeError requires details or detailsKeys for a non-404 error',
    );
  }
  // Every safe error is no-store JSON, and the body requestId echoes the header.
  expect(response.headers.get('cache-control'), summary).toBe('no-store');
  // The proper MIME boundary: `application/json` optionally followed by a
  // `;`-separated parameter, NOT a prefix of `application/json-not-json`.
  expect(response.headers.get('content-type'), summary).toMatch(
    /^application\/json(?:\s*;|\s*$)/u,
  );
  expect(response.headers.get('x-request-id'), summary).toBe(error.requestId);
  if (expected.requestId !== undefined) {
    expect(error.requestId, summary).toBe(expected.requestId);
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
 * outage or event-less branch): not a missing key, not undefined.
 */
export const expectEvidenceNull = (request: Record<string, unknown>): void => {
  expect('evidence' in request, 'the evidence member must be present').toBe(
    true,
  );
  expect(request.evidence).toBeNull();
};
