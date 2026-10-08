// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import {
  BLURB,
  RATING,
  TITLE,
  ENTRY_ID,
  revisionCreated,
} from './cms-editorial-editor-fixtures.test-support';
import {
  bodyOf,
  setup,
  writes,
} from './cms-editorial-entry-editor-harness.test-support';

describe('editor controller: autosave cadence and request shape', () => {
  it('saves 3 s after the last edit against the explicit base revision with If-Match and a key', async () => {
    const { controller, calls, clock } = setup([
      revisionCreated({ revisionNumber: '3', entryVersion: '5' }),
    ]);
    controller.setValue(TITLE, 'Release notes v2');
    expect(controller.getState().phase).toBe('dirty');
    await clock.advance(2_999);
    expect(calls).toHaveLength(0);
    await clock.advance(1);
    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toBe(`/api/v1/cms/entries/${ENTRY_ID}/revisions`);
    expect(call.headers.get('if-match')).toBe('"4"');
    expect(call.headers.get('idempotency-key')).toBe('key-1');
    expect(call.headers.get('x-csrf-token')).toBe('csrf-token');
    expect(call.headers.get('content-type')).toBe('application/json');
    expect(bodyOf(call)).toEqual({
      entryId: ENTRY_ID,
      baseRevision: '2',
      changedPaths: [`/fields/${TITLE}`],
      values: { [TITLE]: 'Release notes v2' },
      locale: 'en-US',
      expectedVersion: '4',
    });
  });

  it('sends only the changed fields', async () => {
    const { controller, calls, clock } = setup([
      revisionCreated({ revisionNumber: '3', entryVersion: '5' }),
    ]);
    controller.setValue(BLURB, 'A short blurb');
    await clock.advance(3_000);
    expect(bodyOf(calls[0])).toMatchObject({
      changedPaths: [`/fields/${BLURB}`],
      values: { [BLURB]: 'A short blurb' },
    });
  });

  it('adopts the committed ENTRY version, not the snapshot version, as the next If-Match', async () => {
    const { controller, calls, clock } = setup([
      revisionCreated({ revisionNumber: '3', entryVersion: '5' }),
      revisionCreated({ revisionNumber: '4', entryVersion: '6' }),
    ]);
    controller.setValue(TITLE, 'One');
    await clock.advance(3_000);
    expect(controller.getState()).toMatchObject({
      phase: 'saved',
      baseRevision: '3',
      expectedVersion: '5',
      unsentCount: 0,
    });
    controller.setValue(TITLE, 'Two');
    await clock.advance(3_000);
    expect(writes(calls)).toHaveLength(2);
    expect(calls[1]!.headers.get('if-match')).toBe('"5"');
    expect(bodyOf(calls[1])).toMatchObject({
      baseRevision: '3',
      expectedVersion: '5',
    });
  });

  it('commits at least every 30 s of continuous typing, never moving past the hard maximum', async () => {
    const { controller, calls, clock } = setup([
      revisionCreated({ revisionNumber: '3', entryVersion: '5' }),
    ]);
    // Edits every 2 s keep resetting the 3 s idle timer, so only the 30 s hard
    // maximum (anchored at the FIRST edit) can fire: not at 29 s, at 30 s.
    for (let elapsed = 0; elapsed < 28_000; elapsed += 2_000) {
      controller.setValue(TITLE, `Typing ${elapsed}`);
      await clock.advance(2_000);
    }
    controller.setValue(TITLE, 'Typing at 28 s');
    await clock.advance(1_000);
    expect(calls).toHaveLength(0);
    await clock.advance(1_000);
    expect(writes(calls)).toHaveLength(1);
  });

  it('saves immediately on the explicit Save draft action', async () => {
    const { controller, calls } = setup([
      revisionCreated({ revisionNumber: '3', entryVersion: '5' }),
    ]);
    controller.setValue(TITLE, 'Explicit');
    await controller.saveNow();
    expect(writes(calls)).toHaveLength(1);
    expect(controller.getState().phase).toBe('saved');
  });

  it('keeps an edit made while a save is in flight and sends it next', async () => {
    let release: (response: Response) => void = () => undefined;
    const held = () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      });
    const { controller, calls, clock } = setup([
      held,
      revisionCreated({ revisionNumber: '4', entryVersion: '6' }),
    ]);
    controller.setValue(TITLE, 'First');
    await clock.advance(3_000);
    expect(controller.getState().phase).toBe('saving');
    controller.setValue(BLURB, 'Typed while saving');
    release(revisionCreated({ revisionNumber: '3', entryVersion: '5' }));
    await clock.advance(0);
    for (let tick = 0; tick < 30; tick += 1) await Promise.resolve();
    expect(controller.getState().values[BLURB]).toBe('Typed while saving');
    expect(controller.getState().unsentCount).toBe(1);
    await clock.advance(3_000);
    expect(writes(calls)).toHaveLength(2);
    expect(bodyOf(calls[1])).toMatchObject({
      changedPaths: [`/fields/${BLURB}`],
      baseRevision: '3',
      expectedVersion: '5',
    });
  });
});

describe('editor controller: local validation', () => {
  it('sends nothing while a changed field is invalid, then saves once it is fixed', async () => {
    const { controller, calls, clock } = setup([
      revisionCreated({ revisionNumber: '3', entryVersion: '5' }),
    ]);
    controller.setValue(RATING, 11);
    await clock.advance(3_000);
    expect(calls).toHaveLength(0);
    expect(controller.getState()).toMatchObject({
      phase: 'invalid',
      refusedFieldIds: [RATING],
    });
    controller.setValue(RATING, 5);
    await clock.advance(3_000);
    expect(writes(calls)).toHaveLength(1);
    expect(controller.getState().phase).toBe('saved');
  });

  it('holds the save while a control reports unparsable text', async () => {
    const { controller, calls, clock } = setup([]);
    controller.setValue(TITLE, 'Fine');
    controller.setInputError(RATING, 'Enter a whole number.');
    await clock.advance(3_000);
    expect(calls).toHaveLength(0);
    expect(controller.getState().phase).toBe('invalid');
  });
});

describe('editor controller: text the database cannot store', () => {
  for (const bad of ['ab\uD800', '\uDC00ab', 'a\u0000b'])
    it(`never sends ${JSON.stringify(bad)} and keeps the value for the author to fix`, async () => {
      const { controller, calls, clock } = setup([
        revisionCreated({ revisionNumber: '3', entryVersion: '5' }),
      ]);
      controller.setValue(TITLE, bad);
      await clock.advance(3_000);
      expect(calls).toHaveLength(0);
      expect(controller.getState()).toMatchObject({
        phase: 'invalid',
        refusedFieldIds: [TITLE],
      });
      expect(controller.getState().values[TITLE]).toBe(bad);
      controller.setValue(TITLE, 'Fixed title');
      await clock.advance(3_000);
      expect(writes(calls)).toHaveLength(1);
      expect(controller.getState().phase).toBe('saved');
    });
});
