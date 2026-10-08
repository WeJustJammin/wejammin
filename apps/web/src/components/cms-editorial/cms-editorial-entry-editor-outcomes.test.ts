// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { fieldUuid } from '../cms-editorial-fields/cms-field-fixtures.test-support';
import {
  BLURB,
  CONFLICT_ID,
  ENTRY_ID,
  TITLE,
  apiError,
  draftDetail,
  editorInit,
  revisionCreated,
} from './cms-editorial-editor-fixtures.test-support';
import {
  bodyOf,
  setup,
  writes,
} from './cms-editorial-entry-editor-harness.test-support';

describe('editor controller: outcome unknown and refusals', () => {
  it('after a lost response keeps the key and replays the IDENTICAL request', async () => {
    const { controller, calls, clock } = setup([
      new TypeError('Failed to fetch'),
      revisionCreated({ revisionNumber: '3', entryVersion: '5' }),
    ]);
    controller.setValue(TITLE, 'Replay me');
    await clock.advance(3_000);
    expect(controller.getState().phase).toBe('unknown');
    // An edit made now must not alter the request that may already be applied.
    controller.setValue(BLURB, 'later');
    await clock.advance(2_000);
    expect(writes(calls)).toHaveLength(2);
    expect(calls[1]!.headers.get('idempotency-key')).toBe(
      calls[0]!.headers.get('idempotency-key'),
    );
    expect(calls[1]!.body).toBe(calls[0]!.body);
    expect(controller.getState().values[BLURB]).toBe('later');
    expect(controller.getState().expectedVersion).toBe('5');
  });

  it('stops replaying automatically after three tries and offers a manual retry', async () => {
    const lost = new TypeError('Failed to fetch');
    const { controller, calls, clock } = setup([
      lost,
      lost,
      lost,
      lost,
      revisionCreated({ revisionNumber: '3', entryVersion: '5' }),
    ]);
    controller.setValue(TITLE, 'Flaky');
    await clock.advance(3_000);
    await clock.advance(30_000);
    expect(writes(calls)).toHaveLength(4);
    expect(controller.getState()).toMatchObject({
      phase: 'unknown',
      needsManualRetry: true,
    });
    await controller.retryReconcile();
    expect(controller.getState().phase).toBe('saved');
    expect(calls[4]!.headers.get('idempotency-key')).toBe(
      calls[0]!.headers.get('idempotency-key'),
    );
  });

  it('maps a typed 422 to its field and fixed copy, keeps the values, and waits for an edit', async () => {
    const { controller, calls, clock } = setup([
      apiError(422, 'VALIDATION_FAILED', {
        reasonCode: 'rich_text_not_canonical',
        violations: [
          { path: `/values/${TITLE}`, code: 'invalid_value', message: 'x' },
        ],
      }),
      revisionCreated({ revisionNumber: '3', entryVersion: '5' }),
    ]);
    controller.setValue(TITLE, 'Refused');
    await clock.advance(3_000);
    const state = controller.getState();
    expect(state.phase).toBe('invalid');
    expect(state.refusedFieldIds).toEqual([TITLE]);
    expect(state.message).toContain('rich text');
    expect(state.message).not.toContain('Server text');
    expect(state.values[TITLE]).toBe('Refused');
    await clock.advance(60_000);
    expect(writes(calls)).toHaveLength(1);
    controller.setValue(TITLE, 'Corrected');
    await clock.advance(3_000);
    expect(writes(calls)).toHaveLength(2);
    // A definite refusal is a new logical save: a new key.
    expect(calls[1]!.headers.get('idempotency-key')).not.toBe(
      calls[0]!.headers.get('idempotency-key'),
    );
  });

  it('waits out a rate limit and then saves again with the values it kept', async () => {
    const { controller, calls, clock } = setup([
      apiError(
        429,
        'RATE_LIMITED',
        { retryAfterSeconds: 7 },
        { 'retry-after': '7' },
      ),
      revisionCreated({ revisionNumber: '3', entryVersion: '5' }),
    ]);
    controller.setValue(TITLE, 'Patient');
    await clock.advance(3_000);
    expect(controller.getState()).toMatchObject({
      phase: 'waiting',
      retryAfterSeconds: 7,
    });
    expect(controller.getState().values[TITLE]).toBe('Patient');
    await clock.advance(7_000);
    expect(writes(calls)).toHaveLength(2);
    expect(controller.getState().phase).toBe('saved');
  });

  it.each([
    [401, 'UNAUTHENTICATED', 'unauthenticated', 'Sign in again'],
    [403, 'FORBIDDEN', 'denied', 'kept in this browser only'],
    [404, 'NOT_FOUND', 'denied', 'not available'],
  ])(
    'on a %i adopts nothing, keeps the unsent values and stops sending',
    async (status, code, phase, copy) => {
      const { controller, calls, clock } = setup([apiError(status, code)]);
      controller.setValue(TITLE, 'Unsent');
      await clock.advance(3_000);
      expect(controller.getState()).toMatchObject({ phase, alert: true });
      expect(controller.getState().message).toContain(copy);
      expect(controller.getState().values[TITLE]).toBe('Unsent');
      expect(controller.getState().expectedVersion).toBe('4');
      controller.setValue(TITLE, 'Still unsent');
      await clock.advance(60_000);
      expect(writes(calls)).toHaveLength(1);
    },
  );
});

