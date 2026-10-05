/**
 * Zod-free syntax rules of the content schema registry request fields.
 *
 * The generated request schemas build their `regex` checks from these
 * constants, and the browser registry forms use the same constants for their
 * blur feedback (FE03 form contract: syntax and safe local constraints on
 * blur, the server stays authoritative). Sharing the constant means the form
 * and the contract cannot drift; `field-rules.test.ts` also proves each rule
 * agrees with its schema over a corpus.
 */

export const CMS_TYPE_KEY_PATTERN = /^[a-z][a-z0-9_]{1,63}$/u;
export const CMS_FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{1,63}$/u;
export const CMS_BLOCK_KEY_PATTERN = /^[a-z][a-z0-9._-]{0,95}$/u;
export const CMS_CAPABILITY_KEY_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;
export const CMS_PROJECTION_KEY_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;
export const CMS_VALIDATOR_KEY_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;
export const CMS_WORKFLOW_KEY_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;
export const CMS_TARGET_TYPE_PATTERN = /^[a-z][a-z0-9._-]{0,95}$/u;
export const CMS_HASH_PATTERN = /^[a-f0-9]{64}$/u;
export const CMS_VERSION_PATTERN = /^[1-9][0-9]{0,18}$/u;
export const CMS_MAX_VERSION = 9_223_372_036_854_775_807n;

/** A decimal version string within the signed 64-bit range. */
export const isCmsVersion = (value: string): boolean =>
  CMS_VERSION_PATTERN.test(value) && BigInt(value) <= CMS_MAX_VERSION;

/** BE03a: a label is 2 to 120 Unicode characters, counted after NFC. */
export const CMS_LABEL_MIN_CHARACTERS = 2;
export const CMS_LABEL_MAX_CHARACTERS = 120;

/** The authoritative label length: trimmed, NFC, counted in characters. */
export const cmsLabelCharacters = (value: string): number =>
  Array.from(value.normalize('NFC').trim()).length;

/**
 * Raw text bound before normalization. NFC never expands a string past four
 * times its length (UTF-16 units, so eight units per character at worst), so
 * this only rejects hostile payloads cheaply.
 */
export const CMS_LABEL_RAW_MAX_UNITS = CMS_LABEL_MAX_CHARACTERS * 8;

export const isCmsLabel = (value: string): boolean => {
  if (
    value.length < CMS_LABEL_MIN_CHARACTERS ||
    value.length > CMS_LABEL_RAW_MAX_UNITS
  )
    return false;
  const characters = cmsLabelCharacters(value);
  return (
    characters >= CMS_LABEL_MIN_CHARACTERS &&
    characters <= CMS_LABEL_MAX_CHARACTERS
  );
};

/** RFC 9562 UUID text as `z.uuid()` accepts it (versions 1 to 8, plus nil and max). */
export const CMS_UUID_PATTERN =
  /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/u;
