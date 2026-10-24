// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { saveFlowImporters } from './cms-editorial-entry-editor-controller';
import {
  TITLE,
  revisionCreated,
} from './cms-editorial-editor-fixtures.test-support';
import { setup } from './cms-editorial-entry-editor-harness.test-support';

/*
 * The save flow loads with the first save (P2-S11-AC-106). If its chunk cannot be fetched nothing
 * was sent: the draft stays dirty with the author's values, the status region says so, the next
 * Save draft (or edit, for autosave) imports again, and the failure is never remembered.
 */
const real = { ...saveFlowImporters };
afterEach(() => {
  Object.assign(saveFlowImporters, real);
});

const flaky = () => {
  let down = true;
  const importer = vi.fn(async () => {
    if (down)
      throw new TypeError('Failed to fetch dynamically imported module');
    return real.flow();
  });
  return {
    importer,
    heal: () => {
      down = false;
    },
  };
};

describe('the editor save flow chunk fails to load', () => {
  it('Save draft reports it, keeps the values, and the next Save draft sends', async () => {
    const chunk = flaky();
    saveFlowImporters.flow = chunk.importer;
    const { controller, calls } = setup([
      revisionCreated({ revisionNumber: '3', entryVersion: '5' }),
    ]);
    controller.setValue(TITLE, 'Release notes v2');

    await controller.saveNow();
    expect(calls).toHaveLength(0);
    expect(controller.getState()).toMatchObject({
      phase: 'dirty',
      alert: true,
      unsentCount: 1,
    });
    expect(controller.getState().message).toContain(
      'Part of this page could not be loaded, so nothing was sent',
    );
    expect(controller.hasUnsentWork()).toBe(true);

    chunk.heal();
    await controller.saveNow();
    expect(calls).toHaveLength(1);
    expect(controller.getState()).toMatchObject({
      phase: 'saved',
      unsentCount: 0,
    });
    expect(chunk.importer.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('an autosave that cannot load the flow reports it without an unhandled rejection, and a later edit saves', async () => {
    const chunk = flaky();
    saveFlowImporters.flow = chunk.importer;
    const { controller, calls, clock } = setup([
      revisionCreated({ revisionNumber: '3', entryVersion: '5' }),
    ]);
    controller.setValue(TITLE, 'One');
    await clock.advance(3_000);
    expect(calls).toHaveLength(0);
    expect(controller.getState()).toMatchObject({
      phase: 'dirty',
      alert: true,
    });
    expect(controller.getState().message).toContain(
      'Part of this page could not be loaded, so nothing was sent',
    );

    chunk.heal();
    controller.setValue(TITLE, 'Two');
    await clock.advance(3_000);
    expect(calls).toHaveLength(1);
    expect(controller.getState().phase).toBe('saved');
  });
});
