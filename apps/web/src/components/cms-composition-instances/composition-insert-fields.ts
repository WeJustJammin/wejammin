import type { SelectorItem } from './composition-types';

/*
 * The instance-insert form's fields as `PatternInstanceRequest` (FE03 1114; BE03c 175; DEC-175, DEC-186). The browser
 * repeats the contract's cheap structural bounds so a bad value is named at its field before any request; whether an
 * override key names a node of the pinned tree is the server's check.
 */
export type InsertField = 'pattern' | 'linkMode' | 'slotPath' | 'overrides';
export interface InsertIssue {
  readonly field: InsertField;
  readonly message: string;
}

export interface PlacementFields {
  readonly item: SelectorItem | null;
  readonly linkMode: 'linked' | 'detached' | null;
  readonly slotPath: string;
  readonly overridesText: string;
}

const MAX_SLOT_PATH = 512;
const MAX_OVERRIDE_KEYS = 64;
const MAX_OVERRIDE_DEPTH = 8;
const NODE_PATH = /^\/[a-z][a-z0-9_-]{0,63}(?:\/[a-z][a-z0-9_-]{0,63})*$/u;

export const INSERT_MESSAGES = {
  pattern: 'Choose a pattern to insert.',
  linkMode: 'Choose whether the placement is linked or detached.',
  slotPath:
    'Enter a slot path that starts with a slash, is at most 512 characters and has no control characters.',
  overridesJson: 'Overrides must be a JSON object.',
  overridesKey:
    'Every override key must be a node path such as /hero or /hero/title.',
  overridesLimit: 'Overrides allow at most 64 keys and 8 levels of nesting.',
} as const;

const hasSafeSlotPath = (value: string): boolean =>
  value.length >= 1 &&
  value.length <= MAX_SLOT_PATH &&
  value.startsWith('/') &&
  [...value].every((character) => character.charCodeAt(0) >= 32);

const depthOf = (value: unknown): number =>
  typeof value !== 'object' || value === null
    ? 0
    : 1 +
      Math.max(
        0,
        ...(Array.isArray(value) ? value : Object.values(value)).map(depthOf),
      );

/** The parsed overrides, or the issue that names why the text is not usable. */
export const parseOverrides = (
  text: string,
):
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; message: string } => {
  if (text.trim() === '') return { ok: true, value: {} };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, message: INSERT_MESSAGES.overridesJson };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
    return { ok: false, message: INSERT_MESSAGES.overridesJson };
  const keys = Object.keys(parsed);
  if (keys.some((key) => key.length > MAX_SLOT_PATH || !NODE_PATH.test(key)))
    return { ok: false, message: INSERT_MESSAGES.overridesKey };
  if (keys.length > MAX_OVERRIDE_KEYS || depthOf(parsed) > MAX_OVERRIDE_DEPTH)
    return { ok: false, message: INSERT_MESSAGES.overridesLimit };
  return { ok: true, value: parsed as Record<string, unknown> };
};

export const insertIssues = (fields: PlacementFields): InsertIssue[] => {
  const issues: InsertIssue[] = [];
  if (fields.item === null)
    issues.push({ field: 'pattern', message: INSERT_MESSAGES.pattern });
  if (fields.linkMode === null)
    issues.push({ field: 'linkMode', message: INSERT_MESSAGES.linkMode });
  if (!hasSafeSlotPath(fields.slotPath))
    issues.push({ field: 'slotPath', message: INSERT_MESSAGES.slotPath });
  const overrides = parseOverrides(fields.overridesText);
  if (!overrides.ok)
    issues.push({ field: 'overrides', message: overrides.message });
  return issues;
};

/** The one field a server violation pointer names, so the refusal lands where the person can fix it. */
export const fieldOfPointer = (path: string): InsertField | null =>
  path === '/slotPath'
    ? 'slotPath'
    : path === '/overrides' || path.startsWith('/overrides/')
      ? 'overrides'
      : path === '/patternId' || path === '/patternVersion'
        ? 'pattern'
        : null;
