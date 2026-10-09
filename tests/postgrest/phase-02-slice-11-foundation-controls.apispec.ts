/**
 * Slice 11 foundation-correction controls (lane S11-4R, same-wave corrective
 * scope). Pure, NON-DB controls that exercise the ACTUAL assertion/effect/log
 * helpers and prove their failure diagnostics can never print a forbidden
 * payload: a schema-valid synthetic token in `details`, an unexpected snapshot
 * group/member name, an uppercase grammar-conforming code, a malformed header, an
 * object-valued non-null evidence, and an object log argument with a nested
 * marker. Every control goes through `runMetaControl`/`expectSafeControl`, which
 * inspect the real failure surfaces (message, stack, own leaves, Vitest
 * actual/expected) and assert only booleans and a fixed digest -- so a control's
 * own failure can never print the marker either.

 * This file imports the PURE cores only (`phase-02-slice-11-assert-core.ts`,
 * `phase-02-slice-11-snapshot-core.ts`, the pure diagnostic/log-capture helpers),
 * with NO stack import at all, so it triggers NO database or stack module-load side
 * effects (`stack.ts` runs `statusEnv()`/docker at load; the DB-bearing facade
 * `phase-02-slice-11-assert.ts` is deliberately NOT imported here). It creates no
 * fixtures.
 */
import { describe, expect, it } from 'vitest';

import {
  type AssertResponse,
  expectEvidenceNull,
  expectSafeEqual,
  expectSafeError,
  safeResponse,
} from './support/phase-02-slice-11-assert-core';
import { decodeSnapshot } from './support/phase-02-slice-11-snapshot-core';
import { captureLog } from './support/phase-02-slice-11-log-capture';
import {
  expectSafeControl,
  runMetaControl,
} from './support/phase-02-slice-11-meta-controls';
import { deepEqual } from './support/phase-02-slice-11-safe-diagnostics';

/** A synthetic sensitive marker: no whitespace, grammar-conforming where noted. */
const MARKER = 'S11FOUNDATIONSENTINEL9f3c1a7e4b2d8c60';

const responseOf = (
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
  status = 409,
): AssertResponse => ({
  status,
  headers: new Headers({
    'content-type': 'application/json; charset=UTF-8',
    'cache-control': 'no-store',
    'x-request-id': '00000000-0000-4000-8000-000000000000',
    ...headers,
  }),
  body,
  text: JSON.stringify(body),
});

describe('foundation controls: failure diagnostics never print a forbidden payload', () => {
  it('a schema-valid forbidden detail fails without printing the marker or the values', () => {
    const response = responseOf({
      code: 'CONFLICT',
      details: { reasonCode: MARKER },
      message: 'conflict',
      requestId: '00000000-0000-4000-8000-000000000000',
    });
    const control = runMetaControl(
      () =>
        expectSafeError(response, {
          status: 409,
          code: 'CONFLICT',
          details: { reasonCode: 'dependency_changed' },
        }),
      [MARKER],
    );
    expectSafeControl(control, 'forbidden detail control');
  });

  it('an unknown envelope key (schema failure) is reported without echoing the key', () => {
    const response = responseOf({
      code: 'CONFLICT',
      details: { conflict: 'INVALID_TRANSITION', recoveryAction: 'refresh' },
      message: 'conflict',
      requestId: '00000000-0000-4000-8000-000000000000',
      [MARKER]: MARKER,
    });
    const control = runMetaControl(
      () =>
        expectSafeError(response, {
          status: 409,
          code: 'CONFLICT',
          details: {
            conflict: 'INVALID_TRANSITION',
            recoveryAction: 'refresh',
          },
        }),
      [MARKER],
    );
    expectSafeControl(control, 'unknown envelope key control');
  });

  it('an uppercase grammar-conforming code marker is summarised as n/a, not echoed', () => {
    const codeMarker = MARKER.toUpperCase()
      .replace(/[^A-Z0-9_]/gu, '')
      .slice(0, 43);
    const response = responseOf({
      code: codeMarker,
      details: {},
      message: 'x',
    });
    const summary = safeResponse(response);
    // Assert by booleans only: neither the summary nor its digest reveals the code.
    expect(summary.includes(codeMarker)).toBe(false);
    expect(/code=n\/a/u.test(summary)).toBe(true);
  });

  it('a malformed header fails with a safe message that never echoes the header value', () => {
    const response = responseOf(
      {
        code: 'CONFLICT',
        details: { conflict: 'INVALID_TRANSITION', recoveryAction: 'refresh' },
        message: 'conflict',
        requestId: '00000000-0000-4000-8000-000000000000',
      },
      { 'content-type': `application/json-${MARKER}` },
    );
    const control = runMetaControl(
      () =>
        expectSafeError(response, {
          status: 409,
          code: 'CONFLICT',
          details: {
            conflict: 'INVALID_TRANSITION',
            recoveryAction: 'refresh',
          },
        }),
      [MARKER],
    );
    expectSafeControl(control, 'malformed header control');
  });

  it('an object-valued non-null evidence fails with a boolean message, never the evidence', () => {
    const control = runMetaControl(
      () => expectEvidenceNull({ evidence: { token: MARKER } }),
      [MARKER],
    );
    expectSafeControl(control, 'object-valued evidence control');
  });

  it('expectSafeEqual exposes only a boolean and digests, never the values', () => {
    const control = runMetaControl(
      () => expectSafeEqual({ a: MARKER }, { a: 'other' }, 'value'),
      [MARKER],
    );
    expectSafeControl(control, 'expectSafeEqual control');
  });
});

