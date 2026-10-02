import { z } from 'zod';

export const CmsUuidSchema = z.uuid();
const cmsVersionPattern = /^[1-9][0-9]{0,18}$/u;
export const CmsVersionSchema = z
  .string()
  .regex(cmsVersionPattern, 'version_invalid')
  .refine(
    (value) =>
      !cmsVersionPattern.test(value) ||
      BigInt(value) <= 9_223_372_036_854_775_807n,
    'version_out_of_range',
  );
export const CmsHashSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/u, 'hash_invalid');
export const CmsInstantSchema = z.iso.datetime({ offset: true });
export const CmsTypeKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]{1,63}$/u, 'type_key_invalid');
export const CmsFieldKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]{1,63}$/u, 'field_key_invalid');
export const CmsBlockKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9._-]{0,95}$/u, 'block_key_invalid');
export const CmsCapabilityKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9._-]{0,127}$/u, 'capability_key_invalid');
export const CmsProjectionKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9._-]{0,127}$/u, 'projection_key_invalid');
export const CmsValidatorKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9._-]{0,127}$/u, 'validator_key_invalid');
export const CmsWorkflowKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9._-]{0,127}$/u, 'workflow_key_invalid');
export const CmsTargetTypeSchema = z
  .string()
  .regex(/^[a-z][a-z0-9._-]{0,95}$/u, 'target_type_invalid');
export const CmsLocaleSchema = z
  .string()
  .regex(/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u, 'locale_invalid');
export const CmsArtifactRefSchema = z
  .string()
  .regex(/^[a-z][a-z0-9._/-]{0,255}$/u, 'artifact_ref_invalid')
  .refine((value) => !value.includes('..'), 'artifact_ref_traversal')
  .refine((value) => !value.includes('//'), 'artifact_ref_empty_segment');
export const CmsRendererRefSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-z][a-z0-9._/-]*$/u, 'renderer_ref_invalid')
  .refine((value) => !value.includes('..'), 'renderer_ref_traversal')
  .refine((value) => !value.includes('//'), 'renderer_ref_empty_segment');
export const CmsReleaseKeyIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9_.-]{1,95}$/u, 'release_key_id_invalid');

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_SHAPE = /^[A-Za-z0-9+/]+={0,2}$/u;

/**
 * Base64 is canonical only when its trailing unused pad bits are zero.  The
 * runtime decoders accept non-canonical spellings, so callers must validate
 * this property before decoding signed evidence.
 */
export const isCanonicalPaddedBase64 = (value: string): boolean => {
  if (value.length === 0 || value.length % 4 !== 0 || !BASE64_SHAPE.test(value))
    return false;
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  if (padding === 0) return true;
  const meaningful = value.charAt(value.length - padding - 1);
  const alphabetIndex = BASE64_ALPHABET.indexOf(meaningful);
  return padding === 2 ? alphabetIndex % 16 === 0 : alphabetIndex % 4 === 0;
};

export const CmsEd25519SignatureSchema = z
  .string()
  .regex(/^[A-Za-z0-9+/]{86}==$/u, 'ed25519_signature_invalid')
  .refine(isCanonicalPaddedBase64, 'ed25519_signature_noncanonical');
export const CmsOpaqueCursorSchema = z.string().min(1).max(512);
export const CmsStrongEtagSchema = z
  .string()
  .regex(/^"[1-9][0-9]{0,18}"$/u, 'etag_invalid')
  .refine((value) => {
    if (!/^"[1-9][0-9]{0,18}"$/u.test(value)) return true;
    return BigInt(value.slice(1, -1)) <= 9_223_372_036_854_775_807n;
  }, 'etag_out_of_range');

export type CmsVersion = z.infer<typeof CmsVersionSchema>;
