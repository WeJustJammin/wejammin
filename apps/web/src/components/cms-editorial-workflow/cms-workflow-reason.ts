import {
  DecisionReasonSchema,
  ReviewAssignmentReasonSchema,
} from '@wejammin/contracts';

/** BE03b decision reason bound: 1-2000 Unicode characters (code points). */
export const DECISION_REASON_MAX = 2000;

export const countCharacters = (text: string): number =>
  Array.from(text).length;

/** The schema's refusal tokens in the order the person should fix them. */
const REASON_MESSAGES: readonly (readonly [string, string])[] = [
  ['reason_too_long', 'Use at most 2000 characters.'],
  [
    'reason_must_be_nfc',
    'Use the composed form of accented letters (Unicode NFC).',
  ],
  [
    'reason_control_or_bidi_characters',
    'Remove control and text-direction characters.',
  ],
  ['reason_unsafe_characters', 'Remove the characters < > { and }.'],
];

/**
 * The inline refusal of a decision reason, from the generated schema itself, so
 * the browser refuses exactly what the server would (it never sends it). Null
 * when the reason is valid; an empty reason is the remaining failure.
 */
export const validateDecisionReason = (reason: string): string | null => {
  const parsed = DecisionReasonSchema.safeParse(reason);
  if (parsed.success) return null;
  const tokens = new Set(parsed.error.issues.map((issue) => issue.message));
  const found = REASON_MESSAGES.find(([token]) => tokens.has(token));
  return found === undefined ? 'Enter a reason.' : found[1];
};

/** BE03b assignment reason bound: optional, 1-256 Unicode characters. */
export const ASSIGNMENT_REASON_MAX = 256;

/** The inline refusal of an optional assignment reason; an empty one is simply omitted. */
export const validateAssignmentReason = (reason: string): string | null => {
  if (reason === '') return null;
  const parsed = ReviewAssignmentReasonSchema.safeParse(reason);
  if (parsed.success) return null;
  return parsed.error.issues.some(
    (issue) => issue.message === 'reason_too_long',
  )
    ? 'Use at most 256 characters.'
    : 'Use the composed form of accented letters (Unicode NFC).';
};
