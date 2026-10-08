import { z } from 'zod';

import { CmsVersionSchema } from './primitives.ts';

/**
 * BE03a code-owned protected validator registry (DEC-112, DEC-146).
 *
 * `rich_text.v1` version 1 is the ONLY member, and it may be paired only with a
 * `rich_text` field. A new member ships only as code plus a forward migration,
 * so a field-level `validatorKey`/`validatorVersion` and a manifest or version
 * set `validatorRefs` entry must resolve to a registered member; a free-form
 * key is refused. This mirrors `platform_private.cms_protected_validator_ref`
 * (the registry membership), the `rich_text.v1` kind pairing in
 * `platform_private.cms_valid_field_input`, and, once published, the
 * descriptor registry `platform_private.cms_protected_validator_descriptor`.
 */
export const CMS_PROTECTED_VALIDATORS = {
  'rich_text.v1': { version: 1, kinds: ['rich_text'] },
} as const;

export type ProtectedValidatorKey = keyof typeof CMS_PROTECTED_VALIDATORS;

export const CMS_PROTECTED_VALIDATOR_KEYS = Object.keys(
  CMS_PROTECTED_VALIDATORS,
) as readonly ProtectedValidatorKey[];

export const ProtectedValidatorKeySchema = z.enum(['rich_text.v1']);

const registeredVersion = (key: ProtectedValidatorKey): string =>
  String(CMS_PROTECTED_VALIDATORS[key].version);

/** True when (key, version) names a registered protected validator member. */
export const isProtectedValidatorRef = (
  key: unknown,
  version: unknown,
): boolean =>
  typeof key === 'string' &&
  Object.hasOwn(CMS_PROTECTED_VALIDATORS, key) &&
  (typeof version === 'string' || typeof version === 'number') &&
  String(version) === registeredVersion(key as ProtectedValidatorKey);

/**
 * True when a field of `kind` may carry the validator pair: no pair at all, or
 * a registered protected member whose registered kinds include `kind`.
 */
export const isProtectedValidatorPairing = (
  kind: string,
  key: string | null,
  version: string | null,
): boolean => {
  if (key === null && version === null) return true;
  if (key === null || version === null) return false;
  if (!isProtectedValidatorRef(key, version)) return false;
  const kinds: readonly string[] =
    CMS_PROTECTED_VALIDATORS[key as ProtectedValidatorKey].kinds;
  return kinds.includes(kind);
};

/**
 * DEC-146 canonical immutable `rich_text.v1`@1 grammar descriptor. It pins the
 * grammar the code-owned validators implement (`RichTextV1Schema` here and
 * `platform_private.cms_rich_text_v1_valid` in PostgreSQL): any change to the
 * grammar is a new validator version, never an edit of this descriptor. Its JCS
 * (RFC 8785) SHA-256 is the validator's artifact hash, frozen with its artifact
 * reference into every compiled schema artifact that uses the grammar. ASCII
 * strings, booleans and integers only, so the JCS form is key-sorted compact
 * JSON and identical in every implementation. The SQL registry
 * `platform_private.cms_protected_validator_descriptor` is the mirror; both
 * hold the same hash, pinned by tests on each side.
 */
export const RICH_TEXT_V1_DESCRIPTOR = {
  format: 'rich_text.v1',
  grammarVersion: 1,
  blockTypes: ['heading', 'list_item', 'paragraph', 'quote'],
  headingLevels: [2, 3, 4],
  listKinds: ['bulleted', 'numbered'],
  listDepths: [1, 2, 3],
  marks: ['bold', 'italic', 'code'],
  linkKinds: ['https', 'internal', 'mailto'],
  bounds: {
    blocks: 128,
    spansPerBlock: 128,
    spanTextCharacters: 10_000,
    marksPerSpan: 3,
    httpsHrefCharacters: 2048,
    mailtoAddressMinCharacters: 3,
    mailtoAddressMaxCharacters: 254,
    internalRouteCharacters: 2048,
    containerDepth: 7,
  },
  canonical: {
    normalization: 'NFC',
    uniqueOrderedMarks: true,
    mergedAdjacentSpans: true,
    linkAbsentNotNull: true,
    allowedControlCharacters: ['U+000A'],
  },
  unit: 'unicode_character',
} as const;

