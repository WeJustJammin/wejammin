import { PublicationActionSchema } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  effectiveScheduleAction,
  scheduleActionChoices,
} from './cms-workflow-schedule-actions';

/*
 * BE03b:268-270: the revision author is refused only the action `publish`.
 */
describe('scheduleActionChoices', () => {
  it('[P2-S11-AC-040] offers every registry action, Publish first and the default, to a caller who may publish', () => {
    const choices = scheduleActionChoices(true);
    expect(choices.options).toEqual(PublicationActionSchema.options);
    expect(choices.defaultAction).toBe('publish');
    expect(choices.options[0]).toBe('publish');
  });

  it('[P2-S11-AC-040] withholds exactly Publish from an author and starts on the first remaining action', () => {
    const choices = scheduleActionChoices(false);
    expect(choices.options).toEqual(
      PublicationActionSchema.options.filter((action) => action !== 'publish'),
    );
    expect(choices.options).toHaveLength(3);
    // The default is an offered action and the first one, so it tracks the registry order.
    expect(choices.defaultAction).toBe(choices.options[0]);
  });
});

describe('effectiveScheduleAction', () => {
  it('[P2-S11-AC-040] keeps a choice that is still offered', () => {
    expect(
      effectiveScheduleAction('archive', scheduleActionChoices(false)),
    ).toBe('archive');
    expect(
      effectiveScheduleAction('publish', scheduleActionChoices(true)),
    ).toBe('publish');
  });

  it('[P2-S11-AC-040] replaces a Publish choice by the default once Publish is not offered', () => {
    const author = scheduleActionChoices(false);
    expect(effectiveScheduleAction('publish', author)).toBe(
      author.defaultAction,
    );
  });

  it('[P2-S11-AC-040] replaces an empty or unknown value by the default', () => {
    expect(effectiveScheduleAction('', scheduleActionChoices(true))).toBe(
      'publish',
    );
    expect(
      effectiveScheduleAction('delete', scheduleActionChoices(false)),
    ).toBe(scheduleActionChoices(false).defaultAction);
  });
});
