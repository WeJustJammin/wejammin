import { z } from 'zod';

import {
  JSON_VALUE_MAX_BYTES,
  JSON_VALUE_MAX_DEPTH,
  JsonValueSchema,
  type JsonValue,
} from '../api-error.ts';
import { JsonPointerSchema, cmsEditorialJsonDepth } from './primitives.ts';

const conflictChoiceValueBytes = (value: JsonValue): number =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength;

/**
 * BE03b CMS-03B-02 explicit choice value.  The shared envelope helper already
 * refuses a value deeper than 8 levels, wider than 128 keys or items, or larger
 * than 256 KiB, but this named contract declares the editorial bound here so the
 * limit is visible from this directory instead of being inherited silently, and
 * a later loosening of the shared helper cannot widen it unnoticed.
 */
export const ConflictChoiceValueSchema = JsonValueSchema.refine(
  (value) => cmsEditorialJsonDepth(value) <= JSON_VALUE_MAX_DEPTH,
  'conflict_choice_value_max_depth',
).refine(
  (value) => conflictChoiceValueBytes(value) <= JSON_VALUE_MAX_BYTES,
  'conflict_choice_value_max_bytes',
);

/**
 * BE03b ConflictChoice: one explicit same-field decision.  The caller names
 * base, theirs, yours, or an explicit replacement; the server never infers a
 * winning side.  value is accepted only for explicit, so a named choice can
 * never smuggle an unvalidated replacement alongside a source the server is
 * expected to trust -- a named choice that carries a value is rejected rather
 * than silently ignored.
 */
export const ConflictChoiceSchema = z
  .strictObject({
    path: JsonPointerSchema,
    choice: z.enum(['base', 'theirs', 'yours', 'explicit']),
    value: ConflictChoiceValueSchema.optional(),
  })
  .superRefine((choice, context) => {
    if (choice.choice === 'explicit' && choice.value === undefined)
      context.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'explicit_choice_requires_value',
      });
    if (choice.choice !== 'explicit' && choice.value !== undefined)
      context.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'named_choice_forbids_value',
      });
  })
  .readonly();

export type ConflictChoice = z.infer<typeof ConflictChoiceSchema>;
export type ConflictChoiceValue = z.infer<typeof ConflictChoiceValueSchema>;