/** The artifact reference of the frozen `rich_text.v1`@1 grammar descriptor. */
export const RICH_TEXT_V1_ARTIFACT_REF = 'cms/validators/rich_text.v1/v1';

/** JCS SHA-256 of {@link RICH_TEXT_V1_DESCRIPTOR}: the validator's artifact hash. */
export const RICH_TEXT_V1_ARTIFACT_HASH =
  '4fe960667baa6d616e9fe00527d3e1a1d5740013b37f548eec74e20a244f2d15';

/**
 * One frozen validator entry exactly as a compiled artifact carries it in
 * `editor_manifest.validators`, and as the SQL registry returns it: the
 * registered key, its version as a JSON number, the artifact reference and the
 * descriptor hash.
 */
export const FrozenValidatorEntrySchema = z
  .strictObject({
    key: ProtectedValidatorKeySchema,
    version: z.number().int().min(1),
    artifactRef: z.string().min(1).max(256),
    artifactHash: z.string().regex(/^[a-f0-9]{64}$/u),
  })
  .readonly();

export type FrozenValidatorEntry = z.infer<typeof FrozenValidatorEntrySchema>;

/** The registry entry for a protected validator, or null when unregistered. */
export const protectedValidatorDescriptor = (
  key: unknown,
  version: unknown,
): FrozenValidatorEntry | null =>
  key === 'rich_text.v1' && isProtectedValidatorRef(key, version)
    ? {
        key: 'rich_text.v1',
        version: CMS_PROTECTED_VALIDATORS['rich_text.v1'].version,
        artifactRef: RICH_TEXT_V1_ARTIFACT_REF,
        artifactHash: RICH_TEXT_V1_ARTIFACT_HASH,
      }
    : null;

type DefinitionField = Readonly<{
  kind: string;
  validatorKey?: string | null | undefined;
  constraints?: unknown;
}>;

/** True when a field's values are validated by the rich_text.v1 grammar. */
export const fieldUsesRichTextGrammar = (field: DefinitionField): boolean => {
  if (field.kind === 'rich_text' || field.validatorKey === 'rich_text.v1')
    return true;
  if (field.kind !== 'object') return false;
  const constraints = field.constraints as
    | { objectStructure?: { properties?: readonly { kind?: string }[] } }
    | null
    | undefined;
  return (
    constraints?.objectStructure?.properties?.some(
      (property) => property.kind === 'rich_text',
    ) === true
  );
};

/**
 * The protected validators a definition's compiled artifact must freeze, in
 * registry order: the `rich_text.v1` descriptor once when any field uses the
 * grammar (a rich_text field, an explicit pair, or an object field with a
 * rich_text property), otherwise none. Mirrors
 * `platform_private.cms_required_protected_validators`.
 */
export const requiredProtectedValidators = (
  fields: readonly DefinitionField[],
): readonly FrozenValidatorEntry[] =>
  fields.some(fieldUsesRichTextGrammar)
    ? [protectedValidatorDescriptor('rich_text.v1', 1) as FrozenValidatorEntry]
    : [];

/**
 * One protected validator reference as carried by a dependency manifest or a
 * frozen version set: a registered key at its registered version.
 */
export const ProtectedValidatorEvidenceSchema = z
  .strictObject({
    key: ProtectedValidatorKeySchema,
    version: CmsVersionSchema,
  })
  .refine(
    (value) => isProtectedValidatorRef(value.key, value.version),
    'validator_ref_must_be_registered_protected_member',
  )
  .readonly();

export type ProtectedValidatorEvidence = z.infer<
  typeof ProtectedValidatorEvidenceSchema
>;