describe('foundation controls: exact deep equality', () => {
  it('distinguishes the cases a JSON round-trip gets wrong', () => {
    // -0 vs 0, and NaN vs NaN.
    expect(deepEqual(-0, 0)).toBe(false);
    expect(deepEqual(Number.NaN, Number.NaN)).toBe(true);
    // An own __proto__ data member (as JSON.parse produces) is an ordinary key.
    const withProto = JSON.parse('{"__proto__":1}') as Record<string, unknown>;
    expect(deepEqual(withProto, {})).toBe(false);
    expect(deepEqual(withProto, JSON.parse('{"__proto__":1}'))).toBe(true);
    // A repeated reference and a copied structure are EQUAL (alias, not cycle).
    const shared = { id: 'x' };
    expect(
      deepEqual({ a: shared, b: shared }, { a: { id: 'x' }, b: { id: 'x' } }),
    ).toBe(true);
    // A genuine cycle compares structurally and never throws.
    const leftCycle: Record<string, unknown> = { name: 'c' };
    leftCycle.self = leftCycle;
    const rightCycle: Record<string, unknown> = { name: 'c' };
    rightCycle.self = rightCycle;
    expect(deepEqual(leftCycle, rightCycle)).toBe(true);
    // Ordinary nested inequality is still detected.
    expect(deepEqual({ a: [1, 2] }, { a: [1, 3] })).toBe(false);
  });

  it('distinguishes the cases a hand-written comparator got wrong (Node isDeepStrictEqual)', () => {
    // An array with an own extra key is not equal to a plain array.
    const arrayWithOwnKey = [1, 2] as unknown as Record<string, unknown>;
    arrayWithOwnKey.extra = 'x';
    expect(deepEqual(arrayWithOwnKey, [1, 2])).toBe(false);
    // A sparse one-element array is not equal to [undefined].
    const sparse = [1] as unknown[];
    sparse.length = 1;
    delete sparse[0];
    expect(deepEqual(sparse, [undefined])).toBe(false);
    // Two different Dates are not equal; equal Dates are.
    expect(deepEqual(new Date(0), new Date(1))).toBe(false);
    expect(deepEqual(new Date(0), new Date(0))).toBe(true);
    // Two Maps with different values are not equal; equal Maps are.
    expect(deepEqual(new Map([['k', 1]]), new Map([['k', 2]]))).toBe(false);
    expect(deepEqual(new Map([['k', 1]]), new Map([['k', 1]]))).toBe(true);
  });
});

describe('foundation controls: the snapshot decoder is closed', () => {
  const goodGroup = { count: 1, sha: 'a'.repeat(64) };
  const tables = [
    'platform_private.cms_editorial_reviews',
    'platform_private.cms_editorial_decisions',
    'platform_private.cms_editorial_review_assignments',
    'platform_private.cms_editorial_review_dependencies',
    'platform_private.cms_publication_schedules',
    'platform_private.cms_publication_versions',
    'platform_private.cms_preview_tokens',
    'platform_private.cms_publication_settings_snapshots',
    'platform_private.cms_command_accessibility_evidence',
    'platform_private.idempotency_records',
    'platform_private.outbox_events',
    'audit_private.audit_events',
    'platform_private.cms_content_entries',
    'platform_private.cms_entry_revisions',
  ];
  const payload = (over: (record: Record<string, unknown>) => void): string => {
    const record = Object.fromEntries(
      tables.map((table) => [table, goodGroup]),
    );
    over(record);
    return JSON.stringify(record);
  };

  it('rejects an unexpected outer group whose name is a marker, without echoing it', () => {
    const raw = payload((record) => {
      delete record[tables[0] as string];
      record[MARKER] = goodGroup;
    });
    const control = runMetaControl(() => decodeSnapshot(raw), [MARKER]);
    expectSafeControl(control, 'unexpected outer group control');
  });

  it('rejects an extra inner group member (a smuggled marker) with a fixed message', () => {
    const raw = payload((record) => {
      record[tables[0] as string] = { ...goodGroup, rawToken: MARKER };
    });
    const control = runMetaControl(() => decodeSnapshot(raw), [MARKER]);
    expectSafeControl(control, 'extra inner member control');
  });

  it('accepts the exact closed {count,sha} groups', () => {
    const decoded = decodeSnapshot(payload(() => {}));
    expect(Object.keys(decoded).sort()).toEqual([...tables].sort());
  });
});

