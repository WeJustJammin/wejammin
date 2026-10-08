// @vitest-environment jsdom

/**
 * Slice 10 evidence lane EA (AC-001, AC-003): the draft editor's autosave sends exactly the
 * changed fields against the adopted base revision, and a refused or ambiguous save rolls back to
 * the canonical preimage (FE03 "optimistic-rollback": restore the preimage, announce the refusal,
 * retain the input) instead of adopting the unsent value.
 */
import { describe, expect, it } from 'vitest';

import {
  BLURB,
  ENTRY_ID,
  RATING,
  TITLE,
  apiError,
  editorInit,
  revisionCreated,
} from './cms-editorial-editor-fixtures.test-support';
import {
  type Step,
  bodyOf,
  setup,
  writes,
} from './cms-editorial-entry-editor-harness.test-support';

describe('EA autosave sends exactly the changed fields against the adopted base', () => {
  it('one edited field is the whole request: changedPaths and values name only it, with the loaded base revision and entry version', async () => {
    const { controller, calls, clock } = setup([
      revisionCreated({ revisionNumber: '3', entryVersion: '5' }),
    ]);
    controller.setValue(TITLE, 'Release notes v2');
    await clock.advance(3_000);
    expect(writes(calls)).toHaveLength(1);
    expect(bodyOf(calls[0])).toEqual({
      entryId: ENTRY_ID,
      baseRevision: '2',
      changedPaths: [`/fields/${TITLE}`],
      values: { [TITLE]: 'Release notes v2' },
      locale: 'en-US',
      expectedVersion: '4',
    });
  });

  it('two edited fields are both sent in sorted order and the untouched siblings are not', async () => {
    const { controller, calls, clock } = setup([
      revisionCreated({ revisionNumber: '3', entryVersion: '5' }),
    ]);
    controller.setValue(BLURB, 'A short blurb');
    controller.setValue(TITLE, 'Release notes v2');
    await clock.advance(3_000);
    const body = bodyOf(calls[0]);
    expect(body.changedPaths).toEqual(
      [`/fields/${BLURB}`, `/fields/${TITLE}`].sort(),
    );
    expect(Object.keys(body.values as object).sort()).toEqual(
      [BLURB, TITLE].sort(),
    );
    expect(body.values).not.toHaveProperty(RATING);
  });

  it('the next save re-sends nothing the adopted revision already holds and is based on the adopted revision', async () => {
    const { controller, calls, clock } = setup([
      revisionCreated({ revisionNumber: '3', entryVersion: '5' }),
      revisionCreated({ revisionNumber: '4', entryVersion: '6' }),
    ]);
    controller.setValue(TITLE, 'Release notes v2');
    await clock.advance(3_000);
    controller.setValue(BLURB, 'Added later');
    await clock.advance(3_000);
    expect(writes(calls)).toHaveLength(2);
    expect(bodyOf(calls[1])).toEqual({
      entryId: ENTRY_ID,
      baseRevision: '3',
      changedPaths: [`/fields/${BLURB}`],
      values: { [BLURB]: 'Added later' },
      locale: 'en-US',
      expectedVersion: '5',
    });
  });
});

const refusals: ReadonlyArray<readonly [string, Step]> = [
  ['a 401 UNAUTHENTICATED', apiError(401, 'UNAUTHENTICATED')],
  ['a 403 FORBIDDEN', apiError(403, 'FORBIDDEN')],
  ['a 404 NOT_FOUND', apiError(404, 'NOT_FOUND')],
  [
    'a 422 VALIDATION_FAILED',
    apiError(422, 'VALIDATION_FAILED', {
      violations: [{ path: `/fields/${TITLE}`, code: 'invalid', message: 'x' }],
    }),
  ],
  ['a 500 INTERNAL_ERROR', apiError(500, 'INTERNAL_ERROR')],
  ['a 503 DEPENDENCY_UNAVAILABLE', apiError(503, 'DEPENDENCY_UNAVAILABLE')],
  [
    'a 409 version conflict with a durable open conflict',
    apiError(409, 'CONFLICT', { conflict: 'VERSION_MISMATCH' }),
  ],
];

describe('EA a refused save rolls back to the canonical preimage and keeps the input', () => {
  const preimage = editorInit();

  it.each(refusals)(
    '%s adopts nothing: base values, base revision and entry version stay the preimage while the unsent value is kept',
    async (_label, step) => {
      const { controller, clock } = setup(
        [step, ...(_label.includes('409') ? [apiError(404, 'NOT_FOUND')] : [])],
        editorInit(),
      );
      controller.setValue(TITLE, 'Unsent title');
      await clock.advance(3_000);
      const state = controller.getState();
      expect(state.baseValues).toEqual(preimage.values);
      expect(state.baseRevision).toBe(preimage.baseRevision);
      expect(state.expectedVersion).toBe(preimage.entryVersion);
      expect(state.values[TITLE]).toBe('Unsent title');
      expect(state.adoptCount).toBe(0);
      expect(state.phase).not.toBe('saved');
      expect(state.phase).not.toBe('clean');
      expect(state.message).not.toContain('Server text');
    },
  );

  it('a lost response then a refused replay rolls back too: the preimage is restored and the edit is kept', async () => {
    const { controller, calls, clock } = setup([
      new TypeError('Failed to fetch'),
      apiError(403, 'FORBIDDEN'),
    ]);
    controller.setValue(TITLE, 'Unsent title');
    await clock.advance(3_000);
    expect(controller.getState().phase).toBe('unknown');
    await clock.advance(2_000);
    expect(writes(calls)).toHaveLength(2);
    expect(calls[1]?.headers.get('idempotency-key')).toBe(
      calls[0]?.headers.get('idempotency-key'),
    );
    const state = controller.getState();
    expect(state.baseValues).toEqual(preimage.values);
    expect(state.expectedVersion).toBe(preimage.entryVersion);
    expect(state.values[TITLE]).toBe('Unsent title');
    expect(state.phase).toBe('denied');
  });

  it('a lost response then a confirmed replay adopts the canonical revision exactly once', async () => {
    const { controller, calls, clock } = setup([
      new TypeError('Failed to fetch'),
      revisionCreated({ revisionNumber: '3', entryVersion: '5' }),
    ]);
    controller.setValue(TITLE, 'Unsent title');
    await clock.advance(3_000);
    await clock.advance(2_000);
    expect(writes(calls)).toHaveLength(2);
    const state = controller.getState();
    expect(state.phase).toBe('saved');
    expect(state.baseRevision).toBe('3');
    expect(state.expectedVersion).toBe('5');
    expect(state.baseValues[TITLE]).toBe('Unsent title');
    expect(state.unsentCount).toBe(0);
  });
});
