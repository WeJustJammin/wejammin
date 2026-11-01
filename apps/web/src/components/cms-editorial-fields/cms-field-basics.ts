import type { JsonValue } from '@wejammin/contracts';

/*
 * The small, validation-free helpers every field editor needs when it first renders: the JSON object guard, the empty
 * rich text document and the two datetime-local conversions. They live apart from the value validators
 * (`cms-field-value*.ts`) because the validators are needed only after a save was refused or a command is sent, so an
 * island that imports these helpers does not carry the validators in its cold load (FE03 "Performance budgets and
 * loading strategy"; P2-S11-AC-106). The validator modules re-export these names, so existing importers keep working.
 */

/** A JSON object (not an array, not null), as a narrowing guard. */
export const isJsonRecord = (
  value: unknown,
): value is Readonly<Record<string, JsonValue>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The document the rich text editor starts from when a field has no value. */
export const CMS_EMPTY_RICH_TEXT: JsonValue = {
  format: 'rich_text.v1',
  blocks: [{ type: 'paragraph', spans: [] }],
};

const pad = (value: number, width = 2): string =>
  String(value).padStart(width, '0');

/**
 * The `datetime-local` control shows the instant in the author's local time.
 * An unparsable stored value renders as an empty control, never as a guess.
 */
export const cmsDatetimeToLocalInput = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

/**
 * A control value is local wall-clock time; the stored value is the UTC
 * instant (`Z`), which satisfies the datetime encoding and never drifts.
 */
export const cmsLocalInputToDatetime = (local: string): string | null => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/u.test(local)) return null;
  const date = new Date(local);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().replace('.000Z', 'Z');
};
