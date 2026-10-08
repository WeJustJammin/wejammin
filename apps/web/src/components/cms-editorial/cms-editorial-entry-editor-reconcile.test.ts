// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { fieldUuid } from '../cms-editorial-fields/cms-field-fixtures.test-support';
import {
  BLURB,
  RATING,
  TITLE,
  apiError,
  draftDetail,
  revisionCreated,
} from './cms-editorial-editor-fixtures.test-support';
import {
  bodyOf,
  setup,
  writes,
} from './cms-editorial-entry-editor-harness.test-support';
import { settleAsyncWork } from './cms-editorial-fake-clock.test-support';

const MERGED_PARENTS = [fieldUuid(0x701), fieldUuid(0x702)];

const mergedCreated = (revisionNumber: string, entryVersion: string) =>
  revisionCreated({ revisionNumber, entryVersion, parents: MERGED_PARENTS });

const held = () => {
  let release: (response: Response) => void = () => undefined;
  const step = () =>
    new Promise<Response>((resolve) => {
      release = resolve;
    });
  return { step, release: (response: Response) => release(response) };
};

/**
 * Codex review s10-ts-2, H1: a field the author edits AFTER a save was
 * dispatched is unsent work. Reconciling a merged (two-parent) 201 must never
 * replace it with the canonical draft, and where another session also changed
 * that field it must stop for an explicit decision rather than overwrite either
 * side.
 */
describe('H1: merged-save reconciliation never overwrites an edit made after dispatch', () => {
  it('keeps a field edited while the save was pending and still adopts the merged-in fields', async () => {
    const pending = held();
    const { controller, calls, clock } = setup([
      pending.step,
      draftDetail({
        entryVersion: '7',
        revisionNumber: '4',
        values: { [TITLE]: 'Mine', [RATING]: 7 },
      }),
      revisionCreated({ revisionNumber: '5', entryVersion: '8' }),
    ]);
    controller.setValue(TITLE, 'Mine');
    await clock.advance(3_000);
    expect(controller.getState().phase).toBe('saving');
    controller.setValue(BLURB, 'Typed after dispatch');
    pending.release(mergedCreated('4', '7'));
    await settleAsyncWork();
    const state = controller.getState();
    expect(state.values[BLURB]).toBe('Typed after dispatch');
    expect(state.values[RATING]).toBe(7);
    expect(state.baseValues[RATING]).toBe(7);
    expect(state.unsentCount).toBe(1);
    expect(state.phase).toBe('dirty');
    // The kept edit goes out next, against the canonical base.
    await clock.advance(3_000);
    expect(writes(calls)).toHaveLength(2);
    expect(bodyOf(calls[2])).toMatchObject({
      baseRevision: '4',
      expectedVersion: '7',
      changedPaths: [`/fields/${BLURB}`],
      values: { [BLURB]: 'Typed after dispatch' },
    });
  });

  it('keeps a field edited while the canonical draft is being read', async () => {
    const read = held();
    const { controller, clock } = setup([mergedCreated('4', '7'), read.step]);
    controller.setValue(TITLE, 'Mine');
    await clock.advance(3_000);
    controller.setValue(BLURB, 'Typed during the read');
    read.release(
      draftDetail({
        entryVersion: '7',
        revisionNumber: '4',
        values: { [TITLE]: 'Mine', [RATING]: 7 },
      }),
    );
    await settleAsyncWork();
    expect(controller.getState().values[BLURB]).toBe('Typed during the read');
    expect(controller.getState().values[RATING]).toBe(7);
  });

  it('keeps a field edited after a lost response when the identical replay is the merged 201', async () => {
    const { controller, calls, clock } = setup([
      new TypeError('Failed to fetch'),
      mergedCreated('4', '7'),
      draftDetail({
        entryVersion: '7',
        revisionNumber: '4',
        values: { [TITLE]: 'Mine', [RATING]: 7 },
      }),
    ]);
    controller.setValue(TITLE, 'Mine');
    await clock.advance(3_000);
    expect(controller.getState().phase).toBe('unknown');
    controller.setValue(BLURB, 'Typed while unknown');
    await clock.advance(2_000);
    expect(writes(calls)).toHaveLength(2);
    expect(calls[1]!.body).toBe(calls[0]!.body);
    const state = controller.getState();
    expect(state.values[BLURB]).toBe('Typed while unknown');
    expect(state.values[RATING]).toBe(7);
    expect(state.unsentCount).toBe(1);
  });

  it('stops for an explicit decision, overwriting neither side, when another session also changed the field edited after dispatch', async () => {
    const pending = held();
    const { controller, calls, clock } = setup([
      pending.step,
      draftDetail({
        entryVersion: '7',
        revisionNumber: '4',
        values: { [TITLE]: 'Mine', [BLURB]: 'Theirs' },
      }),
    ]);
    controller.setValue(TITLE, 'Mine');
    await clock.advance(3_000);
    controller.setValue(BLURB, 'Mine too');
    pending.release(mergedCreated('4', '7'));
    await settleAsyncWork();
    const state = controller.getState();
    expect(state.phase).toBe('sync-conflict');
    expect(state.values[BLURB]).toBe('Mine too');
    expect(state.unsentCount).toBe(1);
    expect(state.message).toContain('nothing was overwritten');
    await clock.advance(60_000);
    expect(writes(calls)).toHaveLength(1);
  });
});