describe('foundation controls: object log arguments are inspected', () => {
  it('the meta-control is sensitive to a marker hidden in a non-enumerable own Error property', () => {
    const control = runMetaControl(() => {
      const error = new Error('safe message');
      Object.defineProperty(error, 'hiddenDetail', {
        value: MARKER,
        enumerable: false,
        configurable: true,
      });
      throw error;
    }, [MARKER]);
    // The marker is non-enumerable, so a naive Object.keys scan would miss it; the
    // control must still detect the leak (caught=true, leaked=true).
    expect(control.caught).toBe(true);
    expect(control.leaked).toBe(true);
  });

  it('the meta-control is sensitive to a marker in the thrown Error cause chain', () => {
    const control = runMetaControl(() => {
      throw new Error('outer', { cause: new Error(MARKER) });
    }, [MARKER]);
    expect(control.caught).toBe(true);
    expect(control.leaked).toBe(true);
  });

  it('the meta-control reports no leak for a control that throws only a safe message', () => {
    const control = runMetaControl(() => {
      throw new Error('safe failure message');
    }, [MARKER]);
    expect(control.caught).toBe(true);
    expect(control.leaked).toBe(false);
  });

  it('detects a marker nested inside an object argument that String(object) would hide', () => {
    const calls = [
      [
        '[s11-rpc] cms_submit_review 503 bytes=1 bodySha256=abcd',
        { body: MARKER },
      ],
    ];
    const capture = captureLog(calls, [MARKER]);
    expect(capture.hasObjectArg).toBe(true);
    expect(capture.leaked).toBe(true);
    // The naive String(object) rendering would have missed it entirely.
    expect(calls[0]?.map(String).join(' ').includes(MARKER)).toBe(false);
  });

  it('reports no leak for a safe metadata string argument and handles cycles', () => {
    const cyclic: Record<string, unknown> = { bodySha256: 'a'.repeat(16) };
    cyclic.self = cyclic;
    const capture = captureLog(
      [['[s11-http] GET 400 pathSha256=abc bytes=2 bodySha256=def', cyclic]],
      [MARKER],
    );
    expect(capture.leaked).toBe(false);
    expect(capture.text.includes('bodySha256=def')).toBe(true);
  });
});

describe('foundation controls: outgoing-wire evidence and Retry-After (Stage A controls)', () => {
  it('expectEvidenceNull rejects a request whose evidence is inherited, not an own null member', () => {
    // The evidence member is present only on the prototype, so it is inherited
    // membership, not an own property. A correct own-null check must reject it; the
    // current helper uses `'evidence' in request`, so it ACCEPTS it (no throw) and
    // this control is RED until the helper checks own membership.
    const inherited = Object.create({ evidence: null }) as Record<
      string,
      unknown
    >;
    const control = runMetaControl(
      () => expectEvidenceNull(inherited),
      [MARKER],
    );
    expectSafeControl(control, 'inherited-null evidence control');
  });

  it('expectSafeError with retryAfter:true rejects a malformed synthetic Retry-After without leaking the marker', () => {
    // A schema-valid 503 safe envelope whose Retry-After header is a synthetic
    // marker (a malformed value). With `retryAfter: true` the helper must reject it
    // (no valid Retry-After), and the marker must not reach any failure surface. The
    // current helper ignores `retryAfter`, so it ACCEPTS the envelope (no throw) and
    // this control is RED until the runtime check is implemented.
    const response = responseOf(
      {
        code: 'DEPENDENCY_UNAVAILABLE',
        details: { dependencyClass: 'preflight', retryable: true },
        message: 'unavailable',
        requestId: '00000000-0000-4000-8000-000000000000',
      },
      { 'retry-after': MARKER },
      503,
    );
    const control = runMetaControl(
      () =>
        expectSafeError(response, {
          status: 503,
          code: 'DEPENDENCY_UNAVAILABLE',
          details: { dependencyClass: 'preflight', retryable: true },
          retryAfter: true,
        }),
      [MARKER],
    );
    expectSafeControl(control, 'retry-after control');
  });
});
