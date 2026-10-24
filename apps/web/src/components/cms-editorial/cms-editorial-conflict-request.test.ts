import { describe, expect, it } from 'vitest';

import {
  attemptsWaitingMessage,
  conflictResolveRequest,
  unresolvedConflictFieldIds,
} from './cms-editorial-conflict-request';
import {
  initialConflictState,
  type CmsEditorialConflictChoiceState,
  type CmsEditorialConflictState,
} from './cms-editorial-conflict-state';
import { init } from './cms-editorial-conflict-controller.test-support';
import { BLURB, TITLE } from './cms-editorial-editor-fixtures.test-support';

/**
 * The pure parts of the resolution form's submit (BE03b CMS-03B-02): a path is sent only with an
 * explicit choice, a named choice carries no value, and an explicit value is checked with the
 * field's own rules. The controller tests drive the same code through the whole flow.
 */
const start = init();
const descriptors = new Map(
  start.descriptors.map((descriptor) => [descriptor.fieldId, descriptor]),
);
const withChoices = (
  choices: Record<string, CmsEditorialConflictChoiceState>,
): CmsEditorialConflictState => ({ ...initialConflictState(start), choices });

describe('unresolvedConflictFieldIds', () => {
  it('lists every path before any choice is made', () => {
    expect(
      unresolvedConflictFieldIds(initialConflictState(start), descriptors),
    ).toEqual([TITLE, BLURB]);
  });

  it('lists none once every path has a named choice', () => {
    const state = withChoices({
      [TITLE]: { choice: 'theirs', explicit: null },
      [BLURB]: { choice: 'yours', explicit: null },
    });
    expect(unresolvedConflictFieldIds(state, descriptors)).toEqual([]);
  });

  it('lists a path whose explicit value breaks the field rules, and one with an input error', () => {
    const state = {
      ...withChoices({
        [TITLE]: { choice: 'explicit', explicit: 'x' },
        [BLURB]: { choice: 'base', explicit: null },
      }),
      inputErrors: { [BLURB]: 'Bad input' },
    };
    expect(unresolvedConflictFieldIds(state, descriptors)).toEqual([
      TITLE,
      BLURB,
    ]);
  });
});

describe('unresolvedConflictFieldIds without a descriptor', () => {
  it('lists an explicit choice for a field that has no descriptor, as it cannot be validated', () => {
    const state = withChoices({
      [TITLE]: { choice: 'explicit', explicit: 'Merged title' },
      [BLURB]: { choice: 'base', explicit: null },
    });
    const without = new Map(descriptors);
    without.delete(TITLE);
    expect(unresolvedConflictFieldIds(state, without)).toEqual([TITLE]);
    expect(unresolvedConflictFieldIds(state, descriptors)).toEqual([]);
  });
});

describe('conflictResolveRequest', () => {
  it('sends a named choice without a value and an explicit choice with its value', () => {
    const state = withChoices({
      [TITLE]: { choice: 'explicit', explicit: 'Merged title' },
      [BLURB]: { choice: 'theirs', explicit: 'ignored' },
    });
    expect(conflictResolveRequest(start, state)).toEqual({
      entryId: start.entryId,
      conflictId: start.conflictId,
      baseRevision: start.baseRevision,
      expectedVersion: start.entryVersion,
      choices: [
        { path: `/fields/${TITLE}`, choice: 'explicit', value: 'Merged title' },
        { path: `/fields/${BLURB}`, choice: 'theirs' },
      ],
    });
  });
});

describe('attemptsWaitingMessage', () => {
  it('names the stated wait, or says shortly, and says the choices are kept', () => {
    expect(attemptsWaitingMessage(9)).toBe(
      'Too many attempts. Try again in 9 seconds; your choices are kept.',
    );
    expect(attemptsWaitingMessage(null)).toBe(
      'Too many attempts. Try again shortly; your choices are kept.',
    );
  });
});
