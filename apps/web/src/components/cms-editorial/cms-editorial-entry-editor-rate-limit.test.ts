// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { rateLimitMessage } from '../../lib/safe-read-retry';
import {
  BLURB,
  TITLE,
  apiError,
  draftDetail,
  revisionCreated,
} from './cms-editorial-editor-fixtures.test-support';
import { settleAsyncWork } from './cms-editorial-fake-clock.test-support';
import {
  bodyOf,
  setup,
  writes,
} from './cms-editorial-entry-editor-harness.test-support';

/**
 * FE03 "Network and retry contract" (:1172): a 429 waits for `Retry-After`, announces the
 * remaining wait and preserves input. Here the 429 answers the editor's re-read of the canonical
 * draft (CMS-03B-11), not a save.
 */
const stale = () => apiError(409, 'CONFLICT', { conflict: 'VERSION_MISMATCH' });
const limited = (seconds: number) =>
  apiError(
    429,
    'RATE_LIMITED',
    { retryAfterSeconds: seconds },
    { 'retry-after': String(seconds) },
  );

const READ_WAIT_7 =
  'Too many requests while checking the current version. Retrying in 7 seconds. Your unsent edits are kept.';
const READ_WAIT_UNSTATED =
  'Too many requests while checking the current version. Retrying shortly. Your unsent edits are kept.';
const methods = (calls: readonly { readonly method: string }[]) =>
  calls.map((call) => call.method);

