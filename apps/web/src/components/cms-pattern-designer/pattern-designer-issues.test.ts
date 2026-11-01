import { describe, expect, it } from 'vitest';

import type { PatternSummaryItem } from './CmsPatternStatus';
import { groupSummary } from './pattern-designer-issues';

const field = (message: string): PatternSummaryItem => ({
  message,
  target: { kind: 'field', field: 'patternKey' },
});

describe('groupSummary', () => {
  it('has nothing from the submit summary while the form is idle, and lists visited-control errors alone', () => {
    const grouped = groupSummary({ kind: 'idle' }, [field('blur')]);
    expect(grouped.byField.patternKey.map((item) => item.message)).toEqual([
      'blur',
    ]);
  });

  it('joins an invalid summary and a result summary, showing a problem listed twice once', () => {
    const submitted = [field('same'), field('only submitted')];
    const blurred = [field('same'), field('only blurred')];
    for (const status of [
      { kind: 'invalid', items: submitted },
      {
        kind: 'result',
        result: { kind: 'conflict', currentVersion: null },
        items: submitted,
      },
    ] as const) {
      expect(
        groupSummary(status, blurred).byField.patternKey.map(
          (item) => item.message,
        ),
      ).toEqual(['same', 'only submitted', 'only blurred']);
    }
  });
});
