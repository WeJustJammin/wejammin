/**
 * Zod-free field pointer vocabulary (BE03b "Pointers"): a command addresses a
 * field as `/fields/{stableFieldId}`. The conflict editor reads the stable id
 * back out of a server-validated pointer without shipping zod; `primitives.ts`
 * builds `FieldPointerSchema` from the same prefix.
 */

export const FIELD_POINTER_PREFIX = '/fields/';

/** The stable field id a validated field pointer names. */
export const fieldIdOfPointer = (pointer: string): string =>
  pointer.slice(FIELD_POINTER_PREFIX.length);