describe('a 429 on the draft re-read after a stale base', () => {
  // FE03 :1172-1173: a limited READ waits and reads again; a command is never re-sent for it.
  it('waits for Retry-After, announces a read limit, keeps the edits and reads again before any write', async () => {
    const { controller, calls, clock } = setup([
      stale(),
      limited(7),
      draftDetail({
        entryVersion: '6',
        revisionNumber: '3',
        values: { [TITLE]: 'Release notes', [BLURB]: 'Theirs only' },
      }),
      revisionCreated({ revisionNumber: '4', entryVersion: '7' }),
    ]);
    controller.setValue(TITLE, 'Mine');
    await clock.advance(3_000);
    const waiting = controller.getState();
    expect(waiting.phase).toBe('waiting');
    expect(waiting.message).toBe(READ_WAIT_7);
    expect(waiting.message).not.toContain('saves');
    expect(waiting.retryAfterSeconds).toBe(7);
    expect(waiting.values[TITLE]).toBe('Mine');
    expect(waiting.unsentCount).toBe(1);
    expect(waiting.alert).toBe(false);
    await clock.advance(6_999);
    expect(methods(calls)).toEqual(['POST', 'GET']);
    await clock.advance(1);
    // The wait is over: the READ goes again, and the stale command is not re-sent.
    expect(methods(calls)).toEqual(['POST', 'GET', 'GET']);
    expect(writes(calls)).toHaveLength(1);
    // The rebase bound still spaces the one allowed re-send (1 s after the second counted read).
    await clock.advance(999);
    expect(writes(calls)).toHaveLength(1);
    await clock.advance(1);
    expect(methods(calls)).toEqual(['POST', 'GET', 'GET', 'POST']);
    expect(bodyOf(calls[3])).toMatchObject({
      baseRevision: '3',
      expectedVersion: '6',
      values: { [TITLE]: 'Mine' },
    });
    expect(controller.getState().phase).toBe('saved');
  });

  it('without a stated delay says it will retry shortly and still waits five seconds for the read', async () => {
    const { controller, calls, clock } = setup([
      stale(),
      apiError(429, 'RATE_LIMITED'),
      apiError(404, 'NOT_FOUND'),
    ]);
    controller.setValue(TITLE, 'Mine');
    await clock.advance(3_000);
    expect(controller.getState().phase).toBe('waiting');
    expect(controller.getState().message).toBe(READ_WAIT_UNSTATED);
    await clock.advance(4_999);
    expect(methods(calls)).toEqual(['POST', 'GET']);
    await clock.advance(1);
    expect(methods(calls)).toEqual(['POST', 'GET', 'GET']);
    expect(writes(calls)).toHaveLength(1);
  });

  it('counts every limited read toward the rebase limit and then stops without sending a stale write', async () => {
    const { controller, calls, clock } = setup([
      stale(),
      limited(1),
      limited(1),
      limited(1),
      limited(1),
    ]);
    controller.setValue(TITLE, 'Mine');
    await clock.advance(3_000);
    await clock.advance(10_000);
    expect(methods(calls)).toEqual(['POST', 'GET', 'GET', 'GET', 'GET']);
    const state = controller.getState();
    expect(state.phase).toBe('sync-conflict');
    expect(state.alert).toBe(true);
    expect(state.message).toBe(
      'Reading the current version is still rate limited, so automatic saving stopped. Nothing was overwritten and your edits are kept; choose Save draft to try again.',
    );
    expect(state.values[TITLE]).toBe('Mine');
    expect(state.unsentCount).toBe(1);
    await clock.advance(120_000);
    expect(calls).toHaveLength(5);
    expect(writes(calls)).toHaveLength(1);
  });

  it('writes nothing for edits typed while the read is waiting; they go out with the rebase', async () => {
    const { controller, calls, clock } = setup([
      stale(),
      limited(30),
      draftDetail({
        entryVersion: '6',
        revisionNumber: '3',
        values: { [TITLE]: 'Release notes' },
      }),
      revisionCreated({ revisionNumber: '4', entryVersion: '7' }),
    ]);
    controller.setValue(TITLE, 'Mine');
    await clock.advance(3_000);
    controller.setValue(BLURB, 'More');
    await clock.advance(20_000);
    expect(methods(calls)).toEqual(['POST', 'GET']);
    await clock.advance(10_000);
    await clock.advance(1_000);
    expect(writes(calls)).toHaveLength(2);
    expect(bodyOf(calls[3])).toMatchObject({
      expectedVersion: '6',
      values: { [TITLE]: 'Mine', [BLURB]: 'More' },
    });
  });

  it('writes nothing for edits typed while the second read is in flight either', async () => {
    let answer: (response: Response) => void = () => undefined;
    const { controller, calls, clock } = setup([
      stale(),
      limited(2),
      () => new Promise<Response>((resolve) => (answer = resolve)),
      revisionCreated({ revisionNumber: '4', entryVersion: '7' }),
    ]);
    controller.setValue(TITLE, 'Mine');
    await clock.advance(3_000);
    await clock.advance(2_000);
    expect(methods(calls)).toEqual(['POST', 'GET', 'GET']);
    controller.setValue(BLURB, 'More');
    await clock.advance(10_000);
    expect(methods(calls)).toEqual(['POST', 'GET', 'GET']);
    answer(
      draftDetail({
        entryVersion: '6',
        revisionNumber: '3',
        values: { [TITLE]: 'Release notes' },
      }),
    );
    await settleAsyncWork();
    await clock.advance(1_000);
    expect(methods(calls)).toEqual(['POST', 'GET', 'GET', 'POST']);
    expect(bodyOf(calls[3])).toMatchObject({
      expectedVersion: '6',
      values: { [TITLE]: 'Mine', [BLURB]: 'More' },
    });
  });

  it('is cancelled by dispose: no read and no write after the editor is gone', async () => {
    const { controller, calls, clock } = setup([stale(), limited(7)]);
    controller.setValue(TITLE, 'Mine');
    await clock.advance(3_000);
    controller.dispose();
    await clock.advance(60_000);
    expect(methods(calls)).toEqual(['POST', 'GET']);
  });

  it('is ended by an explicit "load current": the wait is cancelled and nothing is sent after it', async () => {
    const { controller, calls, clock } = setup([
      stale(),
      limited(30),
      draftDetail({
        entryVersion: '6',
        revisionNumber: '3',
        values: { [TITLE]: 'Theirs' },
      }),
      revisionCreated({ revisionNumber: '4', entryVersion: '7' }),
    ]);
    controller.setValue(TITLE, 'Mine');
    await clock.advance(3_000);
    await controller.discardUnsentAndLoadCurrent();
    expect(controller.getState().values[TITLE]).toBe('Theirs');
    await clock.advance(120_000);
    expect(methods(calls)).toEqual(['POST', 'GET', 'GET']);
    expect(controller.getState().phase).toBe('clean');
    // Saving is not gated any more: a new edit goes out normally.
    controller.setValue(TITLE, 'Again');
    await clock.advance(3_000);
    expect(writes(calls)).toHaveLength(2);
  });

  it('is not the stale-base stop a failed read ends in', async () => {
    const { controller, clock } = setup([stale(), apiError(404, 'NOT_FOUND')]);
    controller.setValue(TITLE, 'Mine');
    await clock.advance(3_000);
    expect(controller.getState().phase).toBe('sync-conflict');
  });
});

describe('a 429 on "load the current version"', () => {
  it('announces the remaining wait and keeps the unsent edits', async () => {
    const { controller, calls } = setup([limited(7)]);
    controller.setValue(TITLE, 'Mine');
    await controller.discardUnsentAndLoadCurrent();
    const state = controller.getState();
    expect(calls).toHaveLength(1);
    expect(state.message).toBe(rateLimitMessage(7));
    expect(state.retryAfterSeconds).toBe(7);
    expect(state.alert).toBe(true);
    expect(state.values[TITLE]).toBe('Mine');
    expect(state.unsentCount).toBe(1);
  });

  it('keeps the plain failure copy for a read that is not rate limited', async () => {
    const { controller } = setup([apiError(404, 'NOT_FOUND')]);
    controller.setValue(TITLE, 'Mine');
    await controller.discardUnsentAndLoadCurrent();
    expect(controller.getState().message).toBe(
      'The current version could not be loaded. Your unsent changes are kept; try again.',
    );
    expect(controller.getState().retryAfterSeconds).toBeNull();
  });
});
