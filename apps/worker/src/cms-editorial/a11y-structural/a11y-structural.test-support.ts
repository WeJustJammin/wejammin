import { validateRichTextV1 } from '@wejammin/contracts';

import type {
  AccessibilityCheckerInput,
  BlockNode,
  FieldNode,
} from './input-schema';
import type { ParsedField } from './rules-structure';

/** Fixture builders shared by the cms.a11y.structural tests (never shipped). */

export const REVISION_ID = '11111111-1111-4111-8111-111111111111';
export const FIELD_PREFIX = '00000000-0000-4000-8000-';

/** A lowercase 64-character hex digest derived from a small integer. */
export const hashOf = (seed: number): string =>
  seed.toString(16).padStart(64, '0');

/** A stable lowercase field UUID derived from a small integer. */
export const fieldIdOf = (seed: number): string =>
  `${FIELD_PREFIX}${seed.toString(16).padStart(12, '0')}`;

export type TestLink =
  | { kind: 'https'; href: string }
  | { kind: 'mailto'; address: string }
  | { kind: 'internal'; route: string };

export type TestSpan = {
  text: string;
  marks: ('bold' | 'italic' | 'code')[];
  link?: TestLink;
};

export const span = (
  text: string,
  link?: TestLink,
  marks: TestSpan['marks'] = [],
): TestSpan => (link === undefined ? { text, marks } : { text, marks, link });

export const paragraph = (...spans: TestSpan[]): Record<string, unknown> => ({
  type: 'paragraph',
  spans,
});

export const heading = (
  level: 2 | 3 | 4,
  ...spans: TestSpan[]
): Record<string, unknown> => ({ type: 'heading', level, spans });

export const richText = (
  ...blocks: Record<string, unknown>[]
): Record<string, unknown> => ({ format: 'rich_text.v1', blocks });

/** A paragraph whose only span is the given link. */
export const linkParagraph = (
  text: string,
  link: TestLink,
): Record<string, unknown> => paragraph(span(text, link));

export const httpsLink = (href = 'https://example.org/guide'): TestLink => ({
  kind: 'https',
  href,
});

export const fieldNode = (seed: number, value: unknown): FieldNode => ({
  kind: 'field',
  fieldId: fieldIdOf(seed),
  fieldKind: 'rich_text',
  value,
});

export const blockNode = (
  seed: number,
  overrides: Partial<BlockNode> = {},
): BlockNode => ({
  kind: 'block',
  pointer: `/composition/${seed}`,
  blockKey: 'site.landmark',
  blockVersion: 1,
  recordHash: hashOf(1000 + seed),
  lifecycle: 'supported',
  nameRequired: false,
  accessibleNameFieldDefined: true,
  accessibleName: null,
  ...overrides,
});

export const checkerInput = (
  nodes: AccessibilityCheckerInput['nodes'],
  overrides: Partial<AccessibilityCheckerInput> = {},
): AccessibilityCheckerInput => ({
  revisionId: REVISION_ID,
  revisionNumber: '3',
  locale: 'en-US',
  revisionContentHash: hashOf(1),
  dependencyHash: hashOf(2),
  renderPlanHash: hashOf(3),
  nodes,
  ...overrides,
});

/** Input with one rich-text field holding the given blocks. */
export const singleField = (
  ...blocks: Record<string, unknown>[]
): AccessibilityCheckerInput =>
  checkerInput([fieldNode(1, richText(...blocks))]);

/** A validated rich-text field at a render position (what the structure group hands on). */
export const parsedField = (
  seed: number,
  nodeIndex: number,
  ...blocks: Record<string, unknown>[]
): ParsedField => {
  const verdict = validateRichTextV1(richText(...blocks));
  if (!verdict.ok) throw new Error('fixture rich text is invalid');
  return { nodeIndex, fieldId: fieldIdOf(seed), document: verdict.document };
};

/** 2026-10-08T12:00:00.000Z: the instant every gate test clock starts at. */
export const CLOCK_START = Date.UTC(2026, 9, 8, 12, 0, 0);

/** A clock the test moves by hand. */
export const manualClock = (start = CLOCK_START) => {
  let current = start;
  return {
    now: (): number => current,
    advance: (ms: number): void => {
      current += ms;
    },
  };
};

/** A clock that moves `step` milliseconds on every reading (first reading = `start`). */
export const steppingClock = (step: number, start = CLOCK_START) => {
  let current = start - step;
  return (): number => {
    current += step;
    return current;
  };
};

/** A revision that passes every rule. */
export const cleanInput = (): AccessibilityCheckerInput =>
  singleField(heading(2, span('Plan')), paragraph(span('Read the guide')));

/** A revision with exactly one blocking finding (first heading is level 3). */
export const blockingInput = (): AccessibilityCheckerInput =>
  singleField(heading(3, span('Plan')));