describe('editor controller: conflicts and merges', () => {
  it('on a 409 with a durable open conflict reads it, links to resolution and keeps the values', async () => {
    const { controller, calls, clock } = setup([
      apiError(409, 'CONFLICT', { conflict: 'VERSION_MISMATCH' }),
      draftDetail({
        entryVersion: '6',
        revisionNumber: '3',
        values: { [TITLE]: 'Theirs' },
        openConflict: { conflictId: CONFLICT_ID, version: '1' },
      }),
    ]);
    controller.setValue(TITLE, 'Mine');
    await clock.advance(3_000);
    expect(calls[1]).toMatchObject({
      method: 'GET',
      url: `/api/v1/cms/entries/${ENTRY_ID}`,
    });
    const state = controller.getState();
    expect(state).toMatchObject({
      phase: 'conflict',
      alert: true,
      openConflict: { conflictId: CONFLICT_ID },
    });
    expect(state.syncConflict).toEqual({
      expectedVersion: '4',
      currentVersion: '6',
    });
    expect(state.values[TITLE]).toBe('Mine');
    expect(state.message).toContain('nothing was overwritten');
    await clock.advance(60_000);
    expect(writes(calls)).toHaveLength(1);
  });

  it('on a 409 without a durable conflict rebases the unsent edits and retries once', async () => {
    const { controller, calls, clock } = setup([
      apiError(409, 'CONFLICT', { conflict: 'VERSION_MISMATCH' }),
      draftDetail({
        entryVersion: '6',
        revisionNumber: '3',
        values: { [TITLE]: 'Release notes', [BLURB]: 'Theirs only' },
      }),
      revisionCreated({ revisionNumber: '4', entryVersion: '7' }),
    ]);
    controller.setValue(TITLE, 'Mine');
    await clock.advance(3_000);
    expect(writes(calls)).toHaveLength(2);
    expect(bodyOf(calls[2])).toMatchObject({
      baseRevision: '3',
      expectedVersion: '6',
      changedPaths: [`/fields/${TITLE}`],
      values: { [TITLE]: 'Mine' },
    });
    const state = controller.getState();
    expect(state.phase).toBe('saved');
    // Their disjoint change is adopted, not lost and not overwritten.
    expect(state.values[BLURB]).toBe('Theirs only');
    expect(state.baseValues[TITLE]).toBe('Mine');
  });

  it('when the rebase finds the same field changed on both sides opens the sync conflict and sends nothing', async () => {
    const { controller, calls, clock } = setup([
      apiError(409, 'CONFLICT', { conflict: 'VERSION_MISMATCH' }),
      draftDetail({
        entryVersion: '6',
        revisionNumber: '3',
        values: { [TITLE]: 'Theirs' },
      }),
    ]);
    controller.setValue(TITLE, 'Mine');
    await clock.advance(3_000);
    const state = controller.getState();
    expect(state.phase).toBe('sync-conflict');
    expect(state.syncConflict).toEqual({
      expectedVersion: '4',
      currentVersion: '6',
    });
    expect(state.values[TITLE]).toBe('Mine');
    await clock.advance(60_000);
    expect(writes(calls)).toHaveLength(1);
  });

  it('after a merged 201 (two parents) adopts the canonical draft and keeps newer local edits', async () => {
    const { controller, clock } = setup([
      revisionCreated({
        revisionNumber: '4',
        entryVersion: '7',
        parents: [fieldUuid(0x701), fieldUuid(0x702)],
      }),
      draftDetail({
        entryVersion: '7',
        revisionNumber: '4',
        values: { [TITLE]: 'Mine', [BLURB]: 'Merged in from another tab' },
      }),
    ]);
    controller.setValue(TITLE, 'Mine');
    await clock.advance(3_000);
    const state = controller.getState();
    expect(state.values[BLURB]).toBe('Merged in from another tab');
    expect(state.baseValues[BLURB]).toBe('Merged in from another tab');
    expect(state).toMatchObject({ baseRevision: '4', expectedVersion: '7' });
    expect(state.adoptCount).toBeGreaterThan(0);
    expect(state.message).toContain('merged');
  });
});

describe('editor controller: no authority, no network when nothing changed', () => {
  it('does nothing for an edit that returns to the saved value', async () => {
    const { controller, calls, clock } = setup([]);
    controller.setValue(TITLE, 'Changed');
    controller.setValue(TITLE, 'Release notes');
    await clock.advance(60_000);
    expect(calls).toHaveLength(0);
    expect(controller.getState().phase).toBe('clean');
  });

  it('refuses to send without a CSRF token and says why', async () => {
    const { controller, calls, clock } = setup([], editorInit(), null);
    controller.setValue(TITLE, 'No token');
    await clock.advance(3_000);
    expect(calls).toHaveLength(0);
    expect(controller.getState().message).toContain('CSRF');
  });

  it('is read-only when the entry is not active', async () => {
    const { controller, calls, clock } = setup(
      [],
      editorInit({ lifecycle: 'archived' }),
    );
    expect(controller.getState().message).toBe('');
    controller.setValue(TITLE, 'Nope');
    await clock.advance(10_000);
    expect(calls).toHaveLength(0);
  });
});
