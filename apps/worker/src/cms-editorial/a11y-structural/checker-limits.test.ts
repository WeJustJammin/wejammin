import { describe, expect, it } from 'vitest';

import {
  blockNode,
  checkerInput,
  fieldIdOf,
  fieldNode,
  heading,
  httpsLink,
  paragraph,
  richText,
  singleField,
  span,
} from './a11y-structural.test-support';
import { ACCESSIBILITY_FINDINGS_STORED_MAX } from './catalog';
import { runAccessibilityChecker } from './checker';

/** Truncation, privacy and the cooperative stop of the checker. */

const complete = async (
  input: Parameters<typeof runAccessibilityChecker>[0],
) => {
  const result = await runAccessibilityChecker(input);
  if (result.state === 'stopped') throw new Error('unexpected stop');
  return result;
};

const BLOCKS_PER_FIELD = 128;

/** `count` empty level-2 headings spread over fields of 128 blocks (each one heading.empty). */
const emptyHeadings = (count: number) =>
  Array.from({ length: Math.ceil(count / BLOCKS_PER_FIELD) }, (_u, field) =>
    fieldNode(
      field + 1,
      richText(
        ...Array.from(
          {
            length: Math.min(
              BLOCKS_PER_FIELD,
              count - field * BLOCKS_PER_FIELD,
            ),
          },
          () => heading(2, span(' ')),
        ),
      ),
    ),
  );

/** `count` single-link paragraphs whose text is the URL (link.text_is_url warnings). */
const urlLinks = (count: number) =>
  Array.from({ length: Math.ceil(count / BLOCKS_PER_FIELD) }, (_u, field) =>
    fieldNode(
      field + 1,
      richText(
        ...Array.from(
          {
            length: Math.min(
              BLOCKS_PER_FIELD,
              count - field * BLOCKS_PER_FIELD,
            ),
          },
          () => paragraph(span('https://example.org/guide', httpsLink())),
        ),
      ),
    ),
  );

describe('truncation at FINDINGS_STORED_MAX with true counts', () => {
  const MAX = ACCESSIBILITY_FINDINGS_STORED_MAX;

  it('stores exactly 500 findings without truncating', async () => {
    const result = await complete(checkerInput(emptyHeadings(MAX)));
    expect(result.findings).toHaveLength(MAX);
    expect(result).toMatchObject({
      blockingCount: MAX,
      truncated: false,
      state: 'blocked',
    });
  });

  it('keeps the first 500 in render order and the true blocking total', async () => {
    const result = await complete(checkerInput(emptyHeadings(1280)));
    expect(result.findings).toHaveLength(MAX);
    expect(result).toMatchObject({
      blockingCount: 1280,
      warningCount: 0,
      truncated: true,
    });
    expect(result.findings[0]?.location.pointer).toBe(
      `/fields/${fieldIdOf(1)}/blocks/0`,
    );
    expect(result.findings[MAX - 1]?.location.pointer).toBe(
      `/fields/${fieldIdOf(4)}/blocks/115`,
    );
  });

  it('truncates warnings while the run stays healthy, with the true warning total', async () => {
    const result = await complete(checkerInput(urlLinks(640)));
    expect(result.findings).toHaveLength(MAX);
    expect(
      result.findings.every((finding) => finding.severity === 'warning'),
    ).toBe(true);
    expect(result).toMatchObject({
      state: 'healthy',
      blockingCount: 0,
      warningCount: 640,
      truncated: true,
    });
  });

  it('keeps a late blocking finding ahead of 500 earlier warnings', async () => {
    const result = await complete(
      checkerInput([...urlLinks(500), blockNode(1, { nameRequired: true })]),
    );
    expect(result.findings[0]?.ruleId).toBe('landmark.name_missing');
    expect(result).toMatchObject({
      state: 'blocked',
      blockingCount: 1,
      warningCount: 500,
      truncated: true,
    });
  });
});

