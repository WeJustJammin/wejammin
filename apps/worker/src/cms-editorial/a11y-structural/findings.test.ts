import { describe, expect, it } from 'vitest';

import {
  ACCESSIBILITY_FINDINGS_STORED_MAX,
  catalogEntry,
  type AccessibilityRuleId,
} from './catalog';
import {
  createFindingCollector,
  type FindingLocation,
  type RenderPosition,
} from './findings';

const FIELD = '00000000-0000-4000-8000-000000000001';

const fieldLocation = (path: string): FindingLocation => ({
  kind: 'field',
  pointer: `/fields/${FIELD}${path}`,
  fieldId: FIELD,
  blockPath: path === '' ? null : path,
});

type Entry = [AccessibilityRuleId, string, RenderPosition];

const collect = (entries: readonly Entry[]) => {
  const collector = createFindingCollector();
  for (const [ruleId, path, position] of entries)
    collector.add(ruleId, fieldLocation(path), position);
  return collector.result();
};

describe('finding collector: shape', () => {
  it('builds a finding from the catalog and the constant human review', () => {
    const { findings } = collect([['heading.empty', '/blocks/0', [0, 0, -1]]]);
    expect(findings).toEqual([
      {
        ruleId: 'heading.empty',
        severity: 'blocking',
        location: {
          kind: 'field',
          pointer: `/fields/${FIELD}/blocks/0`,
          fieldId: FIELD,
          blockPath: '/blocks/0',
        },
        message: catalogEntry('heading.empty').message,
        humanReview: 'required',
      },
    ]);
    expect(Object.keys(findings[0] ?? {})).toEqual([
      'ruleId',
      'severity',
      'location',
      'message',
      'humanReview',
    ]);
  });

  it('counts blocking and warning findings separately', () => {
    const run = collect([
      ['heading.empty', '/blocks/0', [0, 0, -1]],
      ['link.text_is_url', '/blocks/1/spans/0', [0, 1, 0]],
      ['link.text_generic', '/blocks/1/spans/1', [0, 1, 1]],
    ]);
    expect(run).toMatchObject({
      blockingCount: 2,
      warningCount: 1,
      truncated: false,
    });
  });

  it('reports an empty result', () => {
    expect(collect([])).toEqual({
      findings: [],
      blockingCount: 0,
      warningCount: 0,
      truncated: false,
    });
  });
});

describe('finding collector: deterministic order', () => {
  it('sorts blocking first, then render order, then ruleId, then pointer', () => {
    const { findings } = collect([
      ['link.text_is_url', '/blocks/0/spans/0', [0, 0, 0]],
      ['heading.empty', '/blocks/10', [2, 10, -1]],
      ['heading.empty', '/blocks/2', [2, 2, -1]],
      ['heading.empty', '/blocks/1', [10, 1, -1]],
      ['link.text_generic', '/blocks/3/spans/0', [2, 3, 0]],
      ['link.text_empty', '/blocks/3/spans/0', [2, 3, 0]],
      ['link.text_empty', '/blocks/3/spans/0', [2, 3, 0]],
    ]);
    expect(findings.map((f) => `${f.ruleId} ${f.location.blockPath}`)).toEqual([
      'heading.empty /blocks/2',
      'link.text_empty /blocks/3/spans/0',
      'link.text_empty /blocks/3/spans/0',
      'link.text_generic /blocks/3/spans/0',
      'heading.empty /blocks/10',
      'heading.empty /blocks/1',
      'link.text_is_url /blocks/0/spans/0',
    ]);
  });

  it('breaks an equal position and rule by pointer', () => {
    const { findings } = collect([
      ['heading.empty', '/blocks/9', [0, 0, -1]],
      ['heading.empty', '/blocks/1', [0, 0, -1]],
    ]);
    expect(findings.map((f) => f.location.blockPath)).toEqual([
      '/blocks/1',
      '/blocks/9',
    ]);
  });

  it('orders by span inside one block', () => {
    const { findings } = collect([
      ['link.text_empty', '/blocks/1/spans/4', [0, 1, 4]],
      ['link.text_empty', '/blocks/1/spans/3', [0, 1, 3]],
    ]);
    expect(findings.map((f) => f.location.blockPath)).toEqual([
      '/blocks/1/spans/3',
      '/blocks/1/spans/4',
    ]);
  });

  it('is independent of the insertion order', () => {
    const entries: Entry[] = [
      ['heading.empty', '/blocks/0', [0, 0, -1]],
      ['heading.first_level', '/blocks/0', [0, 0, -1]],
      ['link.text_is_url', '/blocks/1/spans/0', [0, 1, 0]],
      ['landmark.name_missing', '', [3, -1, -1]],
      ['structure.block_unregistered', '', [4, -1, -1]],
    ];
    expect(collect([...entries].reverse())).toEqual(collect(entries));
  });
});

describe('finding collector: FINDINGS_STORED_MAX', () => {
  const MAX = ACCESSIBILITY_FINDINGS_STORED_MAX;
  const heading = (index: number): Entry => [
    'heading.empty',
    `/blocks/${index}`,
    [0, index, -1],
  ];

  it('stores exactly the maximum without truncating', () => {
    const run = collect(
      Array.from({ length: MAX }, (_u, index) => heading(index)),
    );
    expect(run.findings).toHaveLength(MAX);
    expect(run.truncated).toBe(false);
    expect(run.blockingCount).toBe(MAX);
  });

  it('stores the first 500 in sorted order and keeps true totals past compaction', () => {
    const total = MAX * 5 + 7;
    const entries = Array.from({ length: total }, (_u, index) =>
      heading(index),
    );
    const run = collect([...entries].reverse());
    expect(run.findings).toHaveLength(MAX);
    expect(run.truncated).toBe(true);
    expect(run.blockingCount).toBe(total);
    expect(run.warningCount).toBe(0);
    expect(run.findings.map((f) => f.location.blockPath)).toEqual(
      Array.from({ length: MAX }, (_u, index) => `/blocks/${index}`),
    );
  });

  it('keeps a blocking finding ahead of warnings when truncating', () => {
    const warnings = Array.from({ length: MAX }, (_u, index): Entry => [
      'link.text_is_url',
      `/blocks/${index}/spans/0`,
      [0, index, 0],
    ]);
    const run = collect([
      ...warnings,
      ['landmark.name_missing', '', [9, -1, -1]],
    ]);
    expect(run.findings).toHaveLength(MAX);
    expect(run.findings[0]?.ruleId).toBe('landmark.name_missing');
    expect(run).toMatchObject({
      blockingCount: 1,
      warningCount: MAX,
      truncated: true,
    });
  });
});