/**
 * Codex review s10-ts-2, M2: a peer that keeps changing a different field made
 * every 409 look safely rebasable, so the editor re-sent in an unbounded
 * immediate chain. Automatic rebases are capped, backed off, and end in an
 * explicit state that the author can resume.
 */
describe('M2: automatic rebases after a stale base are bounded, backed off and recoverable', () => {
  const stale = () =>
    apiError(409, 'CONFLICT', { conflict: 'VERSION_MISMATCH' });
  const peer = (version: string, revision: string, title = 'Release notes') =>
    draftDetail({
      entryVersion: version,
      revisionNumber: revision,
      values: { [TITLE]: title, [BLURB]: `Peer ${version}` },
    });

  it('rebases at once, then after 1 s and 2 s, then stops and keeps every edit', async () => {
    const { controller, calls, clock } = setup([
      stale(),
      peer('6', '3'),
      stale(),
      peer('7', '4'),
      stale(),
      peer('8', '5'),
      stale(),
      peer('9', '6'),
    ]);
    controller.setValue(TITLE, 'Mine');
    await clock.advance(3_000);
    expect(writes(calls)).toHaveLength(2);
    await clock.advance(999);
    expect(writes(calls)).toHaveLength(2);
    await clock.advance(1);
    expect(writes(calls)).toHaveLength(3);
    await clock.advance(1_999);
    expect(writes(calls)).toHaveLength(3);
    await clock.advance(1);
    expect(writes(calls)).toHaveLength(4);
    const state = controller.getState();
    expect(state.phase).toBe('sync-conflict');
    expect(state.alert).toBe(true);
    expect(state.message).toContain('keeps changing');
    expect(state.values[TITLE]).toBe('Mine');
    expect(state.unsentCount).toBe(1);
    // Paused: no further automatic send, however long we wait.
    await clock.advance(120_000);
    expect(writes(calls)).toHaveLength(4);
    // Each rebase is a new logical save under a new key against the new base.
    const keys = writes(calls).map((call) =>
      call.headers.get('idempotency-key'),
    );
    expect(new Set(keys).size).toBe(4);
    expect(bodyOf(writes(calls)[3])).toMatchObject({
      baseRevision: '5',
      expectedVersion: '8',
    });
  });

  it('resumes only on the explicit Save draft action, with a fresh budget', async () => {
    const { controller, calls, clock } = setup([
      stale(),
      peer('6', '3'),
      stale(),
      peer('7', '4'),
      stale(),
      peer('8', '5'),
      stale(),
      peer('9', '6'),
      revisionCreated({ revisionNumber: '7', entryVersion: '10' }),
    ]);
    controller.setValue(TITLE, 'Mine');
    await clock.advance(3_000);
    await clock.advance(3_000);
    expect(controller.getState().phase).toBe('sync-conflict');
    await controller.saveNow();
    expect(writes(calls)).toHaveLength(5);
    expect(bodyOf(writes(calls)[4])).toMatchObject({
      baseRevision: '6',
      expectedVersion: '9',
      values: { [TITLE]: 'Mine' },
    });
    expect(controller.getState().phase).toBe('saved');
  });

  it('starts a new budget after a save succeeds', async () => {
    const { controller, calls, clock } = setup([
      stale(),
      peer('6', '3'),
      stale(),
      peer('7', '4'),
      revisionCreated({ revisionNumber: '5', entryVersion: '8' }),
      stale(),
      peer('9', '6', 'One'),
      revisionCreated({ revisionNumber: '7', entryVersion: '10' }),
    ]);
    controller.setValue(TITLE, 'One');
    await clock.advance(3_000);
    await clock.advance(1_000);
    expect(controller.getState().phase).toBe('saved');
    controller.setValue(TITLE, 'Two');
    await clock.advance(3_000);
    expect(writes(calls)).toHaveLength(5);
    expect(controller.getState().phase).toBe('saved');
  });

  it('does not send a backed-off rebase after the editor is disposed', async () => {
    const { controller, calls, clock } = setup([
      stale(),
      peer('6', '3'),
      stale(),
      peer('7', '4'),
    ]);
    controller.setValue(TITLE, 'Mine');
    await clock.advance(3_000);
    expect(writes(calls)).toHaveLength(2);
    controller.dispose();
    await clock.advance(10_000);
    expect(writes(calls)).toHaveLength(2);
  });
});