describe('privacy: a finding never carries author content', () => {
  const CANARY = 'CANARY-AUTHOR-TEXT';
  const URL_CANARY = 'https://canary.example/CANARY-AUTHOR-TEXT';

  it('keeps text, URLs, link text and names out of the serialized run', async () => {
    const link = httpsLink(URL_CANARY);
    const result = await complete(
      checkerInput(
        [
          fieldNode(
            1,
            richText(
              heading(4, span(`${CANARY} heading`)),
              paragraph(span(URL_CANARY, link)),
              paragraph(
                span(' ', {
                  kind: 'mailto',
                  address: 'canary-author-text@example.org',
                }),
              ),
            ),
          ),
          fieldNode(2, {
            format: 'rich_text.v1',
            blocks: [{ type: 'paragraph', spans: CANARY }],
          }),
          blockNode(1, {
            nameRequired: true,
            accessibleName: CANARY.repeat(20),
          }),
          blockNode(2, { accessibleName: CANARY }),
          blockNode(3, { accessibleName: CANARY.toLowerCase() }),
        ],
        { locale: 'de' },
      ),
    );
    const ids = result.findings.map((finding) => finding.ruleId);
    expect(ids).toEqual(
      expect.arrayContaining([
        'heading.first_level',
        'link.text_is_url',
        'link.text_empty',
        'link.text_unchecked_language',
        'structure.rich_text_invalid',
        'landmark.name_missing',
        'landmark.name_duplicate',
      ]),
    );
    const serialized = JSON.stringify(result).toLowerCase();
    expect(serialized).not.toContain('canary-author-text');
    expect(serialized).not.toContain('canary.example');
    expect(serialized).not.toContain('example.org');
  });

  it('exposes only the contract members on a finding', async () => {
    const result = await complete(
      singleField(heading(3, span('Secret title'))),
    );
    expect(Object.keys(result.findings[0] ?? {})).toEqual([
      'ruleId',
      'severity',
      'location',
      'message',
      'humanReview',
    ]);
    expect(Object.keys(result)).toEqual([
      'checkerKey',
      'checkerVersion',
      'state',
      'findings',
      'blockingCount',
      'warningCount',
      'truncated',
      'inputHash',
    ]);
  });
});

describe('cooperative stop between nodes', () => {
  // One field and one block: pass 1 checks twice, then heading, link and landmark once each.
  const input = checkerInput([
    fieldNode(1, richText(heading(2, span('Title')))),
    blockNode(1, { nameRequired: true, accessibleName: 'Nav' }),
  ]);
  const stopAfter = (calls: number) => {
    let seen = 0;
    return { shouldStop: () => (seen += 1) > calls, seen: () => seen };
  };

  it.each([
    ['structure', 0],
    ['heading', 2],
    ['link', 3],
    ['landmark', 4],
  ])(
    'returns an explicit stopped result in the %s group',
    async (_group, calls) => {
      const probe = stopAfter(calls);
      expect(
        await runAccessibilityChecker(input, { shouldStop: probe.shouldStop }),
      ).toEqual({ state: 'stopped' });
    },
  );

  it('completes when the stop is never requested', async () => {
    const probe = stopAfter(Number.POSITIVE_INFINITY);
    const result = await runAccessibilityChecker(input, {
      shouldStop: probe.shouldStop,
    });
    expect(result.state).toBe('healthy');
    expect(probe.seen()).toBe(5);
  });

  it('never asks to stop when there is nothing to visit', async () => {
    const probe = stopAfter(0);
    const result = await runAccessibilityChecker(checkerInput([]), {
      shouldStop: probe.shouldStop,
    });
    expect(result.state).toBe('healthy');
    expect(probe.seen()).toBe(0);
  });

  it('runs without options', async () => {
    expect((await runAccessibilityChecker(input)).state).toBe('healthy');
    expect((await runAccessibilityChecker(input, {})).state).toBe('healthy');
  });
});
