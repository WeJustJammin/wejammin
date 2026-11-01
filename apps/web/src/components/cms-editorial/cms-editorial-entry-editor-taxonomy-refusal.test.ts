// @vitest-environment jsdom

/**
 * The taxonomy-refresh boundary of the draft controller (BE03b CMS-03B-01,
 * BE03c CMS-03C-17): only a verified 422 `VALIDATION_FAILED` may re-read the
 * taxonomy selector. A 415 `UNSUPPORTED_MEDIA_TYPE` that carries the same
 * `term_unavailable` token must not bump `taxonomyRefreshToken`, and a 413 must
 * not be read as a term refusal at all.
 *
 * The token can legitimately ride these statuses because `ApiErrorSchema.details`
 * is an open, bounded JsonValue record (packages/contracts/src/api-error.ts), so
 * only the editor decides that a token counts. Exact transport evidence: the
 * error-code map declares 415 but NOT 413
 * (cms-editorial-mutation-errors.ts `EDITORIAL_ERROR_CODE_FOR_STATUS`), so a 413
 * is an UNDECLARED status the transport already answers as an `unknown` outcome
 * (pinned in cms-editorial-runtime.test.ts: 'treats undeclared 413 as unknown');
 * a 415 IS declared, so it reaches the refusal path as a verified
 * `unsupported-media` result that carries its reason token. That 415 case is the
 * strict-scope gap this file pins.
 *
 * The tests drive the REAL controller and the REAL revision transport through the
 * injected fetcher; no module is mocked.
 */

import { describe, expect, it } from 'vitest';

import {
  BLURB,
  TITLE,
  apiError,
  revisionCreated,
} from './cms-editorial-editor-fixtures.test-support';
import {
  setup,
  writes,
} from './cms-editorial-entry-editor-harness.test-support';

/** A refusal of the given status whose verified details still name the term token. */
const namedTermRefusal = (status: number, code: string): Response =>
  apiError(status, code, {
    reasonCode: 'term_unavailable',
    violations: [
      { path: `/fields/${TITLE}`, code: 'invalid_value', message: 'x' },
    ],
  });

describe('draft controller: the taxonomy refresh boundary', () => {
  it('does not refresh for a verified 415 that carries term_unavailable', async () => {
    const { controller, calls, clock } = setup([
      namedTermRefusal(415, 'UNSUPPORTED_MEDIA_TYPE'),
      revisionCreated({ revisionNumber: '3', entryVersion: '5' }),
    ]);
    controller.setValue(TITLE, 'Unsupported');
    await controller.saveNow();
    expect(controller.getState().phase).toBe('invalid');
    expect(writes(calls)).toHaveLength(1);
    expect(controller.getState().taxonomyRefreshToken).toBe(0);
    await clock.advance(60_000);
    expect(controller.getState().taxonomyRefreshToken).toBe(0);
    expect(writes(calls)).toHaveLength(1);
  });

  it('does not refresh for a verified 400 INVALID_REQUEST that carries term_unavailable', async () => {
    const { controller, calls, clock } = setup([
      namedTermRefusal(400, 'INVALID_REQUEST'),
      revisionCreated({ revisionNumber: '3', entryVersion: '5' }),
    ]);
    controller.setValue(TITLE, 'Refused');
    controller.setValue(BLURB, 'Kept');
    await controller.saveNow();
    expect(controller.getState().phase).toBe('invalid');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe('POST');
    expect(controller.getState().taxonomyRefreshToken).toBe(0);
    expect(controller.getState().values[TITLE]).toBe('Refused');
    expect(controller.getState().values[BLURB]).toBe('Kept');
    // A definite refusal: nothing is read and nothing is retried on its own.
    await clock.advance(60_000);
    expect(calls).toHaveLength(1);
    expect(controller.getState().taxonomyRefreshToken).toBe(0);
  });

  it('refreshes exactly once for a verified 422, and a real edit still saves', async () => {
    const { controller, calls, clock } = setup([
      namedTermRefusal(422, 'VALIDATION_FAILED'),
      revisionCreated({ revisionNumber: '3', entryVersion: '5' }),
    ]);
    controller.setValue(TITLE, 'Refused');
    await controller.saveNow();
    expect(controller.getState().phase).toBe('invalid');
    expect(writes(calls)).toHaveLength(1);
    expect(controller.getState().taxonomyRefreshToken).toBe(1);
    // No automatic resubmit of a definite refusal.
    await clock.advance(60_000);
    expect(writes(calls)).toHaveLength(1);
    expect(controller.getState().taxonomyRefreshToken).toBe(1);
    // A real edit returns the phase to dirty and re-arms the save.
    controller.setValue(TITLE, 'Corrected');
    await clock.advance(3_000);
    expect(writes(calls)).toHaveLength(2);
    expect(controller.getState().taxonomyRefreshToken).toBe(1);
  });

  it('reads a 413 as an unknown outcome, never a term refusal: no refresh, same key replayed', async () => {
    const { controller, calls, clock } = setup([
      namedTermRefusal(413, 'PAYLOAD_TOO_LARGE'),
      namedTermRefusal(413, 'PAYLOAD_TOO_LARGE'),
    ]);
    controller.setValue(TITLE, 'Too large');
    await clock.advance(3_000);
    expect(controller.getState().phase).toBe('unknown');
    expect(controller.getState().taxonomyRefreshToken).toBe(0);
    await clock.advance(2_000);
    expect(writes(calls)).toHaveLength(2);
    expect(calls[1]!.headers.get('idempotency-key')).toBe(
      calls[0]!.headers.get('idempotency-key'),
    );
    expect(controller.getState().taxonomyRefreshToken).toBe(0);
  });
});
